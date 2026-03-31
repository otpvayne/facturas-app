/**
 * Factura detail and validation screen - SIMPLIFIED VERSION
 */

import React, { useState } from 'react'
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native'
import {
  Text,
  Button,
  ActivityIndicator,
  TextInput,
  Chip,
  Divider,
} from 'react-native-paper'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'
import { useFacturaDetail, useProcessOcr, useValidateFactura } from '@/hooks/useFacturas'
import {
  formatDate,
  formatDateTime,
  formatCurrency,
  formatStatus,
  formatEstado,
} from '@/utils/formatting'

export function DetailScreen({ route, navigation }: any) {
  const { facturaId } = route.params
  const { data: factura, isLoading, isError, refetch } = useFacturaDetail(facturaId)
  const processOcrMutation = useProcessOcr(facturaId)
  const validateMutation = useValidateFactura(facturaId)

  const [activeTab, setActiveTab] = useState<'details' | 'ocr' | 'validation'>('details')
  const [validatedProvider, setValidatedProvider] = useState('')
  const [validatedDate, setValidatedDate] = useState('')
  const [validatedTotal, setValidatedTotal] = useState('')
  const [validationNotes, setValidationNotes] = useState('')

  const handleProcessOcr = async () => {
    try {
      await processOcrMutation.mutateAsync()
      Toast.show({
        type: 'success',
        text1: 'OCR Processing',
        text2: 'Image is being processed',
      })
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'OCR Failed',
        text2: err?.message || 'Failed to process image',
      })
    }
  }

  const handleValidate = async () => {
    try {
      await validateMutation.mutateAsync({
        validated_provider: validatedProvider || undefined,
        validated_date: validatedDate || undefined,
        validated_total: validatedTotal || undefined,
        validation_notes: validationNotes || undefined,
      })
      Toast.show({
        type: 'success',
        text1: 'Validated',
        text2: 'Factura validated successfully',
      })
      navigation.goBack()
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Validation Failed',
        text2: err?.message || 'Failed to validate',
      })
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (isError || !factura) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Failed to load factura</Text>
        <Button onPress={() => refetch()}>Retry</Button>
      </View>
    )
  }

  const ocrBlock = factura.ocr
  const statusInfo = formatStatus(factura.status)
  const estadoInfo = formatEstado(factura.estado)

  return (
    <View style={styles.container}>
      {/* Tab Buttons */}
      <View style={styles.tabButtons}>
        <Button
          mode={activeTab === 'details' ? 'contained' : 'outlined'}
          onPress={() => setActiveTab('details')}
          style={styles.tabButton}
        >
          Details
        </Button>
        <Button
          mode={activeTab === 'ocr' ? 'contained' : 'outlined'}
          onPress={() => setActiveTab('ocr')}
          style={styles.tabButton}
        >
          OCR
        </Button>
        <Button
          mode={activeTab === 'validation' ? 'contained' : 'outlined'}
          onPress={() => setActiveTab('validation')}
          style={styles.tabButton}
        >
          Validate
        </Button>
      </View>

      <ScrollView style={styles.scrollContent}>
        <View style={styles.content}>
          {/* Details Tab */}
          {activeTab === 'details' && (
            <View>
              {factura.image_url && (
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: factura.image_url }}
                    style={styles.image}
                    resizeMode="contain"
                  />
                </View>
              )}

              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <Text variant="bodySmall" style={styles.label}>
                    Number:
                  </Text>
                  <Text variant="bodyMedium" style={styles.value}>
                    {factura.numero || 'N/A'}
                  </Text>
                </View>

                <Divider />

                <View style={styles.detailRow}>
                  <Text variant="bodySmall" style={styles.label}>
                    Provider:
                  </Text>
                  <Text variant="bodyMedium" style={styles.value}>
                    {factura.proveedor || 'N/A'}
                  </Text>
                </View>

                <Divider />

                <View style={styles.detailRow}>
                  <Text variant="bodySmall" style={styles.label}>
                    Amount:
                  </Text>
                  <Text variant="bodyMedium" style={styles.value}>
                    {formatCurrency(factura.monto_total || '0', factura.moneda)}
                  </Text>
                </View>

                <Divider />

                <View style={styles.detailRow}>
                  <Text variant="bodySmall" style={styles.label}>
                    Status:
                  </Text>
                  <Chip style={[styles.statusChip, { backgroundColor: statusInfo.color }]} textStyle={{ color: '#fff' }}>
                    {statusInfo.label}
                  </Chip>
                </View>

                <Divider />

                <View style={styles.detailRow}>
                  <Text variant="bodySmall" style={styles.label}>
                    Created:
                  </Text>
                  <Text variant="bodySmall" style={styles.dateValue}>
                    {formatDateTime(factura.created_at)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* OCR Tab */}
          {activeTab === 'ocr' && (
            <View>
              {!ocrBlock ? (
                <View style={styles.emptyCard}>
                  <MaterialCommunityIcons name="file-search" size={48} color="#ccc" />
                  <Text variant="titleMedium" style={styles.emptyText}>
                    No OCR data yet
                  </Text>
                  <Button
                    mode="contained"
                    onPress={handleProcessOcr}
                    loading={processOcrMutation.isPending}
                    style={styles.processButton}
                  >
                    Process Image
                  </Button>
                </View>
              ) : (
                <View style={styles.ocrCard}>
                  <Text variant="titleSmall" style={styles.ocrTitle}>
                    Extracted Data
                  </Text>

                  <View style={styles.ocrField}>
                    <Text variant="bodySmall" style={styles.label}>
                      Provider:
                    </Text>
                    <Text variant="bodyMedium">{ocrBlock.extracted_provider || 'N/A'}</Text>
                  </View>

                  <View style={styles.ocrField}>
                    <Text variant="bodySmall" style={styles.label}>
                      Date:
                    </Text>
                    <Text variant="bodyMedium">{ocrBlock.extracted_date || 'N/A'}</Text>
                  </View>

                  <View style={styles.ocrField}>
                    <Text variant="bodySmall" style={styles.label}>
                      Total:
                    </Text>
                    <Text variant="bodyMedium">{ocrBlock.extracted_total || 'N/A'}</Text>
                  </View>

                  <Divider style={styles.divider} />

                  <Button
                    mode="outlined"
                    onPress={handleProcessOcr}
                    loading={processOcrMutation.isPending}
                    style={styles.reprocessButton}
                  >
                    Re-process OCR
                  </Button>
                </View>
              )}
            </View>
          )}

          {/* Validation Tab */}
          {activeTab === 'validation' && (
            <View>
              {factura.status === 'validated' ? (
                <View style={styles.validatedCard}>
                  <MaterialCommunityIcons name="check-circle" size={48} color="#4CAF50" style={styles.checkIcon} />
                  <Text variant="titleMedium" style={styles.validatedText}>
                    Factura Validated
                  </Text>
                </View>
              ) : (
                <View style={styles.validationForm}>
                  <Text variant="titleSmall" style={styles.formTitle}>
                    Validate Extracted Data
                  </Text>

                  <TextInput
                    label="Provider"
                    value={validatedProvider}
                    onChangeText={setValidatedProvider}
                    placeholder={ocrBlock?.extracted_provider || 'Enter provider'}
                    style={styles.validationInput}
                  />

                  <TextInput
                    label="Date"
                    value={validatedDate}
                    onChangeText={setValidatedDate}
                    placeholder={ocrBlock?.extracted_date || 'YYYY-MM-DD'}
                    style={styles.validationInput}
                  />

                  <TextInput
                    label="Total Amount"
                    value={validatedTotal}
                    onChangeText={setValidatedTotal}
                    placeholder={ocrBlock?.extracted_total || '0.00'}
                    style={styles.validationInput}
                  />

                  <TextInput
                    label="Notes (Optional)"
                    value={validationNotes}
                    onChangeText={setValidationNotes}
                    multiline
                    numberOfLines={3}
                    style={[styles.validationInput, styles.notesInput]}
                  />

                  <Button
                    mode="contained"
                    onPress={handleValidate}
                    loading={validateMutation.isPending}
                    style={styles.validateButton}
                  >
                    Submit Validation
                  </Button>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tabButtons: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  tabButton: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  imageContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 300,
  },
  detailCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: {
    fontWeight: 'bold',
    flex: 1,
  },
  value: {
    flex: 1,
    textAlign: 'right',
  },
  dateValue: {
    color: '#666',
    textAlign: 'right',
  },
  statusChip: {
    height: 28,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 16,
    marginBottom: 16,
  },
  processButton: {
    marginTop: 12,
  },
  ocrCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  ocrTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  ocrField: {
    marginBottom: 12,
  },
  divider: {
    marginVertical: 12,
  },
  reprocessButton: {
    marginTop: 8,
  },
  validatedCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  checkIcon: {
    marginBottom: 16,
  },
  validatedText: {
    marginBottom: 8,
  },
  validationForm: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  formTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  validationInput: {
    marginBottom: 12,
  },
  notesInput: {
    textAlignVertical: 'top',
  },
  validateButton: {
    marginTop: 8,
  },
  errorText: {
    color: '#d32f2f',
  },
})
