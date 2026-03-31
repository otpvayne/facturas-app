/**
 * Authentication service for login, register, and token management
 */

import { LoginPayload, RegisterPayload, TokenResponse } from '@/types/api'
import apiClient from '@/api/client'

const TOKEN_KEY = 'auth_token'
const TOKEN_EXPIRY_KEY = 'auth_token_expiry'

/**
 * Register a new user with email and password
 */
export async function register(
  email: string,
  password: string,
  passwordConfirm: string
): Promise<TokenResponse> {
  const payload: RegisterPayload = { email, password, password_confirm: passwordConfirm }
  const response = await apiClient.post<TokenResponse>('/api/v1/auth/register', payload)

  if (response.data) {
    setToken(response.data.access_token, response.data.expires_in)
  }

  return response.data
}

/**
 * Login with email and password
 */
export async function login(email: string, password: string): Promise<TokenResponse> {
  const payload: LoginPayload = { email, password }
  const response = await apiClient.post<TokenResponse>('/api/v1/auth/login', payload)

  if (response.data) {
    setToken(response.data.access_token, response.data.expires_in)
  }

  return response.data
}

/**
 * Get the stored authentication token
 */
export function getToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY)

  // Check if token is expired
  if (token && isTokenExpired()) {
    clearToken()
    return null
  }

  return token
}

/**
 * Store the authentication token
 */
export function setToken(token: string, expiresIn: number): void {
  localStorage.setItem(TOKEN_KEY, token)

  // Calculate and store expiry time
  const expiryTime = Date.now() + expiresIn * 1000
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString())
}

/**
 * Clear the authentication token
 */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRY_KEY)
}

/**
 * Check if the token is expired
 */
export function isTokenExpired(): boolean {
  const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY)

  if (!expiryStr) {
    return true
  }

  const expiryTime = parseInt(expiryStr, 10)
  return Date.now() > expiryTime
}

/**
 * Check if user is authenticated (token exists and is not expired)
 */
export function isAuthenticated(): boolean {
  return getToken() !== null
}
