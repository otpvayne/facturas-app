/**
 * Profile screen showing user info and logout button
 */

import React from 'react'
import { View, StyleSheet, Alert } from 'react-native'
import { Text, Button, ActivityIndicator, Divider } from 'react-native-paper'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'
import { useAuth } from '@/context/AuthContext'

export function ProfileScreen({ navigation }: any) {
  const { logout, isLoading } = useAuth()

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout()
            Toast.show({
              type: 'success',
              text1: 'Logged out',
              text2: 'You have been logged out successfully',
            })
            // Navigation will be handled by auth state change
          } catch (err: any) {
            Toast.show({
              type: 'error',
              text1: 'Error',
              text2: 'Failed to logout',
            })
          }
        },
      },
    ])
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="account-circle" size={80} color="#2196F3" />
        <Text variant="headlineSmall" style={styles.title}>
          User Profile
        </Text>
      </View>

      <Divider />

      <View style={styles.content}>
        <View style={styles.infoCard}>
          <Text variant="labelMedium" style={styles.label}>
            EMAIL ADDRESS
          </Text>
          <Text variant="bodyLarge" style={styles.value}>
            user@example.com
          </Text>
        </View>

        <Divider style={styles.divider} />

        <View style={styles.infoCard}>
          <Text variant="labelMedium" style={styles.label}>
            ACCOUNT STATUS
          </Text>
          <Text variant="bodyLarge" style={styles.activeStatus}>
            Active
          </Text>
        </View>

        <Divider style={styles.divider} />

        <Text variant="titleSmall" style={styles.sectionTitle}>
          App Version
        </Text>
        <Text variant="bodySmall" style={styles.versionText}>
          1.0.0
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        {isLoading ? (
          <ActivityIndicator style={styles.loader} />
        ) : (
          <Button
            mode="contained"
            buttonColor="#d32f2f"
            onPress={handleLogout}
            icon="logout"
            style={styles.logoutButton}
          >
            Logout
          </Button>
        )}
      </View>

      <Text variant="bodySmall" style={styles.footer}>
        © 2026 Facturas App. All rights reserved.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#f5f5f5',
  },
  title: {
    marginTop: 16,
    fontWeight: 'bold',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    flex: 1,
  },
  infoCard: {
    paddingVertical: 12,
  },
  label: {
    color: '#999',
    marginBottom: 8,
  },
  value: {
    color: '#333',
  },
  activeStatus: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 12,
  },
  sectionTitle: {
    marginTop: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  versionText: {
    color: '#666',
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  logoutButton: {
    marginBottom: 8,
  },
  loader: {
    marginVertical: 16,
  },
  footer: {
    textAlign: 'center',
    paddingVertical: 12,
    color: '#999',
  },
})
