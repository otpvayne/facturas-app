from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, String, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.models.base import Base
from app.core.security import hash_password, verify_password


class User(Base):
    """User model for authentication."""

    __tablename__ = "users"

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True,
    )
    email = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        Index("idx_users_email", "email"),
    )

    def set_password(self, password: str) -> None:
        """Hash and set the user password."""
        self.password_hash = hash_password(password)

    def verify_password(self, password: str) -> bool:
        """Verify a password against the stored hash."""
        return verify_password(password, self.password_hash)

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email}>"
