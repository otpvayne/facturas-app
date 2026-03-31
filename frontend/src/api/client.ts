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
import { getToken, clearToken } from '@/api/auth'

// Use environment variable or fallback to Render backend URL
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://tesis-m0yw.onrender.com'

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60_000, // 60s — OCR can be slow on free tier
})

// Request interceptor: inject Authorization header with JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor: normalize errors to a simple string message
// Also handle 401 by clearing token and redirecting to login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 unauthorized — token expired or invalid
    if (error?.response?.status === 401) {
      clearToken()
      // Redirect to login (will be handled by PrivateRoute component)
      window.location.href = '/login'
    }

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
