import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert} from 'react-native';

// Importamos la configuración para leer el nombre de la BD
import {ODOO_CONFIG} from '../services/odoo';

// Definimos la estructura de un Módulo
interface ModuleItem {
    id: string;
    name: string;
    icon?: any; // Puede ser una imagen local o null
    color?: string; // Color de respaldo si no hay imagen
}

// Datos simulados (Aquí irás agregando tus otros módulos)
const MODULES: ModuleItem[] = [
    { id: '1', name: 'Conversaciones', color: '#F06050'},
    { id: '2', name: 'Calendario', color: '#F29648'},
    { id: '3', name: 'Mantenimiento', icon: require('../assets/logo_mantenimiento.png'), color: '#318F9A' },
    { id: '4', name: 'Contactos', color: '#315C99'},
    { id: '5', name: 'Inventario', color: '#7C3446'},
    { id: '6', name: 'Ajustes', color: '#666666'},
];

interface DashboardProps {
    username: string;
    onLogout: () => void;
    onModulePress: (moduleName: string) => void;
}

export const DashboardScreen = ({ username, onLogout, onModulePress}: DashboardProps) => {
    // Función para dibujar cada tarjetita
  const renderItem = ({ item }: { item: ModuleItem }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => item.name === 'Mantenimiento' ? onModulePress(item.name) : Alert.alert('Próximamente', `El módulo ${item.name} aún no está listo.`)}
    >
      <View style={styles.iconContainer}>
        {/* Si existe la imagen local, la usa. Si no, pone un cuadro de color */}
        {item.icon ? (
            // Asegúrate de tener la imagen o esto dará error si no existe el archivo. 
            // Si no tienes la imagen aún, comenta la línea de <Image> y descomenta la <View> de abajo.
            <Image source={item.icon} style={styles.iconImage} resizeMode="contain" />
        ) : (
            <View style={[styles.placeholderIcon, { backgroundColor: item.color }]} >
                <Text style={styles.placeholderText}>{item.name[0]}</Text>
            </View>
        )}
      </View>
      <Text style={styles.cardText}>{item.name}</Text>
    </TouchableOpacity>
  );

    return (
    <View style={styles.container}>
      
      {/* --- HEADER SUPERIOR --- */}
      <View style={styles.headerContainer}>
        {/* Parte Izquierda (Vacía o Logo Empresa) */}
        <View style={{ flex: 1 }} />

        {/* Parte Derecha (Info Usuario) */}
        <View style={styles.userInfo}>
           {/* Avatar Simulado */}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{username.charAt(0).toUpperCase()}</Text>
          </View>
          
          <View>
            <Text style={styles.usernameText}>{username}</Text>
            <Text style={styles.dbText}>{ODOO_CONFIG.db}</Text>
          </View>
          
          {/* Botón sutil de salir */}
          <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
            <Text style={{color: '#d9534f', fontSize: 12}}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* --- GRID DE MÓDULOS --- */}
      <FlatList
        data={MODULES}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={3} // 3 columnas como en Odoo
        contentContainerStyle={styles.gridContainer}
      />
    </View>
  );     
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EFF0F4' }, // Color de fondo gris Odoo Enterprise
  
  // Header
  headerContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    alignItems: 'center',
  },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 35, height: 35,
    backgroundColor: '#714B67', // Color morado Odoo
    borderRadius: 5,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
  },
  avatarText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  usernameText: { fontWeight: 'bold', color: '#333', fontSize: 14 },
  dbText: { color: '#666', fontSize: 12, fontStyle: 'italic' },
  logoutBtn: { marginLeft: 15, padding: 5, backgroundColor: '#ffeaea', borderRadius: 4 },

  // Grid
  gridContainer: { padding: 10, paddingTop: 30 },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 8,
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 20,
    elevation: 2, // Sombra Android
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, // Sombra iOS
    minHeight: 110,
  },
  iconContainer: { width: 50, height: 50, marginBottom: 10, justifyContent: 'center', alignItems: 'center' },
  iconImage: { width: '100%', height: '100%' },
  placeholderIcon: { width: 50, height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  cardText: { fontSize: 13, color: '#444', fontWeight: '500' },
});