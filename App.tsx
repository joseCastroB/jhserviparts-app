import React, { useState } from 'react';
import { Alert } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { MaintenanceScreen } from './src/screens/MaintenanceScreen';
import { MaintenanceCreateScreen } from './src/screens/MaintenanceCreateScreen';
import { MaintenanceEditScreen } from './src/screens/MaintenanceEditScreen';

function App(): React.JSX.Element {
  const [session, setSession] = useState<{ uid: number, user: string, pass: string } | null>(null);

  // Estado para saber en qué pantalla estamos: 'dashboard' | 'mantenimiento'
  const [currentModule, setCurrentModule] = useState<'dashboard' | 'mantenimiento' | 'maintenance_create' | 'maintenance_edit'>('dashboard');

  //Id para editar
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);

  // Manejo de clics en el menú
  const handleModulePress = (moduleName: string) => {
    if (moduleName === 'Mantenimiento') {
      setCurrentModule('mantenimiento');
    } else {
      Alert.alert('Proximamente', `El módulo ${moduleName} aún no está listo.`)
    }
  };

  // 1. Si NO hay sesión -> Login
  if (!session) {
    return (
      <SafeAreaProvider>
        <LoginScreen
          onLoginSuccess={(uid, user, pass) => setSession({ uid, user, pass })}
        />
      </SafeAreaProvider>
    );
  }

  // 2. Crear solicitud mantenimiento
  if (currentModule === 'maintenance_create') {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#EFF0F4' }}>
          <MaintenanceCreateScreen
            session={session}
            onBack={() => setCurrentModule('mantenimiento')} 
            onSuccess={() => setCurrentModule('mantenimiento')} 
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // Pantalla para editar
  if (currentModule === 'maintenance_edit' && selectedRequestId){
    return (
      <SafeAreaProvider>
        <SafeAreaView style={{flex: 1, backgroundColor: '#EFF0F4'}}>
          <MaintenanceEditScreen
            session={session}
            requestId={selectedRequestId} // Aquí el ID es obligatorio
            onBack={() => {
                setSelectedRequestId(null);
                setCurrentModule('mantenimiento');
            }}
            onSuccess={() => {
                setSelectedRequestId(null);
                setCurrentModule('mantenimiento');
            }}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  } 

  // 3. Mantenimiento listado
  if (currentModule === 'mantenimiento') {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#EFF0F4' }}>
          <MaintenanceScreen
            session={session}
            onBack={() => setCurrentModule('dashboard')} // Volver al menú
            onCreate={() => setCurrentModule('maintenance_create')}
            onEdit={(id) => {
                setSelectedRequestId(id);
                setCurrentModule('maintenance_edit');
            }}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // 4. Si HAY sesión -> Dashboard
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#EFF0F4' }}>
        <DashboardScreen
          username={session.user}
          onLogout={() => setSession(null)}
          onModulePress={handleModulePress}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );


}

export default App;