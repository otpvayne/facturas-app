"""
query_service.py

Query builder and data-access layer for factura listing and detail retrieval.

Design goals:
    - Filters are accumulated as a list of SQLAlchemy conditions, then
      combined with and_(). This avoids nested if-chains and makes adding
      new filters a one-line change.
    - Pagination and sorting are applied after filtering so the count
      query and the data query share the same conditions.
    - No business logic lives here; this module only talks to the DB.
"""

import math
import uuid
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Literal

from sqlalchemy import Date, and_, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.factura import Factura
from app.models.ocr_result import OcrResult
from app.schemas.factura import FacturaDetail, FacturaSummary, OcrBlock, PaginatedResponse

# Allowed values for status filter and sort_by parameter
VALID_STATUSES: frozenset[str] = frozenset(
    {"uploaded", "processing", "processed", "needs_review", "validated", "failed"}
)

SORTABLE_COLUMNS: dict[str, object] = {
    "created_at": Factura.created_at,
    "monto_total": Factura.monto_total,
    "proveedor": Factura.proveedor,
    "status": Factura.status,
}


# ---------------------------------------------------------------------------
# Filter parameters dataclass
# ---------------------------------------------------------------------------


@dataclass
class FacturaFilters:
    proveedor: str | None = None
    status: str | None = None
    date_from: date | None = None
    date_to: date | None = None
    total: Decimal | None = None
    total_min: Decimal | None = None
    total_max: Decimal | None = None
    q: str | None = None
    sort_by: str = "created_at"
    sort_order: Literal["asc", "desc"] = "desc"
    page: int = 1
    page_size: int = 20


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def list_facturas(
    db: AsyncSession, filters: FacturaFilters
) -> PaginatedResponse[FacturaSummary]:
    conditions = _build_conditions(filters)

    # Total count (separate query to avoid loading rows)
    count_q = select(func.count()).select_from(Factura)
    if conditions:
        count_q = count_q.where(and_(*conditions))
    total_items: int = (await db.execute(count_q)).scalar_one()

    # Data query with sort + pagination
    sort_col = SORTABLE_COLUMNS.get(filters.sort_by, Factura.created_at)
    order_expr = sort_col.asc() if filters.sort_order == "asc" else sort_col.desc()  # type: ignore[union-attr]

    data_q = select(Factura).order_by(order_expr)
    if conditions:
        data_q = data_q.where(and_(*conditions))
    offset = (filters.page - 1) * filters.page_size
    data_q = data_q.offset(offset).limit(filters.page_size)

    rows = (await db.execute(data_q)).scalars().all()

    total_pages = max(1, math.ceil(total_items / filters.page_size))

    items = [
        FacturaSummary(
            factura_id=f.id,
            numero=f.numero,
            proveedor=f.proveedor,
            monto_total=f.monto_total,
            moneda=f.moneda,
            status=f.status,
            estado=f.estado,
            image_url=f.image_url,
            created_at=f.created_at,
        )
        for f in rows
    ]

    return PaginatedResponse(
        items=items,
        total_items=total_items,
        total_pages=total_pages,
        page=filters.page,
        page_size=filters.page_size,
    )


async def get_factura_detail(
    db: AsyncSession, factura_id: uuid.UUID
) -> FacturaDetail | None:
    result = await db.execute(select(Factura).where(Factura.id == factura_id))
    factura = result.scalar_one_or_none()
    if factura is None:
        return None

    ocr = await _get_latest_ocr(db, factura_id)
    ocr_block: OcrBlock | None = None
    if ocr is not None:
        ocr_block = OcrBlock(
            ocr_result_id=ocr.id,
            pipeline_status=ocr.status,
            confidence_estimate=ocr.confidence_estimate,
            extracted_provider=ocr.extracted_provider,
            extracted_date=ocr.extracted_date,
            extracted_total=ocr.extracted_total,
            validated_provider=ocr.validated_provider,
            validated_date=ocr.validated_date,
            validated_total=ocr.validated_total,
            validated_by=ocr.validated_by,
            validated_at=ocr.validated_at,
            was_manually_edited=ocr.was_manually_edited,
            validation_notes=ocr.validation_notes,
        )

    return FacturaDetail(
        factura_id=factura.id,
        numero=factura.numero,
        proveedor=factura.proveedor,
        monto_total=factura.monto_total,
        moneda=factura.moneda,
        descripcion=factura.descripcion,
        status=factura.status,
        estado=factura.estado,
        image_url=factura.image_url,
        created_at=factura.created_at,
        updated_at=factura.updated_at,
        ocr=ocr_block,
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _build_conditions(filters: FacturaFilters) -> list:
    """
    Accumulate SQLAlchemy WHERE conditions from filter values.
    Each active filter adds exactly one entry to the list.
    """
    conditions: list = []

    if filters.proveedor:
        conditions.append(Factura.proveedor.ilike(f"%{filters.proveedor}%"))

    if filters.status:
        conditions.append(Factura.status == filters.status)

    if filters.date_from:
        conditions.append(cast(Factura.created_at, Date) >= filters.date_from)

    if filters.date_to:
        conditions.append(cast(Factura.created_at, Date) <= filters.date_to)

    # exact total takes precedence over range
    if filters.total is not None:
        conditions.append(Factura.monto_total == filters.total)
    else:
        if filters.total_min is not None:
            conditions.append(Factura.monto_total >= filters.total_min)
        if filters.total_max is not None:
            conditions.append(Factura.monto_total <= filters.total_max)

    if filters.q:
        term = f"%{filters.q}%"
        conditions.append(
            or_(
                Factura.proveedor.ilike(term),
                Factura.numero.ilike(term),
            )
        )

    return conditions


async def _get_latest_ocr(
    db: AsyncSession, factura_id: uuid.UUID
) -> OcrResult | None:
    result = await db.execute(
        select(OcrResult)
        .where(OcrResult.factura_id == factura_id)
        .order_by(OcrResult.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()
