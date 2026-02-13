import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, StyleSheet, TouchableOpacity, 
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Modal, FlatList, Image,
  PermissionsAndroid 
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';
import SignatureScreen from 'react-native-signature-canvas';

// Librerías para PDF
import RNFS from 'react-native-fs';
import Share from 'react-native-share';

// Servicios
import { 
  updateMaintenanceRequest, 
  getEquipments, 
  getUsers, 
  getPartners,
  getRequestDetails,
  getAttachments,
  getChecklistLines,
  ODOO_SESSION_ID, 
  ODOO_CONFIG,
  authenticate
} from '../services/odoo';

interface EditProps {
  session: { uid: number; user: string; pass: string };
  requestId: number;
  onBack: () => void;
  onSuccess: () => void;
}

interface ChecklistItem {
  id?: number; 
  name: string;
  is_done: boolean;
}

export const MaintenanceEditScreen = ({ session, requestId, onBack, onSuccess }: EditProps) => {
  // --- CAMPOS BÁSICOS ---
  const [subject, setSubject] = useState('');
  const [type, setType] = useState<'corrective' | 'preventive'>('corrective');
  const [description, setDescription] = useState('');

  // Campos Técnicos
  const [hourType, setHourType] = useState<'operational' | 'snack' | 'transfer'>('operational');
  const [equipmentStatus, setEquipmentStatus] = useState<'operative' | 'inoperative'>('operative');

  // Estados Finales
  const [equipmentFinalStatus, setEquipmentFinalStatus] = useState<'operative' | 'inoperative'>('operative');
  const [hasPending, setHasPending] = useState<'yes' | 'no'>('no');
  const [pendingComments, setPendingComments] = useState('');
  const [serviceRating, setServiceRating] = useState<'good' | 'regular' | 'bad'>('good');

  // Firmantes
  const [signedByCustomer, setSignedByCustomer] = useState('');
  const [signedByTechnician, setSignedByTechnician] = useState('');

  // Checklist
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [deletedChecklistIds, setDeletedChecklistIds] = useState<number[]>([]);

  // Fechas
  const [execStartDate, setExecStartDate] = useState<Date | null>(null);
  const [execEndDate, setExecEndDate] = useState<Date | null>(null);

  // Selecciones
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number | null>(null);
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<number[]>([]);

  // Listas
  const [partners, setPartners] = useState<any[]>([]);
  const [equipments, setEquipments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // Multimedia
  const [evidences, setEvidences] = useState<Asset[]>([]); 
  const [existingEvidences, setExistingEvidences] = useState<any[]>([]); 
  const [deletedEvidenceIds, setDeletedEvidenceIds] = useState<number[]>([]); 

  const [signature, setSignature] = useState<string | null>(null);
  const [isSignatureVisible, setIsSignatureVisible] = useState(false);
  const signatureRef = useRef<any>(null);

  // UI
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false); // <--- ESTADO PARA CARGA DE PDF
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'partner' | 'equipment' | 'user'>('equipment');
  const [loadingEquipments, setLoadingEquipments] = useState(false);

  // DatePicker
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [currentField, setCurrentField] = useState<'start' | 'end' | null>(null);
  const [tempDate, setTempDate] = useState<Date | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [partnersData, usersData, details] = await Promise.all([
        getPartners(session.uid, session.pass),
        getUsers(session.uid, session.pass),
        getRequestDetails(session.uid, session.pass, requestId)
      ]);

      setPartners(partnersData);
      setUsers(usersData);

      if (details) {
        setSubject(details.request_title || '');
        if (details.maintenance_type) setType(details.maintenance_type);
        if (details.description) setDescription(details.description);
        if (details.hour_type) setHourType(details.hour_type);
        if (details.equipment_found_status) setEquipmentStatus(details.equipment_found_status);
        if (details.equipment_final_status) setEquipmentFinalStatus(details.equipment_final_status);
        if (details.has_pending) setHasPending(details.has_pending);
        if (details.pending_comments) setPendingComments(details.pending_comments);
        if (details.service_rating) setServiceRating(details.service_rating);
        if (details.signed_by_customer) setSignedByCustomer(details.signed_by_customer);
        if (details.signed_by_technician) setSignedByTechnician(details.signed_by_technician);

        if (details.partner_id) {
            setSelectedPartnerId(details.partner_id[0]);
            const clientEquipments = await getEquipments(session.uid, session.pass, details.partner_id[0]);
            setEquipments(clientEquipments);
        } else {
             const all = await getEquipments(session.uid, session.pass, null);
             setEquipments(all);
        }

        if (details.equipment_id) setSelectedEquipmentId(details.equipment_id[0]);
        if (details.technician_id) setSelectedTechnicianIds(details.technician_id);

        if (details.execution_start_date) setExecStartDate(new Date(details.execution_start_date.replace(' ', 'T')));
        if (details.execution_end_date) setExecEndDate(new Date(details.execution_end_date.replace(' ', 'T')));

        if (details.customer_signature) setSignature(`data:image/png;base64,${details.customer_signature}`);

        if (details.evidence_ids && details.evidence_ids.length > 0) {
            const photos = await getAttachments(session.uid, session.pass, details.evidence_ids);
            setExistingEvidences(photos);
        }

        if (details.checklist_ids && details.checklist_ids.length > 0) {
            const lines = await getChecklistLines(session.uid, session.pass, details.checklist_ids);
            setChecklist(lines);
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo cargar la solicitud.');
      onBack();
    } finally {
      setLoadingData(false);
    }
  };

  const handleUpdate = async () => {
    if (!subject.trim()) { Alert.alert('Error', 'El título es obligatorio.'); return; }
    setSaving(true);

    try {
      const newEvidenceCommands = evidences.map((img) => [0, 0, {
          name: img.fileName || 'evidencia_edit.jpg', datas: img.base64, type: 'binary'
      }]);
      const deletedEvidenceCommands = deletedEvidenceIds.map(id => [2, id, false]);
      const allEvidenceCommands = [...newEvidenceCommands, ...deletedEvidenceCommands];

      const checklistCommands: any[] = [];
      checklist.forEach(item => {
          if (item.id) checklistCommands.push([1, item.id, { name: item.name, is_done: item.is_done }]);
          else checklistCommands.push([0, 0, { name: item.name, is_done: item.is_done }]);
      });
      deletedChecklistIds.forEach(id => checklistCommands.push([2, id, false]));

      const cleanSignature = signature && signature.includes('base64,') ? signature.split('base64,')[1] : (signature || false);
      const technicianCommand = [[6, 0, selectedTechnicianIds]];

      const dataToSend: any = {
        request_title: subject,
        partner_id: selectedPartnerId || false,
        equipment_id: selectedEquipmentId || false,
        technician_id: technicianCommand,
        maintenance_type: type,
        hour_type: hourType,
        equipment_found_status: equipmentStatus,
        equipment_final_status: equipmentFinalStatus,
        has_pending: hasPending,
        pending_comments: hasPending === 'yes' ? pendingComments : '',
        service_rating: serviceRating,
        signed_by_customer: signedByCustomer,
        signed_by_technician: signedByTechnician,
        description: description,
        execution_start_date: formatForOdoo(execStartDate),
        execution_end_date: formatForOdoo(execEndDate),
        customer_signature: cleanSignature,
      };

      if (allEvidenceCommands.length > 0) dataToSend.evidence_ids = allEvidenceCommands;
      if (checklistCommands.length > 0) dataToSend.checklist_ids = checklistCommands;

      await updateMaintenanceRequest(session.uid, session.pass, requestId, dataToSend);
      Alert.alert('Éxito', 'Solicitud actualizada correctamente.', [{ text: 'OK', onPress: onSuccess }]);

    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar.');
    } finally {
      setSaving(false);
    }
  };

  // --- LÓGICA DE IMPRESIÓN (PDF) ---
  const handlePrint = async () => {
    // 1. Validar Configuración
    if (!ODOO_CONFIG?.url) {
        Alert.alert('Error', 'Configuración de Odoo no cargada (URL faltante).');
        return;
    }

    // 2. Validar Sesión
    let currentSessionId = ODOO_SESSION_ID;
    if (!currentSessionId) {
        try {
            console.log('🔄 Recuperando sesión...');
            await authenticate(session.user, session.pass);
            currentSessionId = ODOO_SESSION_ID; 
        } catch (e) {
            Alert.alert('Error', 'Sesión expirada. Por favor reloguearse.');
            return;
        }
    }

    setPrinting(true);
    try {
        const reportName = 'serviparts_mantenimiento.report_jh_template';
        const url = `${ODOO_CONFIG.url}/report/pdf/${reportName}/${requestId}`;
        
        // CAMBIO IMPORTANTE: Usar CachesDirectoryPath en lugar de Documents
        const filePath = `${RNFS.CachesDirectoryPath}/Reporte_${requestId}.pdf`;

        console.log('📥 Intentando descargar:', url);
        console.log('📂 Ruta destino:', filePath);

        // 3. Descargar
        const download = RNFS.downloadFile({
            fromUrl: url,
            toFile: filePath,
            headers: {
                'Cookie': `session_id=${currentSessionId}`
            }
        });

        const result = await download.promise;

        // 4. Verificar resultado
        if (result.statusCode === 200) {
            console.log('✅ Descarga completa. Abriendo Share...');
            
            // Verificar si el archivo realmente se creó
            const exists = await RNFS.exists(filePath);
            if (!exists) throw new Error('El archivo no se guardó correctamente.');

            await Share.open({
                url: `file://${filePath}`,
                type: 'application/pdf',
                title: `Reporte ${requestId}`,
                failOnCancel: false // Evita error si el usuario cancela el share
            });
        } else {
            console.log('❌ Error Status:', result.statusCode);
            Alert.alert('Error de Servidor', `Odoo no devolvió el PDF. Código: ${result.statusCode}`);
        }

    } catch (error: any) {
        console.error('❌ Error Crítico:', error);
        Alert.alert('Fallo al Imprimir', error.message || 'Error desconocido');
    } finally {
        setPrinting(false);
    }
  };

  // --- RESTO DE FUNCIONES (Igual que antes) ---
  const addChecklistItem = () => setChecklist([...checklist, { name: '', is_done: false }]);
  const updateChecklistItem = (index: number, text: string) => {
    const list = [...checklist]; list[index].name = text; setChecklist(list);
  };
  const toggleChecklistItem = (index: number) => {
    const list = [...checklist]; list[index].is_done = !list[index].is_done; setChecklist(list);
  };
  const removeChecklistItem = (index: number) => {
    const list = [...checklist];
    const item = list[index];
    if (item.id) setDeletedChecklistIds([...deletedChecklistIds, item.id]);
    list.splice(index, 1);
    setChecklist(list);
  };

  const removeNewEvidence = (index: number) => {
    const list = [...evidences]; list.splice(index, 1); setEvidences(list);
  };
  const removeOldEvidence = (id: number) => {
    setDeletedEvidenceIds([...deletedEvidenceIds, id]); 
    setExistingEvidences(existingEvidences.filter(e => e.id !== id)); 
  };

  const handlePartnerSelect = async (pid: number) => {
      setSelectedPartnerId(pid); setSelectedEquipmentId(null); setModalVisible(false);
      setLoadingEquipments(true);
      try {
          const res = await getEquipments(session.uid, session.pass, pid);
          setEquipments(res);
      } catch(e){} finally { setLoadingEquipments(false); }
  };
  const toggleTechnician = (id: number) => {
      if(selectedTechnicianIds.includes(id)) setSelectedTechnicianIds(selectedTechnicianIds.filter(x=>x!==id));
      else setSelectedTechnicianIds([...selectedTechnicianIds, id]);
  };
  
  const requestCameraPermission = async () => { if(Platform.OS==='ios')return true; try{const g=await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA); return g===PermissionsAndroid.RESULTS.GRANTED;}catch(e){return false;} };
  const openCamera = async () => { if(await requestCameraPermission()){ const r=await launchCamera({mediaType:'photo',quality:0.5,includeBase64:true}); if(r.assets)setEvidences([...evidences,...r.assets]); } };
  const openGallery = async () => { const r=await launchImageLibrary({mediaType:'photo',quality:0.5,includeBase64:true}); if(r.assets)setEvidences([...evidences,...r.assets]); };
  const handleAddEvidence = () => Alert.alert('Adjuntar', 'Elige', [{text:'Cámara', onPress:openCamera}, {text:'Galería', onPress:openGallery}, {text:'Cancelar', style:'cancel'}]);
  
  const formatForOdoo = (d:Date|null) => d ? new Date(d.getTime()-(d.getTimezoneOffset()*60000)).toISOString().slice(0,19).replace('T',' ') : false;
  const formatVisual = (d:Date|null) => d ? d.toLocaleString('es-PE', {day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit'}) : 'Seleccionar...';
  const getSelectedName = (l:any[], id:number|null) => { const i=l.find(x=>x.id===id); return i?i.name:'Seleccionar...'; };
  const openSelector = (t:any) => { setModalType(t); setModalVisible(true); };
  const handleSignatureOK = (s:string) => { setSignature(s); setIsSignatureVisible(false); };
  
  const startPicking = (field: 'start' | 'end') => { setCurrentField(field); setTempDate(new Date()); setPickerMode('date'); setShowPicker(true); };
  const onPickerChange = (event: any, selectedDate?: Date) => {
    if (event.type === 'dismissed') { setShowPicker(false); return; }
    const currentDate = selectedDate || tempDate || new Date();
    if (pickerMode === 'date') { setTempDate(currentDate); setPickerMode('time'); if (Platform.OS === 'android') { setShowPicker(false); setTimeout(() => setShowPicker(true), 100); } } 
    else { setShowPicker(false); const finalDate = new Date(tempDate!); finalDate.setHours(currentDate.getHours()); finalDate.setMinutes(currentDate.getMinutes()); if (currentField === 'start') setExecStartDate(finalDate); if (currentField === 'end') setExecEndDate(finalDate); }
  };

  if (loadingData) return <View style={styles.center}><ActivityIndicator size="large" color="#318F9A" /><Text>Cargando datos...</Text></View>;

  return (
    <View style={styles.container}>
      {/* --- HEADER CON BOTONES --- */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
            <Text style={styles.headerBtn}>Cancelar</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Editar</Text>
        
        <View style={{flexDirection: 'row'}}>
            {/* BOTÓN IMPRIMIR */}
            <TouchableOpacity onPress={handlePrint} disabled={printing || saving} style={{marginRight: 15}}>
                {printing ? <ActivityIndicator color="white" /> : <Text style={styles.headerBtn}>🖨️ PDF</Text>}
            </TouchableOpacity>

            {/* BOTÓN GUARDAR */}
            <TouchableOpacity onPress={handleUpdate} disabled={saving || printing}>
                {saving ? <ActivityIndicator color="white" /> : <Text style={styles.headerBtnBold}>GUARDAR</Text>}
            </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}>
        <ScrollView contentContainerStyle={styles.formContainer}>
          
          <Text style={styles.label}>Título *</Text>
          <TextInput style={styles.inputLarge} value={subject} onChangeText={setSubject} />

          <Text style={styles.label}>Cliente</Text>
          <TouchableOpacity style={styles.selector} onPress={() => openSelector('partner')}>
            <Text style={styles.selectorText} numberOfLines={1}>{getSelectedName(partners, selectedPartnerId)}</Text>
            <Text style={{color:'#666'}}>▼</Text>
          </TouchableOpacity>

          <View style={styles.row}>
            <View style={{flex: 1, marginRight: 5}}>
                <Text style={styles.label}>Máquina</Text>
                <TouchableOpacity style={[styles.selector, !selectedPartnerId && {backgroundColor: '#f0f0f0'}]} onPress={() => !selectedPartnerId ? Alert.alert('Atención', 'Selecciona Cliente.') : openSelector('equipment')}>
                    {loadingEquipments ? <ActivityIndicator color="#318F9A" size="small"/> : <Text style={styles.selectorText} numberOfLines={1}>{getSelectedName(equipments, selectedEquipmentId)}</Text>}
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

          <Text style={styles.label}>Tipo de Hora</Text>
          <View style={styles.typeContainer}>
            {['operational', 'snack', 'transfer'].map((t) => (
                <TouchableOpacity key={t} style={[styles.typeBtn, hourType === t && styles.typeBtnActive, {marginHorizontal:2}]} onPress={() => setHourType(t as any)}>
                    <Text style={[styles.typeText, hourType === t && styles.typeTextActive]}>{t==='operational'?'Operativo':t==='snack'?'Refrigerio':'Traslado'}</Text>
                </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Fechas y Hora</Text>
          <View style={styles.row}>
             <View style={{flex: 1, marginRight: 5}}>
                 <Text style={styles.labelSmall}>Inicio</Text>
                 <TouchableOpacity style={styles.dateButton} onPress={()=>startPicking('start')}><Text style={styles.dateText}>{formatVisual(execStartDate)}</Text></TouchableOpacity>
             </View>
             <View style={{flex: 1, marginLeft: 5}}>
                 <Text style={styles.labelSmall}>Fin</Text>
                 <TouchableOpacity style={styles.dateButton} onPress={()=>startPicking('end')}><Text style={styles.dateText}>{formatVisual(execEndDate)}</Text></TouchableOpacity>
             </View>
          </View>

          <Text style={styles.label}>¿Cómo encontró el equipo?</Text>
          <View style={styles.typeContainer}>
            <TouchableOpacity style={[styles.typeBtn, equipmentStatus === 'operative' && styles.typeBtnActive]} onPress={() => setEquipmentStatus('operative')}>
              <Text style={[styles.typeText, equipmentStatus === 'operative' && styles.typeTextActive]}>Operativo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeBtn, equipmentStatus === 'inoperative' && styles.typeBtnActive, {marginLeft: 10}]} onPress={() => setEquipmentStatus('inoperative')}>
              <Text style={[styles.typeText, equipmentStatus === 'inoperative' && styles.typeTextActive]}>Inoperativo</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Descripción del Servicio</Text>
          <View style={styles.cardSection}>
             {checklist.map((item, index) => (
                <View key={index} style={styles.checklistItem}>
                    <TouchableOpacity onPress={() => toggleChecklistItem(index)} style={styles.checkboxContainer}>
                        <View style={[styles.checkbox, item.is_done && styles.checkboxChecked]}>{item.is_done && <Text style={styles.checkmark}>✓</Text>}</View>
                    </TouchableOpacity>
                    <TextInput style={styles.checklistInput} value={item.name} onChangeText={(text) => updateChecklistItem(index, text)} placeholder="Tarea..." />
                    <TouchableOpacity onPress={() => removeChecklistItem(index)} style={styles.deleteItemBtn}><Text style={{color: 'white', fontWeight: 'bold'}}>X</Text></TouchableOpacity>
                </View>
             ))}
             <TouchableOpacity style={styles.addChecklistBtn} onPress={addChecklistItem}><Text style={styles.addChecklistText}>+ Agregar Tarea</Text></TouchableOpacity>
          </View>

          <Text style={styles.label}>¿Cómo se deja el equipo?</Text>
          <View style={styles.typeContainer}>
            <TouchableOpacity style={[styles.typeBtn, equipmentFinalStatus === 'operative' && styles.typeBtnActive]} onPress={() => setEquipmentFinalStatus('operative')}>
              <Text style={[styles.typeText, equipmentFinalStatus === 'operative' && styles.typeTextActive]}>Operativo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeBtn, equipmentFinalStatus === 'inoperative' && styles.typeBtnActive, {marginLeft: 10}]} onPress={() => setEquipmentFinalStatus('inoperative')}>
              <Text style={[styles.typeText, equipmentFinalStatus === 'inoperative' && styles.typeTextActive]}>Inoperativo</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>¿Encontró pendientes?</Text>
          <View style={styles.typeContainer}>
            <TouchableOpacity style={[styles.typeBtn, hasPending === 'yes' && styles.typeBtnActive]} onPress={() => setHasPending('yes')}>
              <Text style={[styles.typeText, hasPending === 'yes' && styles.typeTextActive]}>Sí</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeBtn, hasPending === 'no' && styles.typeBtnActive, {marginLeft: 10}]} onPress={() => setHasPending('no')}>
              <Text style={[styles.typeText, hasPending === 'no' && styles.typeTextActive]}>No</Text>
            </TouchableOpacity>
          </View>
          {hasPending === 'yes' && (
            <View style={{marginTop: 10}}>
                <Text style={styles.label}>Pendientes / Comentarios</Text>
                <TextInput style={[styles.input, {height: 60}]} multiline value={pendingComments} onChangeText={setPendingComments} placeholder="Describa pendientes..." />
            </View>
          )}
          
          <Text style={styles.label}>Notas Adicionales</Text>
          <TextInput style={[styles.input, {height:60}]} multiline value={description} onChangeText={setDescription} placeholder="Observaciones..."/>

          <Text style={styles.sectionHeader}>Fotos</Text>
          <View style={styles.cardSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {existingEvidences.map((img) => (
                    <View key={`old-${img.id}`} style={styles.evidenceItem}>
                        <Image source={{ uri: `data:image/jpeg;base64,${img.datas}` }} style={[styles.evidenceImage, {opacity: 0.7}]} />
                        <TouchableOpacity style={styles.removeBtn} onPress={() => removeOldEvidence(img.id)}><Text style={styles.removeBtnText}>X</Text></TouchableOpacity>
                    </View>
                ))}
                {evidences.map((img, i) => (
                    <View key={`new-${i}`} style={styles.evidenceItem}>
                        <Image source={{ uri: img.uri }} style={styles.evidenceImage} />
                        <TouchableOpacity style={styles.removeBtn} onPress={() => removeNewEvidence(i)}><Text style={styles.removeBtnText}>X</Text></TouchableOpacity>
                    </View>
                ))}
                <TouchableOpacity style={styles.addEvidenceBtn} onPress={handleAddEvidence}><Text style={styles.addEvidenceText}>+</Text></TouchableOpacity>
            </ScrollView>
          </View>

          <Text style={styles.sectionHeader}>Calificación</Text>
          <View style={styles.typeContainer}>
             {['good', 'regular', 'bad'].map(r => (
                 <TouchableOpacity key={r} style={[styles.typeBtn, serviceRating === r && styles.typeBtnActive, {marginHorizontal:2}]} onPress={() => setServiceRating(r as any)}>
                     <Text style={[styles.typeText, serviceRating === r && styles.typeTextActive]}>{r==='good'?'Bueno':r==='regular'?'Regular':'Malo'}</Text>
                 </TouchableOpacity>
             ))}
          </View>

          <Text style={styles.label}>Firmado por</Text>
          <View style={styles.row}>
             <View style={{flex: 1, marginRight: 5}}>
                 <Text style={styles.labelSmall}>Contacto Cliente</Text>
                 <TextInput style={styles.input} value={signedByCustomer} onChangeText={setSignedByCustomer}/>
             </View>
             <View style={{flex: 1, marginLeft: 5}}>
                 <Text style={styles.labelSmall}>Técnico</Text>
                 <TextInput style={styles.input} value={signedByTechnician} onChangeText={setSignedByTechnician}/>
             </View>
          </View>

          <Text style={styles.sectionHeader}>Firma del Cliente</Text>
          <View style={styles.cardSection}>
            {signature ? (
                <View style={{alignItems:'center'}}>
                    <Image source={{uri:signature}} style={styles.signaturePreview} resizeMode="contain"/>
                    <TouchableOpacity onPress={()=>setSignature(null)}><Text style={{color:'red'}}>Cambiar Firma</Text></TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity style={styles.signButton} onPress={()=>setIsSignatureVisible(true)}><Text style={styles.signButtonText}>✍️ Firmar</Text></TouchableOpacity>
            )}
          </View>

          <Text style={styles.label}>Tipo de Mantenimiento</Text>
          <View style={styles.typeContainer}>
            <TouchableOpacity style={[styles.typeBtn, type === 'corrective' && styles.typeBtnActive]} onPress={() => setType('corrective')}>
              <Text style={[styles.typeText, type === 'corrective' && styles.typeTextActive]}>Correctivo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeBtn, type === 'preventive' && styles.typeBtnActive]} onPress={() => setType('preventive')}>
              <Text style={[styles.typeText, type === 'preventive' && styles.typeTextActive]}>Preventivo</Text>
            </TouchableOpacity>
          </View>

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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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