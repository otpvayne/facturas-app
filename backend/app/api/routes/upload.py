import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.factura import Factura
from app.services import storage_service

router = APIRouter(prefix="/upload", tags=["upload"])

MAX_READ_CHUNK = 10 * 1024 * 1024 + 1


class UploadResponse(BaseModel):
    factura_id: uuid.UUID
    image_url: str
    status: str


@router.post("/", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_factura_image(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
) -> UploadResponse:
    file_bytes = await file.read(MAX_READ_CHUNK)

    try:
        storage_service.validate_image(
            filename=file.filename or "",
            content_type=file.content_type or "",
            size_bytes=len(file_bytes),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    try:
        image_url = storage_service.upload_image(
            file_bytes=file_bytes,
            original_filename=file.filename or "imagen.jpg",
            content_type=file.content_type or "image/jpeg",
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    factura = Factura(image_url=image_url, status="uploaded")
    db.add(factura)
    await db.flush()
    await db.refresh(factura)

    return UploadResponse(
        factura_id=factura.id,
        image_url=image_url,
        status=factura.status,
    )