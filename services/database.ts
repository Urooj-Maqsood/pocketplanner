import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Use different storage based on platform
let storage: any;

if (Platform.OS === 'web') {
  // For web, use localStorage wrapper
  storage = {
    getItem: async (key: string) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: async (key: string, value: string) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Ignore storage errors
      }
    },
    removeItem: async (key: string) => {
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore storage errors
      }
    }
  };
} else {
  // For native platforms, use AsyncStorage
  storage = AsyncStorage;
}

export interface User {
  id: number;
  username: string;
  email: string;
  password: string;
}

// Storage keys
const USERS_KEY = 'pocketplanner_users';
const USER_COUNTER_KEY = 'pocketplanner_user_counter';

// Initialize database (now just ensures storage is ready)
export const initDatabase = async () => {
  console.log('Storage initialized for platform:', Platform.OS);
};

// Helper function to get all users from storage
const getAllUsers = async (): Promise<User[]> => {
  try {
    const usersJson = await storage.getItem(USERS_KEY);
    return usersJson ? JSON.parse(usersJson) : [];
  } catch (error) {
    console.error('Error getting users:', error);
    return [];
  }
};

// Helper function to save all users to storage
const saveAllUsers = async (users: User[]): Promise<void> => {
  try {
    await storage.setItem(USERS_KEY, JSON.stringify(users));
  } catch (error) {
    console.error('Error saving users:', error);
  }
};

// Helper function to get next user ID
const getNextUserId = async (): Promise<number> => {
  try {
    const counterStr = await storage.getItem(USER_COUNTER_KEY);
    const counter = counterStr ? parseInt(counterStr, 10) : 0;
    const nextId = counter + 1;
    await storage.setItem(USER_COUNTER_KEY, nextId.toString());
    return nextId;
  } catch (error) {
    console.error('Error getting next user ID:', error);
    return Math.floor(Math.random() * 1000000); // Fallback to random ID
  }
};

// Hash password using expo-crypto
const hashPassword = async (password: string): Promise<string> => {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password
  );
};

// Create new user
export const createUser = async (username: string, email: string, password: string): Promise<{ success: boolean; message: string; user?: User }> => {
  try {
    const users = await getAllUsers();
    console.log('Creating user with email:', email);
    console.log('Current users count:', users.length);

    // Check if email already exists (case-insensitive)
    const existingUser = users.find(user => user.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      console.log('Email already exists:', email);
      return { success: false, message: 'An account with this email already exists. Please try logging in instead.' };
    }

    // Check if username already exists (case-insensitive)
    const existingUsername = users.find(user => user.username.toLowerCase() === username.toLowerCase());
    if (existingUsername) {
      return { success: false, message: 'Username already taken. Please choose a different username.' };
    }

    // Hash password
    const hashedPassword = await hashPassword(password);
    console.log('Password hashed successfully');

    // Create new user
    const newUser: User = {
      id: await getNextUserId(),
      username,
      email: email.toLowerCase(), // Store email in lowercase
      password: hashedPassword
    };

    // Add user to storage
    users.push(newUser);
    await saveAllUsers(users);
    console.log('User created successfully:', newUser.username);

    // Return user without password for security
    const { password: _, ...userWithoutPassword } = newUser;
    return { success: true, message: 'User created successfully', user: userWithoutPassword as User };
  } catch (error) {
    console.error('Error creating user:', error);
    return { success: false, message: 'Failed to create user due to a technical error. Please try again.' };
  }
};

// Authenticate user
export const authenticateUser = async (email: string, password: string): Promise<{ success: boolean; message: string; user?: User }> => {
  try {
    const users = await getAllUsers();
    console.log('Total users in database:', users.length);
    console.log('Attempting login for email:', email);

    // Find user by email (case-insensitive)
    const userByEmail = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    console.log('User found by email:', userByEmail ? 'Yes' : 'No');

    if (!userByEmail) {
      console.log('No user found with email:', email);
      return { success: false, message: 'No account found with this email address. Please check your email or sign up for a new account.' };
    }

    // Hash the provided password
    const hashedPassword = await hashPassword(password);
    console.log('Comparing password hashes...');
    console.log('Stored hash:', userByEmail.password.substring(0, 20) + '...');
    console.log('Login hash:', hashedPassword.substring(0, 20) + '...');

    // Check if password matches
    if (userByEmail.password === hashedPassword) {
      console.log('Authentication successful for user:', userByEmail.username);

      // Return user without password for security
      const { password: _, ...userWithoutPassword } = userByEmail;
      return { 
        success: true, 
        message: 'Login successful', 
        user: userWithoutPassword as User 
      };
    } else {
      console.log('Password mismatch for user:', userByEmail.username);
      return { success: false, message: 'Incorrect password. Please try again.' };
    }
  } catch (error) {
    console.error('Error authenticating user:', error);
    return { success: false, message: 'Authentication failed due to a technical error. Please try again.' };
  }
};

// Get user by ID
export const getUserById = async (id: number): Promise<User | null> => {
  try {
    const users = await getAllUsers();
    const user = users.find(u => u.id === id);
    return user || null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

// Debug function to check existing users
export const debugUsers = async (): Promise<void> => {
  try {
    const users = await getAllUsers();
    console.log('=== DEBUG: All Users ===');
    console.log('Total users:', users.length);
    users.forEach((user, index) => {
      console.log(`User ${index + 1}:`, {
        id: user.id,
        username: user.username,
        email: user.email,
        hasPassword: !!user.password
      });
    });
    console.log('=== END DEBUG ===');
  } catch (error) {
    console.error('Debug users error:', error);
  }
};

export const addTimeBlock = async (timeBlock: any): Promise<void> => {
  try {
    // Validate date format before inserting
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(timeBlock.date)) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }

    // Store in AsyncStorage for now (simple implementation)
    const existingBlocks = await storage.getItem('time_blocks');
    const blocks = existingBlocks ? JSON.parse(existingBlocks) : [];
    
    const newBlock = {
      id: Date.now().toString(),
      ...timeBlock,
      created_at: new Date().toISOString(),
    };
    
    blocks.push(newBlock);
    await storage.setItem('time_blocks', JSON.stringify(blocks));
    
    console.log('Time block added successfully');
  } catch (error) {
    console.error('Error adding time block:', error);
    throw error;
  }
};