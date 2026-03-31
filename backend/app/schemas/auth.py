from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class LoginPayload(BaseModel):
    """Payload for login endpoint."""

    email: EmailStr
    password: str = Field(..., min_length=1)


class RegisterPayload(BaseModel):
    """Payload for registration endpoint."""

    email: EmailStr
    password: str = Field(..., min_length=8)
    password_confirm: str = Field(..., min_length=8)


class TokenResponse(BaseModel):
    """Response with authentication token."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until expiry


class UserResponse(BaseModel):
    """User information response."""

    id: UUID
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}
