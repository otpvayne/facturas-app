# Checklist de Testing - Ambiente Producción (Render)

**Objetivo**: Validar que el backend completo funciona correctamente en Render free tier con Supabase.

**Prerequisitos**:
- Proyecto deployado en Render
- Supabase database creado y accesible
- Supabase Storage bucket creado
- Variables de entorno configuradas en Render dashboard
- SSL="require" habilitado en DATABASE_URL

---

## 1. Preparación Pre-Deployment

- [ ] Todas las migraciones están aplicadas (alembic upgrade head en local antes de push)
- [ ] No hay cambios no-commiteados
- [ ] Branch está up-to-date con main
- [ ] requirements.txt incluye todas las dependencias
- [ ] .env.example documenta variables requeridas

---

## 2. Post-Deployment en Render

- [ ] Render dashboard muestra "Deployed"
- [ ] No hay errores en los logs de Render
- [ ] Cold start toma ~30 segundos (esperado)

---

## 3. Health Check

- [ ] GET `https://{render-url}/health` retorna 200
- [ ] Respuesta es JSON válido
- [ ] CORS headers presentes si es requerido

---

## 4. Conectividad a Supabase

- [ ] Logs no muestran "ssl certificate problem"
- [ ] Primera conexión a BD exitosa
- [ ] Queries SELECT simples funcionan

---

## 5. Creación de Factura (POST /api/v1/facturas/)

- [ ] Payload válido crea factura con 201 Created
- [ ] Dato se persiste en Supabase PostgreSQL
- [ ] UUID es válido y único

- [ ] Numero duplicado retorna 409
- [ ] Payload inválido retorna 422

---

## 6. Upload de Imagen

- [ ] POST /api/v1/upload/ con imagen válida (PNG, JPEG)
- [ ] image_url apunta a Supabase Storage
- [ ] imagen es accesible públicamente desde URL
- [ ] Archivo >10MB rechazado

---

## 7. OCR Processing

- [ ] POST /api/v1/ocr/process/{id} procesa imagen exitosamente
- [ ] Timeout de 30s no excedido (imágenes pequeñas < 5MB)
- [ ] Dígitos extraídos en raw_text
- [ ] Status en "success" o "error"

⚠️ **NOTA**: En free tier con 512MB RAM, imágenes muy grandes pueden timeout. Documentado como limitación conocida.

---

## 8. Validación Manual

- [ ] PATCH /api/v1/facturas/{id}/validate acepta correcciones
- [ ] was_manually_edited se actualiza correctamente
- [ ] validated_at contiene timestamp de BD

---

## 9. Listado y Paginación

- [ ] GET /api/v1/facturas?limit=10&skip=0 funciona
- [ ] Filtros por numero/estado funcionan
- [ ] Ordenamiento por fecha funciona

---

## 10. Errores HTTP

- [ ] 404 para factura/OCR no existent
- [ ] 409 para numero duplicado
- [ ] 422 para payload inválido
- [ ] 502 para error en Supabase Storage (si ocurre)

---

## 11. Performance y Límites Free Tier

- [ ] Respuestas regresan en < 5 segundos para operaciones normales
- [ ] OCR no excede 30s timeout
- [ ] Conexiones a BD: solo 1 worker activo (--workers 1 en Procfile)
- [ ] No se agotan las 60 conexiones simultáneas de Supabase free

⚠️ **Limitaciones conocidas**:
- Supabase free tier pausa después de 1 semana inactivo
- OCR solo reconoce dígitos (OCR MVP limitation)
- 512MB RAM en Render free tier puede causar slowdown

---

## 12. CORS (si frontend está separado)

- [ ] OPTIONS preflight responde 200 (si frontend es cross-origin)
- [ ] Encabezados Access-Control-Allow-* presentes
- [ ] Cookies pueden enviarse si se requiere (allow_credentials=True)

---

## 13. Logging en Producción

- [ ] Logs en Render dashboard muestran WARNING level (no INFO)
- [ ] Errores aparecen con stack trace útil
- [ ] No hay secrets/passwords en los logs

---

## 14. Recuperación de Fallos

- [ ] Si Supabase falla: retorna 502 Bad Gateway (no hang)
- [ ] Si Storage falla: retorna 502 Bad Gateway
- [ ] Si BD cae momentáneamente: reintentos funcionan

---

## 15. Monitoreo

- [ ] Abrir Supabase dashboard → Logs para ver queries
- [ ] Abrir Render dashboard → Logs para ver errores
- [ ] Sin spike inexplicado en CPU o memoria

---

## 16. Prueba End-to-End Completa

Ejecutar esta secuencia en orden:

```bash
# 1. Create factura
curl -X POST https://{render-url}/api/v1/facturas/ \
  -H "Content-Type: application/json" \
  -d '{
    "numero": "PROD-001",
    "proveedor": "Production Test",
    "monto_total": 9999.99,
    "moneda": "PEN"
  }'
# Anotar factura_id en respuesta

# 2. Upload imagen (requiere archivo local o URL)
curl -X POST https://{render-url}/api/v1/upload/ \
  -F "file=@test-image.png"

# 3. Process OCR en la imagen subida
curl -X POST https://{render-url}/api/v1/ocr/process/{factura_id}

# 4. Get OCR result
curl https://{render-url}/api/v1/facturas/{factura_id}/ocr-result

# 5. Validate manualmente
curl -X PATCH https://{render-url}/api/v1/facturas/{factura_id}/validate \
  -H "Content-Type: application/json" \
  -d '{
    "validated_provider": "Acme Inc",
    "validated_by": "test@example.com"
  }'

# 6. Get final detail
curl https://{render-url}/api/v1/facturas/{factura_id}/detail
```

- [ ] Todos los pasos completaron sin error
- [ ] Datos consistentes al final

---

## Resultado

- [ ] TODO pasa: **Sistema listo para demo académica o beta testing**
- [ ] Algunos ítems fallan: **Documentar issue y crear incident en Linear si es crítico**

---

## Rollback Plan

Si algo crítico falla en producción:

1. Revertir a commit anterior (git revert)
2. Push a main (Render re-deploy automático)
3. Verificar que Render actualiza
4. Re-runear este checklist

---

## Notas de Operación

- **Pausa de Supabase**: Si no hay tráfico en 1 semana, Supabase pausa. Visitar dashboard para reactivar.
- **OCR Performance**: Imágenes grandes toman más tiempo. Documentado como limitación.
- **Conexiones**: Solo 1 worker (`--workers 1`) porque Supabase free tier limita a 60 conexiones.
