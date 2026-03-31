import { useCallback, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { uploadFacturaImage, processOcr } from '@/api/facturas'

const ACCEPTED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const MAX_SIZE_MB = 10
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

type UploadStep = 'select' | 'uploading' | 'done' | 'ocr_processing' | 'ocr_done'

export default function UploadImage() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [step, setStep] = useState<UploadStep>('select')
  const [facturaId, setFacturaId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // --- Upload mutation ---
  const uploadMutation = useMutation({
    mutationFn: (f: File) =>
      uploadFacturaImage(f, (pct) => setUploadProgress(pct)),
    onSuccess: (data) => {
      setFacturaId(data.factura_id)
      setStep('done')
      toast.success('Imagen subida correctamente.')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al subir la imagen.')
      setStep('select')
    },
  })

  // --- OCR mutation ---
  const ocrMutation = useMutation({
    mutationFn: (id: string) => processOcr(id),
    onSuccess: (data) => {
      setStep('ocr_done')
      if (data.status === 'error') {
        toast.error('OCR terminó con errores. Puedes validar manualmente.')
      } else {
        toast.success('OCR procesado. Revisa los datos extraídos.')
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al procesar OCR.')
      setStep('done')
    },
  })

  // --- File selection ---
  const handleFileSelect = useCallback((selected: File | null | undefined) => {
    if (!selected) return

    if (!ACCEPTED.includes(selected.type)) {
      toast.error('Formato no soportado. Usa PNG, JPEG o WEBP.')
      return
    }
    if (selected.size > MAX_SIZE_BYTES) {
      toast.error(`La imagen supera ${MAX_SIZE_MB}MB.`)
      return
    }

    setFile(selected)
    setPreview(URL.createObjectURL(selected))
    setStep('select')
    setUploadProgress(0)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      handleFileSelect(e.dataTransfer.files[0])
    },
    [handleFileSelect]
  )

  const handleUpload = () => {
    if (!file) return
    setStep('uploading')
    uploadMutation.mutate(file)
  }

  const handleRunOcr = () => {
    if (!facturaId) return
    setStep('ocr_processing')
    ocrMutation.mutate(facturaId)
  }

  const handleViewFactura = () => {
    if (facturaId) navigate(`/facturas/${facturaId}`)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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
        <h1 className="text-2xl font-bold text-gray-900">Subir Imagen de Factura</h1>
        <p className="text-sm text-gray-500 mt-1">
          Sube una imagen de una factura. Luego podrás ejecutar el OCR para extraer datos automáticamente.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={`card p-6 border-2 border-dashed transition-colors cursor-pointer
          ${dragOver ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-gray-400'}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files?.[0])}
        />

        {preview ? (
          <div className="space-y-3">
            <img
              src={preview}
              alt="Preview de la factura"
              className="max-h-64 mx-auto rounded-lg object-contain shadow"
            />
            <p className="text-sm text-center text-gray-500">
              {file?.name} · {((file?.size ?? 0) / 1024 / 1024).toFixed(2)} MB
            </p>
            <p className="text-xs text-center text-brand-600">
              Haz clic o arrastra para cambiar la imagen
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">Arrastra una imagen aquí</p>
              <p className="text-xs text-gray-400">o haz clic para seleccionar · PNG, JPEG, WEBP · máx. {MAX_SIZE_MB}MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Upload progress */}
      {step === 'uploading' && (
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700 font-medium">Subiendo imagen…</span>
            <span className="text-gray-500">{uploadProgress}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-600 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* OCR processing */}
      {step === 'ocr_processing' && (
        <div className="card p-4 flex items-center gap-3">
          <svg className="w-5 h-5 animate-spin text-brand-600 flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-gray-700">Procesando OCR…</p>
            <p className="text-xs text-gray-400">Esto puede tomar hasta 30 segundos.</p>
          </div>
        </div>
      )}

      {/* Success after upload */}
      {(step === 'done' || step === 'ocr_done') && (
        <div className="card p-4 border border-green-200 bg-green-50">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-green-800">
                {step === 'ocr_done' ? 'OCR completado' : 'Imagen subida correctamente'}
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                {step === 'ocr_done'
                  ? 'Los datos extraídos están disponibles en el detalle de la factura.'
                  : 'La factura fue creada. Puedes ejecutar el OCR ahora.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-2">
        {/* Upload button */}
        {step === 'select' && file && (
          <button onClick={handleUpload} className="btn-primary w-full justify-center py-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Subir imagen
          </button>
        )}

        {/* OCR button (after upload) */}
        {step === 'done' && facturaId && (
          <button onClick={handleRunOcr} className="btn-primary w-full justify-center py-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Ejecutar OCR
          </button>
        )}

        {/* View factura button */}
        {(step === 'done' || step === 'ocr_done') && facturaId && (
          <button onClick={handleViewFactura} className="btn-secondary w-full justify-center py-3">
            Ver detalle de la factura
          </button>
        )}

        {/* Skip OCR and go to factura */}
        {step === 'done' && facturaId && (
          <button
            onClick={handleViewFactura}
            className="text-sm text-gray-500 hover:text-gray-700 text-center py-1"
          >
            Omitir OCR y ver factura
          </button>
        )}
      </div>

      {/* Info note */}
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
        <p className="text-xs text-amber-700">
          <span className="font-semibold">Nota OCR:</span>{' '}
          El motor OCR actual reconoce principalmente dígitos. Para nombres de proveedores
          utiliza la validación manual en el detalle de la factura.
        </p>
      </div>
    </div>
  )
}
