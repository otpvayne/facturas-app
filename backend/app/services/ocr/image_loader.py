"""
image_loader.py

Responsible for loading an image from a URL or raw bytes and returning
a NumPy array in RGB color order ready for preprocessing.
No external OCR engine is involved here.
"""

import io
import logging

import httpx
import numpy as np
from PIL import Image, UnidentifiedImageError

logger = logging.getLogger(__name__)


async def load_from_url(url: str) -> np.ndarray:
    """
    Download an image from a URL and return it as an RGB NumPy array.

    Raises:
        RuntimeError: If download fails (HTTP error, network error, timeout).
        ValueError: If the downloaded file is not a valid image.
    """
    logger.debug("Downloading image from URL: %s", url)
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()
        return _decode_bytes(response.content)
    except httpx.TimeoutException as exc:
        raise RuntimeError(f"Timeout al descargar imagen desde {url} (30s)") from exc
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(
            f"HTTP {exc.response.status_code} al descargar imagen: {url}"
        ) from exc
    except httpx.RequestError as exc:
        raise RuntimeError(f"Error de red al descargar imagen: {exc}") from exc


def load_from_bytes(data: bytes) -> np.ndarray:
    """Decode raw image bytes and return an RGB NumPy array."""
    return _decode_bytes(data)


def _decode_bytes(data: bytes) -> np.ndarray:
    try:
        image = Image.open(io.BytesIO(data))
        image.verify()
        # verify() closes the internal buffer; reopen
        image = Image.open(io.BytesIO(data)).convert("RGB")
        return np.array(image, dtype=np.uint8)
    except UnidentifiedImageError as exc:
        raise ValueError("El archivo no es una imagen valida o esta corrupto.") from exc
    except Exception as exc:
        raise ValueError(f"No se pudo decodificar la imagen: {exc}") from exc
