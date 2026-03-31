"""
preprocessing.py

Classical image preprocessing pipeline applied before text detection.
All operations use OpenCV and NumPy only — no OCR engine involved.

Stages:
    1. Grayscale conversion
    2. Gaussian noise reduction
    3. Contrast enhancement via CLAHE
    4. Binarization via Otsu's method (inverted: text = white, background = black)
    5. Deskew via dominant angle estimation from Hough lines
"""

import logging

import cv2
import numpy as np

logger = logging.getLogger(__name__)


def to_grayscale(image: np.ndarray) -> np.ndarray:
    """Convert an RGB image to grayscale."""
    if len(image.shape) == 2:
        return image
    return cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)


def reduce_noise(gray: np.ndarray) -> np.ndarray:
    """Apply Gaussian blur to suppress high-frequency noise."""
    return cv2.GaussianBlur(gray, (3, 3), 0)


def enhance_contrast(gray: np.ndarray) -> np.ndarray:
    """Apply CLAHE to improve local contrast before thresholding."""
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(gray)


def binarize(enhanced: np.ndarray) -> np.ndarray:
    """
    Binarize using Otsu's method with inversion.
    Result convention: text pixels = 255 (white), background = 0 (black).
    This makes text foreground easy to detect as positive blobs.
    """
    _, binary = cv2.threshold(
        enhanced, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )
    return binary


def deskew(binary: np.ndarray) -> np.ndarray:
    """
    Estimate and correct image skew using the Hough line transform.

    Approach: detect prominent lines in the binary image, compute their
    dominant angle, and rotate the image to align text horizontally.
    Correction is skipped when the estimated angle is less than 0.5 degrees.

    Limitation: works best on images with clear horizontal text lines and
    minimal non-text structure. May introduce artifacts on complex layouts.
    """
    edges = cv2.Canny(binary, 50, 150, apertureSize=3)
    lines = cv2.HoughLines(edges, 1, np.pi / 180, threshold=100)

    if lines is None:
        logger.debug("Deskew: no lines detected, skipping correction.")
        return binary

    angles: list[float] = []
    for line in lines[:40]:
        theta = float(line[0][1])
        # Convert theta to angle relative to horizontal
        angle = np.degrees(theta) - 90.0
        if -45 < angle < 45:
            angles.append(angle)

    if not angles:
        return binary

    median_angle = float(np.median(angles))
    if abs(median_angle) < 0.5:
        return binary

    logger.debug("Deskew: rotating by %.2f degrees.", median_angle)
    h, w = binary.shape
    center = (w // 2, h // 2)
    rotation_matrix = cv2.getRotationMatrix2D(center, median_angle, 1.0)
    rotated = cv2.warpAffine(
        binary,
        rotation_matrix,
        (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=0,
    )
    return rotated


def preprocess(image: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    Full preprocessing pipeline.

    Returns:
        gray   -- grayscale image (for display / debugging)
        binary -- binarized, deskewed image ready for region detection
    """
    gray = to_grayscale(image)
    denoised = reduce_noise(gray)
    enhanced = enhance_contrast(denoised)
    binary = binarize(enhanced)
    corrected = deskew(binary)
    return gray, corrected
