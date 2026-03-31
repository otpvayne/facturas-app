# Checklist de Testing - Ambiente Local

**Objetivo**: Validar que el backend completo funciona correctamente en desarrollo local antes de deployar a producción.

**Prerequisitos**:
- Python 3.10+
- PostgreSQL corriendo localmente (o usar Base de datos existente)
- Variables de entorno configuradas en `.env`
- Todas las dependencias instaladas (`pip install -r requirements.txt`)

---

## 1. Configuración Inicial

- [ ] `.env` existe con valores válidos
  - DATABASE_URL apunta a PostgreSQL local o Supabase
  - SUPABASE_URL y SUPABASE_KEY configurados
  - ENVIRONMENT="development"

- [ ] Base de datos lista
  ```bash
  alembic upgrade head
  ```
  Verificar que las tablas se crean sin error

- [ ] Dependencias instaladas
  ```bash
  pip install -r requirements.txt
  ```

---

## 2. Startup Local

- [ ] Servidor inicia sin error
  ```bash
  uvicorn main:app --reload --host 0.0.0.0 --port 8000
  ```

- [ ] Logs muestran nivel INFO (desarrollo)
- [ ] No hay errores de conexión a BD
- [ ] No hay errores de imports de módulos

---

## 3. Health Check

- [ ] GET `http://localhost:8000/health` retorna 200
- [ ] Respuesta es JSON válido

---

## 4. Endpoints Básicos - Facturas

### Creación (POST /api/v1/facturas/)

- [ ] Payload válido crea factura exitosamente
  ```bash
  curl -X POST http://localhost:8000/api/v1/facturas/ \
    -H "Content-Type: application/json" \
    -d '{
      "numero": "INV-001",
      "proveedor": "Test Provider",
      "monto_total": 1500.50,
      "moneda": "PEN",
      "descripcion": "Test invoice"
    }'
  ```
  Esperar 201 Created con factura_id en respuesta

- [ ] Numero duplicado rechazado con 409 Conflict
- [ ] Monto negativo rechazado con 422 Unprocessable Entity
- [ ] Campo requerido faltante rechazado con 422

### Lectura (GET /api/v1/facturas/{id})

- [ ] Factura existente retorna 200 con datos correctos
- [ ] Factura inexistente retorna 404
- [ ] UUID inválido retorna error

---

## 5. Upload de Imagen

### POST /api/v1/upload/

- [ ] Imagen válida (PNG, JPEG) se carga exitosamente
  - [ ] Retorna 201 Created
  - [ ] Retorna image_url válida
  - [ ] Retorna factura_id y status "uploaded"

- [ ] Archivo muy grande (>10MB) rechazado
- [ ] Archivo no-imagen rechazado
- [ ] Archivo corrupto/malformado rechazado con mensaje claro

---

## 6. Flujo OCR

### POST /api/v1/ocr/process/{factura_id}

- [ ] OCR procesa imagen válida
  - [ ] Retorna 200 OK
  - [ ] raw_text contiene dígitos extraídos
  - [ ] extracted_total es string numérico o None
  - [ ] status es "success" o "error"

- [ ] OCR timeout > 30s devuelve RuntimeError adecuado
- [ ] Imagen inexistente retorna 404
- [ ] Image_url inválida maneja error gracefully

### GET /api/v1/facturas/{factura_id}/ocr-result

- [ ] OCR result existe: retorna 200 con datos OCR
- [ ] OCR result no existe: retorna 404
- [ ] Los campos extracted_* pueden ser None

---

## 7. Validación Manual

### PATCH /api/v1/facturas/{factura_id}/validate

- [ ] Payload vacío rechazado con 422
- [ ] Al menos un campo de validación permite procesar
  ```bash
  curl -X PATCH http://localhost:8000/api/v1/facturas/{id}/validate \
    -H "Content-Type: application/json" \
    -d '{
      "validated_provider": "Corrected Name",
      "validated_by": "user@example.com"
    }'
  ```

- [ ] was_manually_edited=true después de validación
- [ ] validated_at contiene timestamp
- [ ] Factura inexistente retorna 404

### GET /api/v1/facturas/{factura_id}/detail

- [ ] Retorna factura + OCR + validación consolidados
- [ ] ocr puede ser null si no hay OCR
- [ ] Estructura JSON es completa

---

## 8. Listado y Filtros

### GET /api/v1/facturas?

- [ ] Sin parámetros retorna todas las facturas con paginación
- [ ] ?skip=0&limit=10 funciona
- [ ] ?numero=INV-001 filtra por número
- [ ] ?estado=pendiente filtra por estado
- [ ] ?sort_by=created_at&sort_order=desc ordena descendente
- [ ] Parámetro inválido no causa crash

---

## 9. Tests Automatizados

- [ ] pytest descubre todos los tests
  ```bash
  pytest tests/ -v
  ```

- [ ] Todos los tests pasan:
  - [ ] test_health.py::test_health_endpoint
  - [ ] test_facturas.py (6 tests)
  - [ ] test_validation.py (5 tests)
  - [ ] test_ocr_image_loader.py (6 tests)

- [ ] No hay warnings de deprecación en tests

---

## 10. Errores y Edge Cases

- [ ] Request sin Content-Type adecuado retorna error claro
- [ ] Body JSON malformado retorna 422
- [ ] Timeout en descargas de imágenes: "Timeout al descargar imagen"
- [ ] HTTP error en descarga: "HTTP {code} al descargar imagen"
- [ ] Error de red: "Error de red al descargar imagen"

---

## 11. Logging

- [ ] Logs muestran:
  - [ ] "Starting server" en startup
  - [ ] Request/response para endpoints
  - [ ] Query SQL para operaciones de BD (INFO level)
  - [ ] Warnings para situaciones inesperadas

- [ ] No hay logs de ERROR/CRITICAL sin justificación

---

## 12. Base de Datos

- [ ] Tabla `facturas` tiene datos correctos
- [ ] Tabla `ocr_results` relacionada correctamente
- [ ] Foreign keys funcionan (borrar factura borra OCR)
- [ ] Timestamps (created_at, updated_at) se actualizan

---

## Resultado

- [ ] TODO pasa: **Sistema listo para testeo en Render**
- [ ] Algunos ítems fallan: **Listar qué falló y por qué**

---

## Notas Adicionales

- Si testeas localmente con SQLite instead of PostgreSQL: asegúrate de que las migraciones sean compatibles
- Para testing rápido: usar `pytest -k "test_health"` para correr solo tests específicos
- Para debugging: agregar print statements o usar `pdb` en los tests
