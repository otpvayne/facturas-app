"""
GET /facturas  -- paginated list with filters and sorting.

Query parameters are grouped using a dependency class so the route
signature stays clean and validation is centralised in one place.
"""

import uuid
from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.factura import FacturaDetail, FacturaSummary, PaginatedResponse
from app.services import query_service
from app.services.query_service import VALID_STATUSES, FacturaFilters

router = APIRouter(prefix="/facturas", tags=["query"])


# ---------------------------------------------------------------------------
# Query-parameter dependency
# ---------------------------------------------------------------------------


class FacturaQueryParams:
    """
    Groups all filter, sort, and pagination parameters.
    Business-rule validation (coherent ranges, valid status) runs here
    so the route handler stays free of validation logic.
    """

    def __init__(
        self,
        proveedor: Annotated[
            str | None,
            Query(description="Filtrar por nombre de proveedor (busqueda parcial)"),
        ] = None,
        status: Annotated[
            str | None,
            Query(description=f"Estado del flujo. Valores: {', '.join(sorted(VALID_STATUSES))}"),
        ] = None,
        date_from: Annotated[
            date | None,
            Query(description="Fecha de carga desde (YYYY-MM-DD, inclusive)"),
        ] = None,
        date_to: Annotated[
            date | None,
            Query(description="Fecha de carga hasta (YYYY-MM-DD, inclusive)"),
        ] = None,
        total: Annotated[
            Decimal | None,
            Query(description="Total exacto de la factura"),
        ] = None,
        total_min: Annotated[
            Decimal | None,
            Query(description="Total minimo (>=)"),
        ] = None,
        total_max: Annotated[
            Decimal | None,
            Query(description="Total maximo (<=)"),
        ] = None,
        q: Annotated[
            str | None,
            Query(description="Busqueda libre en proveedor y numero de factura"),
        ] = None,
        sort_by: Annotated[
            Literal["created_at", "monto_total", "proveedor", "status"],
            Query(description="Campo por el cual ordenar"),
        ] = "created_at",
        sort_order: Annotated[
            Literal["asc", "desc"],
            Query(description="Direccion del ordenamiento"),
        ] = "desc",
        page: Annotated[int, Query(ge=1, description="Numero de pagina (empieza en 1)")] = 1,
        page_size: Annotated[
            int, Query(ge=1, le=100, description="Resultados por pagina (max 100)")
        ] = 20,
    ) -> None:
        # Validate status value
        if status is not None and status not in VALID_STATUSES:
            raise HTTPException(
                status_code=status_code_422,
                detail=f"Estado invalido: '{status}'. Valores permitidos: {', '.join(sorted(VALID_STATUSES))}.",
            )

        # Validate date range coherence
        if date_from and date_to and date_from > date_to:
            raise HTTPException(
                status_code=status_code_422,
                detail="date_from no puede ser posterior a date_to.",
            )

        # Validate total range coherence
        if total_min is not None and total_max is not None and total_min > total_max:
            raise HTTPException(
                status_code=status_code_422,
                detail="total_min no puede ser mayor que total_max.",
            )

        self.filters = FacturaFilters(
            proveedor=proveedor,
            status=status,
            date_from=date_from,
            date_to=date_to,
            total=total,
            total_min=total_min,
            total_max=total_max,
            q=q,
            sort_by=sort_by,
            sort_order=sort_order,
            page=page,
            page_size=page_size,
        )


# FastAPI resolves HTTPException inside __init__ correctly;
# the 422 status code is referenced before instantiation so we name it here.
status_code_422 = status.HTTP_422_UNPROCESSABLE_ENTITY


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "",
    response_model=PaginatedResponse[FacturaSummary],
    summary="Listar facturas con filtros y paginacion",
)
async def listar_facturas(
    params: Annotated[FacturaQueryParams, Depends()],
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[FacturaSummary]:
    return await query_service.list_facturas(db, params.filters)
