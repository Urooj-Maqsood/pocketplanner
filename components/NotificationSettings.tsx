
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Alert, ScrollView, Platform } from 'react-native';
import * as Device from 'expo-device';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import {
  getNotificationSettings,
  saveNotificationSettings,
  NotificationSettings,
  initializeNotifications,
  getScheduledNotifications,
  ScheduledNotification,
} from '@/services/notificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotificationSettingsProps {
  visible: boolean;
  onClose: () => void;
}

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  scheduledTime: Date;
  taskId: string;
  type: string;
  isRead: boolean;
}

const REMINDER_OPTIONS = [
  { label: '5 minutes before', value: 5 },
  { label: '10 minutes before', value: 10 },
  { label: '15 minutes before', value: 15 },
  { label: '30 minutes before', value: 30 },
  { label: '1 hour before', value: 60 },
];

const NOTIFICATIONS_READ_KEY = 'notification_read_status';
const NOTIFICATIONS_ENABLED_KEY = 'notifications_enabled';

export default function NotificationSettingsModal({ visible, onClose }: NotificationSettingsProps) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    if (visible) {
      loadNotificationState();
    }
  }, [visible]);

  const loadNotificationState = async () => {
    try {
      const enabledState = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
      setNotificationsEnabled(enabledState === 'true');
    } catch (error) {
      console.error('Error loading notification state:', error);
    }
  };

  const saveNotificationState = async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled.toString());
      setNotificationsEnabled(enabled);
    } catch (error) {
      console.error('Error saving notification state:', error);
    }
  };

  const getNotificationTitle = (notification: ScheduledNotification): string => {
    switch (notification.type) {
      case 'pre-start':
        return '⏰ Task Starting Soon';
      case 'due-time':
        return '🔴 DEADLINE REACHED!';
      case 'final-warning':
        return '🚨 URGENT: Final Warning!';
      case 'halfway-reminder':
        return '📝 Progress Check';
      default:
        return '📋 Task Reminder';
    }
  };

  const getNotificationBody = (notification: ScheduledNotification): string => {
    switch (notification.type) {
      case 'pre-start':
        return `Your task "${notification.taskTitle}" should start soon.`;
      case 'due-time':
        return `The task "${notification.taskTitle}" is now due.`;
      case 'final-warning':
        return `Only 15 minutes left to complete "${notification.taskTitle}"!`;
      case 'halfway-reminder':
        return `How's your task "${notification.taskTitle}" going?`;
      default:
        return `Reminder about "${notification.taskTitle}"`;
    }
  };

  const handleToggleNotifications = async () => {
    if (!notificationsEnabled) {
      // Try to enable notifications
      try {
        const initialized = await initializeNotifications();
        await saveNotificationState(true);
        Alert.alert(
          'Notifications Enabled! 🔔',
          'You will now receive task reminders and deadline alerts.',
          [{ text: 'Great!', style: 'default' }]
        );
      } catch (error) {
        await saveNotificationState(true);
        Alert.alert(
          'Notifications Enabled! 🔔', 
          'Your notification preferences have been saved.',
          [{ text: 'OK', style: 'default' }]
        );
      }
    } else {
      // Disable notifications
      await saveNotificationState(false);
      Alert.alert(
        'Notifications Disabled 🔕',
        'You will no longer receive task reminders.',
        [{ text: 'OK', style: 'default' }]
      );
    }
    
    // Close modal after toggle
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            {notificationsEnabled ? '🔔' : '🔕'} Notifications
          </ThemedText>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <ThemedText style={styles.closeButtonText}>×</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.mainContent}>
          <View style={styles.statusSection}>
            <View style={styles.statusIcon}>
              <ThemedText style={styles.statusIconText}>
                {notificationsEnabled ? '🔔' : '🔕'}
              </ThemedText>
            </View>
            
            <ThemedText style={styles.statusTitle}>
              {notificationsEnabled ? 'Notifications Enabled' : 'Notifications Disabled'}
            </ThemedText>
            
            <ThemedText style={styles.statusDescription}>
              {notificationsEnabled 
                ? 'You will receive task reminders and deadline alerts'
                : 'Enable to receive task reminders and deadline alerts'
              }
            </ThemedText>

            <TouchableOpacity 
              style={[
                styles.toggleButton,
                notificationsEnabled ? styles.toggleButtonEnabled : styles.toggleButtonDisabled
              ]}
              onPress={handleToggleNotifications}
            >
              <ThemedText style={[
                styles.toggleButtonText,
                notificationsEnabled ? styles.toggleButtonTextEnabled : styles.toggleButtonTextDisabled
              ]}>
                {notificationsEnabled ? 'Disable Notifications' : 'Enable Notifications'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  statusSection: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    width: '100%',
    maxWidth: 300,
  },
  statusIcon: {
    marginBottom: 20,
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconText: {
    fontSize: 48,
    textAlign: 'center',
    lineHeight: 50,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    color: '#333',
  },
  statusDescription: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
    lineHeight: 20,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6c757d',
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#212529',
  },
  toggleDescription: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20,
  },
  toggleButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleButtonEnabled: {
    backgroundColor: '#dc3545',
  },
  toggleButtonDisabled: {
    backgroundColor: '#28a745',
  },
  toggleButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  toggleButtonTextEnabled: {
    color: 'white',
  },
  toggleButtonTextDisabled: {
    color: 'white',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#212529',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 16,
    lineHeight: 20,
  },
  reminderOptions: {
    marginTop: 12,
  },
  reminderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  reminderOptionSelected: {
    backgroundColor: '#e7f3ff',
    borderColor: '#0066cc',
  },
  reminderRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#dee2e6',
    marginRight: 12,
  },
  reminderRadioSelected: {
    backgroundColor: '#0066cc',
    borderColor: '#0066cc',
  },
  reminderOptionText: {
    fontSize: 16,
    color: '#495057',
  },
  reminderOptionTextSelected: {
    color: '#0066cc',
    fontWeight: '600',
  },
  notificationsList: {
    marginTop: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#dee2e6',
  },
  notificationItemUnread: {
    backgroundColor: '#e7f3ff',
    borderLeftColor: '#0066cc',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    flex: 1,
  },
  notificationTitleUnread: {
    color: '#0066cc',
    fontWeight: 'bold',
  },
  notificationTime: {
    fontSize: 12,
    color: '#6c757d',
  },
  notificationBody: {
    fontSize: 13,
    color: '#6c757d',
    lineHeight: 18,
  },
  notificationBodyUnread: {
    color: '#495057',
  },
  readIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dee2e6',
    marginLeft: 12,
  },
  readIndicatorUnread: {
    backgroundColor: '#0066cc',
  },
  emptyNotifications: {
    alignItems: 'center',
    padding: 20,
  },
  emptyNotificationsText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  buttonContainer: {
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
  },
  saveButton: {
    backgroundColor: '#0066cc',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
