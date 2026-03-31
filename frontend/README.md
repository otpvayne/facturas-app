# Facturas Frontend

Interfaz web para el sistema de gestión de facturas con OCR.

**Stack**: React 18 + TypeScript + Vite + Tailwind CSS + React Query

---

## Requisitos

- Node.js 18+
- npm 9+
- Backend FastAPI corriendo (ver `../backend/`)

---

## Inicio rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno (solo producción)
cp .env.example .env
# En desarrollo no se necesita configurar nada:
# Vite hace proxy de /api → http://localhost:8000

# 3. Levantar backend primero (en otra terminal)
cd ../backend
uvicorn main:app --reload --port 8000

# 4. Levantar frontend
npm run dev
# → http://localhost:5173
```

---

## Páginas

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/` | Dashboard | Listado de facturas con filtros y paginación |
| `/facturas/nueva` | CreateFactura | Formulario para crear factura manualmente |
| `/upload` | UploadImage | Subida de imagen + trigger OCR |
| `/facturas/:id` | FacturaDetail | Detalle completo: campos + OCR + validación |

---

## Estructura

```
src/
├── api/
│   ├── client.ts        # Axios instance + interceptors
│   └── facturas.ts      # Todas las funciones de API
├── components/
│   ├── Layout.tsx        # Shell: navbar + outlet
│   ├── StatusBadge.tsx   # Badges para status/estado
│   ├── Spinner.tsx       # Loading spinner
│   ├── ErrorMessage.tsx  # Error display
│   ├── EmptyState.tsx    # Placeholder sin datos
│   └── Pagination.tsx    # Paginación reutilizable
├── pages/
│   ├── Dashboard.tsx     # Lista facturas
│   ├── CreateFactura.tsx # Formulario creación manual
│   ├── UploadImage.tsx   # Upload con drag-and-drop
│   └── FacturaDetail.tsx # Detalle + OCR + Validación
├── types/
│   └── api.ts            # Tipos TS que reflejan los schemas del backend
├── App.tsx               # Router configuration
└── main.tsx              # Entry point + QueryClient + Toaster
```

---

## Flujos principales

### Flujo 1: Crear factura manualmente
```
/ → /facturas/nueva → [formulario] → /facturas/:id
```

### Flujo 2: Subir imagen + OCR + Validar
```
/ → /upload → [drag&drop] → Upload → [botón OCR] → OCR → /facturas/:id → Validar
```

### Flujo 3: Ver y validar factura existente
```
/ → [click en fila] → /facturas/:id → [sección Validación] → Guardar
```

---

## Variables de entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | URL base del backend | `` (vacío = proxy local) |

**En desarrollo**: Dejar vacío. Vite hace proxy automático de `/api` → `http://localhost:8000`.

**En producción** (Render, Vercel, Netlify):
```env
VITE_API_BASE_URL=https://tu-backend.onrender.com
```

---

## Comandos

```bash
npm run dev        # Servidor de desarrollo (HMR)
npm run build      # Build de producción → dist/
npm run preview    # Preview del build de producción
npm run lint       # ESLint
```

---

## Notas de integración con el backend

- Las respuestas con `Decimal` vienen como **strings** → parseadas con `parseFloat()` en el frontend.
- UUIDs vienen como strings (UUID v4).
- Datetimes en ISO 8601 → formateados con `Intl.DateTimeFormat`.
- El OCR solo extrae dígitos (limitación del backend MVP): el nombre del proveedor se ingresa en la validación manual.
- Timeout del cliente Axios: 60 segundos (para OCR lento en Render free tier).

---

## Deploy en Vercel / Netlify

```bash
npm run build
# El directorio dist/ se puede deployar como sitio estático

# Configurar env var VITE_API_BASE_URL en el dashboard del hosting
```

**Importante**: Configurar redirects/rewrites para SPA:
- Vercel: `vercel.json` con `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`
- Netlify: `public/_redirects` con `/* /index.html 200`
