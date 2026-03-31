/**
 * React Query hooks for facturas operations
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listFacturas,
  getFacturaDetail,
  createFactura,
  uploadImage,
  processOcr,
  validateFactura,
} from '@/api/facturas'
import {
  FacturaSummary,
  FacturaDetail,
  FacturaCreatePayload,
  FacturaFilters,
  ValidatePayload,
  PaginatedResponse,
} from '@/types/api'

// Query keys
const facturaKeys = {
  all: ['facturas'] as const,
  lists: () => [...facturaKeys.all, 'list'] as const,
  list: (filters?: FacturaFilters) => [...facturaKeys.lists(), filters] as const,
  details: () => [...facturaKeys.all, 'detail'] as const,
  detail: (id: string) => [...facturaKeys.details(), id] as const,
}

/**
 * Hook to list facturas with filters
 */
export const useListFacturas = (filters?: FacturaFilters) => {
  return useQuery({
    queryKey: facturaKeys.list(filters),
    queryFn: () => listFacturas(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  })
}

/**
 * Hook to get a single factura detail
 */
export const useFacturaDetail = (facturaId: string) => {
  return useQuery({
    queryKey: facturaKeys.detail(facturaId),
    queryFn: () => getFacturaDetail(facturaId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!facturaId,
  })
}

/**
 * Hook to create a new factura
 */
export const useCreateFactura = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: FacturaCreatePayload) => createFactura(payload),
    onSuccess: (data) => {
      // Invalidate list and detail queries
      queryClient.invalidateQueries({ queryKey: facturaKeys.lists() })
      queryClient.invalidateQueries({ queryKey: facturaKeys.detail(data.id) })
    },
  })
}

/**
 * Hook to upload image for a factura
 */
export const useUploadImage = (facturaId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (file: FormData) => uploadImage(facturaId, file),
    onSuccess: () => {
      // Invalidate detail and list queries
      queryClient.invalidateQueries({ queryKey: facturaKeys.detail(facturaId) })
      queryClient.invalidateQueries({ queryKey: facturaKeys.lists() })
    },
  })
}

/**
 * Hook to process OCR for a factura
 */
export const useProcessOcr = (facturaId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => processOcr(facturaId),
    onSuccess: () => {
      // Invalidate detail query
      queryClient.invalidateQueries({ queryKey: facturaKeys.detail(facturaId) })
    },
  })
}

/**
 * Hook to validate a factura
 */
export const useValidateFactura = (facturaId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: ValidatePayload) => validateFactura(facturaId, payload),
    onSuccess: () => {
      // Invalidate detail query
      queryClient.invalidateQueries({ queryKey: facturaKeys.detail(facturaId) })
    },
  })
}
