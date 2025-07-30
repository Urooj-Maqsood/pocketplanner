
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface BiometricAuthProps {
  onAuthenticationSuccess: () => void;
  onAuthenticationError: (error: string) => void;
  enabled: boolean;
}

export default function BiometricAuth({ 
  onAuthenticationSuccess, 
  onAuthenticationError, 
  enabled 
}: BiometricAuthProps) {
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');

  useEffect(() => {
    checkBiometricSupport();
  }, []);

  const checkBiometricSupport = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setIsBiometricSupported(compatible);

      if (compatible) {
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (enrolled) {
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
            setBiometricType('Face ID');
          } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
            setBiometricType('Fingerprint');
          } else {
            setBiometricType('Biometric');
          }
        }
      }
    } catch (error) {
      console.error('Error checking biometric support:', error);
    }
  };

  const handleBiometricAuth = async () => {
    try {
      if (!isBiometricSupported) {
        Alert.alert('Not Supported', 'Biometric authentication is not supported on this device.');
        return;
      }

      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) {
        Alert.alert(
          'No Biometrics Enrolled',
          'Please set up biometric authentication in your device settings first.'
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access PocketPlanner',
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        await AsyncStorage.setItem('biometric_auth_success', 'true');
        onAuthenticationSuccess();
      } else {
        onAuthenticationError(result.error || 'Authentication failed');
      }
    } catch (error) {
      onAuthenticationError('Biometric authentication error');
      console.error('Biometric auth error:', error);
    }
  };

  if (!enabled || !isBiometricSupported) {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.biometricButton} onPress={handleBiometricAuth}>
        <Ionicons 
          name={biometricType === 'Face ID' ? 'scan' : 'finger-print'} 
          size={24} 
          color="#74b9ff" 
        />
        <Text style={styles.biometricText}>
          Login with {biometricType}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 20,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f8f9ff',
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#74b9ff',
    gap: 8,
  },
  biometricText: {
    color: '#74b9ff',
    fontWeight: '600',
    fontSize: 14,
  },
});
