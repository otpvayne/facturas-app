/**
 * Root app component with providers
 */

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PaperProvider } from 'react-native-paper'
import Toast from 'react-native-toast-message'
import { AuthProvider } from '@/context/AuthContext'
import { RootNavigator } from '@/navigation/RootNavigator'

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
    },
    mutations: {
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <PaperProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <RootNavigator />
          <Toast />
        </QueryClientProvider>
      </AuthProvider>
    </PaperProvider>
  )
}
