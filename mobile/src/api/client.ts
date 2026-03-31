/**
 * Axios instance configured to communicate with the FastAPI backend.
 *
 * Base URL strategy:
 *  - Development: Use VITE_API_BASE_URL from .env
 *  - Production: Fallback to Render backend URL
 *
 * Usage:
 *   import apiClient from '@/api/client'
 *   const response = await apiClient.get('/api/v1/facturas')
 */
import axios from 'axios'
import { getToken, clearToken } from '@/utils/storage'

// Use environment variable or fallback to Render backend URL
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://tesis-m0yw.onrender.com'

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60_000, // 60s — OCR can be slow on free tier
})

// Request interceptor: inject Authorization header with JWT token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getToken()
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
// 401 errors will be handled at the app level (AuthContext)
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
