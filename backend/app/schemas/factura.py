"""
Shared Pydantic schemas used by multiple route modules.

Keeping schemas in one place avoids cross-importing between route files
and gives a single source of truth for API response contracts.
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Nested blocks
# ---------------------------------------------------------------------------


class OcrBlock(BaseModel):
    """
    Embedded OCR block shown inside a factura detail response.
    Combines pipeline output and human validation in one object.
    """

    ocr_result_id: uuid.UUID
    pipeline_status: str
    confidence_estimate: float | None

    # Pipeline-extracted fields (raw OCR output)
    extracted_provider: str | None
    extracted_date: str | None
    extracted_total: str | None

    # Human-validated fields (may differ from extracted)
    validated_provider: str | None
    validated_date: str | None
    validated_total: str | None

    # Validation metadata
    validated_by: str | None
    validated_at: datetime | None
    was_manually_edited: bool
    validation_notes: str | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Factura views
# ---------------------------------------------------------------------------


class FacturaSummary(BaseModel):
    """
    Lean representation used in paginated list responses.
    Excludes heavy fields (raw_text, validation notes) to keep payloads small.
    """

    factura_id: uuid.UUID
    numero: str | None
    proveedor: str | None
    monto_total: Decimal | None
    moneda: str
    status: str
    estado: str
    image_url: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FacturaDetail(BaseModel):
    """
    Full representation returned by GET /facturas/{id}.
    Includes all factura fields plus the latest OCR result if available.
    """

    factura_id: uuid.UUID
    numero: str | None
    proveedor: str | None
    monto_total: Decimal | None
    moneda: str
    descripcion: str | None
    status: str
    estado: str
    image_url: str | None
    created_at: datetime
    updated_at: datetime

    # None when OCR has never been run for this factura
    ocr: OcrBlock | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Pagination wrapper
# ---------------------------------------------------------------------------


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total_items: int
    total_pages: int
    page: int
    page_size: int
