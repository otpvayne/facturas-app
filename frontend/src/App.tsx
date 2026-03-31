import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { PrivateRoute } from '@/components/PrivateRoute'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import CreateFactura from '@/pages/CreateFactura'
import UploadImage from '@/pages/UploadImage'
import FacturaDetail from '@/pages/FacturaDetail'
import { Login } from '@/pages/Login'
import { Register } from '@/pages/Register'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Auth routes (no protection) */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
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
    </AuthProvider>
  )
}
