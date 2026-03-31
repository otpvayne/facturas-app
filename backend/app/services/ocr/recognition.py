"""
recognition.py

First-version character recognition built from scratch.

Approach and honest scope:
    Full arbitrary text recognition without a pre-trained model is not
    achievable at this phase. What this module provides is:

    1. Digit recognition via 7x5 grid template matching.
       Each candidate character blob is resized to a 7-row x 5-col grid
       and compared against hand-coded binary templates using normalized
       Hamming distance. This works reasonably for clean, printed digits
       in common sans-serif fonts at sufficient resolution.

    2. Non-digit blobs are classified as alphabetic or unknown based on
       morphological features (aspect ratio, stroke density) and returned
       as the placeholder character UNKNOWN_CHAR.

    3. Digit sequences detected within a region are joined into numeric
       tokens (e.g., "1", "2", "3" -> "123").

    Known limitations:
        - Will misclassify digits in unusual fonts or low-resolution scans.
        - Cannot recognize letters reliably without a trained model.
        - Template matching is sensitive to binarization quality.
        - Characters touching each other after binarization will be merged
          into one blob and misrecognized.
"""

import logging

import cv2
import numpy as np

from app.services.ocr.text_region_detection import TextRegion

logger = logging.getLogger(__name__)

UNKNOWN_CHAR = "?"
TEMPLATE_ROWS = 7
TEMPLATE_COLS = 5

# Hand-coded binary templates for digits 0-9.
# Convention: 1 = ink pixel, 0 = background pixel.
# Each template is TEMPLATE_ROWS x TEMPLATE_COLS.
DIGIT_TEMPLATES: dict[str, np.ndarray] = {
    "0": np.array(
        [
            [0, 1, 1, 1, 0],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [0, 1, 1, 1, 0],
        ],
        dtype=np.uint8,
    ),
    "1": np.array(
        [
            [0, 0, 1, 0, 0],
            [0, 1, 1, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 1, 1, 1, 0],
        ],
        dtype=np.uint8,
    ),
    "2": np.array(
        [
            [0, 1, 1, 1, 0],
            [1, 0, 0, 0, 1],
            [0, 0, 0, 0, 1],
            [0, 0, 0, 1, 0],
            [0, 0, 1, 0, 0],
            [0, 1, 0, 0, 0],
            [1, 1, 1, 1, 1],
        ],
        dtype=np.uint8,
    ),
    "3": np.array(
        [
            [0, 1, 1, 1, 0],
            [1, 0, 0, 0, 1],
            [0, 0, 0, 0, 1],
            [0, 0, 1, 1, 0],
            [0, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [0, 1, 1, 1, 0],
        ],
        dtype=np.uint8,
    ),
    "4": np.array(
        [
            [0, 0, 0, 1, 0],
            [0, 0, 1, 1, 0],
            [0, 1, 0, 1, 0],
            [1, 0, 0, 1, 0],
            [1, 1, 1, 1, 1],
            [0, 0, 0, 1, 0],
            [0, 0, 0, 1, 0],
        ],
        dtype=np.uint8,
    ),
    "5": np.array(
        [
            [1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0],
            [1, 0, 0, 0, 0],
            [1, 1, 1, 1, 0],
            [0, 0, 0, 0, 1],
            [0, 0, 0, 0, 1],
            [1, 1, 1, 1, 0],
        ],
        dtype=np.uint8,
    ),
    "6": np.array(
        [
            [0, 0, 1, 1, 0],
            [0, 1, 0, 0, 0],
            [1, 0, 0, 0, 0],
            [1, 1, 1, 1, 0],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [0, 1, 1, 1, 0],
        ],
        dtype=np.uint8,
    ),
    "7": np.array(
        [
            [1, 1, 1, 1, 1],
            [0, 0, 0, 0, 1],
            [0, 0, 0, 1, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 1, 0, 0],
        ],
        dtype=np.uint8,
    ),
    "8": np.array(
        [
            [0, 1, 1, 1, 0],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [0, 1, 1, 1, 0],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [0, 1, 1, 1, 0],
        ],
        dtype=np.uint8,
    ),
    "9": np.array(
        [
            [0, 1, 1, 1, 0],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [0, 1, 1, 1, 1],
            [0, 0, 0, 0, 1],
            [0, 0, 0, 1, 0],
            [0, 1, 1, 0, 0],
        ],
        dtype=np.uint8,
    ),
}

# Minimum similarity (0–1) to accept a template match as a digit.
DIGIT_CONFIDENCE_THRESHOLD = 0.55

# Aspect ratio range considered plausible for a single character.
MIN_CHAR_ASPECT = 0.2
MAX_CHAR_ASPECT = 1.8

# Minimum height in pixels for a blob to be considered a character
# (smaller blobs are likely punctuation or noise).
MIN_CHAR_HEIGHT = 6


def recognize_region(binary: np.ndarray, region: TextRegion) -> tuple[str, float]:
    """
    Attempt to recognize the text content of a single TextRegion.

    Returns:
        token      -- recognized string (may contain digits, '?', or mixed)
        confidence -- average per-character confidence in [0, 1]
    """
    roi = binary[region.y : region.y + region.h, region.x : region.x + region.w]
    if roi.size == 0:
        return UNKNOWN_CHAR, 0.0

    char_blobs = _extract_character_blobs(roi)
    if not char_blobs:
        return UNKNOWN_CHAR, 0.0

    chars: list[str] = []
    confidences: list[float] = []

    for blob_roi in char_blobs:
        char, conf = _match_digit(blob_roi)
        chars.append(char)
        confidences.append(conf)

    token = "".join(chars)
    avg_confidence = float(np.mean(confidences)) if confidences else 0.0
    return token, avg_confidence


def _extract_character_blobs(roi: np.ndarray) -> list[np.ndarray]:
    """
    Find individual character-level blobs inside a region crop using
    connected component analysis on the binarized ROI.

    Returns a list of small binary arrays, one per character candidate,
    sorted left-to-right.
    """
    num_labels, _, stats, _ = cv2.connectedComponentsWithStats(roi, connectivity=8)

    blobs: list[tuple[int, np.ndarray]] = []
    for label in range(1, num_labels):  # skip background label 0
        x = int(stats[label, cv2.CC_STAT_LEFT])
        y = int(stats[label, cv2.CC_STAT_TOP])
        w = int(stats[label, cv2.CC_STAT_WIDTH])
        h = int(stats[label, cv2.CC_STAT_HEIGHT])

        if h < MIN_CHAR_HEIGHT:
            continue

        aspect = w / h if h > 0 else 0.0
        if aspect < MIN_CHAR_ASPECT or aspect > MAX_CHAR_ASPECT:
            continue

        blob = roi[y : y + h, x : x + w]
        blobs.append((x, blob))

    blobs.sort(key=lambda t: t[0])
    return [b for _, b in blobs]


def _match_digit(blob: np.ndarray) -> tuple[str, float]:
    """
    Resize a character blob to TEMPLATE_ROWS x TEMPLATE_COLS and compare
    against each digit template using normalized Hamming distance.

    Returns the best matching digit and its similarity score, or
    (UNKNOWN_CHAR, 0.0) if no template exceeds DIGIT_CONFIDENCE_THRESHOLD.
    """
    resized = cv2.resize(
        blob, (TEMPLATE_COLS, TEMPLATE_ROWS), interpolation=cv2.INTER_AREA
    )
    # Binarize the resized blob: values > 127 → 1
    binary_blob = (resized > 127).astype(np.uint8)

    best_char = UNKNOWN_CHAR
    best_score = 0.0
    total_pixels = TEMPLATE_ROWS * TEMPLATE_COLS

    for digit, template in DIGIT_TEMPLATES.items():
        matches = int(np.sum(binary_blob == template))
        score = matches / total_pixels
        if score > best_score:
            best_score = score
            best_char = digit

    if best_score < DIGIT_CONFIDENCE_THRESHOLD:
        return UNKNOWN_CHAR, best_score

    return best_char, best_score


def recognize_line_regions(
    binary: np.ndarray, regions: list[TextRegion]
) -> list[tuple[str, float]]:
    """
    Recognize all regions in a line and return (token, confidence) pairs.
    """
    return [recognize_region(binary, region) for region in regions]
