/**
 * Upload factura image screen
 */

import React, { useState } from 'react'
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { Text, Button, ActivityIndicator, ProgressBar, TextInput } from 'react-native-paper'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import Toast from 'react-native-toast-message'
import { useCreateFactura, useUploadImage } from '@/hooks/useFacturas'
import { FacturaCreatePayload } from '@/types/api'

export function UploadScreen({ navigation }: any) {
  const createMutation = useCreateFactura()
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [numero, setNumero] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [step, setStep] = useState<'create' | 'upload'>('create')
  const [createdFacturaId, setCreatedFacturaId] = useState<string | null>(null)
  const uploadMutation = useUploadImage(createdFacturaId || '')
  const [uploadProgress, setUploadProgress] = useState(0)

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      })

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri)
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to pick image',
      })
    }
  }

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      })

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri)
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to take photo',
      })
    }
  }

  const handleCreateFactura = async () => {
    if (!numero.trim() || !proveedor.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please enter invoice number and provider',
      })
      return
    }

    const payload: FacturaCreatePayload = {
      numero,
      proveedor,
      monto_total: 0,
      moneda: 'SOL',
      descripcion: 'Created via upload',
    }

    try {
      const result = await createMutation.mutateAsync(payload)
      setCreatedFacturaId(result.id)
      setStep('upload')
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Factura created. Now upload image.',
      })
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err?.message || 'Failed to create factura',
      })
    }
  }

  const handleUploadImage = async () => {
    if (!selectedImage || !createdFacturaId) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please select an image first',
      })
      return
    }

    try {
      const formData = new FormData()
      const fileName = selectedImage.split('/').pop() || 'image.jpg'
      formData.append('file', {
        uri: selectedImage,
        name: fileName,
        type: 'image/jpeg',
      } as any)

      await uploadMutation.mutateAsync(formData)
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Image uploaded successfully',
      })

      // Navigate to detail screen
      navigation.navigate('Detail', { facturaId: createdFacturaId })
      setSelectedImage(null)
      setNumero('')
      setProveedor('')
      setStep('create')
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Upload Failed',
        text2: err?.message || 'Failed to upload image',
      })
    }
  }

  if (step === 'create') {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <Text variant="headlineSmall" style={styles.title}>
            Create & Upload Factura
          </Text>

          <Text variant="titleSmall" style={styles.subtitle}>
            Step 1: Create Factura
          </Text>

          <TextInput
            label="Invoice Number*"
            value={numero}
            onChangeText={setNumero}
            style={styles.input}
            disabled={createMutation.isPending}
          />

          <TextInput
            label="Provider Name*"
            value={proveedor}
            onChangeText={setProveedor}
            style={styles.input}
            disabled={createMutation.isPending}
          />

          {createMutation.isPending ? (
            <ActivityIndicator style={styles.loader} />
          ) : (
            <Button
              mode="contained"
              onPress={handleCreateFactura}
              style={styles.button}
            >
              Next: Upload Image
            </Button>
          )}
        </View>
      </ScrollView>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text variant="headlineSmall" style={styles.title}>
          Upload Factura Image
        </Text>

        <Text variant="titleSmall" style={styles.subtitle}>
          Step 2: Upload Image
        </Text>

        {selectedImage ? (
          <View style={styles.imagePreview}>
            <Image
              source={{ uri: selectedImage }}
              style={styles.image}
              resizeMode="contain"
            />
            <Button
              mode="outlined"
              icon="close"
              onPress={() => setSelectedImage(null)}
              style={styles.removeImageButton}
            >
              Remove
            </Button>
          </View>
        ) : (
          <View style={styles.imageButtons}>
            <TouchableOpacity style={styles.imageButton} onPress={takePhoto}>
              <MaterialCommunityIcons name="camera" size={48} color="#2196F3" />
              <Text style={styles.imageButtonText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
              <MaterialCommunityIcons name="folder-image" size={48} color="#4CAF50" />
              <Text style={styles.imageButtonText}>Choose Image</Text>
            </TouchableOpacity>
          </View>
        )}

        {uploadProgress > 0 && uploadProgress < 100 && (
          <View style={styles.progressContainer}>
            <ProgressBar progress={uploadProgress / 100} style={styles.progressBar} />
            <Text variant="bodySmall">{Math.round(uploadProgress)}%</Text>
          </View>
        )}

        <View style={styles.actions}>
          {uploadMutation.isPending ? (
            <ActivityIndicator style={styles.loader} />
          ) : (
            <>
              <Button
                mode="outlined"
                onPress={() => {
                  setStep('create')
                  setSelectedImage(null)
                }}
                style={styles.backButton}
              >
                Back
              </Button>
              <Button
                mode="contained"
                onPress={handleUploadImage}
                disabled={!selectedImage}
                style={styles.button}
              >
                Upload Image
              </Button>
            </>
          )}
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
    padding: 16,
  },
  title: {
    marginBottom: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    marginBottom: 16,
    color: '#666',
  },
  input: {
    marginBottom: 12,
  },
  imagePreview: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 300,
    marginBottom: 12,
  },
  removeImageButton: {
    marginTop: 8,
  },
  imageButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  imageButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageButtonText: {
    marginTop: 8,
    textAlign: 'center',
    color: '#333',
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 8,
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
  },
  backButton: {
    flex: 1,
  },
  loader: {
    marginVertical: 20,
  },
})
