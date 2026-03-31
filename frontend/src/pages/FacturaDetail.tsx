import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  getFacturaDetail,
  processOcr,
  validateFactura,
} from '@/api/facturas'
import type { OcrBlock, ValidatePayload } from '@/types/api'
import StatusBadge from '@/components/StatusBadge'
import Spinner from '@/components/Spinner'
import ErrorMessage from '@/components/ErrorMessage'

function formatMonto(monto: string | null, moneda: string) {
  if (!monto) return '—'
  const num = parseFloat(monto)
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: moneda }).format(num)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// OCR block component
// ---------------------------------------------------------------------------

function OcrSection({
  ocr,
  facturaId,
  onOcrDone,
}: {
  ocr: OcrBlock | null
  facturaId: string
  onOcrDone: () => void
}) {
  const ocrMutation = useMutation({
    mutationFn: () => processOcr(facturaId),
    onSuccess: () => {
      toast.success('OCR procesado correctamente.')
      onOcrDone()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al procesar OCR.')
    },
  })

  if (!ocr) {
    return (
      <div className="card p-5 space-y-3">
        <h2 className="text-base font-semibold text-gray-900">OCR</h2>
        <p className="text-sm text-gray-500">
          No se ha ejecutado OCR en esta factura todavía.
        </p>
        <button
          onClick={() => ocrMutation.mutate()}
          disabled={ocrMutation.isPending}
          className="btn-primary"
        >
          {ocrMutation.isPending ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Procesando…
            </>
          ) : (
            'Ejecutar OCR'
          )}
        </button>
        <p className="text-xs text-gray-400">
          Requiere que la factura tenga una imagen subida.
        </p>
      </div>
    )
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Resultado OCR</h2>
        <span
          className={`text-xs font-medium px-2 py-1 rounded-full ${
            ocr.pipeline_status === 'success'
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {ocr.pipeline_status}
        </span>
      </div>

      {/* Extracted fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <DataCell label="Proveedor extraído" value={ocr.extracted_provider} />
        <DataCell label="Fecha extraída" value={ocr.extracted_date} />
        <DataCell label="Total extraído" value={ocr.extracted_total} />
      </div>

      {/* Confidence */}
      {ocr.confidence_estimate !== null && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Confianza estimada</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  ocr.confidence_estimate > 0.7
                    ? 'bg-green-500'
                    : ocr.confidence_estimate > 0.4
                    ? 'bg-yellow-400'
                    : 'bg-red-400'
                }`}
                style={{ width: `${Math.round(ocr.confidence_estimate * 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 font-mono w-10">
              {Math.round(ocr.confidence_estimate * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Notes */}
      {ocr.processing_notes && (
        <p className="text-xs text-gray-400 italic">{ocr.processing_notes}</p>
      )}

      {/* Re-run OCR */}
      <button
        onClick={() => ocrMutation.mutate()}
        disabled={ocrMutation.isPending}
        className="btn-secondary text-xs"
      >
        {ocrMutation.isPending ? 'Procesando…' : 'Volver a ejecutar OCR'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Validation form component
// ---------------------------------------------------------------------------

function ValidationSection({
  ocr,
  facturaId,
  onValidated,
}: {
  ocr: OcrBlock | null
  facturaId: string
  onValidated: () => void
}) {
  const [form, setForm] = useState<ValidatePayload>({
    validated_provider: ocr?.validated_provider ?? ocr?.extracted_provider ?? '',
    validated_date: ocr?.validated_date ?? ocr?.extracted_date ?? '',
    validated_total: ocr?.validated_total ?? ocr?.extracted_total ?? '',
    validated_by: '',
    validation_notes: '',
  })

  const mutation = useMutation({
    mutationFn: (payload: ValidatePayload) => validateFactura(facturaId, payload),
    onSuccess: () => {
      toast.success('Factura validada correctamente.')
      onValidated()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al validar la factura.')
    },
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const hasAny =
      form.validated_provider?.trim() ||
      form.validated_date?.trim() ||
      form.validated_total?.trim()

    if (!hasAny) {
      toast.error('Proporciona al menos proveedor, fecha o total.')
      return
    }

    mutation.mutate({
      ...form,
      validated_provider: form.validated_provider?.trim() || null,
      validated_date: form.validated_date?.trim() || null,
      validated_total: form.validated_total?.trim() || null,
      validated_by: form.validated_by?.trim() || null,
      validation_notes: form.validation_notes?.trim() || null,
    })
  }

  // Already validated
  if (ocr?.was_manually_edited) {
    return (
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Validación Manual</h2>
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
            ✓ Validada
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <DataCell label="Proveedor validado" value={ocr.validated_provider} highlight />
          <DataCell label="Fecha validada" value={ocr.validated_date} highlight />
          <DataCell label="Total validado" value={ocr.validated_total} highlight />
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
          {ocr.validated_by && <p>Por: <span className="font-medium">{ocr.validated_by}</span></p>}
          {ocr.validated_at && <p>El: <span className="font-medium">{formatDate(ocr.validated_at)}</span></p>}
        </div>

        {ocr.validation_notes && (
          <p className="text-sm text-gray-600 bg-gray-50 rounded p-3">{ocr.validation_notes}</p>
        )}

        {/* Allow re-validation */}
        <details className="text-xs">
          <summary className="cursor-pointer text-gray-400 hover:text-gray-600">
            Corregir validación…
          </summary>
          <div className="mt-3">
            <ValidationForm form={form} onChange={handleChange} onSubmit={handleSubmit} isPending={mutation.isPending} />
          </div>
        </details>
      </div>
    )
  }

  return (
    <div className="card p-5 space-y-4">
      <h2 className="text-base font-semibold text-gray-900">Validación Manual</h2>
      <p className="text-sm text-gray-500">
        Corrige o confirma los datos extraídos por OCR. Los valores se pre-rellenan
        desde el resultado OCR si está disponible.
      </p>
      <ValidationForm form={form} onChange={handleChange} onSubmit={handleSubmit} isPending={mutation.isPending} />
    </div>
  )
}

interface ValidationFormProps {
  form: ValidatePayload
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onSubmit: (e: React.FormEvent) => void
  isPending: boolean
}

function ValidationForm({ form, onChange, onSubmit, isPending }: ValidationFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="label">Proveedor</label>
          <input
            name="validated_provider"
            value={form.validated_provider ?? ''}
            onChange={onChange}
            className="input"
            placeholder="Nombre del proveedor"
          />
        </div>
        <div>
          <label className="label">Fecha</label>
          <input
            name="validated_date"
            value={form.validated_date ?? ''}
            onChange={onChange}
            className="input"
            placeholder="DD/MM/YYYY"
          />
        </div>
        <div>
          <label className="label">Total</label>
          <input
            name="validated_total"
            value={form.validated_total ?? ''}
            onChange={onChange}
            className="input"
            placeholder="1234.50"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Validado por</label>
          <input
            name="validated_by"
            value={form.validated_by ?? ''}
            onChange={onChange}
            className="input"
            placeholder="Tu nombre o email"
          />
        </div>
        <div>
          <label className="label">Notas</label>
          <input
            name="validation_notes"
            value={form.validation_notes ?? ''}
            onChange={onChange}
            className="input"
            placeholder="Notas opcionales"
          />
        </div>
      </div>

      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Guardando…
          </>
        ) : (
          'Guardar validación'
        )}
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Small helper component: key-value cell
// ---------------------------------------------------------------------------

function DataCell({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string | null | undefined
  highlight?: boolean
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p
        className={`text-sm font-medium truncate ${
          value ? (highlight ? 'text-brand-700' : 'text-gray-900') : 'text-gray-300 italic'
        }`}
      >
        {value ?? 'No extraído'}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function FacturaDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['factura', id],
    queryFn: () => getFacturaDetail(id!),
    enabled: !!id,
    staleTime: 10_000,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['factura', id] })
    queryClient.invalidateQueries({ queryKey: ['facturas'] })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" label="Cargando factura…" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="max-w-xl mx-auto py-10">
        <ErrorMessage
          title="No se pudo cargar la factura"
          message={(error as Error).message}
          onRetry={() => refetch()}
        />
        <button onClick={() => navigate('/')} className="btn-secondary mt-4">
          ← Volver al dashboard
        </button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link to="/" className="text-gray-500 hover:text-gray-700">Facturas</Link>
        <span className="text-gray-300">›</span>
        <span className="text-gray-900 font-medium">
          {data.numero ?? data.factura_id.slice(0, 8) + '…'}
        </span>
      </div>

      {/* Header card */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {data.numero ?? <span className="text-gray-400 italic">Sin número</span>}
            </h1>
            <p className="text-gray-500 mt-1">{data.proveedor ?? '—'}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <StatusBadge value={data.status} type="status" size="md" />
            <StatusBadge value={data.estado} type="estado" size="md" />
          </div>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div>
            <p className="text-xs text-gray-400">Monto total</p>
            <p className="text-lg font-semibold text-gray-900 font-mono">
              {formatMonto(data.monto_total, data.moneda)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Moneda</p>
            <p className="text-sm font-medium text-gray-700">{data.moneda}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Creada</p>
            <p className="text-sm text-gray-700">{formatDate(data.created_at)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Actualizada</p>
            <p className="text-sm text-gray-700">{formatDate(data.updated_at)}</p>
          </div>
        </div>

        {/* Descripción */}
        {data.descripcion && (
          <p className="mt-4 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{data.descripcion}</p>
        )}

        {/* Image preview */}
        {data.image_url && (
          <div className="mt-4">
            <p className="text-xs text-gray-400 mb-2">Imagen adjunta</p>
            <a href={data.image_url} target="_blank" rel="noopener noreferrer">
              <img
                src={data.image_url}
                alt="Imagen de factura"
                className="max-h-48 rounded-lg border border-gray-200 object-contain hover:opacity-90 transition-opacity"
              />
            </a>
          </div>
        )}

        {/* No image notice */}
        {!data.image_url && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Sin imagen adjunta ·{' '}
            <Link to="/upload" className="text-brand-600 hover:underline">
              Subir imagen
            </Link>
          </div>
        )}
      </div>

      {/* OCR section */}
      <OcrSection
        ocr={data.ocr}
        facturaId={data.factura_id}
        onOcrDone={invalidate}
      />

      {/* Validation section */}
      <ValidationSection
        ocr={data.ocr}
        facturaId={data.factura_id}
        onValidated={invalidate}
      />

      {/* Footer actions */}
      <div className="flex gap-3 pb-8">
        <Link to="/" className="btn-secondary">
          ← Volver al dashboard
        </Link>
      </div>
    </div>
  )
}
