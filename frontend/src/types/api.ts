/**
 * TypeScript types mirroring the FastAPI backend schemas.
 * Keep these in sync with:
 *   - app/schemas/factura.py
 *   - app/api/routes/factura.py  (FacturaCreate, FacturaResponse)
 *   - app/api/routes/validation.py
 *   - app/api/routes/upload.py
 */

// ---------------------------------------------------------------------------
// Enums / literals
// ---------------------------------------------------------------------------

/** Processing pipeline status */
export type FacturaStatus =
  | 'uploaded'
  | 'ocr_processing'
  | 'ocr_done'
  | 'ocr_error'
  | 'validated'

/** Business estado */
export type FacturaEstado = 'pendiente' | 'aprobada' | 'rechazada'

// ---------------------------------------------------------------------------
// OCR block (nested inside FacturaDetail)
// ---------------------------------------------------------------------------

export interface OcrBlock {
  ocr_result_id: string
  pipeline_status: string
  confidence_estimate: number | null

  // Raw OCR extraction
  extracted_provider: string | null
  extracted_date: string | null
  extracted_total: string | null

  // Human-validated fields
  validated_provider: string | null
  validated_date: string | null
  validated_total: string | null

  // Metadata
  validated_by: string | null
  validated_at: string | null       // ISO datetime string
  was_manually_edited: boolean
  validation_notes: string | null
  processing_notes: string | null
}

// ---------------------------------------------------------------------------
// Factura schemas
// ---------------------------------------------------------------------------

/** Lean summary used in paginated list */
export interface FacturaSummary {
  factura_id: string
  numero: string | null
  proveedor: string | null
  monto_total: string | null        // Decimal returned as string
  moneda: string
  status: FacturaStatus
  estado: FacturaEstado
  image_url: string | null
  created_at: string                // ISO datetime string
}

/** Full detail including OCR block */
export interface FacturaDetail {
  factura_id: string
  numero: string | null
  proveedor: string | null
  monto_total: string | null
  moneda: string
  descripcion: string | null
  status: FacturaStatus
  estado: FacturaEstado
  image_url: string | null
  created_at: string
  updated_at: string
  ocr: OcrBlock | null
}

// ---------------------------------------------------------------------------
// Create Factura
// ---------------------------------------------------------------------------

export interface FacturaCreatePayload {
  numero: string
  proveedor: string
  monto_total: number
  moneda?: string
  descripcion?: string | null
}

export interface FacturaCreateResponse {
  id: string
  numero: string
  proveedor: string
  monto_total: string
  moneda: string
  descripcion: string | null
  estado: string
  status: string
  image_url: string | null
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export interface UploadResponse {
  factura_id: string
  image_url: string
  filename: string
  content_type: string
  status: string
}

// ---------------------------------------------------------------------------
// OCR
// ---------------------------------------------------------------------------

export interface OcrProcessResponse {
  factura_id: string
  ocr_result_id: string
  status: string
  raw_text: string | null
  extracted_date: string | null
  extracted_total: string | null
  extracted_provider: string | null
  confidence_estimate: number | null
  processing_notes: string | null
}

export interface OcrResultResponse {
  ocr_result_id: string
  factura_id: string
  pipeline_status: string
  raw_text: string | null
  extracted_date: string | null
  extracted_total: string | null
  extracted_provider: string | null
  confidence_estimate: number | null
  processing_notes: string | null
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidatePayload {
  validated_provider?: string | null
  validated_date?: string | null
  validated_total?: string | null
  validated_by?: string | null
  validation_notes?: string | null
}

export interface ValidationResponse {
  ocr_result_id: string
  factura_id: string
  status: string
  validated_provider: string | null
  validated_date: string | null
  validated_total: string | null
  validated_by: string | null
  validated_at: string | null
  validation_notes: string | null
  was_manually_edited: boolean
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  items: T[]
  total_items: number
  total_pages: number
  page: number
  page_size: number
}

// ---------------------------------------------------------------------------
// Query filters (mirror FacturaQueryParams in backend)
// ---------------------------------------------------------------------------

export interface FacturaFilters {
  proveedor?: string
  status?: FacturaStatus | ''
  date_from?: string
  date_to?: string
  total_min?: number | ''
  total_max?: number | ''
  q?: string
  sort_by?: 'created_at' | 'monto_total' | 'proveedor' | 'status'
  sort_order?: 'asc' | 'desc'
  page?: number
  page_size?: number
}

// ---------------------------------------------------------------------------
// API error shape (FastAPI HTTPException)
// ---------------------------------------------------------------------------

export interface ApiError {
  detail: string | { loc: string[]; msg: string; type: string }[]
}
