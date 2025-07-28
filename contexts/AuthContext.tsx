import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initDatabase, User } from '@/services/database';

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  login: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      // Initialize database
      await initDatabase();

      // Check if user is already logged in
      const loginState = await AsyncStorage.getItem('isLoggedIn');
      const userData = await AsyncStorage.getItem('userData');

      console.log('Checking login state:', loginState);
      console.log('User data exists:', userData ? 'Yes' : 'No');

      if (loginState === 'true' && userData) {
        try {
          const parsedUserData = JSON.parse(userData);
          console.log('Restoring user session:', parsedUserData.username);
          setIsLoggedIn(true);
          setUser(parsedUserData);
        } catch (error) {
          console.error('Error parsing stored user data:', error);
          // Clear corrupted data
          await AsyncStorage.removeItem('isLoggedIn');
          await AsyncStorage.removeItem('userData');
        }
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (userData: User) => {
    try {
      await AsyncStorage.setItem('isLoggedIn', 'true');
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      setIsLoggedIn(true);
      setUser(userData);
    } catch (error) {
      console.error('Error saving login state:', error);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('isLoggedIn');
      await AsyncStorage.removeItem('userData');
      setIsLoggedIn(false);
      setUser(null);
    } catch (error) {
      console.error('Error clearing login state:', error);
    }
  };

  useEffect(() => {
    initializeAuth();

    // Add listener for app state changes to refresh auth when app becomes active
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        initializeAuth();
      }
    };

    return () => {
      // Cleanup if needed
    };
  }, []);

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};