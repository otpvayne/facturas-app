import type { FacturaEstado, FacturaStatus } from '@/types/api'

const STATUS_CONFIG: Record<
  FacturaStatus,
  { label: string; className: string }
> = {
  uploaded:       { label: 'Subida',          className: 'bg-blue-100 text-blue-800' },
  ocr_processing: { label: 'Procesando OCR',  className: 'bg-yellow-100 text-yellow-800' },
  ocr_done:       { label: 'OCR Completo',    className: 'bg-purple-100 text-purple-800' },
  ocr_error:      { label: 'Error OCR',       className: 'bg-red-100 text-red-800' },
  validated:      { label: 'Validada',        className: 'bg-green-100 text-green-800' },
}

const ESTADO_CONFIG: Record<
  FacturaEstado,
  { label: string; className: string }
> = {
  pendiente: { label: 'Pendiente', className: 'bg-gray-100 text-gray-700' },
  aprobada:  { label: 'Aprobada',  className: 'bg-emerald-100 text-emerald-800' },
  rechazada: { label: 'Rechazada', className: 'bg-red-100 text-red-800' },
}

interface StatusBadgeProps {
  value: string
  type?: 'status' | 'estado'
  size?: 'sm' | 'md'
}

export default function StatusBadge({ value, type = 'status', size = 'sm' }: StatusBadgeProps) {
  const config =
    type === 'status'
      ? STATUS_CONFIG[value as FacturaStatus]
      : ESTADO_CONFIG[value as FacturaEstado]

  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${
        config?.className ?? 'bg-gray-100 text-gray-700'
      }`}
    >
      {config?.label ?? value}
    </span>
  )
}
