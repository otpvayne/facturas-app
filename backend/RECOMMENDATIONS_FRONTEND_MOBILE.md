# Recomendaciones Antes de Pasar a Frontend/Mobile

**Fecha**: 2026-03-30
**Estado del Backend**: Funcional con limitaciones documentadas (Fase 7 completa)

---

## 1. Seguridad (CRÍTICO)

### 1.1 Implementar Autenticación JWT

**Por qué**: Actualmente cualquiera puede acceder a todos los datos y crear facturas.

**Cómo**:
```bash
pip install python-jose pydantic-settings
```

```python
# app/core/security.py
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi.security import HTTPBearer, HTTPAuthCredentials

SECRET_KEY = "tu-secret-key-muy-largo"
ALGORITHM = "HS256"

def create_access_token(user_id: str, expires_delta: timedelta = None):
    to_encode = {"sub": user_id}
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=24)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: HTTPAuthCredentials = Depends(HTTPBearer())):
    try:
        payload = jwt.decode(token.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user_id
```

**Endpoints afectados**:
- Todos los POST (crear factura, upload, validate)
- GET debe filtrar por user_id del token
- Health puede quedar sin auth

**Timeline**: 2-3 horas de implementación

---

### 1.2 Agregar Rate Limiting

**Por qué**: Sin límites, DoS es trivial (bombardear con /ocr/process).

**Cómo**:
```bash
pip install slowapi
```

```python
# main.py
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, custom_rate_limit_exceeded)

# En cada router
@limiter.limit("10/minute")
@router.post("/upload/")
async def upload_factura_image(...):
    ...

@limiter.limit("5/minute")  # Más restrictivo para OCR (CPU-heavy)
@router.post("/ocr/process/{factura_id}")
async def process_ocr(...):
    ...
```

**Recomendaciones por endpoint**:
- POST /facturas: 20 req/min (creación normal)
- POST /upload: 10 req/min (imágenes grandes)
- POST /ocr/process: 5 req/min (CPU-heavy)
- GET /facturas: 30 req/min (listados)

**Timeline**: 1 hora

---

## 2. Base de Datos y Escalabilidad

### 2.1 Agregar user_id a Facturas

**Por qué**: Facturas deben separarse por usuario (multi-tenant).

**Migration Alembic**:
```python
# alembic/versions/xxx_add_user_id_to_facturas.py
def upgrade():
    op.add_column('facturas', sa.Column('user_id', sa.String(255), nullable=True))
    op.create_index('ix_facturas_user_id', 'facturas', ['user_id'])

def downgrade():
    op.drop_index('ix_facturas_user_id', 'facturas')
    op.drop_column('facturas', 'user_id')
```

**Modelo actualizado**:
```python
# app/models/factura.py
class Factura(Base):
    ...
    user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
```

**Timeline**: 1 hora

---

### 2.2 Pasar a Supabase Plan Pagado (Opcional pero Recomendado)

**Actual**: Free tier tiene limitaciones:
- Pausa después de 1 semana inactivo
- 60 conexiones máximo
- Sin SLA

**Plan recomendado**: Supabase Pro ($25/mes)
- Conexiones ilimitadas
- No pausa
- SLA 99.9%
- Suficiente para 1000+ usuarios

**Si se queda en free**: Implementar cron para "despertar" cada 6 días

---

## 3. API y Documentación

### 3.1 OpenAPI Schema Actualizado

**Actual**: FastAPI genera automáticamente, está OK.

**Mejoras**:
```python
# main.py
app = FastAPI(
    title="Facturas API",
    version="1.0.0",
    description="Backend para gestión de facturas con OCR",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Documentar en cada endpoint
@router.post("/facturas/", tags=["Facturas"])
async def crear_factura(
    payload: FacturaCreate,
    current_user: str = Depends(get_current_user),
):
    """
    Crear nueva factura.

    - **numero**: Número único de factura (ej: INV-001)
    - **proveedor**: Nombre del proveedor
    - **monto_total**: Monto en decimales

    Retorna: Factura creada con ID generado
    """
```

**Timeline**: 1 hora

---

### 3.2 Versioning de API

**Actual**: /api/v1 está bien, pero documentar futura compatibilidad.

**Recomendación**:
- No hacer cambios breaking en v1
- Si cambios mayores: crear v2 en paralelo
- Deprecate v1 después de 6 meses

---

## 4. Testing y QA

### 4.1 Tests de Integración End-to-End

**Actual**: Tests unitarios creados (conftest.py + test_*.py)

**Agregar**:
```python
# tests/test_e2e.py
@pytest.mark.asyncio
async def test_complete_invoice_workflow():
    """Test completo: crear → upload → OCR → validar"""
    # 1. Crear factura
    # 2. Upload imagen
    # 3. Process OCR
    # 4. Validar manualmente
    # 5. Verificar estado final
```

**Timeline**: 3 horas

---

### 4.2 Tests de Carga

**Antes de producción**: Probar con 50-100 usuarios simultáneos.

```bash
# Con locust
pip install locust

# locustfile.py
from locust import HttpUser, task

class InvoiceUser(HttpUser):
    @task
    def list_invoices(self):
        self.client.get("/api/v1/facturas")

    @task
    def create_invoice(self):
        self.client.post("/api/v1/facturas", json={...})

# Ejecutar
locust -f locustfile.py --host=http://localhost:8000
```

**Objetivos**:
- 50 usuarios concurrentes sin timeout
- Latencia promedio < 500ms
- Sin errores 5xx

**Timeline**: 2 horas de setup + pruebas

---

## 5. Performance (OCR)

### 5.1 Comprimir Imágenes Antes de OCR

**Actual**: OCR procesa imagen full-size, puede timeout >30s.

**Solución**:
```python
# app/services/ocr/pipeline.py
from PIL import Image

def compress_image_for_ocr(image_path: str, max_width: int = 1024):
    img = Image.open(image_path)
    if img.width > max_width:
        ratio = max_width / img.width
        new_height = int(img.height * ratio)
        img = img.resize((max_width, new_height), Image.LANCZOS)
    return img
```

**Impacto**: OCR 3-5x más rápido con imágenes grandes.

**Timeline**: 1 hora

---

### 5.2 Opción: Integrar Tesseract para OCR de Letras

**Actual MVE**: Solo extrae dígitos.

**Para producción**: Usar Tesseract para reconocer texto.

```bash
pip install pytesseract
# En Render: agregar buildpack para Tesseract
```

```python
# app/services/ocr/ocr_engine.py (refactor)
import pytesseract

def extract_text_with_tesseract(image_array):
    text = pytesseract.image_to_string(image_array, lang='spa')
    # Parser para extraer número, proveedor, etc.
    return parse_invoice_text(text)
```

**Timeline**: 4-6 horas

**Recomendación**: Hacer DESPUÉS de que frontend esté lista (no bloquea).

---

## 6. Deployment y Operaciones

### 6.1 Environment Variables

**Actual**: app/core/config.py gestiona bien.

**Verificar en Render dashboard**:
- [ ] ENVIRONMENT = "production"
- [ ] DEBUG = "false"
- [ ] DATABASE_URL (Supabase PostgreSQL)
- [ ] SUPABASE_URL, SUPABASE_KEY
- [ ] CORS_ORIGINS (agregar dominio del frontend)

---

### 6.2 CORS Configuration

**Actual**: CORS permite todos los orígenes en development, limitado en producción.

**Para frontend en dominio específico**:
```python
# app/core/config.py
CORS_ORIGINS = ["https://frontend.example.com", "https://www.frontend.example.com"]
```

**En main.py ya está manejado**:
```python
origins = settings.cors_origins_list  # Lee de .env
```

---

### 6.3 Monitoreo

**Opciones gratuitas**:

1. **Datadog Free Tier**:
   ```bash
   pip install datadog
   # 5 hosts gratis, logs incluidos
   ```

2. **Sentry** (para errores):
   ```bash
   pip install sentry-sdk
   import sentry_sdk
   sentry_sdk.init("https://xxx@xxx.ingest.sentry.io/xxx")
   ```

3. **Render Logs** (nativo):
   - Ir a Render dashboard → Logs
   - Ver errores en tiempo real
   - Suficiente para MVP

---

## 7. Documentación para Frontend

### 7.1 API Specification

**Disponible automáticamente**:
- OpenAPI/Swagger: `https://backend-url/docs`
- ReDoc: `https://backend-url/redoc`

**Para compartir con frontend**:
```bash
# Exportar OpenAPI spec como JSON
curl https://backend-url/openapi.json > api-spec.json
```

---

### 7.2 Error Handling Reference

**Crear documento para frontend**:

```markdown
# Error Codes

## 400 Bad Request
- Payload malformado (JSON inválido)

## 401 Unauthorized
- Token JWT inválido o expirado
- HEADER requerido: Authorization: Bearer {token}

## 404 Not Found
- Factura no existe
- OCR result no existe

## 409 Conflict
- Número de factura ya existe

## 422 Unprocessable Entity
- Validación fallida (payload inválido)
- Monto negativo, email inválido, etc.
- Respuesta incluye "detail" con mensajes específicos

## 502 Bad Gateway
- Supabase storage no disponible
- Intentar de nuevo en 30s

## 503 Service Unavailable
- Servidor reiniviando (Render cold start)
- Esperar 30s y reintentar
```

**Timeline**: 1 hora

---

## 8. Frontend Integration Checklist

Antes de que el frontend comience:

- [ ] Backend deployado en Render
- [ ] Autenticación JWT implementada
- [ ] Rate limiting activo
- [ ] CORS configurado para dominio del frontend
- [ ] OpenAPI docs accesibles en /docs
- [ ] Tests E2E pasando
- [ ] Documentación de API compartida
- [ ] Error handling documentado
- [ ] Logs siendo monitorados
- [ ] Backup de BD configurado (Supabase)

---

## 9. Timeline Recomendado

### Antes de Frontend (CRÍTICO - 1 semana)
1. Implementar autenticación JWT (2h)
2. Agregar rate limiting (1h)
3. Agregar user_id a facturas (1h)
4. Tests E2E (3h)
5. Documentación API (1h)
6. Testing manual completo (2h)

**Total**: ~10 horas = 2 días de trabajo

### Paralelo con Frontend (IMPORTANTE)
- Comprimir imágenes antes de OCR (1h)
- Mejorar logging y monitoreo (2h)
- Tests de carga (2h)

### Después de MVP (FUTURO)
- Tesseract OCR para letras (4-6h)
- Plan pagado Supabase (si demanda lo requiere)
- Integración con sistema de pago real

---

## 10. Go/No-Go Checklist para Frontend

**Responde SÍ a TODO antes de iniciar**:

- [ ] ¿Backend deployado en Render y accesible?
- [ ] ¿Autenticación JWT funcionando?
- [ ] ¿Rate limiting en lugar?
- [ ] ¿CORS configurado para frontend domain?
- [ ] ¿Tests unitarios pasando (pytest)?
- [ ] ¿Tests E2E pasando?
- [ ] ¿OpenAPI docs viewable en /docs?
- [ ] ¿Supabase storage bucket creado?
- [ ] ¿Database migraciones aplicadas (alembic upgrade head)?
- [ ] ¿Error handling documentado para frontend?
- [ ] ¿Known risks y limitaciones documentados?
- [ ] ¿Plan B si Supabase falla?

Si alguno es **NO**: Solucionarlo antes de que frontend empiece.

---

## 11. Contacto y Escalación

**Si frontend encuentra problema**:

1. Revisar OpenAPI docs en /docs
2. Revisar KNOWN_RISKS.md para limitaciones
3. Revisar error message en respuesta API
4. Revisar logs de Render dashboard
5. Crear issue describiendo:
   - Endpoint llamado
   - Payload enviado
   - Respuesta recibida
   - Logs relevantes

---

## Conclusión

Backend está **LISTO PARA FRONTEND** con:

✅ Arquitectura sólida
✅ Error handling coherente
✅ Tests en lugar
✅ Documentación completa
✅ Limitaciones documentadas

⚠️ Agregar autenticación JWT antes de pasar a frontend
⚠️ Configurar rate limiting
⚠️ Tests E2E

**Estimado**: 2 días de trabajo preparatorio → Backend 100% listo para integración.
