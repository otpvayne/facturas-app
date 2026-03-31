"""
pipeline.py

Orchestrates the full OCR MVP pipeline for a single invoice image.

Stages executed in order:
    1. load        -- fetch image bytes from URL
    2. preprocess  -- grayscale, denoise, CLAHE, binarize, deskew
    3. detect      -- find candidate text regions via morphological analysis
    4. segment     -- group regions into lines
    5. recognize   -- attempt digit/character recognition per region
    6. extract     -- apply heuristic field extraction on recognized text

Each stage is wrapped in individual error handling so that a failure in
one stage produces a descriptive note rather than crashing the whole run.
The pipeline always returns a PipelineResult, never raises to the caller.

CPU-bound operations (OpenCV) are designed to be run in a thread pool
via asyncio.to_thread() from the async endpoint layer.
"""

import logging
from dataclasses import dataclass, field

import numpy as np

from app.services.ocr import field_extraction, recognition, segmentation
from app.services.ocr import image_loader, preprocessing, text_region_detection

logger = logging.getLogger(__name__)


@dataclass
class PipelineResult:
    raw_text: str
    extracted_date: str | None
    extracted_total: str | None
    extracted_provider: str | None
    confidence_estimate: float
    processing_notes: list[str]
    status: str  # "processed" | "needs_review" | "failed"


# --------------------------------------------------------------------------
# Public entry point (sync — call via asyncio.to_thread from async context)
# --------------------------------------------------------------------------


def run_sync(image_array: np.ndarray) -> PipelineResult:
    """
    Execute all CPU-bound OCR stages synchronously.

    Intended to be called via:
        result = await asyncio.to_thread(run_sync, image_array)
    """
    notes: list[str] = []

    # Stage 1: Preprocessing
    logger.info("[OCR] Stage 1: preprocessing")
    try:
        _, binary = preprocessing.preprocess(image_array)
    except Exception as exc:
        logger.error("[OCR] Preprocessing failed: %s", exc)
        return _failed(f"Error en preprocesamiento: {exc}")

    image_height = image_array.shape[0]

    # Stage 2: Text region detection
    logger.info("[OCR] Stage 2: text region detection")
    try:
        regions = text_region_detection.detect_text_regions(binary)
    except Exception as exc:
        logger.error("[OCR] Region detection failed: %s", exc)
        return _failed(f"Error en deteccion de regiones: {exc}")

    if not regions:
        notes.append("No se detectaron regiones de texto en la imagen.")
        return PipelineResult(
            raw_text="",
            extracted_date=None,
            extracted_total=None,
            extracted_provider=None,
            confidence_estimate=0.0,
            processing_notes=notes,
            status="needs_review",
        )

    logger.info("[OCR] Stage 2: %d regions found", len(regions))

    # Stage 3: Segmentation into lines
    logger.info("[OCR] Stage 3: line segmentation")
    try:
        lines = segmentation.group_into_lines(regions)
    except Exception as exc:
        logger.error("[OCR] Segmentation failed: %s", exc)
        return _failed(f"Error en segmentacion: {exc}")

    logger.info("[OCR] Stage 3: %d lines found", len(lines))

    # Stage 4: Recognition
    logger.info("[OCR] Stage 4: recognition")
    lines_text: list[str] = []
    try:
        for line in lines:
            token_pairs = recognition.recognize_line_regions(binary, line.regions)
            line_str = " ".join(token for token, _ in token_pairs if token)
            lines_text.append(line_str)
    except Exception as exc:
        logger.error("[OCR] Recognition failed: %s", exc)
        notes.append(f"Error parcial en reconocimiento: {exc}")

    raw_text = "\n".join(lines_text)
    logger.info("[OCR] Stage 4: raw text (%d chars)", len(raw_text))

    # Stage 5: Field extraction
    logger.info("[OCR] Stage 5: field extraction")
    try:
        fields = field_extraction.extract_fields(lines_text, image_height)
        notes.extend(fields.processing_notes)
    except Exception as exc:
        logger.error("[OCR] Field extraction failed: %s", exc)
        notes.append(f"Error en extraccion de campos: {exc}")
        fields = field_extraction.ExtractedFields(
            extracted_date=None,
            extracted_total=None,
            extracted_provider=None,
            confidence_estimate=0.0,
            processing_notes=[],
        )

    status = _determine_status(
        fields.extracted_date,
        fields.extracted_total,
        fields.confidence_estimate,
    )

    logger.info(
        "[OCR] Pipeline complete — status=%s confidence=%.2f",
        status,
        fields.confidence_estimate,
    )

    return PipelineResult(
        raw_text=raw_text,
        extracted_date=fields.extracted_date,
        extracted_total=fields.extracted_total,
        extracted_provider=fields.extracted_provider,
        confidence_estimate=fields.confidence_estimate,
        processing_notes=notes,
        status=status,
    )


# --------------------------------------------------------------------------
# Internal helpers
# --------------------------------------------------------------------------


def _failed(reason: str) -> PipelineResult:
    return PipelineResult(
        raw_text="",
        extracted_date=None,
        extracted_total=None,
        extracted_provider=None,
        confidence_estimate=0.0,
        processing_notes=[reason],
        status="failed",
    )


def _determine_status(
    date: str | None,
    total: str | None,
    confidence: float,
) -> str:
    if confidence >= 0.60:
        return "processed"
    if confidence >= 0.30 or date or total:
        return "needs_review"
    return "needs_review"
