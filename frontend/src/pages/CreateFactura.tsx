import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { createFactura } from '@/api/facturas'
import type { FacturaCreatePayload } from '@/types/api'

interface FormState {
  numero: string
  proveedor: string
  monto_total: string
  moneda: string
  descripcion: string
}

const INITIAL: FormState = {
  numero: '',
  proveedor: '',
  monto_total: '',
  moneda: 'PEN',
  descripcion: '',
}

type FieldErrors = Partial<Record<keyof FormState, string>>

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {}

  if (!form.numero.trim()) errors.numero = 'El número de factura es requerido.'
  else if (form.numero.length > 50) errors.numero = 'Máximo 50 caracteres.'

  if (!form.proveedor.trim()) errors.proveedor = 'El proveedor es requerido.'
  else if (form.proveedor.length > 255) errors.proveedor = 'Máximo 255 caracteres.'

  const monto = parseFloat(form.monto_total)
  if (!form.monto_total.trim()) errors.monto_total = 'El monto es requerido.'
  else if (isNaN(monto) || monto <= 0) errors.monto_total = 'Debe ser un número mayor a 0.'

  if (!['PEN', 'USD', 'EUR'].includes(form.moneda)) errors.moneda = 'Moneda no válida.'

  return errors
}

export default function CreateFactura() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(INITIAL)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const mutation = useMutation({
    mutationFn: (payload: FacturaCreatePayload) => createFactura(payload),
    onSuccess: (data) => {
      toast.success(`Factura ${data.numero} creada correctamente.`)
      navigate(`/facturas/${data.id}`)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'No se pudo crear la factura.')
    },
  })

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    // Clear field error on change
    if (fieldErrors[name as keyof FormState]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const errors = validate(form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    mutation.mutate({
      numero: form.numero.trim(),
      proveedor: form.proveedor.trim(),
      monto_total: parseFloat(form.monto_total),
      moneda: form.moneda,
      descripcion: form.descripcion.trim() || null,
    })
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nueva Factura</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ingresa los datos de la factura manualmente.
          También puedes{' '}
          <Link to="/upload" className="text-brand-600 hover:underline">
            subir una imagen
          </Link>{' '}
          y dejar que el OCR la procese.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {/* Número */}
        <div>
          <label className="label" htmlFor="numero">
            Número de factura <span className="text-red-500">*</span>
          </label>
          <input
            id="numero"
            name="numero"
            type="text"
            placeholder="Ej: INV-2024-001"
            value={form.numero}
            onChange={handleChange}
            className={`input ${fieldErrors.numero ? 'border-red-400 focus:ring-red-400' : ''}`}
          />
          {fieldErrors.numero && (
            <p className="text-xs text-red-600 mt-1">{fieldErrors.numero}</p>
          )}
        </div>

        {/* Proveedor */}
        <div>
          <label className="label" htmlFor="proveedor">
            Proveedor <span className="text-red-500">*</span>
          </label>
          <input
            id="proveedor"
            name="proveedor"
            type="text"
            placeholder="Nombre del proveedor"
            value={form.proveedor}
            onChange={handleChange}
            className={`input ${fieldErrors.proveedor ? 'border-red-400 focus:ring-red-400' : ''}`}
          />
          {fieldErrors.proveedor && (
            <p className="text-xs text-red-600 mt-1">{fieldErrors.proveedor}</p>
          )}
        </div>

        {/* Monto + Moneda (side by side) */}
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <div>
            <label className="label" htmlFor="monto_total">
              Monto total <span className="text-red-500">*</span>
            </label>
            <input
              id="monto_total"
              name="monto_total"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={form.monto_total}
              onChange={handleChange}
              className={`input ${fieldErrors.monto_total ? 'border-red-400 focus:ring-red-400' : ''}`}
            />
            {fieldErrors.monto_total && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.monto_total}</p>
            )}
          </div>

          <div>
            <label className="label" htmlFor="moneda">
              Moneda
            </label>
            <select
              id="moneda"
              name="moneda"
              value={form.moneda}
              onChange={handleChange}
              className="input"
            >
              <option value="PEN">PEN (S/)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label className="label" htmlFor="descripcion">
            Descripción <span className="text-gray-400">(opcional)</span>
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={3}
            placeholder="Notas sobre la factura…"
            value={form.descripcion}
            onChange={handleChange}
            className="input resize-none"
          />
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <Link to="/" className="btn-secondary flex-1 justify-center">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary flex-1 justify-center"
          >
            {mutation.isPending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creando…
              </>
            ) : (
              'Crear factura'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
