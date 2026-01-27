import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';

function App(): React.JSX.Element {
  const [session, setSession] = useState<{uid: number, user: string, pass: string} | null>(null);

  // Manejo de clics en el menú
  const handleModulePress = (moduleName: string) => {
    if (moduleName === 'Mantenimiento') {
      // AQUÍ IRÁ LA NAVEGACIÓN A LA PANTALLA DE MANTENIMIENTO
      Alert.alert('Navegando', 'Abriendo módulo de Mantenimiento...');
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

  // 2. Si HAY sesión -> Dashboard
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