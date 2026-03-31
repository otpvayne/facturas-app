/**
 * Authentication context for global state management of auth state
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import * as authService from '@/api/auth'

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, passwordConfirm: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check auth on mount
  useEffect(() => {
    const token = authService.getToken()
    setIsAuthenticated(token !== null)
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      await authService.login(email, password)
      setIsAuthenticated(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (email: string, password: string, passwordConfirm: string) => {
    setIsLoading(true)
    setError(null)
    try {
      await authService.register(email, password, passwordConfirm)
      setIsAuthenticated(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    authService.clearToken()
    setIsAuthenticated(false)
    setError(null)
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        error,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
