"""Test validation endpoints."""

import uuid

import pytest
from fastapi import status
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.factura import Factura
from app.models.ocr_result import OcrResult


@pytest.mark.asyncio
async def test_validate_factura_no_payload_fields(async_client: AsyncClient, test_db: AsyncSession):
    """Reject validation with empty payload (no validation fields provided)."""
    # Create a factura first
    factura = Factura(numero="INV-VAL-001", proveedor="Test")
    test_db.add(factura)
    await test_db.flush()
    await test_db.refresh(factura)

    payload = {}  # Empty payload

    response = await async_client.patch(
        f"/api/v1/facturas/{factura.id}/validate",
        json=payload
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    assert "proporcionar al menos uno" in response.json()["detail"]


@pytest.mark.asyncio
async def test_validate_factura_success(async_client: AsyncClient, test_db: AsyncSession):
    """Successfully validate a factura with manual corrections."""
    # Create a factura
    factura = Factura(numero="INV-VAL-002", proveedor="Original Provider")
    test_db.add(factura)
    await test_db.flush()
    await test_db.refresh(factura)

    # Create an OCR result for it
    ocr_result = OcrResult(
        factura_id=factura.id,
        status="success",
        extracted_provider="Bad OCR Provider",
        extracted_date="01/01/2024",
        extracted_total="1000.00",
    )
    test_db.add(ocr_result)
    await test_db.flush()
    await test_db.refresh(ocr_result)

    # Now validate with corrections
    payload = {
        "validated_provider": "Corrected Provider",
        "validated_by": "user@example.com",
        "validation_notes": "Fixed OCR mistakes",
    }

    response = await async_client.patch(
        f"/api/v1/facturas/{factura.id}/validate",
        json=payload
    )
    assert response.status_code == status.HTTP_200_OK

    data = response.json()
    assert data["validated_provider"] == "Corrected Provider"
    assert data["validated_by"] == "user@example.com"
    assert data["was_manually_edited"] is True


@pytest.mark.asyncio
async def test_validate_nonexistent_factura(async_client: AsyncClient, test_db):
    """Validate non-existent factura returns 404."""
    fake_id = uuid.uuid4()
    payload = {"validated_provider": "Some Provider"}

    response = await async_client.patch(
        f"/api/v1/facturas/{fake_id}/validate",
        json=payload
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.asyncio
async def test_get_ocr_result_success(async_client: AsyncClient, test_db: AsyncSession):
    """Retrieve OCR result for a factura."""
    factura = Factura(numero="INV-OCR-001", proveedor="Test")
    test_db.add(factura)
    await test_db.flush()
    await test_db.refresh(factura)

    ocr_result = OcrResult(
        factura_id=factura.id,
        status="success",
        extracted_provider="Supplier Inc",
        extracted_date="15/03/2024",
        extracted_total="5000.50",
        confidence_estimate=0.85,
    )
    test_db.add(ocr_result)
    await test_db.flush()
    await test_db.refresh(ocr_result)

    response = await async_client.get(f"/api/v1/facturas/{factura.id}/ocr-result")
    assert response.status_code == status.HTTP_200_OK

    data = response.json()
    assert data["extracted_provider"] == "Supplier Inc"
    assert data["extracted_date"] == "15/03/2024"
    assert data["confidence_estimate"] == 0.85


@pytest.mark.asyncio
async def test_get_ocr_result_not_found(async_client: AsyncClient, test_db: AsyncSession):
    """Get OCR result for factura without OCR processing returns 404."""
    factura = Factura(numero="INV-NO-OCR", proveedor="Test")
    test_db.add(factura)
    await test_db.flush()
    await test_db.refresh(factura)

    response = await async_client.get(f"/api/v1/facturas/{factura.id}/ocr-result")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert "aun no tiene resultado OCR" in response.json()["detail"]


@pytest.mark.asyncio
async def test_validate_blank_provider(async_client: AsyncClient, test_db: AsyncSession):
    """Reject validation with blank provider string."""
    factura = Factura(numero="INV-BLANK", proveedor="Test")
    test_db.add(factura)
    await test_db.flush()
    await test_db.refresh(factura)

    payload = {"validated_provider": "   "}  # Blank after strip

    response = await async_client.patch(
        f"/api/v1/facturas/{factura.id}/validate",
        json=payload
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    assert "vacia" in response.json()["detail"]
