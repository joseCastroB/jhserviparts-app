import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Button, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LoginScreen } from './src/screens/LoginScreen';
import { getProducts } from './src/services/odoo';

function App(): React.JSX.Element {
  // Estado para guardar la sesión del usuario
  const [session, setSession] = useState<{uid: number; user: string, pass: string} | null>(null);

  // Estado para los productos
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProds, setLoadingProds] = useState(false);

  // Función que carga productos usando la sesión guardada
  const loadData = async () => {
    if (!session) return;
    setLoadingProds(true);
    try {
      // Pasamos el UID y el PASS gurados al logearse
      const data = await getProducts(session.uid, session.pass);
      setProducts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingProds(false);
    }
  };

  // LOGICA PRINCIPAL

  // 1. Si NO hay sesión, mostramos el login
  if (!session) {
    return (
      <SafeAreaProvider>
        <LoginScreen
          onLoginSuccess={(uid, user, pass) => {
            // Guardamos la sesión y automaticamente React cambiara de pantalla
            setSession({ uid, user, pass});
          }}
        />
      </SafeAreaProvider>
    );
  }

  // 2. Si HAY sesión, mostramos la App (Lista de productos)
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.welcome}>Hola, {session.user}</Text>
          <Button title="Salir" color="red" onPress={() => setSession(null)} />
        </View>

        <Button 
          title="Cargar Productos de Odoo" 
          onPress={loadData} 
          disabled={loadingProds} 
        />

        <FlatList
          data={products}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ marginTop: 20 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.prodName}>{item.name}</Text>
              <Text style={styles.prodPrice}>$ {item.list_price}</Text>
            </View>
          )}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' },
  welcome: { fontSize: 18, fontWeight: 'bold' },
  card: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    elevation: 2, // Sombra en Android
  },
  prodName: { fontSize: 16, fontWeight: '600' },
  prodPrice: { fontSize: 14, color: 'green', marginTop: 5 },
});

export default App;