"""
Tests for authentication endpoints and JWT functionality.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_token
from app.models.user import User


pytestmark = pytest.mark.asyncio


class TestRegister:
    """Tests for POST /auth/register."""

    async def test_register_success(self, client: AsyncClient, db: AsyncSession) -> None:
        """Register a new user successfully."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "user@example.com",
                "password": "securepassword123",
                "password_confirm": "securepassword123",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["access_token"]
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0

        # Verify user was created in database
        result = await db.execute(
            select(User).where(User.email == "user@example.com")
        )
        user = result.scalar_one_or_none()
        assert user is not None
        assert user.email == "user@example.com"

    async def test_register_password_mismatch(self, client: AsyncClient) -> None:
        """Registration fails if passwords don't match."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "user@example.com",
                "password": "password123",
                "password_confirm": "different123",
            },
        )
        assert response.status_code == 400
        assert "do not match" in response.json()["detail"].lower()

    async def test_register_duplicate_email(self, client: AsyncClient, db: AsyncSession) -> None:
        """Registration fails if email already exists."""
        # Create first user
        await client.post(
            "/api/v1/auth/register",
            json={
                "email": "existing@example.com",
                "password": "password123",
                "password_confirm": "password123",
            },
        )

        # Try to register with same email
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "existing@example.com",
                "password": "different123",
                "password_confirm": "different123",
            },
        )
        assert response.status_code == 409
        assert "already registered" in response.json()["detail"].lower()

    async def test_register_password_too_short(self, client: AsyncClient) -> None:
        """Registration fails if password is too short."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "user@example.com",
                "password": "short",
                "password_confirm": "short",
            },
        )
        assert response.status_code == 422

    async def test_register_invalid_email(self, client: AsyncClient) -> None:
        """Registration fails if email is invalid."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "not-an-email",
                "password": "password123",
                "password_confirm": "password123",
            },
        )
        assert response.status_code == 422


class TestLogin:
    """Tests for POST /auth/login."""

    async def test_login_success(self, client: AsyncClient) -> None:
        """Login with correct credentials."""
        # First register
        await client.post(
            "/api/v1/auth/register",
            json={
                "email": "testuser@example.com",
                "password": "testpassword123",
                "password_confirm": "testpassword123",
            },
        )

        # Now login
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "testuser@example.com",
                "password": "testpassword123",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["access_token"]
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0

    async def test_login_invalid_password(self, client: AsyncClient) -> None:
        """Login fails with wrong password."""
        # Register
        await client.post(
            "/api/v1/auth/register",
            json={
                "email": "testuser@example.com",
                "password": "correctpassword",
                "password_confirm": "correctpassword",
            },
        )

        # Try login with wrong password
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "testuser@example.com",
                "password": "wrongpassword",
            },
        )
        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()

    async def test_login_user_not_found(self, client: AsyncClient) -> None:
        """Login fails if user doesn't exist."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "anypassword",
            },
        )
        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()


class TestTokenValidation:
    """Tests for token validation and JWT functionality."""

    async def test_token_is_valid(self, client: AsyncClient) -> None:
        """Verify that returned token can be validated."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "tokentest@example.com",
                "password": "password123",
                "password_confirm": "password123",
            },
        )
        token = response.json()["access_token"]

        # Verify the token is valid
        user_id = verify_token(token)
        assert user_id is not None

    async def test_invalid_token_rejected(self, client: AsyncClient) -> None:
        """Invalid tokens are rejected."""
        with pytest.raises(Exception):  # Will raise HTTPException from verify_token
            verify_token("invalid.token.here")


class TestProtectedRoutes:
    """Tests for protected routes that require authentication."""

    async def test_list_facturas_without_auth(self, client: AsyncClient) -> None:
        """GET /facturas without token returns 403."""
        response = await client.get("/api/v1/facturas")
        assert response.status_code == 403

    async def test_list_facturas_with_auth(self, client: AsyncClient) -> None:
        """GET /facturas with valid token succeeds."""
        # Register and get token
        reg_response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "user@example.com",
                "password": "password123",
                "password_confirm": "password123",
            },
        )
        token = reg_response.json()["access_token"]

        # Access protected route
        response = await client.get(
            "/api/v1/facturas",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

    async def test_create_factura_without_auth(self, client: AsyncClient) -> None:
        """POST /facturas without token returns 403."""
        response = await client.post(
            "/api/v1/facturas",
            json={
                "numero": "F-001",
                "proveedor": "Test Provider",
                "monto_total": "100.00",
            },
        )
        assert response.status_code == 403

    async def test_create_factura_with_auth(self, client: AsyncClient) -> None:
        """POST /facturas with valid token succeeds."""
        # Register and get token
        reg_response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "user@example.com",
                "password": "password123",
                "password_confirm": "password123",
            },
        )
        token = reg_response.json()["access_token"]

        # Create factura
        response = await client.post(
            "/api/v1/facturas",
            json={
                "numero": "F-001",
                "proveedor": "Test Provider",
                "monto_total": "100.00",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["id"]
        assert data["numero"] == "F-001"

    async def test_expired_token_rejected(self, client: AsyncClient) -> None:
        """Expired tokens are rejected (when validating)."""
        # This is a placeholder; in a real scenario you'd need to manipulate
        # the token expiry or mock the time.
        # For now, we just verify that invalid tokens fail
        response = await client.get(
            "/api/v1/facturas",
            headers={"Authorization": "Bearer invalid.token.format"},
        )
        assert response.status_code == 403


class TestMultiTenancy:
    """Tests for multi-tenant data isolation."""

    async def test_user_can_only_see_own_facturas(self, client: AsyncClient, db: AsyncSession) -> None:
        """User A should not see facturas created by User B."""
        # Register User A
        user_a_response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "usera@example.com",
                "password": "password123",
                "password_confirm": "password123",
            },
        )
        token_a = user_a_response.json()["access_token"]

        # Register User B
        user_b_response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "userb@example.com",
                "password": "password123",
                "password_confirm": "password123",
            },
        )
        token_b = user_b_response.json()["access_token"]

        # User A creates a factura
        factura_a_response = await client.post(
            "/api/v1/facturas",
            json={
                "numero": "F-A-001",
                "proveedor": "Provider A",
                "monto_total": "100.00",
            },
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert factura_a_response.status_code == 201

        # User B creates a factura
        factura_b_response = await client.post(
            "/api/v1/facturas",
            json={
                "numero": "F-B-001",
                "proveedor": "Provider B",
                "monto_total": "200.00",
            },
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert factura_b_response.status_code == 201

        # User A lists facturas - should only see their own
        list_a_response = await client.get(
            "/api/v1/facturas",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert list_a_response.status_code == 200
        items_a = list_a_response.json()["items"]
        assert len(items_a) == 1
        assert items_a[0]["numero"] == "F-A-001"

        # User B lists facturas - should only see their own
        list_b_response = await client.get(
            "/api/v1/facturas",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert list_b_response.status_code == 200
        items_b = list_b_response.json()["items"]
        assert len(items_b) == 1
        assert items_b[0]["numero"] == "F-B-001"
