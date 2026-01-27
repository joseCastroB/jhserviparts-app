import React, { useEffect, useState } from 'react';
import { SafeAreaView, Text, Button, View } from 'react-native';
import { authenticateOdoo, getProducts } from './src/services/odoo';

function App(): React.JSX.Element {
  const [status, setStatus] = useState('Desconectado');
  const [data, setData] = useState('');

  const handleConnect = async () => {
    try {
      setStatus('Conectando...');
      const uid = await authenticateOdoo(); // 1. Autenticar
      setStatus(`Conectado (UID: ${uid})`);
      
      const productos = await getProducts(uid); // 2. Traer datos
      setData(JSON.stringify(productos, null, 2));
      
    } catch (error) {
      console.error(error);
      setStatus('Error de conexión');
    }
  };

  return (
    <SafeAreaView style={{ padding: 20 }}>
      <Text style={{ fontSize: 20, marginBottom: 20 }}>Prueba Odoo</Text>
      <Text>Estado: {status}</Text>
      <Button title="Conectar a Odoo" onPress={handleConnect} />
      <Text style={{ marginTop: 20 }}>Datos:</Text>
      <Text>{data}</Text>
    </SafeAreaView>
  );
}

export default App;