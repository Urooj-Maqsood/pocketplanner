import React, { useState, useEffect } from 'react';
import { TouchableOpacity, StyleSheet, Animated, View, Text, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeToggleProps {
  onThemeChange?: (isDark: boolean) => void;
}

export default function ThemeToggle({ onThemeChange }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      if (savedTheme) {
        setIsDark(savedTheme === 'dark');
        applyTheme(savedTheme === 'dark');
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const applyTheme = (dark: boolean) => {
    if (Platform.OS === 'web') {
      const root = document.documentElement;
      if (dark) {
        root.style.setProperty('--background-color', '#1a1a1a');
        root.style.setProperty('--text-color', '#ffffff');
        root.style.setProperty('--card-background', '#2d2d2d');
      } else {
        root.style.setProperty('--background-color', '#f8f9fa');
        root.style.setProperty('--text-color', '#333333');
        root.style.setProperty('--card-background', '#ffffff');
      }
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = !isDark;
      setIsDark(newTheme);
      await AsyncStorage.setItem('theme', newTheme ? 'dark' : 'light');
      applyTheme(newTheme);

      // Show feedback
      Alert.alert(
        'Theme Changed',
        `Switched to ${newTheme ? 'dark' : 'light'} mode!`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  return (
    <TouchableOpacity style={styles.container} onPress={toggleTheme}>
      <View style={[styles.toggle, isDark && styles.toggleDark]}>
        <View style={[styles.thumb, isDark && styles.thumbDark]}>
          <Ionicons 
            name={isDark ? "moon" : "sunny"} 
            size={12} 
            color={isDark ? "#fff" : "#6c5ce7"} 
          />
        </View>
      </View>
      <Text style={styles.label}>{isDark ? 'Dark' : 'Light'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 20,
  },
  toggle: {
    width: 50,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleDark: {
    backgroundColor: '#333',
  },
  thumb: {
    width: 18,
    height: 18,
    backgroundColor: 'white',
    borderRadius: 9,
  },
  thumbDark: {
    backgroundColor: '#6c5ce7',
  },
  label: {
    marginTop: 5,
    fontSize: 14,
    color: '#555',
  },
});