/**
 * Authentication context for managing auth state across the app
 * Adapted for React Native
 */

import React, { createContext, useContext, useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { login, register, logout } from '@/api/auth'
import { getToken } from '@/utils/storage'
import { TokenResponse } from '@/types/api'

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<TokenResponse>
  register: (email: string, password: string, passwordConfirm: string) => Promise<TokenResponse>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await getToken()
        setIsAuthenticated(token !== null)
        setError(null)
      } catch (err) {
        console.error('Auth check failed:', err)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const handleLogin = async (email: string, password: string): Promise<TokenResponse> => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await login(email, password)
      setIsAuthenticated(true)
      return response
    } catch (err: any) {
      const errorMessage = err?.message || 'Login failed'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (
    email: string,
    password: string,
    passwordConfirm: string
  ): Promise<TokenResponse> => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await register(email, password, passwordConfirm)
      setIsAuthenticated(true)
      return response
    } catch (err: any) {
      const errorMessage = err?.message || 'Registration failed'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      await logout()
      setIsAuthenticated(false)
      setError(null)
    } catch (err) {
      console.error('Logout failed:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    error,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
