import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { getMaintenanceRequests } from '../services/odoo';

interface MaintenanceProps {
  session: { uid: number, user: string, pass: string };
  onBack: () => void;
  onCreate: () => void;
  onEdit: (requestId: number) => void;
}

export const MaintenanceScreen = ({ session, onBack, onCreate, onEdit }: MaintenanceProps) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Permisos (ajusta según tus necesidades reales)
  const allowedUsers = ['admin', 'juan.zegarra@jhserviparts.com'];
  const canCreate = allowedUsers.includes(session.user.toLowerCase());

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await getMaintenanceRequests(session.uid, session.pass);
      setRequests(data);
    } catch (e) {
      Alert.alert('Error', 'No se pudieron cargar las solicitudes');
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = requests.filter(item => {
    const searchText = searchQuery.toLowerCase();
    const name = item.name ? item.name.toLowerCase() : '';
    const title = item.request_title ? item.request_title.toLowerCase() : ''; // Buscamos también por título
    const stage = Array.isArray(item.stage_id) ? item.stage_id[1].toLowerCase() : '';
    
    // Filtro: Nombre (Código) O Título O Estado
    return name.includes(searchText) || title.includes(searchText) || stage.includes(searchText);
  });

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity onPress={() => onEdit(item.id)} activeOpacity={0.7}>
        <View style={styles.card}>
          {/* Cabecera: Código y Estado */}
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <View style={styles.badge}>
                <Text style={styles.badgeText}>
                    {Array.isArray(item.stage_id) ? item.stage_id[1] : 'Borrador'}
                </Text>
            </View>
          </View>
          
          {/* --- NUEVO: TÍTULO DE LA SOLICITUD --- */}
          <Text style={styles.cardSubtitle} numberOfLines={2}>
            {item.request_title || 'Sin descripción'}
          </Text>

          {/* Fecha */}
          <Text style={styles.dateText}>Fecha: {item.request_date || 'Sin fecha'}</Text>
        </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Menú</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mantenimiento</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.actionRow}>
        <Text style={styles.sectionTitle}>Solicitudes</Text>
        {canCreate && (
          <TouchableOpacity style={styles.newButton} onPress={onCreate}>
            <Text style={styles.newButtonText}>NUEVO</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchContainer}>
        <TextInput
            style={styles.searchInput}
            placeholder="🔍 Buscar por código, título..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#318F9A" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredRequests}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          refreshing={loading}
          onRefresh={loadRequests}
          ListEmptyComponent={
            <Text style={{textAlign: 'center', marginTop: 20, color: '#999'}}>
                No hay solicitudes encontradas.
            </Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EFF0F4' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#318F9A', padding: 15, elevation: 4
  },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  backButton: { padding: 5 },
  backText: { color: 'white', fontSize: 16 },

  actionRow: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    padding: 15, paddingBottom: 5 
  },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#444' },
  newButton: { backgroundColor: '#318F9A', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 5 },
  newButtonText: { color: 'white', fontWeight: 'bold', fontSize: 14 },

  searchContainer: { paddingHorizontal: 15, paddingBottom: 10 },
  searchInput: {
    backgroundColor: 'white', borderRadius: 8, paddingHorizontal: 15, paddingVertical: 10,
    fontSize: 16, color: '#333', borderWidth: 1, borderColor: '#ddd', elevation: 1
  },
  listContainer: { padding: 10 },
  
  // ESTILOS TARJETA
  card: {
    backgroundColor: 'white', borderRadius: 8, padding: 15, marginBottom: 10,
    elevation: 2, borderLeftWidth: 4, borderLeftColor: '#318F9A'
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', flex: 1 },
  
  // Estilo nuevo para el subtítulo
  cardSubtitle: { fontSize: 15, color: '#555', marginBottom: 8, fontWeight: '500' },
  
  dateText: { color: '#999', fontSize: 12 },
  badge: { backgroundColor: '#e0e0e0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 12, color: '#333' }
});