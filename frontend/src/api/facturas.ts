/**
 * All API functions for the Facturas backend.
 * Each function maps 1-to-1 with a backend endpoint.
 */
import type {
  FacturaCreatePayload,
  FacturaCreateResponse,
  FacturaDetail,
  FacturaFilters,
  FacturaSummary,
  OcrProcessResponse,
  OcrResultResponse,
  PaginatedResponse,
  UploadResponse,
  ValidatePayload,
  ValidationResponse,
} from '@/types/api'
import apiClient from './client'

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export async function getHealth(): Promise<{ status: string }> {
  const { data } = await apiClient.get('/health')
  return data
}

// ---------------------------------------------------------------------------
// Facturas CRUD
// ---------------------------------------------------------------------------

/** Create a new factura manually (no image). */
export async function createFactura(
  payload: FacturaCreatePayload
): Promise<FacturaCreateResponse> {
  const { data } = await apiClient.post('/api/v1/facturas/', payload)
  return data
}

/** Get a single factura with full detail (includes OCR block). */
export async function getFacturaDetail(facturaId: string): Promise<FacturaDetail> {
  const { data } = await apiClient.get(`/api/v1/facturas/${facturaId}`)
  return data
}

/** Paginated list of facturas with filters. */
export async function listFacturas(
  filters: FacturaFilters = {}
): Promise<PaginatedResponse<FacturaSummary>> {
  // Remove empty strings/undefined so backend doesn't receive blank params
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined && v !== null)
  )
  const { data } = await apiClient.get('/api/v1/facturas', { params })
  return data
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/**
 * Upload an image file and create a new factura from it.
 * @param file  The image file (PNG, JPEG, WEBP)
 * @param onProgress  Optional progress callback (0–100)
 */
export async function uploadFacturaImage(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await apiClient.post('/api/v1/upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        onProgress(percent)
      }
    },
  })
  return data
}

// ---------------------------------------------------------------------------
// OCR
// ---------------------------------------------------------------------------

/** Trigger OCR processing for a factura. Returns immediately with OCR result. */
export async function processOcr(facturaId: string): Promise<OcrProcessResponse> {
  const { data } = await apiClient.post(`/api/v1/ocr/process/${facturaId}`)
  return data
}

/** Get the latest OCR result for a factura (read-only). */
export async function getOcrResult(facturaId: string): Promise<OcrResultResponse> {
  const { data } = await apiClient.get(`/api/v1/facturas/${facturaId}/ocr-result`)
  return data
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Submit manual corrections / validate a factura's OCR output.
 * At least one of validated_provider, validated_date, validated_total must be set.
 */
export async function validateFactura(
  facturaId: string,
  payload: ValidatePayload
): Promise<ValidationResponse> {
  const { data } = await apiClient.patch(`/api/v1/facturas/${facturaId}/validate`, payload)
  return data
}
