import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { initializeNotifications } from '@/services/notificationService';
import * as Notifications from 'expo-notifications';

import ThemeToggle from '@/components/ThemeToggle';
import TaskCategories from '@/components/TaskCategories';
import VoiceAssistant from '@/components/VoiceAssistant';

export default function SettingsScreen() {
  const [totalTasks, setTotalTasks] = useState(0);
  const [totalTimeBlocks, setTotalTimeBlocks] = useState(0);
  const [totalPomodoros, setTotalPomodoros] = useState(0);
  const [focusTime, setFocusTime] = useState(25);
  const [breakTime, setBreakTime] = useState(5);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const [showCategories, setShowCategories] = useState(false);
  const { logout, user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
    loadSettings();
  }, []);

  const loadStats = async () => {
    try {
      const tasksData = await AsyncStorage.getItem('tasks');
      if (tasksData) {
        const tasks = JSON.parse(tasksData);
        setTotalTasks(tasks.length);
      }

      const timeBlocksData = await AsyncStorage.getItem('timeBlocks');
      if (timeBlocksData) {
        const timeBlocks = JSON.parse(timeBlocksData);
        setTotalTimeBlocks(timeBlocks.length);
      }

      const pomodoroData = await AsyncStorage.getItem('pomodoroStats');
      if (pomodoroData) {
        const stats = JSON.parse(pomodoroData);
        let total = 0;
        Object.values(stats).forEach((dayStats: any) => {
          total += dayStats.completed || 0;
        });
        setTotalPomodoros(total);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const timerSettings = await AsyncStorage.getItem('timerSettings');
      if (timerSettings) {
        const settings = JSON.parse(timerSettings);
        setFocusTime(settings.focusTime || 25);
        setBreakTime(settings.breakTime || 5);
      }

      const notifSettings = await AsyncStorage.getItem('notificationsEnabled');
      if (notifSettings !== null) {
        setNotificationsEnabled(JSON.parse(notifSettings));
      }

      const biometricSettings = await AsyncStorage.getItem('biometricEnabled');
      if (biometricSettings !== null) {
        setBiometricEnabled(JSON.parse(biometricSettings));
      }

      const twoFactorSettings = await AsyncStorage.getItem('twoFactorEnabled');
      if (twoFactorSettings !== null) {
        setTwoFactorEnabled(JSON.parse(twoFactorSettings));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveTimerSettings = async (newFocusTime: number, newBreakTime: number) => {
    try {
      const settings = {
        focusTime: newFocusTime,
        breakTime: newBreakTime,
      };
      await AsyncStorage.setItem('timerSettings', JSON.stringify(settings));
      setFocusTime(newFocusTime);
      setBreakTime(newBreakTime);
    } catch (error) {
      console.error('Error saving timer settings:', error);
    }
  };

  const updateFocusTime = (minutes: number) => {
    if (minutes >= 1 && minutes <= 60) {
      saveTimerSettings(minutes, breakTime);
    }
  };

  const updateBreakTime = (minutes: number) => {
    if (minutes >= 1 && minutes <= 30) {
      saveTimerSettings(focusTime, minutes);
    }
  };

  const toggleNotifications = async (value: boolean) => {
    try {
      setNotificationsEnabled(value);
      await AsyncStorage.setItem('notificationsEnabled', JSON.stringify(value));
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  };

  const toggleBiometric = async (value: boolean) => {
    try {
      setBiometricEnabled(value);
      await AsyncStorage.setItem('biometricEnabled', JSON.stringify(value));
      Alert.alert(
        'Biometric Authentication',
        value ? 'Biometric authentication enabled' : 'Biometric authentication disabled'
      );
    } catch (error) {
      console.error('Error saving biometric settings:', error);
    }
  };

  const toggleTwoFactor = async (value: boolean) => {
    try {
      if (value) {
        // Show setup flow for 2FA
        Alert.alert(
          'Setup Two-Factor Authentication',
          'Would you like to enable 2FA with SMS or Email verification?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'SMS', onPress: () => setup2FA('sms') },
            { text: 'Email', onPress: () => setup2FA('email') },
          ]
        );
      } else {
        Alert.alert(
          'Disable Two-Factor Authentication',
          'Are you sure you want to disable 2FA? This will make your account less secure.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Disable', 
              style: 'destructive',
              onPress: async () => {
                setTwoFactorEnabled(false);
                await AsyncStorage.setItem('twoFactorEnabled', JSON.stringify(false));
                Alert.alert('Success', 'Two-factor authentication has been disabled.');
              }
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error toggling two-factor settings:', error);
    }
  };

  const setup2FA = async (method: 'sms' | 'email') => {
    try {
      // Generate a verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      Alert.alert(
        'Verification Required',
        `We've sent a verification code to your ${method}. Enter the code below.\n\nFor demo: ${verificationCode}`,
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Verify',
            onPress: () => {
              Alert.prompt(
                'Enter Verification Code',
                'Please enter the 6-digit code:',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Verify',
                    onPress: (code) => {
                      if (code === verificationCode) {
                        setTwoFactorEnabled(true);
                        AsyncStorage.setItem('twoFactorEnabled', JSON.stringify(true));
                        AsyncStorage.setItem('twoFactorMethod', method);
                        Alert.alert('Success', 'Two-factor authentication has been enabled!');
                      } else {
                        Alert.alert('Error', 'Invalid verification code. Please try again.');
                      }
                    }
                  }
                ],
                'plain-text'
              );
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error setting up 2FA:', error);
      Alert.alert('Error', 'Failed to setup two-factor authentication.');
    }
  };



  const openCategories = () => {
    setShowCategories(true);
  };

  const navigateToProfile = () => {
    router.push('/profile');
  };

  const testNotifications = async () => {
    try {
      if (Platform.OS === 'web') {
        if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            new Notification('🎉 Test Notification', {
              body: 'Great! Notifications are working in your browser.',
              icon: '/favicon.ico',
            });
            Alert.alert('Success', 'Web notification sent!');
          } else {
            Alert.alert('Permission Denied', 'Please enable notifications in your browser settings.');
          }
        }
      } else {
        const isInitialized = await initializeNotifications();
        if (isInitialized) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '🎉 Test Notification',
              body: 'Great! Notifications are working on your device.',
              sound: true,
            },
            trigger: { seconds: 1 },
          });
          Alert.alert('Success', 'Test notification scheduled!');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to test notifications.');
    }
  };

  const exportData = async () => {
    try {
      const tasks = await AsyncStorage.getItem('tasks');
      const timeBlocks = await AsyncStorage.getItem('timeBlocks');
      const pomodoroStats = await AsyncStorage.getItem('pomodoroStats');

      const data = {
        tasks: tasks ? JSON.parse(tasks) : [],
        timeBlocks: timeBlocks ? JSON.parse(timeBlocks) : [],
        pomodoroStats: pomodoroStats ? JSON.parse(pomodoroStats) : {},
        exportDate: new Date().toISOString(),
      };

      Alert.alert('Data Exported', 'Your data has been prepared for export.');
    } catch (error) {
      Alert.alert('Error', 'Failed to export data.');
    }
  };

  const clearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove(['tasks', 'timeBlocks', 'pomodoroStats']);
              setTotalTasks(0);
              setTotalTimeBlocks(0);
              setTotalPomodoros(0);
              Alert.alert('Success', 'All data has been cleared.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data.');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStats();
    await loadSettings();
    setRefreshing(false);
  }, []);

  const SettingItem = ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    rightComponent 
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightComponent?: React.ReactNode;
  }) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingLeft}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon as any} size={20} color="#74b9ff" />
        </View>
        <View>
          <ThemedText style={styles.settingTitle}>{title}</ThemedText>
          {subtitle && <ThemedText style={styles.settingSubtitle}>{subtitle}</ThemedText>}
        </View>
      </View>
      {rightComponent || <Ionicons name="chevron-forward" size={20} color="#999" />}
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>Settings</ThemedText>
          <ThemedText style={styles.subtitle}>Manage your PocketPlanner</ThemedText>
        </View>

        {/* User Profile Section */}
        {user && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Profile</ThemedText>
            <SettingItem
              icon="person-circle"
              title="Profile Settings"
              subtitle="Manage your profile, upload photo, edit details"
              onPress={navigateToProfile}
            />
          </View>
        )}

        {/* App Features */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>App Features</ThemedText>

          <SettingItem
            icon="color-palette"
            title="Theme Settings"
            subtitle="Switch between light and dark mode"
            rightComponent={<ThemeToggle />}
          />

          <SettingItem
            icon="pricetags"
            title="Categories & Tags"
            subtitle="Manage task categories and tags"
            onPress={openCategories}
          />
        </View>

        {/* Voice Assistant Section */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Voice Assistant</ThemedText>
          <ThemedText style={styles.sectionDescription}>
            Use voice commands to create and manage tasks hands-free
          </ThemedText>
          <VoiceAssistant 
            onTaskCreated={() => {
              loadStats();
              console.log('Task created via voice');
            }}
            onTaskCompleted={() => {
              loadStats();
              console.log('Task completed via voice');
            }}
          />
          <View style={styles.voiceCommandsList}>
            <ThemedText style={styles.commandTitle}>Available Commands:</ThemedText>
            <ThemedText style={styles.commandItem}>• "Add task [task name]"</ThemedText>
            <ThemedText style={styles.commandItem}>• "Complete task [task name]"</ThemedText>
            <ThemedText style={styles.commandItem}>• "List tasks"</ThemedText>
            <ThemedText style={styles.commandItem}>• "Help"</ThemedText>
          </View>
        </View>

        {/* Timer Settings */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Timer Settings</ThemedText>

          <View style={styles.timerSetting}>
            <ThemedText style={styles.settingLabel}>Focus Time (minutes)</ThemedText>
            <View style={styles.timeControls}>
              <TouchableOpacity 
                style={styles.timeButton}
                onPress={() => updateFocusTime(focusTime - 1)}
              >
                <ThemedText style={styles.timeButtonText}>-</ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.timeValue}>{focusTime}</ThemedText>
              <TouchableOpacity 
                style={styles.timeButton}
                onPress={() => updateFocusTime(focusTime + 1)}
              >
                <ThemedText style={styles.timeButtonText}>+</ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.timerSetting}>
            <ThemedText style={styles.settingLabel}>Break Time (minutes)</ThemedText>
            <View style={styles.timeControls}>
              <TouchableOpacity 
                style={styles.timeButton}
                onPress={() => updateBreakTime(breakTime - 1)}
              >
                <ThemedText style={styles.timeButtonText}>-</ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.timeValue}>{breakTime}</ThemedText>
              <TouchableOpacity 
                style={styles.timeButton}
                onPress={() => updateBreakTime(breakTime + 1)}
              >
                <ThemedText style={styles.timeButtonText}>+</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Security & Privacy */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Security & Privacy</ThemedText>

          <SettingItem
            icon="notifications"
            title="Notifications"
            subtitle="Enable task and deadline reminders"
            rightComponent={
              <Switch
                value={notificationsEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ false: '#ccc', true: '#74b9ff' }}
                thumbColor="#fff"
              />
            }
          />

          <SettingItem
            icon="finger-print"
            title="Biometric Login"
            subtitle="Use fingerprint or face ID"
            rightComponent={
              <Switch
                value={biometricEnabled}
                onValueChange={toggleBiometric}
                trackColor={{ false: '#ccc', true: '#74b9ff' }}
                thumbColor="#fff"
              />
            }
          />

          <SettingItem
            icon="shield-checkmark"
            title="Two-Factor Authentication"
            subtitle="Add extra security to your account"
            rightComponent={
              <Switch
                value={twoFactorEnabled}
                onValueChange={toggleTwoFactor}
                trackColor={{ false: '#ccc', true: '#74b9ff' }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* Statistics */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Your Statistics</ThemedText>

          <View style={styles.statGrid}>
            <View style={styles.statCard}>
              <ThemedText style={styles.statNumber}>{totalTasks}</ThemedText>
              <ThemedText style={styles.statLabel}>Tasks Created</ThemedText>
            </View>
            <View style={styles.statCard}>
              <ThemedText style={styles.statNumber}>{totalTimeBlocks}</ThemedText>
              <ThemedText style={styles.statLabel}>Time Blocks</ThemedText>
            </View>
            <View style={styles.statCard}>
              <ThemedText style={styles.statNumber}>{totalPomodoros}</ThemedText>
              <ThemedText style={styles.statLabel}>Pomodoros</ThemedText>
            </View>
          </View>
        </View>

        {/* Data Management */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Data Management</ThemedText>

          <SettingItem
            icon="cloud-download"
            title="Export Data"
            subtitle="Download your tasks and progress"
            onPress={exportData}
          />

          <SettingItem
            icon="notifications"
            title="Test Notifications"
            subtitle="Check if notifications are working"
            onPress={testNotifications}
          />

          <TouchableOpacity style={styles.dangerItem} onPress={clearAllData}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, styles.dangerIcon]}>
                <Ionicons name="trash" size={20} color="#e74c3c" />
              </View>
              <View>
                <ThemedText style={[styles.settingTitle, styles.dangerText]}>Clear All Data</ThemedText>
                <ThemedText style={styles.settingSubtitle}>Permanently delete all data</ThemedText>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Account</ThemedText>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out" size={20} color="white" />
            <ThemedText style={styles.logoutText}>Logout</ThemedText>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={[styles.section, styles.lastSection]}>
          <ThemedText style={styles.sectionTitle}>About</ThemedText>
          <ThemedText style={styles.aboutText}>
            PocketPlanner v1.0.0{'\n'}
            Your personal productivity companion
          </ThemedText>
        </View>
      </ScrollView>

      {/* Modals */}
      <TaskCategories
        visible={showCategories}
        onClose={() => setShowCategories(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#74b9ff',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  title: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: '#dff9ff',
    fontSize: 16,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lastSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dangerIcon: {
    backgroundColor: '#ffebee',
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  dangerText: {
    color: '#e74c3c',
  },
  timerSetting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  timeControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeButton: {
    width: 32,
    height: 32,
    backgroundColor: '#74b9ff',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  timeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 16,
    minWidth: 24,
    textAlign: 'center',
  },
  statGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#74b9ff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  dangerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fd79a8',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  logoutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  aboutText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  voiceCommandsList: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#f8f9ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  commandTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c5ce7',
    marginBottom: 8,
  },
  commandItem: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    paddingLeft: 10,
  },
});