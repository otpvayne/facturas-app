/**
 * Create factura screen for manual entry
 */

import React, { useState } from 'react'
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { Text, TextInput, Button, ActivityIndicator, SegmentedButtons } from 'react-native-paper'
import Toast from 'react-native-toast-message'
import { useCreateFactura } from '@/hooks/useFacturas'
import { FacturaCreatePayload } from '@/types/api'

export function CreateScreen({ navigation }: any) {
  const createMutation = useCreateFactura()
  const [numero, setNumero] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [montoTotal, setMontoTotal] = useState('')
  const [moneda, setMoneda] = useState('SOL')
  const [descripcion, setDescripcion] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!numero.trim()) {
      newErrors.numero = 'Invoice number is required'
    }

    if (!proveedor.trim()) {
      newErrors.proveedor = 'Provider name is required'
    }

    if (!montoTotal.trim()) {
      newErrors.montoTotal = 'Amount is required'
    } else if (isNaN(parseFloat(montoTotal))) {
      newErrors.montoTotal = 'Amount must be a valid number'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleCreate = async () => {
    if (!validateForm()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please fill all required fields',
      })
      return
    }

    const payload: FacturaCreatePayload = {
      numero,
      proveedor,
      monto_total: parseFloat(montoTotal),
      moneda,
      descripcion: descripcion || undefined,
    }

    try {
      const result = await createMutation.mutateAsync(payload)
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Factura created successfully',
      })
      // Navigate to detail view
      navigation.navigate('Detail', { facturaId: result.id })
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || err?.message || 'Failed to create factura'
      Toast.show({
        type: 'error',
        text1: 'Creation Failed',
        text2: typeof errorMessage === 'string' ? errorMessage : 'Please try again',
      })
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scrollContent}>
        <View style={styles.content}>
          <Text variant="headlineSmall" style={styles.title}>
            Create New Factura
          </Text>

          <TextInput
            label="Invoice Number*"
            value={numero}
            onChangeText={setNumero}
            style={styles.input}
            error={!!errors.numero}
            disabled={createMutation.isPending}
          />
          {errors.numero && <Text style={styles.errorText}>{errors.numero}</Text>}

          <TextInput
            label="Provider Name*"
            value={proveedor}
            onChangeText={setProveedor}
            style={styles.input}
            error={!!errors.proveedor}
            disabled={createMutation.isPending}
          />
          {errors.proveedor && <Text style={styles.errorText}>{errors.proveedor}</Text>}

          <TextInput
            label="Total Amount*"
            value={montoTotal}
            onChangeText={setMontoTotal}
            keyboardType="decimal-pad"
            style={styles.input}
            error={!!errors.montoTotal}
            disabled={createMutation.isPending}
          />
          {errors.montoTotal && <Text style={styles.errorText}>{errors.montoTotal}</Text>}

          <Text variant="titleSmall" style={styles.label}>
            Currency
          </Text>
          <SegmentedButtons
            value={moneda}
            onValueChange={setMoneda}
            buttons={[
              { value: 'SOL', label: 'SOL' },
              { value: 'USD', label: 'USD' },
              { value: 'EUR', label: 'EUR' },
            ]}
            style={styles.segmented}
            disabled={createMutation.isPending}
          />

          <TextInput
            label="Description (Optional)"
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
            numberOfLines={4}
            style={[styles.input, styles.multilineInput]}
            disabled={createMutation.isPending}
          />

          {createMutation.isPending ? (
            <ActivityIndicator style={styles.loader} />
          ) : (
            <Button
              mode="contained"
              onPress={handleCreate}
              style={styles.button}
            >
              Create Factura
            </Button>
          )}

          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            style={styles.cancelButton}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    marginBottom: 24,
    fontWeight: 'bold',
  },
  input: {
    marginBottom: 8,
  },
  multilineInput: {
    textAlignVertical: 'top',
  },
  label: {
    marginTop: 16,
    marginBottom: 12,
  },
  segmented: {
    marginBottom: 24,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 12,
    marginBottom: 12,
  },
  button: {
    marginTop: 20,
    marginBottom: 12,
  },
  cancelButton: {
    marginBottom: 16,
  },
  loader: {
    marginVertical: 20,
  },
})
