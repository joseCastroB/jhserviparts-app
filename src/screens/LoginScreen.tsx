// src/screens/LoginScreen.tsx
import React, { useState } from 'react';
import { 
    View, 
    Text, 
    TextInput, 
    StyleSheet, 
    ActivityIndicator, 
    Alert, 
    KeyboardAvoidingView, 
    Platform, 
    ScrollView, 
    TouchableWithoutFeedback, 
    Keyboard, 
    Image, 
    TouchableOpacity 
} from 'react-native';
import { authenticate } from '../services/odoo';

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
            const uid = await authenticate(email, password);
            onLoginSuccess(uid, email, password);
        } catch (error: any) {
            Alert.alert('Login Fallido', error.message || 'Verifica tus credenciales');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            // CAMBIO 1: Ajuste de comportamiento para Android vs iOS
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.mainContainer}
            // CAMBIO 2: Offset para asegurar que no quede pegado al borde
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <ScrollView 
                    contentContainerStyle={styles.scrollContainer}
                    showsVerticalScrollIndicator={false}
                    // CAMBIO 3: Importante para que el botón funcione con el teclado abierto
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.formContainer}>
                        
                        {/* LOGO DE LA EMPRESA */}
                        <View style={styles.logoContainer}>
                            <Image 
                                source={require('../assets/jh-serviparts-logo.png')}
                                style={styles.logo}
                                resizeMode="contain"
                            />
                        </View>

                        <Text style={styles.title}>Bienvenido a JH SERVIPARTS SAC</Text>

                        <Text style={styles.label}>Usuario / Email</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="ejemplo@correo.com"
                            placeholderTextColor="#999"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />

                        <Text style={styles.label}>Contraseña</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="********"
                            placeholderTextColor="#999"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />

                        <View style={styles.buttonContainer}>
                            {loading ? (
                                <ActivityIndicator size="large" color="#F57C00" />
                            ) : (
                                /* Botón personalizado Naranja */
                                <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                                    <Text style={styles.loginButtonText}>INGRESAR</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </ScrollView>
            </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    mainContainer: { 
        flex: 1, 
        backgroundColor: '#f5f5f5' 
    },
    scrollContainer: { 
        flexGrow: 1, 
        justifyContent: 'center' 
    },
    formContainer: { 
        padding: 20, 
        justifyContent: 'center' 
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    logo: {
        width: 150,  // Ajusta este tamaño según tu imagen
        height: 150, 
    },
    title: { 
        fontSize: 22, 
        fontWeight: 'bold', 
        marginBottom: 30, 
        textAlign: 'center', 
        color: '#2E7D32', // Verde corporativo (Título)
    },
    label: { 
        fontSize: 16, 
        marginBottom: 8, 
        fontWeight: '600',
        color: '#2E7D32' // Verde corporativo (Labels)
    },
    input: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#2E7D32', // Borde verde suave
        padding: 12,
        borderRadius: 8,
        marginBottom: 20,
        fontSize: 16,
        color: '#000',
        elevation: 2,
    },
    buttonContainer: {
        marginTop: 10,
    },
    loginButton: {
        backgroundColor: '#F57C00', // Naranja corporativo
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    loginButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 1,
    }
});