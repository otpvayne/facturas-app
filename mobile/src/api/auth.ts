/**
 * Authentication service for login, register, and token management
 * Adapted for React Native using AsyncStorage
 */

import { LoginPayload, RegisterPayload, TokenResponse } from '@/types/api'
import apiClient from '@/api/client'
import { setToken, getToken, clearToken, isTokenExpired } from '@/utils/storage'

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
    await setToken(response.data.access_token, response.data.expires_in)
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
    await setToken(response.data.access_token, response.data.expires_in)
  }

  return response.data
}

/**
 * Get the stored authentication token
 */
export async function getStoredToken(): Promise<string | null> {
  return await getToken()
}

/**
 * Check if user is authenticated (token exists and is not expired)
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getToken()
  if (!token) return false

  const expired = await isTokenExpired()
  return !expired
}

/**
 * Logout by clearing the token
 */
export async function logout(): Promise<void> {
  await clearToken()
}
