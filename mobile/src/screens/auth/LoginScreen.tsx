/**
 * Login screen for authentication
 */

import React, { useState } from 'react'
import { View, StyleSheet, ScrollView, Alert } from 'react-native'
import { Text, TextInput, Button, ActivityIndicator } from 'react-native-paper'
import Toast from 'react-native-toast-message'
import { useAuth } from '@/context/AuthContext'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

type RootStackParamList = {
  Login: undefined
  Register: undefined
  Dashboard: undefined
}

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>

export function LoginScreen({ navigation }: Props) {
  const { login, isLoading, error } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const validateForm = (): boolean => {
    let isValid = true
    setEmailError('')
    setPasswordError('')

    if (!email) {
      setEmailError('Email is required')
      isValid = false
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email')
      isValid = false
    }

    if (!password) {
      setPasswordError('Password is required')
      isValid = false
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      isValid = false
    }

    return isValid
  }

  const handleLogin = async () => {
    if (!validateForm()) return

    try {
      await login(email, password)
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Logged in successfully',
        position: 'top',
      })
      navigation.replace('Dashboard')
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || err?.message || 'Login failed'
      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: errorMessage,
        position: 'top',
      })
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Facturas
        </Text>
        <Text variant="titleSmall" style={styles.subtitle}>
          Sign in to your account
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
          error={!!emailError}
          disabled={isLoading}
        />
        {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}

        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          error={!!passwordError}
          disabled={isLoading}
        />
        {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}

        {isLoading ? (
          <ActivityIndicator size="large" style={styles.loader} />
        ) : (
          <Button mode="contained" onPress={handleLogin} style={styles.button}>
            Sign In
          </Button>
        )}

        <View style={styles.registerLink}>
          <Text>Don't have an account? </Text>
          <Text style={styles.link} onPress={() => navigation.navigate('Register')}>
            Sign up
          </Text>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  input: {
    marginBottom: 8,
  },
  fieldError: {
    color: '#d32f2f',
    marginBottom: 12,
    fontSize: 12,
  },
  errorBox: {
    backgroundColor: '#ffebee',
    borderLeftWidth: 4,
    borderLeftColor: '#d32f2f',
    padding: 12,
    marginBottom: 20,
    borderRadius: 4,
  },
  errorText: {
    color: '#d32f2f',
  },
  button: {
    marginTop: 20,
    marginBottom: 20,
  },
  loader: {
    marginVertical: 20,
  },
  registerLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  link: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
})
