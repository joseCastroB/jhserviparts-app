import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { getMaintenanceRequests } from '../services/odoo';

interface MaintenanceProps {
    session: { uid: number, user: string, pass: string };
    onBack: () => void; // Para volver al Dashboard
    onCreate: () => void; // Para ir a la pantalla de creación
    onEdit: (requestId: number) => void;
}

export const MaintenanceScreen = ({ session, onBack, onCreate, onEdit }: MaintenanceProps) => {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    //Estado para el buscador
    const [searchQuery, setSearchQuery] = useState('');
    // Lista de usuarios que pueden crear solicitudes
    const allowedUsers = ['admin', 'juan.zegarra@jhserviparts.com'];
    // Verificamos si el usuario actual está en la lista (ignorando mayúsculas/minúsculas por seguridad)
    const canCreate = allowedUsers.includes(session.user.toLowerCase());

    //Cargar datos al abrir la pantalla
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

    // Lógica de filtrado 
    const filteredRequests = requests.filter(item =>{
        const searchText = searchQuery.toLowerCase();
        const name = item.name ? item.name.toLowerCase() : '';
        const stage = Array.isArray(item.stage_id) ? item.stage_id[1].toLowerCase() : '';

        return name.includes(searchText) || stage.includes(searchText)  
    })


    // Diseño de cada tarjeta (Solicitud)
    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity onPress={() => onEdit(item.id)} activeOpacity={0.7}>
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    {/* Mostramos la etapa (Ej: Nueva solicitud, En progreso) */}
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                            {Array.isArray(item.stage_id) ? item.stage_id[1] : 'Borrador'}
                        </Text>
                    </View>
                </View>
                <Text style={styles.dateText}>Fecha: {item.request_date || 'Sin fecha'}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* --- Header Tipo Odoo --- */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Text style={styles.backText}>← Menú</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Mantenimiento</Text>
                <View style={{ width: 50 }} /> {/* Espacio vacío para equilibrar */}
            </View>

            {/* --- Botón NUEVO y Título --- */}
            <View style={styles.actionRow}>
                <Text style={styles.sectionTitle}>Solicitudes</Text>
                {canCreate && (
                    <TouchableOpacity style={styles.newButton} onPress={onCreate}>
                        <Text style={styles.newButtonText}>NUEVO</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Buscador */}
            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="🔍 Buscar solicitud..."
                    placeholderTextColor= "#999"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    clearButtonMode="while-editing"
                />
            </View>

            {/* --- Lista de Solicitudes --- */}
            {loading ? (
                <ActivityIndicator size="large" color="#318F9A" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={filteredRequests}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>
                            {searchQuery ? 'No se encontraron resultados.' : 'No hay solicitudes registradas.'}
                        </Text>
                    }
                    refreshing={loading}
                    onRefresh={loadRequests} 
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

    searchContainer:{
        paddingHorizontal: 15,
        paddingBottom: 10,
    },

    searchInput:{
        backgroundColor: 'white',
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 10,
        fontSize: 16,
        color: '#333',
        borderWidth: 1,
        borderColor: '#ddd',
        elevation: 1,
    },

    listContainer: { padding: 10 },
    card: {
        backgroundColor: 'white', borderRadius: 8, padding: 15, marginBottom: 10,
        elevation: 2, borderLeftWidth: 4, borderLeftColor: '#318F9A'
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', flex: 1 },
    dateText: { color: '#666', fontSize: 14 },

    badge: { backgroundColor: '#e0e0e0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    badgeText: { fontSize: 12, color: '#333' },
    emptyText: { textAlign: 'center', marginTop: 30, color: '#999' }
});