"""
field_extraction.py

Extracts structured invoice fields from the recognized text output
of the OCR pipeline using regex patterns and positional heuristics.

This module does NOT perform any image processing. It operates entirely
on the string representation produced by the recognition module.

Fields extracted:
    - extracted_date     : first date pattern found (DD/MM/YYYY or variants)
    - extracted_total    : largest plausible monetary amount found
    - extracted_provider : heuristic: first non-empty, non-numeric line
                           that appears in the upper third of the invoice

Limitations:
    - Field extraction quality depends directly on recognition accuracy.
    - Provider extraction is highly heuristic and will fail for
      multi-line company names or logos scanned as images.
    - Total extraction picks the largest number, which may be wrong if
      the invoice contains subtotals or tax lines with higher values
      than the actual total.
    - Only common date formats are covered. Custom or locale-specific
      separators may not be detected.
    - Negative amounts and foreign currency symbols are not handled.
"""

import logging
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# --- Regex patterns -------------------------------------------------------

# Matches: 01/12/2024  01-12-2024  01.12.2024  2024/12/01
_DATE_PATTERNS = [
    re.compile(r"\b(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{4})\b"),
    re.compile(r"\b(\d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2})\b"),
]

# Matches: 1,234.56  1.234,56  1234.56  1234,56
# (common formats for monetary amounts in Latin American invoices)
_AMOUNT_PATTERN = re.compile(
    r"\b(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+[.,]\d{2}|\d{4,})\b"
)

# Keywords that commonly appear near the total line in invoices
_TOTAL_KEYWORDS = re.compile(
    r"\b(total|importe|monto|suma|subtotal|igv|iva|amount)\b",
    re.IGNORECASE,
)


# --- Data structures ------------------------------------------------------


@dataclass
class ExtractedFields:
    extracted_date: str | None
    extracted_total: str | None
    extracted_provider: str | None
    confidence_estimate: float
    processing_notes: list[str]


# --- Public API -----------------------------------------------------------


def extract_fields(
    lines_text: list[str],
    total_image_height: int,
) -> ExtractedFields:
    """
    Derive invoice fields from a list of line strings.

    Parameters:
        lines_text         -- ordered list of text lines (top to bottom)
        total_image_height -- pixel height of the source image, used for
                              positional heuristics (provider in upper third)
    """
    notes: list[str] = []

    extracted_date = _find_date(lines_text, notes)
    extracted_total = _find_total(lines_text, notes)
    extracted_provider = _find_provider(lines_text, notes)

    confidence = _estimate_confidence(extracted_date, extracted_total, extracted_provider)

    return ExtractedFields(
        extracted_date=extracted_date,
        extracted_total=extracted_total,
        extracted_provider=extracted_provider,
        confidence_estimate=confidence,
        processing_notes=notes,
    )


# --- Internal helpers -----------------------------------------------------


def _find_date(lines: list[str], notes: list[str]) -> str | None:
    for line in lines:
        for pattern in _DATE_PATTERNS:
            match = pattern.search(line)
            if match:
                logger.debug("Date found: %s", match.group(1))
                return match.group(1)
    notes.append("No se encontro patron de fecha en el texto reconocido.")
    return None


def _find_total(lines: list[str], notes: list[str]) -> str | None:
    """
    Search for a monetary amount near a total keyword. Falls back to the
    largest numeric value found in the document if no keyword is present.
    """
    # Priority: lines containing a total keyword
    for line in lines:
        if _TOTAL_KEYWORDS.search(line):
            amounts = _extract_amounts(line)
            if amounts:
                best = max(amounts, key=_normalize_amount)
                logger.debug("Total found near keyword: %s", best)
                return best

    # Fallback: largest amount in the entire document
    all_amounts: list[str] = []
    for line in lines:
        all_amounts.extend(_extract_amounts(line))

    if all_amounts:
        best = max(all_amounts, key=_normalize_amount)
        notes.append(
            "Total inferido como el mayor monto numerico encontrado (sin keyword)."
        )
        return best

    notes.append("No se encontro monto total en el texto reconocido.")
    return None


def _find_provider(lines: list[str], notes: list[str]) -> str | None:
    """
    Use the first non-trivial text line as the provider name.

    Heuristic: provider names usually appear at the top of the invoice,
    are not purely numeric, and have at least 3 meaningful characters.
    """
    for line in lines[:6]:  # only look in the first 6 lines
        cleaned = line.strip()
        if len(cleaned) < 3:
            continue
        # Skip lines that are entirely digits, symbols, or unknowns
        alpha_chars = sum(1 for c in cleaned if c.isalpha())
        if alpha_chars < 2:
            continue
        logger.debug("Provider candidate: %s", cleaned)
        return cleaned

    notes.append("No se pudo inferir proveedor desde las primeras lineas.")
    return None


def _extract_amounts(text: str) -> list[str]:
    return _AMOUNT_PATTERN.findall(text)


def _normalize_amount(amount_str: str) -> float:
    """Convert a locale-formatted amount string to a float for comparison."""
    cleaned = amount_str.replace(",", "").replace(".", "")
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def _estimate_confidence(
    date: str | None,
    total: str | None,
    provider: str | None,
) -> float:
    """
    Rough confidence score based on how many fields were extracted.
    This is a heuristic, not a statistically calibrated metric.
    """
    score = 0.0
    if date:
        score += 0.35
    if total:
        score += 0.40
    if provider:
        score += 0.25
    return round(score, 2)
