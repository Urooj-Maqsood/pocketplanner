import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
  RefreshControl,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import FocusForecast from '@/components/FocusForecast';
import { initializeNotifications } from '@/services/notificationService';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export default function SettingsScreen() {
  const [totalTasks, setTotalTasks] = useState(0);
  const [totalTimeBlocks, setTotalTimeBlocks] = useState(0);
  const [totalPomodoros, setTotalPomodoros] = useState(0);
  const [focusTime, setFocusTime] = useState(25);
  const [breakTime, setBreakTime] = useState(5);
  const { logout, user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
    loadTimerSettings();
  }, []);

  const loadStats = async () => {
    try {
      // Load tasks count
      const tasksData = await AsyncStorage.getItem('tasks');
      if (tasksData) {
        const tasks = JSON.parse(tasksData);
        setTotalTasks(tasks.length);
      }

      // Load time blocks count
      const timeBlocksData = await AsyncStorage.getItem('timeBlocks');
      if (timeBlocksData) {
        const timeBlocks = JSON.parse(timeBlocksData);
        setTotalTimeBlocks(timeBlocks.length);
      }

      // Load pomodoro stats
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

  const loadTimerSettings = async () => {
    try {
      const timerSettings = await AsyncStorage.getItem('timerSettings');
      if (timerSettings) {
        const settings = JSON.parse(timerSettings);
        setFocusTime(settings.focusTime || 25);
        setBreakTime(settings.breakTime || 5);
      }
    } catch (error) {
      console.error('Error loading timer settings:', error);
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
      Alert.alert('Success', 'Timer settings saved successfully!');
    } catch (error) {
      console.error('Error saving timer settings:', error);
      Alert.alert('Error', 'Failed to save timer settings.');
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

  const clearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your tasks, time blocks, and statistics. This action cannot be undone.',
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
              console.error('Error clearing data:', error);
              Alert.alert('Error', 'Failed to clear data.');
            }
          },
        },
      ]
    );
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

      console.log('Export Data:', JSON.stringify(data, null, 2));
      Alert.alert(
        'Data Exported',
        'Your data has been logged to the console. In a real app, this would be saved to a file or shared.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert('Error', 'Failed to export data.');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
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

  const testNotifications = async () => {
    try {
      if (Platform.OS === 'web') {
        // Test web notification
        if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            new Notification('🎉 Test Notification', {
              body: 'Great! Notifications are working in your browser.',
              icon: '/favicon.ico',
              requireInteraction: true,
            });
            Alert.alert('Success', 'Web notification sent! Check your browser notifications.');
          } else {
            Alert.alert('Permission Denied', 'Please enable notifications in your browser settings.');
          }
        } else {
          Alert.alert('Not Supported', 'Notifications are not supported in this browser.');
        }
      } else {
        // Test mobile notification
        const isInitialized = await initializeNotifications();
        if (isInitialized) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '🎉 Test Notification',
              body: 'Great! Notifications are working on your device.',
              sound: true,
            },
            trigger: {
              seconds: 1,
            },
          });
          Alert.alert('Success', 'Test notification scheduled! You should receive it in a moment.');
        } else {
          Alert.alert(
            'Notifications Not Available',
            'Notifications are not enabled or supported. Please enable them in your device settings.',
            [
              { text: 'OK', style: 'default' }
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error testing notifications:', error);
      Alert.alert('Error', 'Failed to test notifications. They may not be properly configured.');
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Refresh user settings if needed
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Error refreshing settings:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={styles.title}>Settings</ThemedText>
          <ThemedText style={styles.subtitle}>Manage your PocketPlanner</ThemedText>
        </ThemedView>

        {user && (
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Account</ThemedText>
            <View style={styles.userInfo}>
              <ThemedText style={styles.userInfoText}>Username: {user.username}</ThemedText>
              <ThemedText style={styles.userInfoText}>Email: {user.email}</ThemedText>
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <ThemedText style={styles.logoutButtonText}>Logout</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Timer Settings</ThemedText>

          <View style={styles.settingRow}>
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

          <View style={styles.settingRow}>
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

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Statistics</ThemedText>

          <View style={styles.statRow}>
            <ThemedText style={styles.statLabel}>Total Tasks Created</ThemedText>
            <ThemedText style={styles.statValue}>{totalTasks}</ThemedText>
          </View>

          <View style={styles.statRow}>
            <ThemedText style={styles.statLabel}>Time Blocks Scheduled</ThemedText>
            <ThemedText style={styles.statValue}>{totalTimeBlocks}</ThemedText>
          </View>

          <View style={styles.statRow}>
            <ThemedText style={styles.statLabel}>Pomodoros Completed</ThemedText>
            <ThemedText style={styles.statValue}>{totalPomodoros}</ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>About PocketPlanner</ThemedText>
          <ThemedText style={styles.aboutText}>
            PocketPlanner is your offline productivity companion. Track tasks, schedule time blocks, 
            and use the Pomodoro technique to boost your focus.
          </ThemedText>
          <ThemedText style={styles.versionText}>Version 1.0.0</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Features</ThemedText>

          <View style={styles.featureItem}>
            <ThemedText style={styles.featureBullet}>✅</ThemedText>
            <ThemedText style={styles.featureText}>Task Management</ThemedText>
          </View>

          <View style={styles.featureItem}>
            <ThemedText style={styles.featureBullet}>⏰</ThemedText>
            <ThemedText style={styles.featureText}>Time Blocking</ThemedText>
          </View>

          <View style={styles.featureItem}>
            <ThemedText style={styles.featureBullet}>🍅</ThemedText>
            <ThemedText style={styles.featureText}>Pomodoro Timer</ThemedText>
          </View>

          <View style={styles.featureItem}>
            <ThemedText style={styles.featureBullet}>📱</ThemedText>
            <ThemedText style={styles.featureText}>Offline Support</ThemedText>
          </View>

          <View style={styles.featureItem}>
            <ThemedText style={styles.featureBullet}>📊</ThemedText>
            <ThemedText style={styles.featureText}>Daily Overview</ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Notifications</ThemedText>
          <ThemedText style={styles.aboutText}>
            Test if notifications are working properly on your device.
          </ThemedText>

          <TouchableOpacity style={styles.actionButton} onPress={testNotifications}>
            <ThemedText style={styles.actionButtonText}>Test Notifications</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Data Management</ThemedText>

          <TouchableOpacity style={styles.actionButton} onPress={exportData}>
            <ThemedText style={styles.actionButtonText}>Export Data</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dangerButton} onPress={clearAllData}>
            <ThemedText style={styles.dangerButtonText}>Clear All Data</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Tips for Success</ThemedText>

          <ThemedText style={styles.tipText}>
            • Start each day by reviewing your Home screen
          </ThemedText>
          <ThemedText style={styles.tipText}>
            • Break large tasks into smaller, manageable ones
          </ThemedText>
          <ThemedText style={styles.tipText}>
            • Use time blocks to schedule important work
          </ThemedText>
          <ThemedText style={styles.tipText}>
            • Try the Pomodoro technique for focused work sessions
          </ThemedText>
          <ThemedText style={styles.tipText}>
            • Take breaks between intense work periods
          </ThemedText>
        </View>



        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>About PocketPlanner</ThemedText>
          <ThemedText style={styles.aboutText}>
            PocketPlanner is your offline productivity companion. Track tasks, schedule time blocks, 
            and use the Pomodoro technique to boost your focus.
          </ThemedText>
          <ThemedText style={styles.versionText}>Version 1.0.0</ThemedText>
        </View>

        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>
            Built with ❤️ for productivity enthusiasts
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    maxWidth: '100%',
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    padding: 16,
    paddingTop: 40,
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
    marginHorizontal: 12,
    marginVertical: 8,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#74b9ff',
  },
  aboutText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  versionText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  featureBullet: {
    fontSize: 16,
    marginRight: 12,
    width: 24,
  },
  featureText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  actionButton: {
    backgroundColor: '#74b9ff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dangerButton: {
    backgroundColor: '#e17055',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    paddingLeft: 8,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 14,
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
  userInfo: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  userInfoText: {
    fontSize: 16,
    marginBottom: 8,
  },
  logoutButton: {
    backgroundColor: '#fd79a8',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});