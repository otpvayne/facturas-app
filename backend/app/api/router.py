from fastapi import APIRouter

from app.api.routes import auth, factura, health, ocr, query, upload, validation

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)         # POST /auth/login, /auth/register — no auth required
api_router.include_router(query.router)       # GET /facturas  (list) — before factura to avoid shadowing
api_router.include_router(factura.router)     # POST /facturas  GET /facturas/{id}
api_router.include_router(upload.router)
api_router.include_router(ocr.router)
api_router.include_router(validation.router)
