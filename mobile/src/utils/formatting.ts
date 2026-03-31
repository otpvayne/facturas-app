/**
 * Formatting utilities for display
 */

import { FacturaStatus, FacturaEstado } from '@/types/api'

/**
 * Format ISO datetime string to readable date
 * Input: "2026-03-31T12:30:45.123456"
 * Output: "31/03/2026"
 */
export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  } catch {
    return 'N/A'
  }
}

/**
 * Format datetime with time
 * Input: "2026-03-31T12:30:45.123456"
 * Output: "31/03/2026 12:30"
 */
export function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year} ${hours}:${minutes}`
  } catch {
    return 'N/A'
  }
}

/**
 * Format currency amount
 * Input: 1234.50, "SOL"
 * Output: "S/ 1,234.50"
 */
export function formatCurrency(amount: string | number, currency: string): string {
  try {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    const formatted = new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)

    const currencySymbol = getCurrencySymbol(currency)
    return `${currencySymbol} ${formatted}`
  } catch {
    return `${amount} ${currency}`
  }
}

/**
 * Get currency symbol
 */
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    SOL: 'S/',
    USD: '$',
    EUR: '€',
    PEN: 'S/',
  }
  return symbols[currency] || currency
}

/**
 * Format Factura status for display
 */
export function formatStatus(status: FacturaStatus): { label: string; color: string } {
  const statusMap: Record<FacturaStatus, { label: string; color: string }> = {
    uploaded: { label: 'Subida', color: '#2196F3' },
    ocr_processing: { label: 'Procesando OCR', color: '#FF9800' },
    ocr_done: { label: 'OCR Completado', color: '#4CAF50' },
    ocr_error: { label: 'Error OCR', color: '#F44336' },
    validated: { label: 'Validada', color: '#4CAF50' },
  }
  return statusMap[status] || { label: status, color: '#9E9E9E' }
}

/**
 * Format Factura estado for display
 */
export function formatEstado(estado: FacturaEstado): { label: string; color: string } {
  const estadoMap: Record<FacturaEstado, { label: string; color: string }> = {
    pendiente: { label: 'Pendiente', color: '#FF9800' },
    aprobada: { label: 'Aprobada', color: '#4CAF50' },
    rechazada: { label: 'Rechazada', color: '#F44336' },
  }
  return estadoMap[estado] || { label: estado, color: '#9E9E9E' }
}

/**
 * Abbreviate long text
 */
export function truncate(text: string, length: number = 20): string {
  if (text.length <= length) return text
  return text.substring(0, length) + '...'
}
