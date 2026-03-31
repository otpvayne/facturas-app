import asyncio
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.factura import Factura
from app.models.ocr_result import OcrResult
from app.services.ocr import image_loader, pipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ocr", tags=["ocr"])


class OcrResponse(BaseModel):
    ocr_result_id: uuid.UUID
    factura_id: uuid.UUID
    status: str
    raw_text: str
    extracted_date: str | None
    extracted_total: str | None
    extracted_provider: str | None
    confidence_estimate: float
    processing_notes: list[str]


@router.post(
    "/process/{factura_id}",
    response_model=OcrResponse,
    status_code=status.HTTP_200_OK,
    summary="Ejecuta el pipeline OCR MVP sobre la imagen de una factura",
)
async def process_factura(
    factura_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> OcrResponse:
    # 1. Fetch factura
    result = await db.execute(select(Factura).where(Factura.id == factura_id))
    factura: Factura | None = result.scalar_one_or_none()
    if not factura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada.",
        )

    if not factura.image_url:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La factura no tiene imagen asociada. Sube una imagen primero.",
        )

    # 2. Create an OcrResult record in "processing" state
    ocr_record = OcrResult(factura_id=factura.id, status="processing")
    db.add(ocr_record)
    await db.flush()

    # Update factura status
    factura.status = "processing"
    await db.flush()

    logger.info("[OCR] Starting pipeline for factura_id=%s", factura_id)

    # 3. Download image
    try:
        image_array = await image_loader.load_from_url(factura.image_url)
    except (RuntimeError, ValueError) as exc:
        logger.error("[OCR] Image load failed: %s", exc)
        await _mark_failed(db, ocr_record, factura, str(exc))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"No se pudo cargar la imagen: {exc}",
        )

    # 4. Run synchronous pipeline in thread pool (CPU-bound)
    try:
        ocr_output = await asyncio.to_thread(pipeline.run_sync, image_array)
    except Exception as exc:
        logger.error("[OCR] Pipeline error: %s", exc)
        await _mark_failed(db, ocr_record, factura, str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno en el pipeline OCR: {exc}",
        )

    # 5. Persist results
    notes_str = "; ".join(ocr_output.processing_notes) if ocr_output.processing_notes else None

    ocr_record.raw_text = ocr_output.raw_text
    ocr_record.extracted_date = ocr_output.extracted_date
    ocr_record.extracted_total = ocr_output.extracted_total
    ocr_record.extracted_provider = ocr_output.extracted_provider
    ocr_record.confidence_estimate = ocr_output.confidence_estimate
    ocr_record.processing_notes = notes_str
    ocr_record.status = ocr_output.status

    factura.status = ocr_output.status
    await db.flush()

    logger.info(
        "[OCR] Finished factura_id=%s status=%s confidence=%.2f",
        factura_id,
        ocr_output.status,
        ocr_output.confidence_estimate,
    )

    return OcrResponse(
        ocr_result_id=ocr_record.id,
        factura_id=factura.id,
        status=ocr_output.status,
        raw_text=ocr_output.raw_text,
        extracted_date=ocr_output.extracted_date,
        extracted_total=ocr_output.extracted_total,
        extracted_provider=ocr_output.extracted_provider,
        confidence_estimate=ocr_output.confidence_estimate,
        processing_notes=ocr_output.processing_notes,
    )


async def _mark_failed(
    db: AsyncSession,
    ocr_record: OcrResult,
    factura: Factura,
    reason: str,
) -> None:
    ocr_record.status = "failed"
    ocr_record.processing_notes = reason
    factura.status = "failed"
    await db.flush()
