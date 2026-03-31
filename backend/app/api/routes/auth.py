from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, ACCESS_TOKEN_EXPIRE_DAYS
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginPayload, RegisterPayload, TokenResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(
    payload: RegisterPayload,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Register a new user and return an authentication token."""
    # Validate password confirmation
    if payload.password != payload.password_confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match",
        )

    # Check if email already exists
    stmt = select(User).where(User.email == payload.email)
    result = await db.execute(stmt)
    existing_user = result.scalars().first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Create new user
    user = User(email=payload.email)
    user.set_password(payload.password)
    db.add(user)
    await db.flush()  # Ensure user is persisted and has an ID

    # Create token
    expires_delta = timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    access_token = create_access_token(user.id, expires_delta)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=int(expires_delta.total_seconds()),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginPayload,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Authenticate a user and return an authentication token."""
    # Find user by email
    stmt = select(User).where(User.email == payload.email)
    result = await db.execute(stmt)
    user = result.scalars().first()

    # Verify user exists and password is correct
    if not user or not user.verify_password(payload.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Create token
    expires_delta = timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    access_token = create_access_token(user.id, expires_delta)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=int(expires_delta.total_seconds()),
    )
