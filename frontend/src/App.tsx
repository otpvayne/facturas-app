import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import CreateFactura from '@/pages/CreateFactura'
import UploadImage from '@/pages/UploadImage'
import FacturaDetail from '@/pages/FacturaDetail'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* Dashboard */}
          <Route index element={<Dashboard />} />

          {/* Create factura manually */}
          <Route path="facturas/nueva" element={<CreateFactura />} />

          {/* Factura detail (with OCR + validation) */}
          <Route path="facturas/:id" element={<FacturaDetail />} />

          {/* Upload image → auto-creates factura */}
          <Route path="upload" element={<UploadImage />} />

          {/* Catch-all → redirect to dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
