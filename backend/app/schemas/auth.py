from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class LoginPayload(BaseModel):
    """Payload for login endpoint."""

    email: EmailStr
    password: str = Field(..., min_length=1, max_length=72)

    @field_validator("password")
    @classmethod
    def password_max_length(cls, v: str) -> str:
        if len(v.encode()) > 72:
            raise ValueError("Password must not exceed 72 bytes")
        return v


class RegisterPayload(BaseModel):
    """Payload for registration endpoint."""

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)
    password_confirm: str = Field(..., min_length=8, max_length=72)

    @field_validator("password", "password_confirm")
    @classmethod
    def password_max_length(cls, v: str) -> str:
        if len(v.encode()) > 72:
            raise ValueError("Password must not exceed 72 bytes")
        return v


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
