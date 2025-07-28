import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debugUsers, createUser } from '@/services/database';

export default function DebugScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const clearAllData = async () => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.clear();
      } else {
        await AsyncStorage.clear();
      }
      Alert.alert('Success', 'All data cleared. You can now test signup again.');
    } catch (error) {
      Alert.alert('Error', 'Failed to clear data');
    }
  };

  const showUsers = async () => {
    await debugUsers();
    Alert.alert('Check Console', 'User data logged to console');
  };

  const handleTestSignup = async () => {
    setIsLoading(true);
    try {
      const result = await createUser('testuser', 'test@example.com', 'password123');
      Alert.alert('Test Result', JSON.stringify(result, null, 2));
    } catch (error) {
      Alert.alert('Error', error.toString());
    }
    setIsLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Debug Tools</Text>

      <TouchableOpacity style={styles.button} onPress={showUsers}>
        <Text style={styles.buttonText}>Show All Users (Check Console)</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.button} 
        onPress={handleTestSignup}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Testing...' : 'Test Signup'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={clearAllData}>
        <Text style={styles.buttonText}>Clear All Data</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => router.back()}>
        <Text style={styles.buttonText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#2d3436',
  },
  button: {
    backgroundColor: '#6c5ce7',
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  dangerButton: {
    backgroundColor: '#e17055',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});