
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
  Switch,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import * as Notifications from 'expo-notifications';

interface PrayerTime {
  id: string;
  name: string;
  time: string;
  enabled: boolean;
}

interface MindfulnessReminder {
  id: string;
  type: 'breathing' | 'relaxation' | 'prayer';
  interval: number; // minutes
  enabled: boolean;
  customDua?: string;
}

export default function PrayerMindfulnessReminders({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [prayerTimes, setPrayerTimes] = useState<PrayerTime[]>([
    { id: '1', name: 'Fajr', time: '05:30', enabled: false },
    { id: '2', name: 'Dhuhr', time: '12:30', enabled: false },
    { id: '3', name: 'Asr', time: '15:45', enabled: false },
    { id: '4', name: 'Maghrib', time: '18:15', enabled: false },
    { id: '5', name: 'Isha', time: '19:45', enabled: false },
  ]);

  const [mindfulnessReminders, setMindfulnessReminders] = useState<MindfulnessReminder[]>([
    { id: '1', type: 'breathing', interval: 120, enabled: false },
    { id: '2', type: 'relaxation', interval: 180, enabled: false },
    { id: '3', type: 'prayer', interval: 240, enabled: false },
  ]);

  const [customDua, setCustomDua] = useState('');
  const [showDuaInput, setShowDuaInput] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const prayerData = await AsyncStorage.getItem('prayerTimes');
      const mindfulnessData = await AsyncStorage.getItem('mindfulnessReminders');
      const duaData = await AsyncStorage.getItem('customDua');

      if (prayerData) setPrayerTimes(JSON.parse(prayerData));
      if (mindfulnessData) setMindfulnessReminders(JSON.parse(mindfulnessData));
      if (duaData) setCustomDua(duaData);
    } catch (error) {
      console.error('Error loading prayer settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem('prayerTimes', JSON.stringify(prayerTimes));
      await AsyncStorage.setItem('mindfulnessReminders', JSON.stringify(mindfulnessReminders));
      await AsyncStorage.setItem('customDua', customDua);
      await scheduleNotifications();
    } catch (error) {
      console.error('Error saving prayer settings:', error);
    }
  };

  const scheduleNotifications = async () => {
    // Cancel existing notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Schedule prayer notifications
    for (const prayer of prayerTimes) {
      if (prayer.enabled) {
        const [hours, minutes] = prayer.time.split(':').map(Number);
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🕌 Prayer Time',
            body: `Time for ${prayer.name} prayer`,
            sound: true,
          },
          trigger: {
            hour: hours,
            minute: minutes,
            repeats: true,
          },
        });
      }
    }

    // Schedule mindfulness reminders
    for (const reminder of mindfulnessReminders) {
      if (reminder.enabled) {
        let title = '';
        let body = '';

        switch (reminder.type) {
          case 'breathing':
            title = '🫁 Breathing Reminder';
            body = 'Take a moment for deep breathing exercises';
            break;
          case 'relaxation':
            title = '🧘 Relaxation Time';
            body = 'Time for a 2-minute relaxation break';
            break;
          case 'prayer':
            title = '🤲 Prayer Reminder';
            body = customDua || 'Time for a moment of prayer and reflection';
            break;
        }

        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: true,
          },
          trigger: {
            seconds: reminder.interval * 60,
            repeats: true,
          },
        });
      }
    }
  };

  const togglePrayerTime = (id: string) => {
    setPrayerTimes(prev => 
      prev.map(prayer => 
        prayer.id === id ? { ...prayer, enabled: !prayer.enabled } : prayer
      )
    );
  };

  const toggleMindfulnessReminder = (id: string) => {
    setMindfulnessReminders(prev =>
      prev.map(reminder =>
        reminder.id === id ? { ...reminder, enabled: !reminder.enabled } : reminder
      )
    );
  };

  const updatePrayerTime = (id: string, time: string) => {
    setPrayerTimes(prev =>
      prev.map(prayer =>
        prayer.id === id ? { ...prayer, time } : prayer
      )
    );
  };

  const getMindfulnessTypeIcon = (type: string) => {
    switch (type) {
      case 'breathing': return '🫁';
      case 'relaxation': return '🧘';
      case 'prayer': return '🤲';
      default: return '⏰';
    }
  };

  const getMindfulnessTypeName = (type: string) => {
    switch (type) {
      case 'breathing': return 'Breathing Exercise';
      case 'relaxation': return 'Relaxation Break';
      case 'prayer': return 'Prayer Time';
      default: return 'Reminder';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title">🕌 Prayer & Mindfulness</ThemedText>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <ThemedText style={styles.closeButtonText}>×</ThemedText>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Prayer Times Section */}
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              🕌 Namaz Reminders
            </ThemedText>
            <ThemedText style={styles.sectionDescription}>
              Set custom prayer time reminders
            </ThemedText>

            {prayerTimes.map((prayer) => (
              <View key={prayer.id} style={styles.prayerItem}>
                <View style={styles.prayerInfo}>
                  <ThemedText style={styles.prayerName}>{prayer.name}</ThemedText>
                  <TextInput
                    style={styles.timeInput}
                    value={prayer.time}
                    onChangeText={(time) => updatePrayerTime(prayer.id, time)}
                    placeholder="HH:MM"
                  />
                </View>
                <Switch
                  value={prayer.enabled}
                  onValueChange={() => togglePrayerTime(prayer.id)}
                  trackColor={{ false: '#767577', true: '#81b0ff' }}
                  thumbColor={prayer.enabled ? '#f5dd4b' : '#f4f3f4'}
                />
              </View>
            ))}
          </View>

          {/* Mindfulness Reminders Section */}
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              🧘 Mindfulness Reminders
            </ThemedText>
            <ThemedText style={styles.sectionDescription}>
              Short 2-minute relaxation and breathing reminders
            </ThemedText>

            {mindfulnessReminders.map((reminder) => (
              <View key={reminder.id} style={styles.reminderItem}>
                <View style={styles.reminderInfo}>
                  <ThemedText style={styles.reminderIcon}>
                    {getMindfulnessTypeIcon(reminder.type)}
                  </ThemedText>
                  <View style={styles.reminderDetails}>
                    <ThemedText style={styles.reminderName}>
                      {getMindfulnessTypeName(reminder.type)}
                    </ThemedText>
                    <ThemedText style={styles.reminderInterval}>
                      Every {reminder.interval} minutes
                    </ThemedText>
                  </View>
                </View>
                <Switch
                  value={reminder.enabled}
                  onValueChange={() => toggleMindfulnessReminder(reminder.id)}
                  trackColor={{ false: '#767577', true: '#81b0ff' }}
                  thumbColor={reminder.enabled ? '#f5dd4b' : '#f4f3f4'}
                />
              </View>
            ))}
          </View>

          {/* Custom Dua Section */}
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              🤲 Custom Dua
            </ThemedText>
            <ThemedText style={styles.sectionDescription}>
              Add your personal dua for prayer reminders
            </ThemedText>
            
            <TouchableOpacity
              style={styles.duaButton}
              onPress={() => setShowDuaInput(!showDuaInput)}
            >
              <ThemedText style={styles.duaButtonText}>
                {customDua ? 'Edit Custom Dua' : 'Add Custom Dua'}
              </ThemedText>
            </TouchableOpacity>

            {showDuaInput && (
              <View style={styles.duaInputContainer}>
                <TextInput
                  style={styles.duaInput}
                  value={customDua}
                  onChangeText={setCustomDua}
                  placeholder="Enter your custom dua..."
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}

            {customDua && (
              <View style={styles.duaPreview}>
                <ThemedText style={styles.duaPreviewText}>{customDua}</ThemedText>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => {
              saveSettings();
              Alert.alert('Success', 'Prayer and mindfulness settings saved!');
            }}
          >
            <ThemedText style={styles.saveButtonText}>Save Settings</ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </ThemedView>
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
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: 'white',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    marginBottom: 8,
    color: '#333',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  prayerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  prayerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  prayerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    width: 80,
  },
  timeInput: {
    fontSize: 16,
    color: '#666',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 16,
    width: 80,
    textAlign: 'center',
  },
  reminderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  reminderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reminderIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  reminderDetails: {
    flex: 1,
  },
  reminderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  reminderInterval: {
    fontSize: 14,
    color: '#666',
  },
  duaButton: {
    backgroundColor: '#74b9ff',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  duaButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  duaInputContainer: {
    marginBottom: 16,
  },
  duaInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  duaPreview: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  duaPreviewText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: '#00b894',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
