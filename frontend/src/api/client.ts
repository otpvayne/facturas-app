/**
 * Axios instance configured to communicate with the FastAPI backend.
 *
 * Base URL strategy:
 *  - Development: Vite proxy handles /api → http://localhost:8000
 *  - Production (Render): Set VITE_API_BASE_URL env var to backend URL
 *
 * Usage:
 *   import apiClient from '@/api/client'
 *   const response = await apiClient.get('/facturas')
 */
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60_000, // 60s — OCR can be slow on free tier
})

// Response interceptor: normalize errors to a simple string message
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail = error?.response?.data?.detail
    if (typeof detail === 'string') {
      error.message = detail
    } else if (Array.isArray(detail)) {
      // Pydantic validation errors → join messages
      error.message = detail.map((d: { msg: string }) => d.msg).join('; ')
    }
    return Promise.reject(error)
  }
)

export default apiClient
