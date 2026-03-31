/**
 * AsyncStorage wrapper for authentication token management
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

const TOKEN_KEY = 'auth_token'
const TOKEN_EXPIRY_KEY = 'auth_token_expiry'

/**
 * Store the authentication token
 */
export async function setToken(token: string, expiresIn: number): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token)

  // Calculate and store expiry time
  const expiryTime = Date.now() + expiresIn * 1000
  await AsyncStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString())
}

/**
 * Get the stored authentication token
 */
export async function getToken(): Promise<string | null> {
  const token = await AsyncStorage.getItem(TOKEN_KEY)

  // Check if token is expired
  if (token && await isTokenExpired()) {
    await clearToken()
    return null
  }

  return token
}

/**
 * Clear the authentication token
 */
export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY)
  await AsyncStorage.removeItem(TOKEN_EXPIRY_KEY)
}

/**
 * Check if the token is expired
 */
export async function isTokenExpired(): Promise<boolean> {
  const expiryStr = await AsyncStorage.getItem(TOKEN_EXPIRY_KEY)

  if (!expiryStr) {
    return true
  }

  const expiryTime = parseInt(expiryStr, 10)
  return Date.now() > expiryTime
}

/**
 * Check if user is authenticated (token exists and is not expired)
 */
export async function isAuthenticated(): Promise<boolean> {
  return (await getToken()) !== null
}
