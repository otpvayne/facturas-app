# Riesgos Conocidos y Limitaciones

**Última actualización**: 2026-03-30

---

## 1. OCR MVP - Solo reconoce dígitos

### Severidad: ALTA (diseño)

**Descripción**:
El pipeline OCR actual usa OpenCV con template matching y solo extrae dígitos. Las letras retornan como "?" en el texto extraído.

**Impacto**:
- No se puede extraer nombre del proveedor (solo dígitos como RUC)
- extracted_provider siempre es None en OCR raw
- El usuario DEBE proporcionar manualmente el nombre del proveedor en validación

**Caso de uso limitado**:
Funciona bien para facturas con estructura predecible (número de factura, monto total). No funciona para información textual.

**Cuándo afecta**:
- POST /api/v1/ocr/process/{id} → extracted_provider será None
- GET /api/v1/facturas/{id}/ocr-result → extracted_provider será None
- El usuario debe usar PATCH /validate con validated_provider

**Mitigación**:
- **Corto plazo**: Documentar que OCR solo extrae dígitos
- **Mediano plazo**: Integrar Tesseract o modelo ML para OCR de letras
- **Actual**: Flujo validación manual compensa esta limitación

**Estado**: ACEPTADO (limitación de MVP)

---

## 2. Supabase Free Tier - Pausa automática después de 1 semana

### Severidad: MEDIA (operacional)

**Descripción**:
Supabase free tier pausa el proyecto si no hay actividad por 1 semana. Las queries fallan con "connection refused" o similar.

**Impacto**:
- Usuarios en demo/testing sienten "se cayó el servidor"
- Requiere visitar dashboard Supabase para reactivar manualmente
- Sin SLA de uptime

**Cuándo ocurre**:
- Después de 7 días sin requests a la BD
- POST /health no cuenta (no toca BD)
- Usuarios deben hacer query de facturas para "despertar" Supabase

**Error observado**:
```
sqlalchemy.exc.OperationalError: (asyncpg.exceptions.CannotConnectNowError)
server closed the connection unexpectedly
```

**Mitigación**:
- **Corto plazo**: Agregar monitor que haga ping a BD cada 6 días (cron en Render)
- **Mediano plazo**: Pasar a plan pagado de Supabase ($25/mes)
- **Actual**: Documentar en README que puede pausar

**Workaround si ocurre**:
1. Ir a supabase.com/dashboard
2. Visitar el proyecto
3. Servidor se reactiva automáticamente
4. Esperar ~30 segundos

**Estado**: MITIGABLE con cron job

---

## 3. Límite de conexiones - 60 simultáneas en Supabase free

### Severidad: MEDIA (escala)

**Descripción**:
Supabase free tier permite máx 60 conexiones simultáneas a la BD. Si se agota, nuevas conexiones rechazan.

**Impacto**:
- No se pueden tener múltiples workers uvicorn (por eso --workers 1)
- Bajo 5-10 usuarios concurrentes el servidor está seguro
- A 20+ usuarios concurrentes riesgo de agotamiento

**Cuándo ocurre**:
- GET /api/v1/facturas?limit=1000 con muchos usuarios en paralelo
- POST /api/v1/ocr/process con múltiples requests simultáneos
- Cargas de prueba con 50+ requests/segundo

**Error observado**:
```
sqlalchemy.exc.OperationalError:
FATAL: sorry, too many clients already
```

**Mitigación**:
- **Corto plazo**: Pool size configurado en session.py (25 max connections)
- **Actual config**: --workers 1 en Procfile limita concurrencia
- **Mejor**: Usar connection pooling inteligente

```python
# En session.py, pool_size y max_overflow controlan esto
pool_size=5,           # Conexiones activas
max_overflow=10,       # Conexiones extra temporales
pool_pre_ping=True,    # Verifica conexión antes de usar
```

**Estado**: MANEJADO con pool limits, pero escalado limitado

---

## 4. OCR - Lentitud en imágenes grandes

### Severidad: MEDIA (performance)

**Descripción**:
OpenCV + numpy procesamiento es CPU-bound. Imágenes >5MB toman tiempo, timeout a los 30s.

**Impacto**:
- POST /api/v1/ocr/process/{id} puede timeout con imágenes grandes
- Render free tier (512MB RAM) aún más lento
- Usuario ve error "timeout" en lugar de OCR result

**Cuándo ocurre**:
- Imagen >10MB
- Imagen >2000x2000 pixels
- Múltiples OCR en paralelo (saturan CPU)

**Error esperado**:
```
RuntimeError: Timeout al descargar imagen desde {url} (30s)
```

**Mitigación**:
- **Corto plazo**: Documentar límite de ~5MB para OCR
- **Mejor**: Comprimir imagen ANTES de OCR
  ```python
  # En upload.py o OCR service
  img = Image.open(...)
  if img.size > (2000, 2000):
      img.thumbnail((2000, 2000), Image.Resampling.LANCZOS)
      # Salvar versión comprimida
  ```
- **Actual**: Usuario puede subir imagen pequeña

**Estado**: LIMITADO pero documentado

---

## 5. No hay autenticación ni autorización

### Severidad: CRÍTICO (seguridad)

**Descripción**:
Cualquiera puede:
- Subir facturas
- Ver todas las facturas de otros usuarios
- Procesar OCR en cualquier imagen
- Validar cualquier factura

**Impacto**:
- No apto para producción real
- Apto para demo académica y testing
- Riesgo de abuso/spam en servidor público

**Casos de riesgo**:
```bash
# Cualquiera puede hacer esto
curl -X POST https://{render-url}/api/v1/facturas/ -H "Content-Type: application/json" -d '{"numero":"FAKE-001",...}'
curl https://{render-url}/api/v1/facturas  # Ve todas las facturas
```

**Mitigación**:
- **Corto plazo**: Implementar JWT auth (fastapi-jwt-extended)
  ```python
  from fastapi.security import HTTPBearer
  security = HTTPBearer()

  @router.post("/facturas/")
  async def crear(payload, token = Depends(security)):
      user_id = decode_token(token.credentials)
  ```
- **Mediano plazo**: OAuth con Google/Auth0
- **Actual**: Aceptable para demo

**Estado**: DEBE hacerse antes de producción real

---

## 6. No hay rate limiting

### Severidad: ALTO (disponibilidad)

**Descripción**:
No hay límite de requests por IP/usuario. Alguien puede bombardear el servidor.

**Impacto**:
- DoS posible: /api/v1/ocr/process en loop
- BD se sobrecarga
- Servidor puede quedar no disponible

**Casos de riesgo**:
```bash
# DoS simple
for i in {1..1000}; do
  curl -X POST https://{render-url}/api/v1/upload/ -F "file=@big.jpg" &
done
```

**Mitigación**:
- **Corto plazo**: Agregar fastapi-slowapi
  ```bash
  pip install slowapi
  ```
  ```python
  from slowapi import Limiter
  from slowapi.util import get_remote_address

  limiter = Limiter(key_func=get_remote_address)

  @limiter.limit("10/minute")
  @router.post("/upload/")
  async def upload_factura_image(...):
  ```
- **Mediano plazo**: Redis-based rate limiting para scale
- **Actual**: Aceptable para demo

**Estado**: FÁCIL de agregar, debe hacerse antes de público

---

## 7. OpenCV-headless - Sin GUI, posibles issues en imágenes corruptas

### Severidad: BAJA

**Descripción**:
opencv-python-headless (requerido en Render) no tiene soporte para window display. Si imagen es corrupta, PIL.Image.verify() a veces no detecta.

**Impacto**:
- Imagen corrupta mal detectada → error vago en OCR
- No se puede debuggear visualmente en producción

**Mitigación**:
- **Actual**: PIL.Image.verify() + try/except cubre la mayoría de casos
- **Mejor**: Agregar más validaciones en validate_image()
  ```python
  # En storage_service.py
  def validate_image(filename, content_type, size_bytes):
      # Agregar más checks
      if size_bytes < 1024:  # Archivo muy pequeño
          raise ValueError("Imagen muy pequeña (posible corrupta)")
  ```

**Estado**: MANEJADO pero puede mejorar

---

## 8. Logs no diferenciados entre local y producción (parcial)

### Severidad: BAJA

**Descripción**:
logging.basicConfig está en main.py pero algunos módulos logguean antes de que se configure.

**Impacto**:
- Primeros logs pueden tener formato inconsistente
- En producción algunos logs pueden perderse

**Mitigación**:
- **Actual**: Ya está parcialmente mitigado (logging.basicConfig early en main.py)
- **Mejor**: Mover logging.basicConfig a app/__init__.py

**Estado**: MENOR

---

## 9. DATABASE_URL no validado en startup

### Severidad: BAJA (startup)

**Descripción**:
Si DATABASE_URL es inválido, el error ocurre al hacer primera query, no en startup.

**Impacto**:
- Startup lento si URL es malformada
- Usuario no sabe que está mal configurado hasta hacer primer request

**Mitigación**:
- **Actual**: URL se prueba al crear engine (create_async_engine)
- **Mejor**: Agregar validación pydantic
  ```python
  from pydantic import validator

  class Settings:
      DATABASE_URL: str

      @validator("DATABASE_URL")
      def validate_db_url(cls, v):
          if not v.startswith(("postgresql://", "postgresql+asyncpg://")):
              raise ValueError("DATABASE_URL debe ser PostgreSQL async")
          return v
  ```

**Estado**: MENOR, pero fácil de mejorar

---

## 10. No hay timeout en descargas de imágenes desde Supabase (FIXED)

### Severidad: BAJA (ya corregido)

**Descripción**:
En la versión anterior, httpx no tenía timeout explícito. YA FUE CORREGIDO.

**Versión actual**:
```python
# app/services/ocr/image_loader.py:29
async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
```

- **Timeout**: 30 segundos
- **Exception handler**: Explícito para TimeoutException
- **Error message**: "Timeout al descargar imagen desde {url} (30s)"

**Estado**: FIXED ✅

---

## 11. No hay monitoreo de recursos (RAM, CPU)

### Severidad: BAJA (observabilidad)

**Descripción**:
No hay métricas de uso de RAM/CPU. En Render free (512MB) es importante detectar leaks.

**Impacto**:
- No se ve si hay memory leak en OCR
- No se sabe cuándo se aproxima al límite de 512MB

**Mitigación**:
- **Corto plazo**: Logs de psutil
  ```python
  import psutil
  # En middleware o cron
  memory_usage = psutil.virtual_memory().percent
  if memory_usage > 80:
      logger.warning(f"High memory usage: {memory_usage}%")
  ```
- **Mediano plazo**: Datadog o New Relic free tier

**Estado**: ÚTIL pero no crítico para MVP

---

## Matriz de Riesgos

| Riesgo | Severidad | Impacto | Mitigation | Estado |
|--------|-----------|--------|-----------|--------|
| OCR solo dígitos | ALTA | Funcionalidad limitada | Manual validation | ACEPTADO |
| Supabase pausa | MEDIA | Downtime 1 semana | Cron monitor | MITIGABLE |
| 60 conexiones | MEDIA | Límite escala | Pool size + 1 worker | MANEJADO |
| OCR lento | MEDIA | Timeout >5MB | Documentar/comprimir | LIMITADO |
| **Sin auth** | **CRÍTICO** | **Seguridad** | **JWT before prod** | **TODO** |
| **Sin rate limit** | **ALTO** | **DoS posible** | **fastapi-slowapi** | **TODO** |
| OpenCV headless | BAJA | Debugging difícil | Validación PIL | MANEJADO |
| Logs inconsistentes | BAJA | Debugging difícil | Ya mitigado | MENOR |
| DATABASE_URL sin validar | BAJA | Startup lentitud | Validación pydantic | MENOR |
| Timeout descarga | BAJA | Hang posible | YA CORREGIDO | FIXED ✅ |
| Sin monitoreo recursos | BAJA | Memory leak no visto | psutil logs | ÚTIL |

---

## Checklist Antes de Producción Real

- [ ] Implementar autenticación JWT
- [ ] Agregar rate limiting (slowapi)
- [ ] Validar DATABASE_URL en startup
- [ ] Agregar cron monitor para Supabase pause
- [ ] Documentar límites de OCR (tamaño imagen, timeout)
- [ ] Tests de carga con 50+ usuarios concurrentes
- [ ] Configurar monitoring (logs, memory usage)
- [ ] Security audit de endpoints (OWASP)

---

## Recomendaciones por Fase

### Fase 8 (Si existe)
- [ ] Implementar JWT autenticación
- [ ] Agregar slowapi rate limiting
- [ ] Mejorar validación de inputs

### Fase 9+
- [ ] Integrar Tesseract para OCR de letras
- [ ] Comprimir imágenes antes de OCR
- [ ] Agregar monitoreo de recursos

### Antes de Pasar a Frontend/Mobile
- [ ] Autenticación obligatoria
- [ ] Rate limiting en lugar
- [ ] Tests de carga exitosos
- [ ] Documentación de limitaciones claras
