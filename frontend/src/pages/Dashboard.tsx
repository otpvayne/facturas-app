import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listFacturas } from '@/api/facturas'
import type { FacturaFilters, FacturaSummary } from '@/types/api'
import StatusBadge from '@/components/StatusBadge'
import Spinner from '@/components/Spinner'
import ErrorMessage from '@/components/ErrorMessage'
import EmptyState from '@/components/EmptyState'
import Pagination from '@/components/Pagination'

function formatMonto(monto: string | null, moneda: string) {
  if (!monto) return '—'
  const num = parseFloat(monto)
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: moneda }).format(num)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Factura row
// ---------------------------------------------------------------------------

function FacturaRow({ f }: { f: FacturaSummary }) {
  return (
    <Link
      to={`/facturas/${f.factura_id}`}
      className="grid grid-cols-[1fr_1fr_auto_auto_auto] items-center gap-4
                 px-4 py-3 hover:bg-gray-50 rounded-lg transition-colors group"
    >
      {/* Número + proveedor */}
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-brand-600">
          {f.numero ?? <span className="text-gray-400 italic">Sin número</span>}
        </p>
        <p className="text-xs text-gray-500 truncate">{f.proveedor ?? '—'}</p>
      </div>

      {/* Monto */}
      <p className="text-sm text-gray-900 font-mono">{formatMonto(f.monto_total, f.moneda)}</p>

      {/* Status pipeline */}
      <StatusBadge value={f.status} type="status" />

      {/* Estado negocio */}
      <StatusBadge value={f.estado} type="estado" />

      {/* Fecha */}
      <p className="text-xs text-gray-400 whitespace-nowrap">{formatDate(f.created_at)}</p>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

interface FilterBarProps {
  filters: FacturaFilters
  onChange: (f: Partial<FacturaFilters>) => void
  onReset: () => void
}

function FilterBar({ filters, onChange, onReset }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2 items-end">
      <div>
        <label className="label">Buscar</label>
        <input
          type="text"
          placeholder="Número o proveedor…"
          value={filters.q ?? ''}
          onChange={(e) => onChange({ q: e.target.value, page: 1 })}
          className="input w-52"
        />
      </div>

      <div>
        <label className="label">Estado pipeline</label>
        <select
          value={filters.status ?? ''}
          onChange={(e) => onChange({ status: e.target.value as FacturaFilters['status'], page: 1 })}
          className="input w-40"
        >
          <option value="">Todos</option>
          <option value="uploaded">Subida</option>
          <option value="ocr_done">OCR Completo</option>
          <option value="ocr_error">Error OCR</option>
          <option value="validated">Validada</option>
        </select>
      </div>

      <div>
        <label className="label">Desde</label>
        <input
          type="date"
          value={filters.date_from ?? ''}
          onChange={(e) => onChange({ date_from: e.target.value, page: 1 })}
          className="input w-40"
        />
      </div>

      <div>
        <label className="label">Hasta</label>
        <input
          type="date"
          value={filters.date_to ?? ''}
          onChange={(e) => onChange({ date_to: e.target.value, page: 1 })}
          className="input w-40"
        />
      </div>

      <div>
        <label className="label">Ordenar por</label>
        <select
          value={filters.sort_by ?? 'created_at'}
          onChange={(e) =>
            onChange({ sort_by: e.target.value as FacturaFilters['sort_by'], page: 1 })
          }
          className="input w-40"
        >
          <option value="created_at">Fecha</option>
          <option value="monto_total">Monto</option>
          <option value="proveedor">Proveedor</option>
          <option value="status">Estado</option>
        </select>
      </div>

      <button
        onClick={onReset}
        className="btn-secondary h-[38px]"
        title="Limpiar filtros"
      >
        Limpiar
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

const DEFAULT_FILTERS: FacturaFilters = {
  sort_by: 'created_at',
  sort_order: 'desc',
  page: 1,
  page_size: 20,
}

export default function Dashboard() {
  const [filters, setFilters] = useState<FacturaFilters>(DEFAULT_FILTERS)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['facturas', filters],
    queryFn: () => listFacturas(filters),
    staleTime: 30_000,
  })

  const updateFilter = (partial: Partial<FacturaFilters>) =>
    setFilters((prev) => ({ ...prev, ...partial }))

  const resetFilters = () => setFilters(DEFAULT_FILTERS)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data ? `${data.total_items} factura${data.total_items !== 1 ? 's' : ''}` : '…'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/upload" className="btn-secondary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Subir imagen
          </Link>
          <Link to="/facturas/nueva" className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4v16m8-8H4" />
            </svg>
            Nueva factura
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card p-4">
        <FilterBar filters={filters} onChange={updateFilter} onReset={resetFilters} />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-xl">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Factura</span>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Monto</span>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pipeline</span>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</span>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</span>
        </div>

        {/* Body */}
        <div className="divide-y divide-gray-50 px-0">
          {isLoading && (
            <div className="py-16 flex items-center justify-center">
              <Spinner label="Cargando facturas…" />
            </div>
          )}

          {isError && (
            <div className="p-6">
              <ErrorMessage
                title="No se pudieron cargar las facturas"
                message={(error as Error).message}
                onRetry={() => refetch()}
              />
            </div>
          )}

          {!isLoading && !isError && data?.items.length === 0 && (
            <EmptyState
              title="No hay facturas"
              description="Crea una factura manualmente o sube una imagen para comenzar."
              action={{ label: 'Subir imagen', to: '/upload' }}
            />
          )}

          {!isLoading &&
            !isError &&
            data?.items.map((f) => <FacturaRow key={f.factura_id} f={f} />)}
        </div>
      </div>

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <Pagination
          page={filters.page ?? 1}
          totalPages={data.total_pages}
          onPageChange={(p) => updateFilter({ page: p })}
        />
      )}
    </div>
  )
}
