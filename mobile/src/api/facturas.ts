/**
 * Facturas API service
 */

import apiClient from '@/api/client'
import {
  FacturaSummary,
  FacturaDetail,
  FacturaCreatePayload,
  FacturaCreateResponse,
  UploadResponse,
  OcrProcessResponse,
  ValidatePayload,
  ValidationResponse,
  PaginatedResponse,
  FacturaFilters,
} from '@/types/api'

/**
 * List facturas with filters and pagination
 */
export async function listFacturas(filters?: FacturaFilters): Promise<PaginatedResponse<FacturaSummary>> {
  const params = new URLSearchParams()

  if (filters?.q) params.append('q', filters.q)
  if (filters?.proveedor) params.append('proveedor', filters.proveedor)
  if (filters?.status) params.append('status', filters.status)
  if (filters?.date_from) params.append('date_from', filters.date_from)
  if (filters?.date_to) params.append('date_to', filters.date_to)
  if (filters?.total_min !== undefined && filters.total_min !== '') {
    params.append('total_min', String(filters.total_min))
  }
  if (filters?.total_max !== undefined && filters.total_max !== '') {
    params.append('total_max', String(filters.total_max))
  }
  if (filters?.sort_by) params.append('sort_by', filters.sort_by)
  if (filters?.sort_order) params.append('sort_order', filters.sort_order)
  if (filters?.page) params.append('page', String(filters.page))
  if (filters?.page_size) params.append('page_size', String(filters.page_size))

  const queryString = params.toString()
  const url = `/api/v1/facturas${queryString ? '?' + queryString : ''}`

  const response = await apiClient.get<PaginatedResponse<FacturaSummary>>(url)
  return response.data
}

/**
 * Get factura detail by ID
 */
export async function getFacturaDetail(facturaId: string): Promise<FacturaDetail> {
  const response = await apiClient.get<FacturaDetail>(`/api/v1/facturas/${facturaId}`)
  return response.data
}

/**
 * Create a new factura
 */
export async function createFactura(payload: FacturaCreatePayload): Promise<FacturaCreateResponse> {
  const response = await apiClient.post<FacturaCreateResponse>('/api/v1/facturas/', payload)
  return response.data
}

/**
 * Upload image for a factura
 */
export async function uploadImage(facturaId: string, file: FormData): Promise<UploadResponse> {
  const response = await apiClient.post<UploadResponse>(
    `/api/v1/upload/${facturaId}`,
    file,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  )
  return response.data
}

/**
 * Process image with OCR
 */
export async function processOcr(facturaId: string): Promise<OcrProcessResponse> {
  const response = await apiClient.post<OcrProcessResponse>(`/api/v1/ocr/process/${facturaId}`, {})
  return response.data
}

/**
 * Validate extracted OCR data
 */
export async function validateFactura(facturaId: string, payload: ValidatePayload): Promise<ValidationResponse> {
  const response = await apiClient.post<ValidationResponse>(
    `/api/v1/validation/validate/${facturaId}`,
    payload
  )
  return response.data
}

/**
 * Re-run OCR on a factura
 */
export async function reprocessOcr(facturaId: string): Promise<OcrProcessResponse> {
  const response = await apiClient.post<OcrProcessResponse>(`/api/v1/ocr/process/${facturaId}`, {})
  return response.data
}
