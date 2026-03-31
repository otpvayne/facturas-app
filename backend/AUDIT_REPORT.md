# Auditoría Técnica - Fase 7 Hardening

**Fecha**: 2026-03-27
**Scope**: Backend completo a través de 6 fases implementadas

---

## 1. PROBLEMAS DETECTADOS

### Críticos

**1.1 - Inconsistencia en commit/flush en routes**
- **Archivo**: `app/api/routes/upload.py:55`
- **Problema**: Usa `await db.commit()` mientras todas las otras rutas usan `await db.flush()`
- **Impacto**: Funciona pero viola el patrón establecido. El `commit()` sucede aquí y luego nuevamente en el middleware `get_db()`, creando un double-commit innecesario.
- **Severidad**: MEDIA
- **Solución**: Cambiar `await db.commit()` → `await db.flush()` para consistencia

---

### Moderados

**2.1 - Storage service usa sync Supabase client en contexto async**
- **Archivo**: `app/services/storage_service.py:16` (`create_client` en lugar de `acreate_client`)
- **Problema**: Se usa el cliente síncrono de Supabase, lo que podría bloquear el event loop si se llamara directamente en async. Actualmente se llama desde upload.py que es async.
- **Impacto**: En la práctica funciona porque es una operación rápida, pero es una mala práctica.
- **Severidad**: BAJA (en free tier, la carga es baja)
- **Nota**: Las rutas que llaman a esto son `async` pero la función es `sync`, lo cual es tolerable para operaciones breves.

**2.2 - OCR pipeline usa `asyncio.to_thread()` pero el threading puede no ser ideal en Render free**
- **Archivo**: `app/api/routes/ocr.py:96`
- **Problema**: El OCR es CPU-intensive. En Render free tier (512MB RAM), el procesamiento de imágenes grandes puede saturar el servidor.
- **Impacto**: OCR lento en imágenes grandes; posible timeout después de 30s.
- **Severidad**: MEDIA (pero documentado)
- **Mitigation**: Reducir tamaño de imagen antes de procesar en fase futura.

**2.3 - Falta manejo específico para imágenes corruptas/malformadas**
- **Archivo**: `app/services/ocr/image_loader.py:38-44`
- **Problema**: Los errores se capturan como genéricos `ValueError`
- **Impacto**: Difícil de debuggear si la imagen no es válida
- **Severidad**: BAJA
- **Solución**: Logs más descriptivos

---

### Menores

**3.1 - Config.py no valida que DATABASE_URL esté en formato correcto**
- **Archivo**: `app/core/config.py`
- **Problema**: Si DATABASE_URL no es válido, el error sale en tiempo de conexión, no en startup
- **Impacto**: Startup lento si la URL es inválida
- **Severidad**: BAJA
- **Solución**: Validación básica con pydantic

**3.2 - No hay timeout en download de imágenes desde Supabase**
- **Archivo**: `app/services/ocr/image_loader.py:21-25`
- **Problema**: httpx.AsyncClient sin timeout explícito
- **Impacto**: Si Supabase demora, la request cuelga
- **Severidad**: BAJA
- **Solución**: Agregar timeout

**3.3 - Logging no diferencia ambiente local vs producción consistentemente**
- **Archivo**: `main.py`
- **Problema**: logging.basicConfig está en main.py pero algunos módulos hacen logging antes
- **Impacto**: Inconsistencia en logs
- **Severidad**: BAJA

---

## 2. AUDITORÍA DE DEPENDENCIAS

### Dependencias usadas

Todas las dependencias en `requirements.txt` están siendo usadas:
- fastapi: rutas
- uvicorn: servidor
- sqlalchemy: ORM async
- asyncpg: driver PostgreSQL
- pydantic: validación
- supabase: storage + (eventual) realtime
- opencv-python-headless: OCR
- Pillow: manejo de imágenes
- httpx: descargas async
- python-dotenv: .env
- python-multipart: multipart forms
- alembic: migraciones

### Imports correctos

Todos los imports en el código resuelven a dependencias válidas.

---

## 3. VALIDACIÓN DE ENDPOINTS

| Endpoint | Método | Status | Notas |
|---|---|---|---|
| `/health` | GET | ✅ OK | Simple, sin BD |
| `/facturas` | POST | ✅ OK | Validación Pydantic |
| `/facturas/{id}` | GET | ✅ OK | Con OCR nested |
| `/upload` | POST | ✅ OK | Pero inconsistencia flush |
| `/ocr/process/{id}` | POST | ✅ OK | Heavy CPU |
| `/facturas/{id}/ocr-result` | GET | ✅ OK | ReadOnly |
| `/facturas/{id}/validate` | PATCH | ✅ OK | State machine |
| `/facturas` (list) | GET | ✅ OK | Filtros compilados |

---

## 4. ERRORES POTENCIALES EN STARTUP

### Local

```bash
# Requisitos:
1. .env con DATABASE_URL válida
2. Base de datos PostgreSQL corriendo
3. Migrations aplicadas (alembic upgrade head)

# Posibles errores:
- DATABASE_URL malformado → error en session.py
- Alembic no ejecutado → error de tabla no existe
- OpenCV headless no instalado → error en OCR pipeline (módulo no encontrado)
```

### Producción (Render)

```bash
# Requisitos:
1. Variables en Render dashboard
2. DB Supabase accesible
3. Storage bucket creado

# Posibles errores:
- SSL requerido: FIXED (added ssl="require" en session.py)
- Cold start lento: EXPECTED (30s primera vez)
- OCR timeout: POSIBLE si imagen grande
```

---

## 5. RIESGOS ACTUALES CONOCIDOS

### Críticos

1. **OCR MVP solo reconoce dígitos**: Las letras retornan `?`. Esto es por diseño pero limita la extracción de proveedor.

### Altos

2. **Free tier Supabase pausa después de 1 semana inactivo**: El proyecto se pausa y las queries fallan hasta que se visita el dashboard. Esto se documenta pero es una limitación real.

3. **Conexiones limitadas a 60 en Supabase free**: Si hay múltiples workers o clientes concurrentes, se agotan rápido. Por eso `--workers 1` en uvicorn.

### Medios

4. **OCR lento en imágenes grandes**: CPU-bound en free tier Render (512MB RAM).

5. **No hay autenticación**: Cualquiera puede subir facturas o validar. Para demo está OK, para producción necesita auth.

6. **No hay rate limiting**: Alguien puede bombardear el servidor.

---

## 6. RECOMENDACIONES ANTES DE MOBILE/FRONTEND

1. **Implementar autenticación JWT** antes de exponer públicamente
2. **Agregar rate limiting** (FastAPI slowapi)
3. **Mejorar OCR** para reconocer letras (próxima fase)
4. **Comprimir imágenes** antes de procesar (reducir tamaño → OCR más rápido)
5. **Agregar tests automatizados** (pytest)
6. **Documentar API con OpenAPI** (ya existe en `/docs`)
7. **Monitoreo**: Supabase Dashboard tiene logs útiles

---

## 7. CONCLUSIÓN

El sistema está **FUNCIONAL Y DESPLEGABLE** con las siguientes consideraciones:

✅ Arquitectura modular y coherente
✅ Error handling presente
✅ Configuración para local y producción
✅ Integración correcta con Supabase
⚠️ OCR limitado pero documentado
⚠️ Free tier tiene restricciones

**Recomendación**: Listo para demo académica y pruebas reales en free tier con las limitaciones documentadas.
