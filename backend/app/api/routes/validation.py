"""
Routes for human validation of OCR results.

Prefix: /facturas  (same as existing factura routes, different paths)

Endpoints:
    GET  /facturas/{factura_id}/ocr-result  -- fetch preliminary OCR output
    PATCH /facturas/{factura_id}/validate   -- submit manual corrections
    GET  /facturas/{factura_id}/detail      -- consolidated view of factura + OCR + validation
"""

import uuid
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.factura import Factura
from app.models.ocr_result import OcrResult
from app.services import validation_service
from app.services.validation_service import ValidationError

router = APIRouter(prefix="/facturas", tags=["validation"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class OcrResultResponse(BaseModel):
    """Preliminary OCR output — read-only fields produced by the pipeline."""

    ocr_result_id: uuid.UUID
    factura_id: uuid.UUID
    pipeline_status: str
    raw_text: str | None
    extracted_date: str | None
    extracted_total: str | None
    extracted_provider: str | None
    confidence_estimate: float | None
    processing_notes: str | None

    model_config = {"from_attributes": True}


class ValidatePayload(BaseModel):
    """
    Payload for the PATCH /validate endpoint.

    All three fields are optional individually, but at least one must be
    provided. To validate without a prior OcrResult, all three are required
    (see validation_service._require_full_payload).
    """

    validated_provider: str | None = Field(
        default=None, max_length=255, description="Nombre del proveedor corregido"
    )
    validated_date: str | None = Field(
        default=None,
        max_length=50,
        description="Fecha de la factura en formato DD/MM/YYYY u otro separador",
    )
    validated_total: str | None = Field(
        default=None,
        max_length=50,
        description="Monto total como cadena numerica (ej: '1234.50')",
    )
    validated_by: str | None = Field(
        default=None,
        max_length=255,
        description="Identificador del usuario que valida (email, nombre, etc.)",
    )
    validation_notes: str | None = Field(
        default=None, description="Notas opcionales del revisor"
    )

    @field_validator("validated_provider")
    @classmethod
    def provider_not_blank(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("validated_provider no puede ser una cadena vacia.")
        return v

    def has_any_field(self) -> bool:
        return any(
            [self.validated_provider, self.validated_date, self.validated_total]
        )


class ValidationResponse(BaseModel):
    """Result returned after a successful validation."""

    ocr_result_id: uuid.UUID
    factura_id: uuid.UUID
    status: str
    validated_provider: str | None
    validated_date: str | None
    validated_total: str | None
    validated_by: str | None
    validated_at: datetime | None
    validation_notes: str | None
    was_manually_edited: bool

    model_config = {"from_attributes": True}


class OcrSummary(BaseModel):
    """Nested OCR block inside the consolidated detail response."""

    ocr_result_id: uuid.UUID
    pipeline_status: str
    extracted_date: str | None
    extracted_total: str | None
    extracted_provider: str | None
    confidence_estimate: float | None
    validated_provider: str | None
    validated_date: str | None
    validated_total: str | None
    validated_by: str | None
    validated_at: datetime | None
    was_manually_edited: bool
    validation_notes: str | None

    model_config = {"from_attributes": True}


class FacturaDetailResponse(BaseModel):
    """Consolidated view: factura fields + OCR result + validation state."""

    factura_id: uuid.UUID
    status: str
    image_url: str | None

    # Original factura fields (may be None for upload-only facturas)
    numero: str | None
    proveedor: str | None
    monto_total: Decimal | None
    moneda: str
    descripcion: str | None
    estado: str

    # Nested OCR + validation block (None if OCR was never run)
    ocr: OcrSummary | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/{factura_id}/ocr-result",
    response_model=OcrResultResponse,
    summary="Obtener resultado OCR preliminar de una factura",
)
async def get_ocr_result(
    factura_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> OcrResultResponse:
    factura = await _get_factura_or_404(db, factura_id)
    ocr = await validation_service.get_ocr_result_for_factura(db, factura.id)

    if ocr is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Esta factura aun no tiene resultado OCR. Ejecuta POST /ocr/process/{factura_id} primero.",
        )

    return OcrResultResponse(
        ocr_result_id=ocr.id,
        factura_id=ocr.factura_id,
        pipeline_status=ocr.status,
        raw_text=ocr.raw_text,
        extracted_date=ocr.extracted_date,
        extracted_total=ocr.extracted_total,
        extracted_provider=ocr.extracted_provider,
        confidence_estimate=ocr.confidence_estimate,
        processing_notes=ocr.processing_notes,
    )


@router.patch(
    "/{factura_id}/validate",
    response_model=ValidationResponse,
    summary="Enviar correcciones manuales y validar la factura",
)
async def validate_factura(
    factura_id: uuid.UUID,
    payload: ValidatePayload,
    db: AsyncSession = Depends(get_db),
) -> ValidationResponse:
    if not payload.has_any_field():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Debes proporcionar al menos uno de: validated_provider, validated_date, validated_total.",
        )

    factura = await _get_factura_or_404(db, factura_id)

    try:
        ocr = await validation_service.validate_factura(
            db=db,
            factura=factura,
            validated_provider=payload.validated_provider,
            validated_date=payload.validated_date,
            validated_total=payload.validated_total,
            validated_by=payload.validated_by,
            validation_notes=payload.validation_notes,
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    return ValidationResponse(
        ocr_result_id=ocr.id,
        factura_id=ocr.factura_id,
        status=ocr.status,
        validated_provider=ocr.validated_provider,
        validated_date=ocr.validated_date,
        validated_total=ocr.validated_total,
        validated_by=ocr.validated_by,
        validated_at=ocr.validated_at,
        validation_notes=ocr.validation_notes,
        was_manually_edited=ocr.was_manually_edited,
    )


@router.get(
    "/{factura_id}/detail",
    response_model=FacturaDetailResponse,
    summary="Vista consolidada: factura + OCR preliminar + validacion final",
)
async def get_factura_detail(
    factura_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> FacturaDetailResponse:
    factura = await _get_factura_or_404(db, factura_id)
    ocr = await validation_service.get_ocr_result_for_factura(db, factura.id)

    ocr_summary: OcrSummary | None = None
    if ocr is not None:
        ocr_summary = OcrSummary(
            ocr_result_id=ocr.id,
            pipeline_status=ocr.status,
            extracted_date=ocr.extracted_date,
            extracted_total=ocr.extracted_total,
            extracted_provider=ocr.extracted_provider,
            confidence_estimate=ocr.confidence_estimate,
            validated_provider=ocr.validated_provider,
            validated_date=ocr.validated_date,
            validated_total=ocr.validated_total,
            validated_by=ocr.validated_by,
            validated_at=ocr.validated_at,
            was_manually_edited=ocr.was_manually_edited,
            validation_notes=ocr.validation_notes,
        )

    return FacturaDetailResponse(
        factura_id=factura.id,
        status=factura.status,
        image_url=factura.image_url,
        numero=factura.numero,
        proveedor=factura.proveedor,
        monto_total=factura.monto_total,
        moneda=factura.moneda,
        descripcion=factura.descripcion,
        estado=factura.estado,
        ocr=ocr_summary,
    )


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


async def _get_factura_or_404(db: AsyncSession, factura_id: uuid.UUID) -> Factura:
    result = await db.execute(select(Factura).where(Factura.id == factura_id))
    factura = result.scalar_one_or_none()
    if not factura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada.",
        )
    return factura
