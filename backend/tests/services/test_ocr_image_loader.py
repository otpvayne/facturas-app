"""Test OCR image loader utilities."""

import io

import numpy as np
import pytest
from PIL import Image

from app.services.ocr.image_loader import load_from_bytes, _decode_bytes


def create_test_image(width: int = 100, height: int = 100) -> bytes:
    """Create a simple RGB test image and return as bytes."""
    img = Image.new("RGB", (width, height), color=(73, 109, 137))
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def test_load_from_bytes_valid_png():
    """Load valid PNG image from bytes."""
    img_bytes = create_test_image(100, 100)
    result = load_from_bytes(img_bytes)

    assert isinstance(result, np.ndarray)
    assert result.shape == (100, 100, 3)  # Height, Width, RGB channels
    assert result.dtype == np.uint8


def test_load_from_bytes_valid_jpeg():
    """Load valid JPEG image from bytes."""
    img = Image.new("RGB", (50, 50), color=(255, 0, 0))
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG")
    jpeg_bytes = buffer.getvalue()

    result = load_from_bytes(jpeg_bytes)
    assert isinstance(result, np.ndarray)
    assert result.shape == (50, 50, 3)
    assert result.dtype == np.uint8


def test_load_from_bytes_invalid_data():
    """Reject non-image bytes."""
    invalid_bytes = b"This is not an image file content"

    with pytest.raises(ValueError) as exc_info:
        load_from_bytes(invalid_bytes)
    assert "valida" in str(exc_info.value).lower() or "corrupto" in str(exc_info.value).lower()


def test_load_from_bytes_empty_data():
    """Reject empty bytes."""
    with pytest.raises(ValueError):
        load_from_bytes(b"")


def test_load_from_bytes_grayscale_converted_to_rgb():
    """Grayscale image is converted to RGB."""
    # Create grayscale image
    img = Image.new("L", (80, 80), color=128)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    gray_bytes = buffer.getvalue()

    result = load_from_bytes(gray_bytes)
    assert result.shape == (80, 80, 3)  # Should be RGB (3 channels)
    assert result.dtype == np.uint8


def test_load_from_bytes_rgba_converted_to_rgb():
    """RGBA image with alpha channel is converted to RGB."""
    img = Image.new("RGBA", (60, 60), color=(100, 150, 200, 255))
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    rgba_bytes = buffer.getvalue()

    result = load_from_bytes(rgba_bytes)
    assert result.shape == (60, 60, 3)  # Should be RGB (alpha removed)
    assert result.dtype == np.uint8


def test_decode_bytes_creates_uint8_array():
    """Decoded image should be uint8 dtype for OpenCV compatibility."""
    img_bytes = create_test_image(50, 50)
    result = _decode_bytes(img_bytes)

    assert result.dtype == np.uint8
    # Values should be in valid uint8 range
    assert np.min(result) >= 0
    assert np.max(result) <= 255
