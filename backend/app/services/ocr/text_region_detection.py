"""
text_region_detection.py

Detects candidate text regions in a binarized invoice image using
morphological operations and contour analysis. No OCR engine is used.

Strategy:
    - Dilate the binary image horizontally to merge character blobs
      within the same word or phrase into a single connected component.
    - Find external contours of these merged blobs.
    - Filter by area and aspect ratio to discard noise and full-page
      elements (lines, borders, logos).

The resulting TextRegion list represents candidate word-level or
phrase-level text blocks, which are later grouped into lines by
the segmentation module.
"""

import logging
from dataclasses import dataclass

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# Minimum number of foreground pixels inside a bounding box to consider
# it a real text region rather than a noise blob.
MIN_PIXEL_DENSITY = 0.05


@dataclass(frozen=True)
class TextRegion:
    x: int
    y: int
    w: int
    h: int

    @property
    def area(self) -> int:
        return self.w * self.h

    @property
    def aspect_ratio(self) -> float:
        return self.w / self.h if self.h > 0 else 0.0

    @property
    def center_y(self) -> int:
        return self.y + self.h // 2

    @property
    def center_x(self) -> int:
        return self.x + self.w // 2


def detect_text_regions(
    binary: np.ndarray,
    dilation_width: int = 18,
    dilation_height: int = 3,
    min_area: int = 60,
    max_area_fraction: float = 0.25,
    min_aspect: float = 0.15,
    max_aspect: float = 60.0,
) -> list[TextRegion]:
    """
    Return a list of TextRegion bounding boxes from a binarized image.

    Parameters:
        binary            -- binarized image (text = 255, background = 0)
        dilation_width    -- kernel width for horizontal dilation (merges
                             characters within the same word)
        dilation_height   -- kernel height for dilation
        min_area          -- reject regions smaller than this (pixels)
        max_area_fraction -- reject regions larger than this fraction of
                             the total image area (catches full-page borders)
        min_aspect        -- minimum width/height ratio
        max_aspect        -- maximum width/height ratio
    """
    image_area = binary.shape[0] * binary.shape[1]
    max_area = int(image_area * max_area_fraction)

    kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT, (dilation_width, dilation_height)
    )
    dilated = cv2.dilate(binary, kernel, iterations=1)

    contours, _ = cv2.findContours(
        dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )

    regions: list[TextRegion] = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = w * h

        if area < min_area or area > max_area:
            continue

        aspect = w / h if h > 0 else 0.0
        if aspect < min_aspect or aspect > max_aspect:
            continue

        # Pixel density check on the original binary (not dilated)
        roi = binary[y : y + h, x : x + w]
        density = float(np.count_nonzero(roi)) / max(area, 1)
        if density < MIN_PIXEL_DENSITY:
            continue

        regions.append(TextRegion(x=x, y=y, w=w, h=h))

    logger.debug("Detected %d text regions.", len(regions))
    return regions
