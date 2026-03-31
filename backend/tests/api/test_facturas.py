"""Test facturas endpoints."""

import uuid
from decimal import Decimal

import pytest
from fastapi import status
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.factura import Factura


@pytest.mark.asyncio
async def test_crear_factura_success(async_client: AsyncClient, test_db):
    """Create a valid factura and verify it's returned."""
    payload = {
        "numero": "INV-001",
        "proveedor": "Acme Corp",
        "monto_total": 1500.50,
        "moneda": "PEN",
        "descripcion": "Servicios profesionales",
    }

    response = await async_client.post("/api/v1/facturas/", json=payload)
    assert response.status_code == status.HTTP_201_CREATED

    data = response.json()
    assert data["numero"] == "INV-001"
    assert data["proveedor"] == "Acme Corp"
    assert data["estado"] == "pendiente"
    assert "id" in data
    assert uuid.UUID(data["id"])  # Verify it's a valid UUID


@pytest.mark.asyncio
async def test_crear_factura_invalid_payload(async_client: AsyncClient, test_db):
    """Reject factura with invalid payload (missing required field)."""
    payload = {
        "numero": "INV-002",
        # proveedor is required but missing
        "monto_total": 1500.50,
    }

    response = await async_client.post("/api/v1/facturas/", json=payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.asyncio
async def test_crear_factura_duplicate_numero(async_client: AsyncClient, test_db: AsyncSession):
    """Reject factura with duplicate numero."""
    payload = {
        "numero": "INV-UNIQUE",
        "proveedor": "Test Provider",
        "monto_total": 1000.00,
    }

    # First creation should succeed
    response1 = await async_client.post("/api/v1/facturas/", json=payload)
    assert response1.status_code == status.HTTP_201_CREATED

    # Second creation with same numero should fail
    response2 = await async_client.post("/api/v1/facturas/", json=payload)
    assert response2.status_code == status.HTTP_409_CONFLICT
    assert "Ya existe" in response2.json()["detail"]


@pytest.mark.asyncio
async def test_obtener_factura_success(async_client: AsyncClient, test_db: AsyncSession):
    """Retrieve a factura by ID."""
    # Create a factura first
    payload = {
        "numero": "INV-GET-001",
        "proveedor": "Test Provider",
        "monto_total": 500.00,
    }

    create_response = await async_client.post("/api/v1/facturas/", json=payload)
    factura_id = create_response.json()["id"]

    # Retrieve it
    response = await async_client.get(f"/api/v1/facturas/{factura_id}")
    assert response.status_code == status.HTTP_200_OK

    data = response.json()
    assert data["id"] == factura_id
    assert data["numero"] == "INV-GET-001"


@pytest.mark.asyncio
async def test_obtener_factura_not_found(async_client: AsyncClient, test_db):
    """Retrieve non-existent factura returns 404."""
    fake_id = uuid.uuid4()
    response = await async_client.get(f"/api/v1/facturas/{fake_id}")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert "no encontrada" in response.json()["detail"]


@pytest.mark.asyncio
async def test_crear_factura_negative_amount(async_client: AsyncClient, test_db):
    """Reject factura with negative or zero monto_total."""
    payload = {
        "numero": "INV-NEG",
        "proveedor": "Test",
        "monto_total": -100.00,  # Invalid: must be > 0
    }

    response = await async_client.post("/api/v1/facturas/", json=payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
