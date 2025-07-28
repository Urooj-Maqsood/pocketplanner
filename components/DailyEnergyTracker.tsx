
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Alert } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface EnergyLog {
  date: string;
  energy: number;
}

interface DailyEnergyTrackerProps {
  visible: boolean;
  onClose: () => void;
  onEnergyLogged?: (energy: number) => void;
}

const energyLevels = [
  { value: 1, emoji: '😴', label: 'Very Low' },
  { value: 2, emoji: '😔', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Neutral' },
  { value: 4, emoji: '😊', label: 'High' },
  { value: 5, emoji: '🚀', label: 'Very High' }
];

export default function DailyEnergyTracker({ visible, onClose, onEnergyLogged }: DailyEnergyTrackerProps) {
  const [selectedEnergy, setSelectedEnergy] = useState<number | null>(null);
  const [todayLogged, setTodayLogged] = useState(false);

  useEffect(() => {
    if (visible) {
      checkTodayEnergyLog();
    }
  }, [visible]);

  const checkTodayEnergyLog = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const energyLogData = await AsyncStorage.getItem('dailyEnergyLog');
      
      if (energyLogData) {
        const logs: EnergyLog[] = JSON.parse(energyLogData);
        const todayLog = logs.find(log => log.date === today);
        
        if (todayLog) {
          setTodayLogged(true);
          setSelectedEnergy(todayLog.energy);
        } else {
          setTodayLogged(false);
          setSelectedEnergy(null);
        }
      } else {
        setTodayLogged(false);
        setSelectedEnergy(null);
      }
    } catch (error) {
      console.error('Error checking today energy log:', error);
      setTodayLogged(false);
      setSelectedEnergy(null);
    }
  };

  const logEnergyLevel = async (energy: number) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const energyLogData = await AsyncStorage.getItem('dailyEnergyLog');
      
      let logs: EnergyLog[] = energyLogData ? JSON.parse(energyLogData) : [];
      
      // Remove existing log for today if it exists
      logs = logs.filter(log => log.date !== today);
      
      // Add new log for today
      logs.push({ date: today, energy });
      
      // Keep only last 30 days of logs
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      logs = logs.filter(log => new Date(log.date) >= thirtyDaysAgo);
      
      await AsyncStorage.setItem('dailyEnergyLog', JSON.stringify(logs));
      
      setSelectedEnergy(energy);
      setTodayLogged(true);
      
      if (onEnergyLogged) {
        onEnergyLogged(energy);
      }
      
      const message = todayLogged 
        ? `Your energy level has been updated to ${energyLevels.find(e => e.value === energy)?.label}!`
        : `Your energy level (${energyLevels.find(e => e.value === energy)?.label}) has been recorded for today!`;
      
      Alert.alert(
        todayLogged ? 'Energy Level Updated' : 'Energy Level Logged',
        message,
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      console.error('Error logging energy level:', error);
      Alert.alert('Error', 'Failed to log energy level. Please try again.');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <ThemedView style={styles.modalContent}>
          <ThemedText type="title" style={styles.title}>
            {todayLogged ? 'Today\'s Energy Level' : 'How\'s your energy today?'}
          </ThemedText>
          
          <ThemedText style={styles.subtitle}>
            {todayLogged 
              ? 'You can update your energy level if it has changed.'
              : 'Help us suggest the best tasks for your current energy level.'
            }
          </ThemedText>

          <View style={styles.energyGrid}>
            {energyLevels.map((level) => (
              <TouchableOpacity
                key={level.value}
                style={[
                  styles.energyButton,
                  selectedEnergy === level.value && styles.energyButtonSelected
                ]}
                onPress={() => setSelectedEnergy(level.value)}
              >
                <ThemedText style={styles.energyEmoji}>{level.emoji}</ThemedText>
                <ThemedText style={styles.energyLabel}>{level.label}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={onClose}
            >
              <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.logButton,
                selectedEnergy === null && styles.logButtonDisabled
              ]}
              onPress={() => selectedEnergy !== null && logEnergyLevel(selectedEnergy)}
              disabled={selectedEnergy === null}
            >
              <ThemedText style={styles.logButtonText}>
                {todayLogged ? 'Update' : 'Log Energy'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    margin: 20,
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
    lineHeight: 22,
  },
  energyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  energyButton: {
    width: '18%',
    aspectRatio: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e9ecef',
    marginBottom: 8,
  },
  energyButtonSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
  },
  energyEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  energyLabel: {
    fontSize: 10,
    textAlign: 'center',
    color: '#666',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
    fontSize: 16,
  },
  logButton: {
    flex: 1,
    backgroundColor: '#2196f3',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  logButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  logButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
