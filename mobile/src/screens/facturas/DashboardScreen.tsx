/**
 * Dashboard screen showing list of facturas with filters
 */

import React, { useState, useCallback } from 'react'
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native'
import { Text, Button, TextInput, ActivityIndicator, Chip, Divider } from 'react-native-paper'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'
import { useListFacturas } from '@/hooks/useFacturas'
import { formatDate, formatCurrency, formatStatus } from '@/utils/formatting'
import { FacturaFilters, FacturaSummary } from '@/types/api'

export function DashboardScreen({ navigation }: any) {
  const [filters, setFilters] = useState<FacturaFilters>({
    page: 1,
    page_size: 20,
  })
  const [showFilters, setShowFilters] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const { data, isLoading, isError, error, refetch } = useListFacturas(filters)

  const handleRefresh = useCallback(() => {
    refetch()
  }, [refetch])

  const handleSearch = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      q: searchText || undefined,
      page: 1,
    }))
  }, [searchText])

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status)
    setFilters((prev) => ({
      ...prev,
      status: status === '' ? undefined : (status as any),
      page: 1,
    }))
  }

  const handleLoadMore = () => {
    if (data && filters.page! < data.total_pages) {
      setFilters((prev) => ({
        ...prev,
        page: (prev.page || 1) + 1,
      }))
    }
  }

  const handleSelectFactura = (facturaId: string) => {
    navigation.navigate('Detail', { facturaId })
  }

  const renderFacturaItem = ({ item }: { item: FacturaSummary }) => {
    const statusInfo = formatStatus(item.status)
    return (
      <TouchableOpacity
        style={styles.facturaCard}
        onPress={() => handleSelectFactura(item.factura_id)}
      >
        <View style={styles.cardHeader}>
          <Text variant="titleMedium" style={styles.numeroText}>
            {item.numero || 'N/A'}
          </Text>
          <Chip
            style={[styles.statusChip, { backgroundColor: statusInfo.color }]}
            textStyle={{ color: '#fff', fontSize: 12 }}
          >
            {statusInfo.label}
          </Chip>
        </View>

        <Text variant="bodySmall" style={styles.proveedorText}>
          {item.proveedor || 'Sin proveedor'}
        </Text>

        <View style={styles.cardFooter}>
          <Text variant="bodySmall">
            {formatCurrency(item.monto_total || '0', item.moneda)}
          </Text>
          <Text variant="bodySmall" style={styles.dateText}>
            {formatDate(item.created_at)}
          </Text>
        </View>
      </TouchableOpacity>
    )
  }

  if (isLoading && !data) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (isError) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Error loading facturas</Text>
        <Text style={styles.errorSubtext}>{(error as any)?.message}</Text>
        <Button onPress={() => refetch()}>Retry</Button>
      </View>
    )
  }

  const facturas = data?.items || []

  return (
    <View style={styles.container}>
      {/* Search and Filter Bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search facturas..."
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={handleSearch}
          right={
            <TextInput.Icon
              icon="magnify"
              onPress={handleSearch}
            />
          }
        />
        <Button
          compact
          icon="filter"
          onPress={() => setShowFilters(!showFilters)}
          style={styles.filterButton}
        >
          Filters
        </Button>
      </View>

      {/* Filters Modal */}
      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.filterModal}>
          <View style={styles.filterContent}>
            <View style={styles.filterHeader}>
              <Text variant="headlineSmall">Filters</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <MaterialCommunityIcons name="close" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterScroll}>
              <Text variant="titleMedium" style={styles.filterLabel}>
                Status
              </Text>
              <View style={styles.filterOptions}>
                {['', 'uploaded', 'ocr_done', 'validated'].map((status) => (
                  <Chip
                    key={status}
                    selected={statusFilter === status}
                    onPress={() => handleStatusFilter(status)}
                    style={styles.filterChip}
                  >
                    {status === '' ? 'All' : status}
                  </Chip>
                ))}
              </View>

              <Divider style={styles.divider} />

              <Button
                mode="contained"
                onPress={() => setShowFilters(false)}
                style={styles.applyButton}
              >
                Apply Filters
              </Button>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Facturas List */}
      {facturas.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="inbox" size={64} color="#ccc" />
          <Text variant="titleMedium" style={styles.emptyText}>
            No facturas yet
          </Text>
          <Text variant="bodySmall" style={styles.emptySubtext}>
            Create your first factura to get started
          </Text>
        </View>
      ) : (
        <FlatList
          data={facturas}
          renderItem={renderFacturaItem}
          keyExtractor={(item) => item.factura_id}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoading && data ? (
              <View style={styles.loadingFooter}>
                <ActivityIndicator />
              </View>
            ) : null
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Pagination Info */}
      {data && (
        <View style={styles.paginationInfo}>
          <Text variant="bodySmall">
            Page {data.page} of {data.total_pages} | Total: {data.total_items}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
  },
  filterButton: {
    justifyContent: 'center',
  },
  filterModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  filterContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '80%',
  },
  filterHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  filterLabel: {
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    marginBottom: 8,
  },
  divider: {
    marginVertical: 16,
  },
  applyButton: {
    marginBottom: 16,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  facturaCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  numeroText: {
    fontWeight: 'bold',
    flex: 1,
  },
  statusChip: {
    height: 28,
  },
  proveedorText: {
    color: '#666',
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  dateText: {
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
  },
  emptySubtext: {
    color: '#999',
    marginTop: 4,
  },
  loadingFooter: {
    paddingVertical: 16,
  },
  paginationInfo: {
    backgroundColor: '#fff',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'center',
  },
  errorText: {
    color: '#d32f2f',
    marginBottom: 8,
  },
  errorSubtext: {
    color: '#999',
    marginBottom: 16,
  },
})
