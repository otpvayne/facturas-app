import uuid
from decimal import Decimal

from sqlalchemy import Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Factura(Base, TimestampMixin):
    __tablename__ = "facturas"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    numero: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True, index=True)
    proveedor: Mapped[str | None] = mapped_column(String(255), nullable=True)
    monto_total: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    moneda: Mapped[str] = mapped_column(String(3), nullable=False, default="PEN")
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    estado: Mapped[str] = mapped_column(String(50), nullable=False, default="pendiente")
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="uploaded")

    ocr_results: Mapped[list["OcrResult"]] = relationship(  # type: ignore[name-defined]
        "OcrResult", back_populates="factura", cascade="all, delete-orphan"
    )
