import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import DailyEnergyTracker from '@/components/DailyEnergyTracker';
import FocusForecast from '@/components/FocusForecast';
import SmartTaskSuggestions from '@/components/SmartTaskSuggestions';
import StreakTracker from '@/components/StreakTracker';

interface Task {
  id: string;
  title: string;
  completed: boolean;
  date: string;
  isMicroTask?: boolean;
  hasMicroTaskActive?: boolean;
}

interface TimeBlock {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  date: string;
  linkedTaskId?: string;
  linkedTaskTitle?: string;
}

export default function HomeScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [pomodoroStats, setPomodoroStats] = useState({ completed: 0, total: 0 });
  const [todayTimeBlocks, setTodayTimeBlocks] = useState<TimeBlock[]>([]);
  const [showEnergyTracker, setShowEnergyTracker] = useState(false);
  const [todayEnergyLevel, setTodayEnergyLevel] = useState<number | null>(null);
  const [energyPromptShown, setEnergyPromptShown] = useState(false);

  const today = new Date().toDateString();

  const checkEnergyLog = async () => {
    try {
      const todayISO = new Date().toISOString().split('T')[0];
      const energyLogData = await AsyncStorage.getItem('dailyEnergyLog');
      const promptShownData = await AsyncStorage.getItem('energyPromptShown_' + todayISO);

      if (energyLogData) {
        const logs = JSON.parse(energyLogData);
        const todayLog = logs.find((log: any) => log.date === todayISO);

        if (todayLog) {
          setTodayEnergyLevel(todayLog.energy);
          setEnergyPromptShown(true);
        } else {
          setTodayEnergyLevel(null);
          // Show energy tracker if not logged today and prompt hasn't been shown
          if (!promptShownData) {
            setTimeout(() => {
              setShowEnergyTracker(true);
              setEnergyPromptShown(true);
            }, 2000);
          }
        }
      } else {
        setTodayEnergyLevel(null);
        // Show energy tracker for first time users
        if (!promptShownData) {
          setTimeout(() => {
            setShowEnergyTracker(true);
            setEnergyPromptShown(true);
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Error checking energy log:', error);
      setTodayEnergyLevel(null);
    }
  };

  const loadData = async () => {
    try {
      // Load tasks
      const tasksData = await AsyncStorage.getItem('tasks');
      if (tasksData) {
        const allTasks = JSON.parse(tasksData);
        const todayTasksList = allTasks.filter((task: Task) => task.date === today);
        setTodayTasks(todayTasksList);
      }

      // Load time blocks
      const timeBlocksData = await AsyncStorage.getItem('timeBlocks');
      if (timeBlocksData) {
        const allTimeBlocks = JSON.parse(timeBlocksData);
        const todayBlocksList = allTimeBlocks.filter((block: TimeBlock) => block.date === today);
        setTodayTimeBlocks(todayBlocksList);
      }

      // Load pomodoro stats
      const pomodoroData = await AsyncStorage.getItem('pomodoroStats');
      if (pomodoroData) {
        const stats = JSON.parse(pomodoroData);
        const todayStats = stats[today] || { completed: 0, total: 0 };
        setPomodoroStats(todayStats);
      }

      // Check energy log
      await checkEnergyLog();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch (error) {
      console.error('Error refreshing home data:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const completedTasks = todayTasks.filter(task => task.completed).length;
  const totalTasks = todayTasks.length;

  return (
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
        <ThemedText type="title" style={styles.title}>PocketPlanner</ThemedText>
        <ThemedText style={styles.date}>{new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</ThemedText>
      </ThemedView>

      <StreakTracker />

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <ThemedText style={styles.statNumber}>{completedTasks}/{totalTasks}</ThemedText>
          <ThemedText style={styles.statLabel}>Tasks</ThemedText>
        </View>
        <View style={styles.statCard}>
          <ThemedText style={styles.statNumber}>{todayTimeBlocks.length}</ThemedText>
          <ThemedText style={styles.statLabel}>Time Blocks</ThemedText>
        </View>
        <View style={styles.statCard}>
          <ThemedText style={styles.statNumber}>{pomodoroStats.completed}</ThemedText>
          <ThemedText style={styles.statLabel}>Pomodoros</ThemedText>
        </View>
      </View>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>Today's Tasks</ThemedText>
        {todayTasks.length === 0 ? (
          <ThemedText style={styles.emptyText}>No tasks for today. Add some in the Tasks tab!</ThemedText>
        ) : (
          todayTasks.slice(0, 5).map(task => (
            <View key={task.id} style={styles.taskItem}>
              <View style={[styles.taskStatus, task.completed && styles.taskCompleted]} />
              <ThemedText style={[styles.taskText, task.completed && styles.taskTextCompleted]}>
                {task.title}
              </ThemedText>
            </View>
          ))
        )}
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>Time Blocks</ThemedText>
        {todayTimeBlocks.length === 0 ? (
          <ThemedText style={styles.emptyText}>No time blocks scheduled for today.</ThemedText>
        ) : (
          todayTimeBlocks.slice(0, 3).map(block => (
            <View key={block.id} style={[styles.timeBlockItem, block.linkedTaskId && styles.timeBlockLinked]}>
              <View style={styles.timeBlockContent}>
                <ThemedText style={styles.timeBlockTime}>
                  {block.startTime} - {block.endTime}
                </ThemedText>
                <ThemedText style={styles.timeBlockTitle}>{block.title}</ThemedText>
                {block.linkedTaskId && block.linkedTaskTitle && (
                  <ThemedText style={styles.linkedTaskInfo}>
                    🔗 {block.linkedTaskTitle}
                  </ThemedText>
                )}
              </View>
            </View>
          ))
        )}
      </ThemedView>
      <ThemedView style={styles.section}>
        <View style={styles.energySection}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Energy Level</ThemedText>
          <TouchableOpacity 
            style={styles.energyButton}
            onPress={() => setShowEnergyTracker(true)}
          >
            {todayEnergyLevel ? (
              <View style={styles.energyDisplay}>
                <ThemedText style={styles.energyEmoji}>
                  {todayEnergyLevel === 1 ? '😴' : 
                   todayEnergyLevel === 2 ? '😔' : 
                   todayEnergyLevel === 3 ? '😐' : 
                   todayEnergyLevel === 4 ? '😊' : '🚀'}
                </ThemedText>
                <ThemedText style={styles.energyText}>
                  {todayEnergyLevel === 1 ? 'Very Low' : 
                   todayEnergyLevel === 2 ? 'Low' : 
                   todayEnergyLevel === 3 ? 'Neutral' : 
                   todayEnergyLevel === 4 ? 'High' : 'Very High'}
                </ThemedText>
              </View>
            ) : (
              <View style={styles.energyDisplay}>
                <ThemedText style={styles.energyEmoji}>❓</ThemedText>
                <ThemedText style={styles.energyText}>Log Energy</ThemedText>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ThemedView>

      <DailyEnergyTracker
        visible={showEnergyTracker}
        onClose={() => setShowEnergyTracker(false)}
        onEnergyLogged={async (energy) => {
          setTodayEnergyLevel(energy);
          setShowEnergyTracker(false);
          setEnergyPromptShown(true);
          // Mark prompt as shown for today
          const todayISO = new Date().toISOString().split('T')[0];
          await AsyncStorage.setItem('energyPromptShown_' + todayISO, 'true');
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 140,
  },
  header: {
    backgroundColor: '#6c5ce7',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 20,
    paddingTop: 60,
    marginBottom: 16,
    marginHorizontal: -16,
  },
  title: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  date: {
    color: '#ddd6fe',
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
    gap: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    minHeight: 110,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6c5ce7',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    marginHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    minHeight: 90,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  taskStatus: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
    marginRight: 12,
  },
  taskCompleted: {
    backgroundColor: '#00b894',
  },
  taskText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  taskTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  timeBlockItem: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    borderRadius: 4,
    marginBottom: 2,
  },
  timeBlockLinked: {
    backgroundColor: '#f8f9ff',
    borderColor: '#6c5ce7',
    borderWidth: 1,
  },
  timeBlockContent: {
    flex: 1,
  },
  timeBlockTime: {
    fontSize: 12,
    color: '#6c5ce7',
    fontWeight: 'bold',
  },
  timeBlockTitle: {
    fontSize: 14,
    color: '#333',
    marginTop: 2,
  },
  linkedTaskInfo: {
    fontSize: 11,
    color: '#27ae60',
    fontStyle: 'italic',
    marginTop: 2,
  },
  energySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  energyButton: {
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2196f3',
  },
  energyDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  energyEmoji: {
    fontSize: 16,
  },
  energyText: {
    fontSize: 14,
    color: '#2196f3',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
});