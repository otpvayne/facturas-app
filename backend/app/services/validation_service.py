"""
validation_service.py

Business logic for human validation of OCR results.

Responsibilities:
    - Enforce state machine transitions before validation
    - Validate business rules on corrected field values
    - Detect which fields were manually edited vs. accepted as-is
    - Persist validated fields and audit metadata
    - Update factura status to "validated"

State machine:
    uploaded    -> validate allowed only with full manual payload (exception, documented below)
    processing  -> validation blocked (OCR in progress)
    processed   -> validation allowed
    needs_review-> validation allowed
    failed      -> validation allowed (user may correct all fields manually)
    validated   -> re-validation allowed (user may update a previously validated record)

Exception for missing OcrResult:
    If no OcrResult exists (i.e., OCR was never run) and the payload contains
    all three required fields (validated_provider, validated_date, validated_total),
    the system creates a minimal OcrResult and proceeds with validation.
    This supports the manual entry flow where the user skips OCR entirely.
"""

import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.factura import Factura
from app.models.ocr_result import OcrResult

# Blocked states where validation is not allowed
BLOCKED_STATES = {"processing"}

# Date patterns accepted in validated_date
_DATE_RE = re.compile(
    r"^\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{4}$"
    r"|^\d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2}$"
)


class ValidationError(Exception):
    """Raised when a business rule is violated during validation."""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def get_ocr_result_for_factura(
    db: AsyncSession, factura_id: uuid.UUID
) -> OcrResult | None:
    """Return the most recent OcrResult for a factura, or None."""
    result = await db.execute(
        select(OcrResult)
        .where(OcrResult.factura_id == factura_id)
        .order_by(OcrResult.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def validate_factura(
    db: AsyncSession,
    factura: Factura,
    validated_provider: str | None,
    validated_date: str | None,
    validated_total: str | None,
    validated_by: str | None,
    validation_notes: str | None,
) -> OcrResult:
    """
    Apply human validation to a factura.

    Raises ValidationError for any business rule violation.
    Returns the updated OcrResult.
    """
    _check_state_transition(factura)
    _validate_fields(validated_provider, validated_date, validated_total)

    ocr = await get_ocr_result_for_factura(db, factura.id)

    if ocr is None:
        _require_full_payload(validated_provider, validated_date, validated_total)
        ocr = OcrResult(
            factura_id=factura.id,
            status="needs_review",
            processing_notes="Registro creado por validacion manual sin OCR previo.",
        )
        db.add(ocr)
        await db.flush()

    was_edited = _detect_manual_edits(
        ocr, validated_provider, validated_date, validated_total
    )

    ocr.validated_provider = validated_provider
    ocr.validated_date = validated_date
    ocr.validated_total = validated_total
    ocr.validated_by = validated_by or "manual"
    ocr.validated_at = datetime.now(timezone.utc)
    ocr.validation_notes = validation_notes
    ocr.was_manually_edited = was_edited
    ocr.status = "validated"

    # Mirror validated fields into the factura for quick access
    if validated_provider:
        factura.proveedor = validated_provider
    if validated_total:
        factura.monto_total = _parse_total(validated_total)
    factura.status = "validated"

    await db.flush()
    return ocr


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _check_state_transition(factura: Factura) -> None:
    if factura.status in BLOCKED_STATES:
        raise ValidationError(
            f"No se puede validar una factura en estado '{factura.status}'. "
            "Espera a que el procesamiento OCR termine."
        )


def _validate_fields(
    provider: str | None,
    date: str | None,
    total: str | None,
) -> None:
    if provider is not None:
        if not provider.strip():
            raise ValidationError("El proveedor validado no puede ser una cadena vacia.")

    if date is not None:
        if not _DATE_RE.match(date.strip()):
            raise ValidationError(
                f"Formato de fecha invalido: '{date}'. "
                "Use DD/MM/YYYY, YYYY-MM-DD u otro separador comun."
            )

    if total is not None:
        _parse_total(total)  # raises if not numeric


def _parse_total(total_str: str) -> Decimal:
    cleaned = total_str.strip().replace(",", ".")
    # Handle patterns like "1.234.56" (thousands dot + decimal dot) naively
    parts = cleaned.split(".")
    if len(parts) > 2:
        # Assume last two digits after last dot are cents
        cleaned = "".join(parts[:-1]) + "." + parts[-1]
    try:
        value = Decimal(cleaned)
    except InvalidOperation:
        raise ValidationError(
            f"El total validado '{total_str}' no es un valor numerico valido."
        )
    if value < 0:
        raise ValidationError("El total validado no puede ser negativo.")
    return value


def _require_full_payload(
    provider: str | None, date: str | None, total: str | None
) -> None:
    """
    Exception rule: allow validation without a prior OcrResult only when
    all three fields are explicitly provided (full manual entry flow).
    """
    missing = [
        name
        for name, val in [
            ("validated_provider", provider),
            ("validated_date", date),
            ("validated_total", total),
        ]
        if not val
    ]
    if missing:
        raise ValidationError(
            "Esta factura no tiene resultado OCR previo. "
            "Para validar sin OCR debes proporcionar los tres campos: "
            f"{', '.join(missing)}."
        )


def _detect_manual_edits(
    ocr: OcrResult,
    validated_provider: str | None,
    validated_date: str | None,
    validated_total: str | None,
) -> bool:
    """Return True if any validated field differs from the extracted value."""
    pairs = [
        (ocr.extracted_provider, validated_provider),
        (ocr.extracted_date, validated_date),
        (ocr.extracted_total, validated_total),
    ]
    for extracted, validated in pairs:
        if validated is not None and validated != extracted:
            return True
    return False
