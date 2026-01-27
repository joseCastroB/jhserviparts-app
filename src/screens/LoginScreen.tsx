// src/screens/LoginScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, TouchableWithoutFeedback, Keyboard, Image } from 'react-native';
import { authenticateOdoo } from '../services/odoo';

// Definimos las "props" que recibirá esta pantalla"
interface LoginProps {
    onLoginSuccess: (uid: number, username: string, password: string) => void;
}

export const LoginScreen = ({ onLoginSuccess }: LoginProps) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Por favor ingresa usuario y contraseña');
            return;
        }

        setLoading(true);
        try {
            // Llamamos al servicio con los datos REALES del formulario
            const uid = await authenticateOdoo(email, password);

            // Si pasa, avisamos a App.tsx que guarde los datos
            onLoginSuccess(uid, email, password);

        } catch (error: any) {
            Alert.alert('Login Fallido', error.message || 'Verifica tus credenciales');
        } finally {
            setLoading(false);
        }
    };

    return (

        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.container}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <ScrollView contentContainerStyle={styles.scrollContainer}>
                    <View style={styles.container}>
                        <Text style={styles.title}>Bienvenido a JH SERVIPARTS SAC</Text>

                        <Text style={styles.label}>Usuario / Email</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="ejemplo@correo.com"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />

                        <Text style={styles.label}>Contraseña</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="********"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />

                        {loading ? (
                            <ActivityIndicator size="large" color="#0000ff" />
                        ) : (
                            <Button title="Ingresar" onPress={handleLogin} />
                        )}
                    </View>
                </ScrollView>
            </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f5f5f5' },
    scrollContainer: { flexGrow: 1, paddingTop: 60, paddingBottom: 200, 
    },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 30, textAlign: 'center', color: '#333' },
    label: { fontSize: 16, marginBottom: 5, color: '#333' },
    input: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 10,
        borderRadius: 8,
        marginBottom: 20,
        fontSize: 16,
        color: '#000',
        elevation: 2, //Pequeña sombra
    },
});