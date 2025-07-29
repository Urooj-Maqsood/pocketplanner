
import React, { useState, useEffect } from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeToggleProps {
  onThemeChange?: (isDark: boolean) => void;
}

export default function ThemeToggle({ onThemeChange }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState(false);
  const [animation] = useState(new Animated.Value(0));

  useEffect(() => {
    loadTheme();
  }, []);

  useEffect(() => {
    Animated.timing(animation, {
      toValue: isDark ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isDark]);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('isDarkTheme');
      if (savedTheme !== null) {
        const darkMode = JSON.parse(savedTheme);
        setIsDark(darkMode);
        onThemeChange?.(darkMode);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = !isDark;
      setIsDark(newTheme);
      await AsyncStorage.setItem('isDarkTheme', JSON.stringify(newTheme));
      onThemeChange?.(newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const backgroundColor = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['#74b9ff', '#2d3436'],
  });

  const translateX = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22],
  });

  return (
    <TouchableOpacity onPress={toggleTheme} style={styles.container}>
      <Animated.View style={[styles.toggle, { backgroundColor }]}>
        <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]}>
          <Ionicons
            name={isDark ? 'moon' : 'sunny'}
            size={16}
            color={isDark ? '#ffd700' : '#ff6b35'}
          />
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 4,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
});
