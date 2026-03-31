import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class OcrResult(Base, TimestampMixin):
    __tablename__ = "ocr_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    factura_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("facturas.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # --- OCR pipeline output (read-only after processing) ---

    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    extracted_total: Mapped[str | None] = mapped_column(String(50), nullable=True)
    extracted_provider: Mapped[str | None] = mapped_column(String(255), nullable=True)
    confidence_estimate: Mapped[float | None] = mapped_column(Float, nullable=True)
    processing_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Pipeline status: processing | processed | needs_review | failed
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="processing")

    # --- Human validation fields ---

    validated_provider: Mapped[str | None] = mapped_column(String(255), nullable=True)
    validated_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    validated_total: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Who validated (free-form string: username, email, or "system")
    validated_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    validated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Optional notes added during human review
    validation_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # True when at least one validated field differs from the extracted value
    was_manually_edited: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    factura: Mapped["Factura"] = relationship("Factura", back_populates="ocr_results")  # type: ignore[name-defined]
