import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, StyleSheet, TouchableOpacity, 
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Modal, FlatList, Image,
  PermissionsAndroid 
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';
import SignatureScreen from 'react-native-signature-canvas';

// Servicios de API
import { 
  createMaintenanceRequest, 
  getEquipments, 
  getUsers, 
  getPartners 
} from '../services/odoo';

interface CreateProps {
  session: { uid: number; user: string; pass: string };
  onBack: () => void;
  onSuccess: () => void;
}

export const MaintenanceCreateScreen = ({ session, onBack, onSuccess }: CreateProps) => {
  // --- FORMULARIO BÁSICO ---
  const [subject, setSubject] = useState('');
  const [type, setType] = useState<'corrective' | 'preventive'>('corrective');
  const [description, setDescription] = useState('');
  
  // Campos Técnicos
  const [hourType, setHourType] = useState<'operational' | 'snack' | 'transfer'>('operational');
  const [equipmentStatus, setEquipmentStatus] = useState<'operative' | 'inoperative'>('operative');
  
  // --- NUEVO: HORÓMETRO (Horas y Minutos) ---
  const [horometerHours, setHorometerHours] = useState('');
  const [horometerMinutes, setHorometerMinutes] = useState('');

  // --- NUEVOS CAMPOS (Final y Pendientes) ---
  const [equipmentFinalStatus, setEquipmentFinalStatus] = useState<'operative' | 'inoperative'>('operative');
  const [hasPending, setHasPending] = useState<'yes' | 'no'>('no');
  const [pendingComments, setPendingComments] = useState('');

  // Calificacion de servicio
  const [serviceRating, setServiceRating] = useState<'good' | 'regular' | 'bad'>('good');

  // Firmantes (Texto)
  const [signedByCustomer, setSignedByCustomer] = useState('');
  const [signedByTechnician, setSignedByTechnician] = useState('');

  // Checklist
  const [checklist, setChecklist] = useState<{name: string, is_done: boolean}[]>([]);

  // --- FECHAS ---
  const [execStartDate, setExecStartDate] = useState<Date | null>(null);
  const [execEndDate, setExecEndDate] = useState<Date | null>(null);

  // --- SELECCIONES (IDs) ---
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number | null>(null);
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<number[]>([]); 
  
  // --- LISTAS DE DATOS ---
  const [partners, setPartners] = useState<any[]>([]);
  const [equipments, setEquipments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  // --- MULTIMEDIA ---
  const [evidences, setEvidences] = useState<Asset[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [isSignatureVisible, setIsSignatureVisible] = useState(false);
  const signatureRef = useRef<any>(null);

  // --- UI CONTROL ---
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'partner' | 'equipment' | 'user'>('equipment');
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingEquipments, setLoadingEquipments] = useState(false);

  // --- DATE PICKER LOGIC ---
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [currentField, setCurrentField] = useState<'start' | 'end' | null>(null);
  const [tempDate, setTempDate] = useState<Date | null>(null);

  // 1. CARGA INICIAL
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoadingData(true);
    try {
      const [partnersData, usersData] = await Promise.all([
        getPartners(session.uid, session.pass),
        getUsers(session.uid, session.pass)
      ]);
      setPartners(partnersData);
      setUsers(usersData);
      const allEquipments = await getEquipments(session.uid, session.pass, null);
      setEquipments(allEquipments);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudieron cargar las listas iniciales.');
    } finally {
      setLoadingData(false);
    }
  };

  // 2. LÓGICA SELECTORES
  const handlePartnerSelect = async (partnerId: number) => {
    setSelectedPartnerId(partnerId);
    setSelectedEquipmentId(null);
    setModalVisible(false);
    setLoadingEquipments(true);
    try {
        const filteredEquipments = await getEquipments(session.uid, session.pass, partnerId);
        setEquipments(filteredEquipments);
    } catch (error) { console.error(error); } 
    finally { setLoadingEquipments(false); }
  };

  const toggleTechnician = (id: number) => {
    if (selectedTechnicianIds.includes(id)) {
        setSelectedTechnicianIds(selectedTechnicianIds.filter(item => item !== id));
    } else {
        setSelectedTechnicianIds([...selectedTechnicianIds, id]);
    }
  };

  // 3. LÓGICA CHECKLIST
  const addChecklistItem = () => setChecklist([...checklist, { name: '', is_done: false }]);
  const updateChecklistItem = (index: number, text: string) => {
    const newList = [...checklist]; newList[index].name = text; setChecklist(newList);
  };
  const toggleChecklistItem = (index: number) => {
    const newList = [...checklist]; newList[index].is_done = !newList[index].is_done; setChecklist(newList);
  };
  const removeChecklistItem = (index: number) => {
    const newList = [...checklist]; newList.splice(index, 1); setChecklist(newList);
  };

  // 4. GUARDAR
  const handleSave = async () => {
    if (!subject.trim()) { Alert.alert('Falta información', 'El título es obligatorio.'); return; }
    setSaving(true);
    try {
      // Preparar datos complejos
      const evidenceCommands = evidences.map((img) => [0, 0, {
          name: img.fileName || 'evidencia.jpg', datas: img.base64, type: 'binary'
      }]);
      const cleanSignature = signature ? signature.replace('data:image/png;base64,', '') : false;
      const technicianCommand = [[6, 0, selectedTechnicianIds]];
      const checklistCommands = checklist.map(item => [0, 0, { name: item.name, is_done: item.is_done }]);

      // CÁLCULO DEL HORÓMETRO (Para Odoo float_time)
      const h = parseFloat(horometerHours) || 0;
      const m = parseFloat(horometerMinutes) || 0;
      const finalHorometerFloat = h + (m / 60);

      const dataToSend: any = {
        request_title: subject,
        partner_id: selectedPartnerId || false,
        equipment_id: selectedEquipmentId || false,
        technician_id: technicianCommand,
        
        maintenance_type: type,
        hour_type: hourType,
        equipment_found_status: equipmentStatus,
        
        // --- NUEVO: HORÓMETRO CALCULADO ---
        horometer_execution: finalHorometerFloat,
        
        // NUEVOS CAMPOS
        equipment_final_status: equipmentFinalStatus,
        has_pending: hasPending,
        pending_comments: hasPending === 'yes' ? pendingComments : '', 
        
        // Calificacion
        service_rating: serviceRating,

        // CAMPOS DE FIRMA (TEXTO)
        signed_by_customer: signedByCustomer,
        signed_by_technician: signedByTechnician,

        description: description,
        checklist_ids: checklistCommands.length > 0 ? checklistCommands : false,

        execution_start_date: formatForOdoo(execStartDate),
        execution_end_date: formatForOdoo(execEndDate),
        
        customer_signature: cleanSignature,
        evidence_ids: evidenceCommands.length > 0 ? evidenceCommands : false,
      };

      await createMaintenanceRequest(session.uid, session.pass, dataToSend);
      Alert.alert('¡Éxito!', 'Solicitud creada correctamente.', [{ text: 'OK', onPress: onSuccess }]);
    } catch (error) {
      Alert.alert('Error', 'No se pudo crear la solicitud.');
    } finally {
      setSaving(false);
    }
  };

  // --- UTILS ---
  const requestCameraPermission = async () => {
    if (Platform.OS === 'ios') return true;
    try {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, { title: "Permiso", message: "Acceso a cámara requerido.", buttonNeutral: "Luego", buttonNegative: "Cancelar", buttonPositive: "OK" });
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) { return false; }
  };
  const openCamera = async () => { if(await requestCameraPermission()){ const r = await launchCamera({mediaType:'photo', quality:0.5, includeBase64:true}); if(r.assets) setEvidences([...evidences,...r.assets]); }};
  const openGallery = async () => { const r = await launchImageLibrary({mediaType:'photo', quality:0.5, includeBase64:true}); if(r.assets) setEvidences([...evidences,...r.assets]); };
  const handleAddEvidence = () => Alert.alert('Adjuntar', 'Elige', [{text:'Cámara', onPress:openCamera}, {text:'Galería', onPress:openGallery}, {text:'Cancelar', style:'cancel'}]);
  const removeEvidence = (i:number) => { const l=[...evidences]; l.splice(i,1); setEvidences(l); };

  const formatForOdoo = (d:Date|null) => d ? new Date(d.getTime()-(d.getTimezoneOffset()*60000)).toISOString().slice(0,19).replace('T',' ') : false;
  const formatVisual = (d:Date|null) => d ? d.toLocaleString('es-PE', {day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit'}) : 'Seleccionar...';
  const getSelectedName = (l:any[], id:number|null) => { const i=l.find(x=>x.id===id); return i?i.name:'Seleccionar...'; };
  const openSelector = (t:any) => { setModalType(t); setModalVisible(true); };
  const handleSignatureOK = (s:string) => { setSignature(s); setIsSignatureVisible(false); };
  
  const startPicking = (field: 'start' | 'end') => { setCurrentField(field); setTempDate(new Date()); setPickerMode('date'); setShowPicker(true); };
  const onPickerChange = (event: any, selectedDate?: Date) => {
    if (event.type === 'dismissed') { setShowPicker(false); return; }
    const currentDate = selectedDate || tempDate || new Date();
    if (pickerMode === 'date') {
        setTempDate(currentDate); setPickerMode('time');
        if (Platform.OS === 'android') { setShowPicker(false); setTimeout(() => setShowPicker(true), 100); }
    } else {
        setShowPicker(false);
        const finalDate = new Date(tempDate!); finalDate.setHours(currentDate.getHours()); finalDate.setMinutes(currentDate.getMinutes());
        if (currentField === 'start') setExecStartDate(finalDate);
        if (currentField === 'end') setExecEndDate(finalDate);
    }
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
          <TextInput style={styles.inputLarge} value={subject} onChangeText={setSubject} placeholder="Ej: Revisión General" />

          {/* CLIENTE */}
          <Text style={styles.label}>Cliente</Text>
          <TouchableOpacity style={styles.selector} onPress={() => openSelector('partner')}>
            <Text style={styles.selectorText} numberOfLines={1}>{getSelectedName(partners, selectedPartnerId)}</Text>
            <Text style={{color:'#666'}}>▼</Text>
          </TouchableOpacity>

          {/* MÁQUINA Y TÉCNICOS */}
          <View style={styles.row}>
            <View style={{flex: 1, marginRight: 5}}>
                <Text style={styles.label}>Máquina</Text>
                <TouchableOpacity 
                    style={[styles.selector, !selectedPartnerId && {backgroundColor: '#f0f0f0'}]}
                    onPress={() => !selectedPartnerId ? Alert.alert('Atención', 'Primero selecciona un Cliente.') : openSelector('equipment')}
                >
                    {loadingEquipments ? <ActivityIndicator color="#318F9A" size="small"/> : (
                        <Text style={styles.selectorText} numberOfLines={1}>{getSelectedName(equipments, selectedEquipmentId)}</Text>
                    )}
                </TouchableOpacity>
            </View>
            <View style={{flex: 1, marginLeft: 5}}>
                <Text style={styles.label}>Técnicos ({selectedTechnicianIds.length})</Text>
                <TouchableOpacity style={styles.selector} onPress={() => openSelector('user')}>
                    <Text style={styles.selectorText} numberOfLines={1}>
                        {selectedTechnicianIds.length > 0 ? users.filter(u => selectedTechnicianIds.includes(u.id)).map(u => u.name).join(', ') : 'Seleccionar...'}
                    </Text>
                </TouchableOpacity>
            </View>
          </View>

          {/* --- NUEVO: HORÓMETRO CON HORAS Y MINUTOS --- */}
          <Text style={styles.label}>Horómetro</Text>
          <View style={styles.row}>
             <View style={{flex: 1, marginRight: 5}}>
                 <Text style={styles.labelSmall}>Horas</Text>
                 <TextInput 
                     style={styles.input} 
                     value={horometerHours} 
                     onChangeText={setHorometerHours} 
                     placeholder="Ej: 1500" 
                     keyboardType="numeric" 
                 />
             </View>
             <View style={{flex: 1, marginLeft: 5}}>
                 <Text style={styles.labelSmall}>Minutos</Text>
                 <TextInput 
                     style={styles.input} 
                     value={horometerMinutes} 
                     onChangeText={(text) => {
                         const val = parseInt(text);
                         // Solo permite borrar o números entre 0 y 59
                         if (text === '' || (val >= 0 && val <= 59)) {
                             setHorometerMinutes(text);
                         }
                     }} 
                     placeholder="0 - 59" 
                     keyboardType="numeric"
                     maxLength={2} 
                 />
             </View>
          </View>

          {/* TIPO DE HORA */}
          <Text style={styles.label}>Tipo de Hora</Text>
          <View style={styles.typeContainer}>
            {['operational', 'snack', 'transfer'].map((t) => (
                <TouchableOpacity key={t}
                    style={[styles.typeBtn, hourType === t && styles.typeBtnActive, {marginHorizontal:2}]} 
                    onPress={() => setHourType(t as any)}>
                    <Text style={[styles.typeText, hourType === t && styles.typeTextActive]}>
                        {t === 'operational' ? 'Operativo' : t === 'snack' ? 'Refrigerio' : 'Traslado'}
                    </Text>
                </TouchableOpacity>
            ))}
          </View>

          {/* FECHAS */}
          <Text style={styles.label}>Fechas y Hora</Text>
          <View style={styles.row}>
             <View style={{flex: 1, marginRight: 5}}>
                 <Text style={styles.labelSmall}>Inicio</Text>
                 <TouchableOpacity style={styles.dateButton} onPress={()=>startPicking('start')}>
                    <Text style={styles.dateText}>{formatVisual(execStartDate)}</Text>
                 </TouchableOpacity>
             </View>
             <View style={{flex: 1, marginLeft: 5}}>
                 <Text style={styles.labelSmall}>Fin</Text>
                 <TouchableOpacity style={styles.dateButton} onPress={()=>startPicking('end')}>
                    <Text style={styles.dateText}>{formatVisual(execEndDate)}</Text>
                 </TouchableOpacity>
             </View>
          </View>

          {/* ESTADO INICIAL */}
          <Text style={styles.label}>¿Cómo encontró el equipo?</Text>
          <View style={styles.typeContainer}>
            <TouchableOpacity style={[styles.typeBtn, equipmentStatus === 'operative' && styles.typeBtnActive]} onPress={() => setEquipmentStatus('operative')}>
              <Text style={[styles.typeText, equipmentStatus === 'operative' && styles.typeTextActive]}>Operativo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeBtn, equipmentStatus === 'inoperative' && styles.typeBtnActive, {marginLeft: 10}]} onPress={() => setEquipmentStatus('inoperative')}>
              <Text style={[styles.typeText, equipmentStatus === 'inoperative' && styles.typeTextActive]}>Inoperativo</Text>
            </TouchableOpacity>
          </View>

          {/* CHECKLIST */}
          <Text style={styles.label}>Descripción del Servicio</Text>
          <View style={styles.cardSection}>
             {checklist.map((item, index) => (
                <View key={index} style={styles.checklistItem}>
                    <TouchableOpacity onPress={() => toggleChecklistItem(index)} style={styles.checkboxContainer}>
                        <View style={[styles.checkbox, item.is_done && styles.checkboxChecked]}>
                            {item.is_done && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                    </TouchableOpacity>
                    <TextInput style={styles.checklistInput} value={item.name} onChangeText={(text) => updateChecklistItem(index, text)} placeholder="Tarea realizada..." />
                    <TouchableOpacity onPress={() => removeChecklistItem(index)} style={styles.deleteItemBtn}><Text style={{color: 'white', fontWeight: 'bold'}}>X</Text></TouchableOpacity>
                </View>
             ))}
             <TouchableOpacity style={styles.addChecklistBtn} onPress={addChecklistItem}>
                <Text style={styles.addChecklistText}>+ Agregar Tarea</Text>
             </TouchableOpacity>
          </View>

          {/* --- NUEVO BLOQUE: ESTADO FINAL --- */}
          <Text style={styles.label}>¿Cómo se deja el equipo?</Text>
          <View style={styles.typeContainer}>
            <TouchableOpacity 
                style={[styles.typeBtn, equipmentFinalStatus === 'operative' && styles.typeBtnActive]} 
                onPress={() => setEquipmentFinalStatus('operative')}>
              <Text style={[styles.typeText, equipmentFinalStatus === 'operative' && styles.typeTextActive]}>Operativo</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.typeBtn, equipmentFinalStatus === 'inoperative' && styles.typeBtnActive, {marginLeft: 10}]} 
                onPress={() => setEquipmentFinalStatus('inoperative')}>
              <Text style={[styles.typeText, equipmentFinalStatus === 'inoperative' && styles.typeTextActive]}>Inoperativo</Text>
            </TouchableOpacity>
          </View>

          {/* --- NUEVO BLOQUE: PENDIENTES --- */}
          <Text style={styles.label}>¿Encontró pendientes?</Text>
          <View style={styles.typeContainer}>
            <TouchableOpacity 
                style={[styles.typeBtn, hasPending === 'yes' && styles.typeBtnActive]} 
                onPress={() => setHasPending('yes')}>
              <Text style={[styles.typeText, hasPending === 'yes' && styles.typeTextActive]}>Sí</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.typeBtn, hasPending === 'no' && styles.typeBtnActive, {marginLeft: 10}]} 
                onPress={() => setHasPending('no')}>
              <Text style={[styles.typeText, hasPending === 'no' && styles.typeTextActive]}>No</Text>
            </TouchableOpacity>
          </View>

          {/* --- CAMPO CONDICIONAL: COMENTARIOS DE PENDIENTES --- */}
          {hasPending === 'yes' && (
            <View style={{marginTop: 10}}>
                <Text style={styles.label}>Pendientes / Comentarios</Text>
                <TextInput 
                    style={[styles.input, {height: 60}]} 
                    multiline 
                    value={pendingComments} 
                    onChangeText={setPendingComments} 
                    placeholder="Describa los pendientes encontrados..."
                />
            </View>
          )}

          {/* FOTOS */}
          <Text style={styles.sectionHeader}>Fotos</Text>
          <View style={styles.cardSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {evidences.map((img, i) => (
                    <View key={i} style={styles.evidenceItem}>
                        <Image source={{ uri: img.uri }} style={styles.evidenceImage} />
                        <TouchableOpacity style={styles.removeBtn} onPress={() => removeEvidence(i)}><Text style={styles.removeBtnText}>X</Text></TouchableOpacity>
                    </View>
                ))}
                <TouchableOpacity style={styles.addEvidenceBtn} onPress={handleAddEvidence}><Text style={styles.addEvidenceText}>+</Text></TouchableOpacity>
            </ScrollView>
          </View>

          {/* --- NUEVO: CALIFICACIÓN DEL SERVICIO --- */}
          <Text style={styles.sectionHeader}>Calificación del Servicio</Text>
          <View style={styles.typeContainer}>
             <TouchableOpacity style={[styles.typeBtn, serviceRating === 'good' && styles.typeBtnActive]} onPress={() => setServiceRating('good')}>
                 <Text style={[styles.typeText, serviceRating === 'good' && styles.typeTextActive]}>Bueno</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.typeBtn, serviceRating === 'regular' && styles.typeBtnActive, {marginHorizontal: 5}]} onPress={() => setServiceRating('regular')}>
                 <Text style={[styles.typeText, serviceRating === 'regular' && styles.typeTextActive]}>Regular</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.typeBtn, serviceRating === 'bad' && styles.typeBtnActive]} onPress={() => setServiceRating('bad')}>
                 <Text style={[styles.typeText, serviceRating === 'bad' && styles.typeTextActive]}>Malo</Text>
             </TouchableOpacity>
          </View>
          
          {/* --- NUEVO: NOMBRES DE FIRMANTES --- */}
          <Text style={styles.label}>Firmado por</Text>
          <View style={styles.row}>
             <View style={{flex: 1, marginRight: 5}}>
                 <Text style={styles.labelSmall}>Contacto Cliente</Text>
                 <TextInput style={styles.input} value={signedByCustomer} onChangeText={setSignedByCustomer} placeholder="Nombre del cliente"/>
             </View>
             <View style={{flex: 1, marginLeft: 5}}>
                 <Text style={styles.labelSmall}>Técnico (Nombre)</Text>
                 <TextInput style={styles.input} value={signedByTechnician} onChangeText={setSignedByTechnician} placeholder="Nombre del técnico"/>
             </View>
          </View>

          {/* FIRMA */}
          <Text style={styles.sectionHeader}>Firma del Cliente</Text>
          <View style={styles.cardSection}>
            {signature ? (
                <View style={{alignItems:'center'}}>
                    <Image source={{uri:signature}} style={styles.signaturePreview} resizeMode="contain"/>
                    <TouchableOpacity onPress={()=>setSignature(null)}><Text style={{color:'red'}}>Borrar</Text></TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity style={styles.signButton} onPress={()=>setIsSignatureVisible(true)}><Text style={styles.signButtonText}>✍️ Firmar</Text></TouchableOpacity>
            )}
          </View>

          {/* TIPO MANTENIMIENTO */}
          <Text style={styles.label}>Tipo de Mantenimiento</Text>
          <View style={styles.typeContainer}>
            <TouchableOpacity style={[styles.typeBtn, type === 'corrective' && styles.typeBtnActive]} onPress={() => setType('corrective')}>
              <Text style={[styles.typeText, type === 'corrective' && styles.typeTextActive]}>Correctivo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeBtn, type === 'preventive' && styles.typeBtnActive]} onPress={() => setType('preventive')}>
              <Text style={[styles.typeText, type === 'preventive' && styles.typeTextActive]}>Preventivo</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.label}>Notas Adicionales</Text>
          <TextInput style={[styles.input, {height:60}]} multiline value={description} onChangeText={setDescription} placeholder="Observaciones generales..."/>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODALES */}
      <Modal visible={modalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Seleccionar</Text>
            <FlatList
                data={modalType === 'partner' ? partners : modalType === 'equipment' ? equipments : users}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => {
                    const isSelected = modalType === 'user' && selectedTechnicianIds.includes(item.id);
                    return (
                        <TouchableOpacity style={[styles.modalItem, isSelected && {backgroundColor: '#e6f7ff'}]} onPress={() => {
                            if (modalType === 'partner') handlePartnerSelect(item.id);
                            else if (modalType === 'equipment') { setSelectedEquipmentId(item.id); setModalVisible(false); }
                            else toggleTechnician(item.id);
                        }}>
                            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                <Text style={[styles.modalItemText, isSelected && {fontWeight: 'bold', color: '#318F9A'}]}>{item.name}</Text>
                                {isSelected && <Text style={{color: '#318F9A', fontWeight: 'bold'}}>☑</Text>}
                            </View>
                            {modalType === 'equipment' && item.serial_no && <Text style={{fontSize:12, color:'#999'}}>Serie: {item.serial_no}</Text>}
                        </TouchableOpacity>
                    );
                }}
            />
            <TouchableOpacity style={[styles.closeModalBtn, modalType === 'user' && {backgroundColor: '#318F9A', marginTop: 10}]} onPress={() => setModalVisible(false)}>
                <Text style={[styles.closeModalText, modalType === 'user' && {color: 'white'}]}>{modalType === 'user' ? 'CONFIRMAR' : 'Cerrar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isSignatureVisible} animationType="slide" transparent={true} onRequestClose={() => setIsSignatureVisible(false)}>
        <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20}}>
            <View style={{backgroundColor: 'white', borderRadius: 10, overflow: 'hidden'}}>
                <View style={{height: 120, width: '100%', backgroundColor: '#f9f9f9'}}>
                    <SignatureScreen ref={signatureRef} onOK={handleSignatureOK} webStyle={`.m-signature-pad--footer {display: none; margin: 0px;} body,html {width: 100%; height: 100%;}`} autoClear={true} imageType="image/png" />
                </View>
                <View style={styles.signatureFooter}>
                    <TouchableOpacity style={[styles.footerBtn, {backgroundColor: '#e0e0e0', marginRight:10}]} onPress={() => signatureRef.current?.clearSignature()}><Text>Borrar</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.footerBtn, {backgroundColor: '#318F9A'}]} onPress={() => signatureRef.current?.readSignature()}><Text style={{color:'white'}}>GUARDAR FIRMA</Text></TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

      {showPicker && <DateTimePicker value={tempDate || new Date()} mode={pickerMode} is24Hour={true} display="default" onChange={onPickerChange} />}
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
  selector: { backgroundColor: 'white', borderRadius: 5, padding: 12, borderWidth: 1, borderColor: '#ddd', flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 5 },
  selectorText: { fontSize: 14, color: '#333', flex:1 },
  addEvidenceBtn: { width: 80, height: 80, backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center', borderRadius: 8, marginRight: 10 },
  addEvidenceText: { fontWeight: 'bold', color: '#666', fontSize: 24 },
  evidenceItem: { marginRight: 10, position: 'relative' },
  evidenceImage: { width: 80, height: 80, borderRadius: 8 },
  removeBtn: { position: 'absolute', top: -5, right: -5, backgroundColor: 'red', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', zIndex:1 },
  removeBtnText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  signButton: { backgroundColor: '#318F9A', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 5 },
  signButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  signaturePreview: { width: '100%', height: 120, backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', marginBottom: 10 },
  signatureFooter: { flexDirection: 'row', padding: 15, borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: 'white' },
  footerBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  typeContainer: { flexDirection: 'row', marginTop: 5 },
  typeBtn: { flex: 1, padding: 12, backgroundColor: '#e0e0e0', alignItems: 'center', borderRadius: 5 },
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
  
  // ESTILOS CHECKLIST
  checklistItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  checkboxContainer: { marginRight: 10 },
  checkbox: { width: 24, height: 24, borderWidth: 2, borderColor: '#318F9A', borderRadius: 4, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' },
  checkboxChecked: { backgroundColor: '#318F9A' },
  checkmark: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  checklistInput: { flex: 1, borderBottomWidth: 1, borderBottomColor: '#ddd', paddingVertical: 5, fontSize: 16, color: '#333' },
  deleteItemBtn: { marginLeft: 10, backgroundColor: '#ff4444', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  addChecklistBtn: { marginTop: 5, padding: 10, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#318F9A', borderRadius: 5 },
  addChecklistText: { color: '#318F9A', fontWeight: 'bold' },
});