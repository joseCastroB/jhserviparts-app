import React, { useState } from 'react';
import { 
  View, Text, TextInput, StyleSheet, TouchableOpacity, 
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView 
} from 'react-native';
import { createMaintenanceRequest } from '../services/odoo';

interface CreateProps {
  session: { uid: number; user: string; pass: string };
  onBack: () => void;
  onSuccess: () => void; // Para recargar la lista al volver
}

export const MaintenanceCreateScreen = ({ session, onBack, onSuccess }: CreateProps) => {
  const [subject, setSubject] = useState('');
  const [type, setType] = useState<'corrective' | 'preventive'>('corrective');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!subject.trim()) {
      Alert.alert('Falta información', 'Por favor escribe el título de la solicitud.');
      return;
    }

    setLoading(true);
    try {
      await createMaintenanceRequest(session.uid, session.pass, {
        name: subject,
        maintenance_type: type,
        description: description
      });
      
      Alert.alert('¡Éxito!', 'Solicitud creada correctamente.', [
        { text: 'OK', onPress: onSuccess }
      ]);
    } catch (error) {
      Alert.alert('Error', 'No se pudo crear la solicitud. Revisa tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.headerBtn}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nueva Solicitud</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.headerBtnBold}>GUARDAR</Text>}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}>
        <ScrollView contentContainerStyle={styles.formContainer}>
          
          {/* Campo: Solicitud (Título) */}
          <Text style={styles.label}>Solicitud (Título) *</Text>
          <TextInput
            style={styles.inputLarge}
            placeholder="Ej: No funciona la pantalla..."
            value={subject}
            onChangeText={setSubject}
            multiline
          />

          {/* Campo: Tipo de Mantenimiento */}
          <Text style={styles.label}>Tipo de Mantenimiento</Text>
          <View style={styles.typeContainer}>
            <TouchableOpacity 
              style={[styles.typeBtn, type === 'corrective' && styles.typeBtnActive]} 
              onPress={() => setType('corrective')}
            >
              <Text style={[styles.typeText, type === 'corrective' && styles.typeTextActive]}>Correctivo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.typeBtn, type === 'preventive' && styles.typeBtnActive]} 
              onPress={() => setType('preventive')}
            >
              <Text style={[styles.typeText, type === 'preventive' && styles.typeTextActive]}>Preventivo</Text>
            </TouchableOpacity>
          </View>

          {/* Campo: Notas (Descripción) */}
          <Text style={styles.label}>Notas / Detalles</Text>
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            placeholder="Describe el problema en detalle..."
            value={description}
            onChangeText={setDescription}
            multiline
          />

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EFF0F4' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#318F9A', padding: 15, elevation: 4
  },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  headerBtn: { color: 'white', fontSize: 16 },
  headerBtnBold: { color: 'white', fontSize: 16, fontWeight: 'bold' },

  formContainer: { padding: 20 },
  label: { fontSize: 14, color: '#318F9A', fontWeight: 'bold', marginTop: 15, marginBottom: 5 },
  
  input: {
    backgroundColor: 'white', borderRadius: 5, padding: 10, borderWidth: 1, borderColor: '#ddd',
    fontSize: 16, color: '#333'
  },
  inputLarge: {
    backgroundColor: 'white', borderRadius: 5, padding: 15, borderWidth: 1, borderColor: '#ddd',
    fontSize: 20, color: '#333', fontWeight: 'bold' // Letra grande como en Odoo
  },

  // Estilos para el selector de tipo (Radio buttons visuales)
  typeContainer: { flexDirection: 'row', marginTop: 5 },
  typeBtn: {
    flex: 1, padding: 12, backgroundColor: '#e0e0e0', alignItems: 'center',
    marginRight: 5, borderRadius: 5
  },
  typeBtnActive: { backgroundColor: '#318F9A' }, // Color activo
  typeText: { color: '#666', fontWeight: '600' },
  typeTextActive: { color: 'white' }
});