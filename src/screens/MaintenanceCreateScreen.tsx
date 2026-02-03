import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, StyleSheet, TouchableOpacity, 
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Modal, FlatList, Image,
  PermissionsAndroid
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
// Librerías nuevas
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';
import SignatureScreen from 'react-native-signature-canvas';

import { createMaintenanceRequest, getEquipments, getUsers } from '../services/odoo';

interface CreateProps {
  session: { uid: number; user: string; pass: string };
  onBack: () => void;
  onSuccess: () => void;
}

export const MaintenanceCreateScreen = ({ session, onBack, onSuccess }: CreateProps) => {
  // --- FORMULARIO GENERAL ---
  const [subject, setSubject] = useState('');
  const [type, setType] = useState<'corrective' | 'preventive'>('corrective');
  const [description, setDescription] = useState('');
  
  // Horas y Fechas
  const [workHoursStart, setWorkHoursStart] = useState('');
  const [workHoursEnd, setWorkHoursEnd] = useState('');
  const [execStartDate, setExecStartDate] = useState<Date | null>(null);
  const [execEndDate, setExecEndDate] = useState<Date | null>(null);

  // Selectores
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [equipments, setEquipments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  // --- NUEVO: EVIDENCIAS (FOTOS) ---
  const [evidences, setEvidences] = useState<Asset[]>([]);
  
  // --- NUEVO: FIRMA ---
  const [signature, setSignature] = useState<string | null>(null); // Base64 de la firma
  const [isSignatureVisible, setIsSignatureVisible] = useState(false);
  const signatureRef = useRef<any>(null);

  // UI Control
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'equipment' | 'user'>('equipment');
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);

  // DatePicker Logic
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [currentField, setCurrentField] = useState<'start' | 'end' | null>(null);
  const [tempDate, setTempDate] = useState<Date | null>(null);

  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    setLoadingData(true);
    try {
      const [equipmentsData, usersData] = await Promise.all([
        getEquipments(session.uid, session.pass),
        getUsers(session.uid, session.pass)
      ]);
      setEquipments(equipmentsData);
      setUsers(usersData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingData(false);
    }
  };

  // --- LÓGICA DE FOTOS ---
  const handleAddEvidence = () => {
    Alert.alert('Subir Evidencia', 'Selecciona una opción', [
      { text: 'Tomar Foto', onPress: () => openCamera() },
      { text: 'Galería', onPress: () => openGallery() },
      { text: 'Cancelar', style: 'cancel' }
    ]);
  };

  // Función auxiliar para pedir permiso en Android
  const requestCameraPermission = async () => {
    if (Platform.OS === 'ios') return true; // iOS lo maneja diferente, asumimos true por ahora

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: "Permiso de Cámara",
          message: "La App necesita acceso a la cámara para tomar fotos de evidencia.",
          buttonNeutral: "Preguntar luego",
          buttonNegative: "Cancelar",
          buttonPositive: "OK"
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  };

  const openCamera = async () => {
    // 1. Pedimos permiso antes de lanzar la cámara
    const hasPermission = await requestCameraPermission();

    if (!hasPermission) {
      Alert.alert('Permiso denegado', 'No podemos abrir la cámara si no nos das permiso.');
      return;
    }

    // 2. Si hay permiso, procedemos normal
    try {
        const result = await launchCamera({ mediaType: 'photo', quality: 0.5, includeBase64: true });
        if (result.didCancel) return; // Si el usuario canceló en la cámara nativa

        if (result.assets && result.assets.length > 0) {
            setEvidences([...evidences, ...result.assets]);
        }
    } catch (error) {
        Alert.alert('Error', 'Hubo un problema al abrir la cámara.');
    }
  };

  const openGallery = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 5, quality: 0.5, includeBase64: true });
    if (result.assets && result.assets.length > 0) {
      setEvidences([...evidences, ...result.assets]);
    }
  };

  const removeEvidence = (index: number) => {
    const newEvidences = [...evidences];
    newEvidences.splice(index, 1);
    setEvidences(newEvidences);
  };

  // --- LÓGICA DE FIRMA ---
  const handleSignatureOK = (signatureBase64: string) => {
    setSignature(signatureBase64); // Guardamos la firma
    setIsSignatureVisible(false); // Cerramos el modal
  };

  const handleClearSignature = () => {
    setSignature(null);
  };

  // --- GUARDAR EN ODOO ---
  const handleSave = async () => {
    if (!subject.trim()) {
      Alert.alert('Falta información', 'Por favor escribe el título.');
      return;
    }

    setSaving(true);
    try {
      // 1. Preparar Evidencias (Fotos) para Odoo
      // Odoo usa comandos especiales. (0, 0, {vals}) crea un registro nuevo vinculado.
      const evidenceCommands = evidences.map((img) => {
        return [0, 0, {
          name: img.fileName || 'evidencia.jpg',
          datas: img.base64, // Odoo necesita el string base64 puro
          type: 'binary'
        }];
      });

      // 2. Preparar Firma
      // La librería devuelve "data:image/png;base64,.....". Odoo solo quiere lo que va después de la coma.
      const cleanSignature = signature ? signature.replace('data:image/png;base64,', '') : false;

      const dataToSend: any = {
        name: subject,
        maintenance_type: type,
        description: description,
        equipment_id: selectedEquipmentId || false,
        user_id: selectedUserId || false,
        work_hours_start: workHoursStart ? parseFloat(workHoursStart) : 0.0,
        work_hours_end: workHoursEnd ? parseFloat(workHoursEnd) : 0.0,
        execution_start_date: formatForOdoo(execStartDate),
        execution_end_date: formatForOdoo(execEndDate),
        
        // --- CAMPOS NUEVOS ---
        customer_signature: cleanSignature,
        evidence_ids: evidenceCommands.length > 0 ? evidenceCommands : false,
      };

      await createMaintenanceRequest(session.uid, session.pass, dataToSend);
      Alert.alert('¡Éxito!', 'Solicitud creada con firma y evidencias.', [{ text: 'OK', onPress: onSuccess }]);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo guardar. Revisa el tamaño de las fotos.');
    } finally {
      setSaving(false);
    }
  };

  // --- UTILS ---
  const formatForOdoo = (date: Date | null) => {
    if (!date) return false;
    const iso = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString();
    return iso.slice(0, 19).replace('T', ' ');
  };
  
  const formatVisual = (date: Date | null) => {
    if (!date) return 'Seleccionar...';
    return date.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute:'2-digit' });
  };

  // Date Pickers
  const startPicking = (field: 'start' | 'end') => {
    setCurrentField(field);
    setTempDate(new Date());
    setPickerMode('date');
    setShowPicker(true);
  };

  const onPickerChange = (event: any, selectedDate?: Date) => {
    if (event.type === 'dismissed') { setShowPicker(false); return; }
    const currentDate = selectedDate || tempDate || new Date();
    if (pickerMode === 'date') {
        setTempDate(currentDate);
        setPickerMode('time');
        if (Platform.OS === 'android') { setShowPicker(false); setTimeout(() => setShowPicker(true), 100); }
    } else {
        setShowPicker(false);
        const finalDate = new Date(tempDate!);
        finalDate.setHours(currentDate.getHours());
        finalDate.setMinutes(currentDate.getMinutes());
        if (currentField === 'start') setExecStartDate(finalDate);
        if (currentField === 'end') setExecEndDate(finalDate);
    }
  };

  const getSelectedName = (list: any[], id: number | null) => {
    const item = list.find(i => i.id === id);
    return item ? item.name : 'Seleccionar...';
  };

  const openSelector = (type: 'equipment' | 'user') => {
    setModalType(type);
    setModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.headerBtn}>Cancelar</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Nueva Solicitud</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="white" /> : <Text style={styles.headerBtnBold}>GUARDAR</Text>}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}>
        <ScrollView contentContainerStyle={styles.formContainer}>
          
          <Text style={styles.label}>Título *</Text>
          <TextInput style={styles.inputLarge} placeholder="Ej: Falla motor" value={subject} onChangeText={setSubject} />

          {/* Selectores */}
          <View style={styles.row}>
            <View style={{flex: 1, marginRight: 5}}>
                <Text style={styles.label}>Máquina</Text>
                <TouchableOpacity style={styles.selector} onPress={() => openSelector('equipment')}>
                    <Text style={styles.selectorText} numberOfLines={1}>{getSelectedName(equipments, selectedEquipmentId)}</Text>
                </TouchableOpacity>
            </View>
            <View style={{flex: 1, marginLeft: 5}}>
                <Text style={styles.label}>Técnico</Text>
                <TouchableOpacity style={styles.selector} onPress={() => openSelector('user')}>
                    <Text style={styles.selectorText} numberOfLines={1}>{getSelectedName(users, selectedUserId)}</Text>
                </TouchableOpacity>
            </View>
          </View>

          {/* --- SECCIÓN EVIDENCIAS --- */}
          <Text style={styles.sectionHeader}>Fotos de Evidencia ({evidences.length})</Text>
          <View style={styles.cardSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 10}}>
                {evidences.map((img, index) => (
                    <View key={index} style={styles.evidenceItem}>
                        <Image source={{ uri: img.uri }} style={styles.evidenceImage} />
                        <TouchableOpacity style={styles.removeBtn} onPress={() => removeEvidence(index)}>
                            <Text style={styles.removeBtnText}>X</Text>
                        </TouchableOpacity>
                    </View>
                ))}
                <TouchableOpacity style={styles.addEvidenceBtn} onPress={handleAddEvidence}>
                    <Text style={styles.addEvidenceText}>+ FOTO</Text>
                </TouchableOpacity>
            </ScrollView>
          </View>

          {/* --- SECCIÓN FIRMA --- */}
          <Text style={styles.sectionHeader}>Firma del Cliente</Text>
          <View style={styles.cardSection}>
            {signature ? (
                <View style={{alignItems: 'center'}}>
                    <Image source={{ uri: signature }} style={styles.signaturePreview} resizeMode="contain" />
                    <TouchableOpacity onPress={handleClearSignature} style={styles.clearSigBtn}>
                        <Text style={{color: 'red'}}>Eliminar Firma</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity style={styles.signButton} onPress={() => setIsSignatureVisible(true)}>
                    <Text style={styles.signButtonText}>✍️ Firmar Aquí</Text>
                </TouchableOpacity>
            )}
          </View>

          {/* Registro de Ejecución */}
          <Text style={styles.sectionHeader}>Ejecución</Text>
          <View style={styles.cardSection}>
            <View style={styles.row}>
                <View style={{flex: 1, marginRight: 5}}>
                    <Text style={styles.labelSmall}>Horas Inicio</Text>
                    <TextInput style={styles.input} placeholder="0.0" keyboardType="numeric" value={workHoursStart} onChangeText={setWorkHoursStart} />
                </View>
                <View style={{flex: 1, marginLeft: 5}}>
                    <Text style={styles.labelSmall}>Horas Fin</Text>
                    <TextInput style={styles.input} placeholder="0.0" keyboardType="numeric" value={workHoursEnd} onChangeText={setWorkHoursEnd} />
                </View>
            </View>
            <Text style={styles.labelSmall}>Fecha Inicio</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => startPicking('start')}>
                <Text style={styles.dateText}>{formatVisual(execStartDate)}</Text>
            </TouchableOpacity>
            <Text style={styles.labelSmall}>Fecha Fin</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => startPicking('end')}>
                <Text style={styles.dateText}>{formatVisual(execEndDate)}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Tipo</Text>
          <View style={styles.typeContainer}>
            <TouchableOpacity style={[styles.typeBtn, type === 'corrective' && styles.typeBtnActive]} onPress={() => setType('corrective')}>
              <Text style={[styles.typeText, type === 'corrective' && styles.typeTextActive]}>Correctivo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeBtn, type === 'preventive' && styles.typeBtnActive]} onPress={() => setType('preventive')}>
              <Text style={[styles.typeText, type === 'preventive' && styles.typeTextActive]}>Preventivo</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Notas</Text>
          <TextInput style={[styles.input, { height: 60 }]} placeholder="Observaciones..." value={description} onChangeText={setDescription} multiline />

        </ScrollView>
      </KeyboardAvoidingView>

      {/* --- MODAL DE FIRMA (Rectangular para Odoo) --- */}
      <Modal visible={isSignatureVisible} animationType="slide" transparent={true} onRequestClose={() => setIsSignatureVisible(false)}>
        {/* Fondo oscurecido */}
        <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20}}>
            
            {/* Tarjeta Blanca Central */}
            <View style={{backgroundColor: 'white', borderRadius: 10, overflow: 'hidden'}}>
                
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Firmar Documento</Text>
                    <TouchableOpacity onPress={() => setIsSignatureVisible(false)}>
                        <Text style={styles.headerBtn}>Cancelar</Text>
                    </TouchableOpacity>
                </View>
                
               {/* ÁREA DE FIRMA (Ajustada a Formato Tira 400x100 de Odoo) */}
                <View style={{height: 120, width: '100%', backgroundColor: '#f9f9f9'}}>
                    <SignatureScreen
                        ref={signatureRef}
                        onOK={handleSignatureOK}
                        // Ocultamos botones y quitamos márgenes para aprovechar todo el espacio
                        webStyle={`.m-signature-pad--footer {display: none; margin: 0px;} body,html {width: 100%; height: 100%;}`} 
                        autoClear={true}
                        imageType="image/png"
                        // @ts-ignore 
                        trim={true} 
                    />
                </View>
                <Text style={{textAlign: 'center', color: '#999', fontSize: 12, paddingVertical: 5, backgroundColor: '#f0f0f0'}}>
                    Firma dentro del recuadro
                </Text>

                {/* BOTONES */}
                <View style={styles.signatureFooter}>
                    <TouchableOpacity 
                        style={[styles.footerBtn, {backgroundColor: '#e0e0e0', marginRight: 10}]} 
                        onPress={() => signatureRef.current?.clearSignature()}
                    >
                        <Text style={{color: '#333', fontWeight: 'bold'}}>Borrar</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        style={[styles.footerBtn, {backgroundColor: '#318F9A'}]} 
                        onPress={() => signatureRef.current?.readSignature()}
                    >
                        <Text style={{color: 'white', fontWeight: 'bold'}}>GUARDAR FIRMA</Text>
                    </TouchableOpacity>
                </View>

            </View>
        </View>
      </Modal>

      {/* DatePicker */}
      {showPicker && (
        <DateTimePicker value={tempDate || new Date()} mode={pickerMode} is24Hour={true} display="default" onChange={onPickerChange} />
      )}

      {/* Modal Listas */}
      <Modal visible={modalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Seleccionar {modalType === 'equipment' ? 'Máquina' : 'Técnico'}</Text>
            {loadingData ? <ActivityIndicator size="large" color="#318F9A" /> : (
                <FlatList
                    data={modalType === 'equipment' ? equipments : users}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.modalItem} onPress={() => {
                                if (modalType === 'equipment') setSelectedEquipmentId(item.id);
                                else setSelectedUserId(item.id);
                                setModalVisible(false);
                            }}>
                            <Text style={styles.modalItemText}>{item.name}</Text>
                        </TouchableOpacity>
                    )}
                />
            )}
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.closeModalText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EFF0F4' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#318F9A', padding: 15, elevation: 4 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  headerBtn: { color: 'white', fontSize: 16 },
  headerBtnBold: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  formContainer: { padding: 15, paddingBottom: 300 },
  label: { fontSize: 14, color: '#318F9A', fontWeight: 'bold', marginTop: 15, marginBottom: 5 },
  labelSmall: { fontSize: 12, color: '#666', marginBottom: 3, marginTop: 8 },
  sectionHeader: { fontSize: 16, color: '#444', fontWeight: 'bold', marginTop: 20, marginBottom: 5, textTransform: 'uppercase' },
  input: { backgroundColor: 'white', borderRadius: 5, padding: 10, borderWidth: 1, borderColor: '#ddd', fontSize: 16, color: '#333' },
  inputLarge: { backgroundColor: 'white', borderRadius: 5, padding: 15, borderWidth: 1, borderColor: '#ddd', fontSize: 18, color: '#333', fontWeight: 'bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  cardSection: { backgroundColor: '#fff', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  dateButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 5, borderWidth: 1, borderColor: '#ddd', marginBottom: 5 },
  dateText: { fontSize: 16, color: '#333' },
  selector: { backgroundColor: 'white', borderRadius: 5, padding: 12, borderWidth: 1, borderColor: '#ddd' },
  selectorText: { fontSize: 14, color: '#333' },
  typeContainer: { flexDirection: 'row', marginTop: 5 },
  typeBtn: { flex: 1, padding: 12, backgroundColor: '#e0e0e0', alignItems: 'center', marginRight: 5, borderRadius: 5 },
  typeBtnActive: { backgroundColor: '#318F9A' },
  typeText: { color: '#666', fontWeight: '600' },
  typeTextActive: { color: 'white' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 10, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#333' },
  modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalItemText: { fontSize: 16, color: '#333' },
  closeModalBtn: { marginTop: 20, alignItems: 'center', padding: 10, backgroundColor: '#eee', borderRadius: 5 },
  closeModalText: { color: 'red', fontWeight: 'bold' },
  
  // ESTILOS EVIDENCIA
  addEvidenceBtn: { width: 80, height: 80, backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center', borderRadius: 8, marginRight: 10 },
  addEvidenceText: { fontWeight: 'bold', color: '#666' },
  evidenceItem: { marginRight: 10, position: 'relative' },
  evidenceImage: { width: 80, height: 80, borderRadius: 8 },
  removeBtn: { position: 'absolute', top: -5, right: -5, backgroundColor: 'red', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  removeBtnText: { color: 'white', fontWeight: 'bold', fontSize: 12 },

  // ESTILOS FIRMA
  signButton: { backgroundColor: '#318F9A', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 5 },
  signButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  signaturePreview: { width: '100%', height: 150, backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', marginBottom: 10 },
  clearSigBtn: { padding: 5 },
  // ESTILOS NUEVOS PARA FIRMA
  signatureFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: 'white'
  },
  footerBtn: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
});