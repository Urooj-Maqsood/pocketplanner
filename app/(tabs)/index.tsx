
import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  RefreshControl,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import StreakTracker from '@/components/StreakTracker';
import DailyEnergyTracker from '@/components/DailyEnergyTracker';
import FocusForecast from '@/components/FocusForecast';
import MicroCommitmentModal from '@/components/MicroCommitmentModal';
import SmartTaskSuggestions from '@/components/SmartTaskSuggestions';
import VoiceAssistant from '@/components/VoiceAssistant';

interface Task {
  id: string;
  title: string;
  completed: boolean;
  date: string;
  priority?: 'low' | 'medium' | 'high';
  category?: string;
  dueTime?: string;
}

interface TimeBlock {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  date: string;
  completed?: boolean;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [streak, setStreak] = useState(0);
  const [todayEnergyLevel, setTodayEnergyLevel] = useState<number | null>(null);
  const [showEnergyTracker, setShowEnergyTracker] = useState(false);
  const [energyPromptShown, setEnergyPromptShown] = useState(false);
  const [showMicroCommitment, setShowMicroCommitment] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  useEffect(() => {
    loadData();
    checkEnergyPrompt();
  }, []);

  const loadData = async () => {
    try {
      const [tasksData, timeBlocksData, streakData, energyData] = await Promise.all([
        AsyncStorage.getItem('tasks'),
        AsyncStorage.getItem('timeBlocks'),
        AsyncStorage.getItem('streak'),
        AsyncStorage.getItem(`energy_${today}`),
      ]);

      if (tasksData) {
        const parsedTasks = JSON.parse(tasksData);
        setTasks(parsedTasks);
      }

      if (timeBlocksData) {
        const parsedTimeBlocks = JSON.parse(timeBlocksData);
        setTimeBlocks(parsedTimeBlocks);
      }

      if (streakData) {
        setStreak(JSON.parse(streakData));
      }

      if (energyData) {
        setTodayEnergyLevel(JSON.parse(energyData));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const checkEnergyPrompt = async () => {
    try {
      const todayISO = new Date().toISOString().split('T')[0];
      const promptShown = await AsyncStorage.getItem('energyPromptShown_' + todayISO);
      const energyData = await AsyncStorage.getItem(`energy_${todayISO}`);
      
      if (!promptShown && !energyData) {
        // Show energy tracker after a short delay
        setTimeout(() => {
          setShowEnergyTracker(true);
        }, 2000);
      } else {
        setEnergyPromptShown(true);
      }
    } catch (error) {
      console.error('Error checking energy prompt:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const todayTasks = tasks.filter(task => task.date === today);
  const completedTasks = todayTasks.filter(task => task.completed);
  const pendingTasks = todayTasks.filter(task => !task.completed);
  const todayTimeBlocks = timeBlocks.filter(block => block.date === today);

  const completionPercentage = todayTasks.length > 0 
    ? Math.round((completedTasks.length / todayTasks.length) * 100) 
    : 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getMotivationalMessage = () => {
    if (completionPercentage === 100 && todayTasks.length > 0) {
      return "🎉 Amazing! You've completed all your tasks today!";
    }
    if (completionPercentage >= 75) {
      return "🚀 You're doing great! Keep up the momentum!";
    }
    if (completionPercentage >= 50) {
      return "💪 Good progress! You're halfway there!";
    }
    if (completionPercentage > 0) {
      return "🌟 Nice start! Every step counts!";
    }
    return "✨ Ready to make today productive? Let's start!";
  };

  const getEnergyEmoji = (level: number) => {
    if (level >= 8) return '⚡';
    if (level >= 6) return '🔋';
    if (level >= 4) return '🔌';
    return '🪫';
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return '#e74c3c';
      case 'medium': return '#f39c12';
      case 'low': return '#27ae60';
      default: return '#74b9ff';
    }
  };

  const navigateToTasks = () => {
    router.push('/(tabs)/tasks');
  };

  const navigateToTimer = () => {
    router.push('/(tabs)/timer');
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <ThemedText style={styles.greeting}>{getGreeting()}</ThemedText>
            <ThemedText style={styles.username}>{user?.username || 'User'}!</ThemedText>
            <ThemedText style={styles.date}>{todayFormatted}</ThemedText>
          </View>
          <View style={styles.headerRight}>
            <StreakTracker currentStreak={streak} />
            {todayEnergyLevel !== null && (
              <View style={styles.energyDisplay}>
                <Text style={styles.energyEmoji}>{getEnergyEmoji(todayEnergyLevel)}</Text>
                <ThemedText style={styles.energyText}>{todayEnergyLevel}/10</ThemedText>
              </View>
            )}
          </View>
        </View>

        {/* Motivational Message */}
        <View style={styles.motivationCard}>
          <ThemedText style={styles.motivationText}>{getMotivationalMessage()}</ThemedText>
        </View>

        {/* Today's Progress */}
        <View style={styles.progressSection}>
          <ThemedText style={styles.sectionTitle}>Today's Progress</ThemedText>
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <ThemedText style={styles.progressTitle}>Task Completion</ThemedText>
              <ThemedText style={styles.progressPercentage}>{completionPercentage}%</ThemedText>
            </View>
            <View style={styles.progressBar}>
              <View 
                style={[styles.progressFill, { width: `${completionPercentage}%` }]} 
              />
            </View>
            <View style={styles.progressStats}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statNumber}>{completedTasks.length}</ThemedText>
                <ThemedText style={styles.statLabel}>Completed</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statNumber}>{pendingTasks.length}</ThemedText>
                <ThemedText style={styles.statLabel}>Remaining</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statNumber}>{todayTimeBlocks.length}</ThemedText>
                <ThemedText style={styles.statLabel}>Time Blocks</ThemedText>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <ThemedText style={styles.sectionTitle}>Quick Actions</ThemedText>
          <View style={styles.actionGrid}>
            <TouchableOpacity style={styles.actionButton} onPress={navigateToTasks}>
              <Ionicons name="checkmark-circle" size={24} color="#74b9ff" />
              <ThemedText style={styles.actionText}>Add Task</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={navigateToTimer}>
              <Ionicons name="timer" size={24} color="#fd79a8" />
              <ThemedText style={styles.actionText}>Start Timer</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => setShowMicroCommitment(true)}
            >
              <Ionicons name="flash" size={24} color="#fdcb6e" />
              <ThemedText style={styles.actionText}>Micro Goals</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => setShowEnergyTracker(true)}
            >
              <Ionicons name="battery-charging" size={24} color="#00b894" />
              <ThemedText style={styles.actionText}>Energy</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Voice Assistant */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Voice Assistant</ThemedText>
          <ThemedText style={styles.sectionSubtitle}>
            Use voice commands to create and manage tasks hands-free
          </ThemedText>
          <VoiceAssistant 
            onTaskCreated={loadData}
            onTaskCompleted={loadData}
          />
        </View>

        {/* Upcoming Tasks */}
        {pendingTasks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Upcoming Tasks</ThemedText>
              <TouchableOpacity onPress={navigateToTasks}>
                <ThemedText style={styles.viewAllText}>View All</ThemedText>
              </TouchableOpacity>
            </View>
            {pendingTasks.slice(0, 3).map((task) => (
              <View key={task.id} style={styles.taskItem}>
                <View style={styles.taskLeft}>
                  <View 
                    style={[
                      styles.taskPriority, 
                      { backgroundColor: getPriorityColor(task.priority) }
                    ]} 
                  />
                  <View style={styles.taskContent}>
                    <ThemedText style={styles.taskTitle}>{task.title}</ThemedText>
                    {task.dueTime && (
                      <ThemedText style={styles.taskTime}>Due: {task.dueTime}</ThemedText>
                    )}
                    {task.category && (
                      <ThemedText style={styles.taskCategory}>{task.category}</ThemedText>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#999" />
              </View>
            ))}
          </View>
        )}

        {/* Today's Time Blocks */}
        {todayTimeBlocks.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Today's Schedule</ThemedText>
            {todayTimeBlocks.slice(0, 3).map((block) => (
              <View key={block.id} style={styles.timeBlockItem}>
                <View style={styles.timeBlockTime}>
                  <ThemedText style={styles.timeText}>{block.startTime}</ThemedText>
                  <ThemedText style={styles.timeText}>{block.endTime}</ThemedText>
                </View>
                <View style={styles.timeBlockContent}>
                  <ThemedText style={styles.timeBlockTitle}>{block.title}</ThemedText>
                  {block.completed && (
                    <Ionicons name="checkmark-circle" size={16} color="#00b894" />
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Smart Suggestions */}
        <SmartTaskSuggestions 
          existingTasks={tasks}
          onTaskSuggestionAccepted={loadData}
        />

        {/* Focus Forecast */}
        <FocusForecast energyLevel={todayEnergyLevel} />
      </ScrollView>

      {/* Modals */}
      <DailyEnergyTracker
        visible={showEnergyTracker}
        onClose={() => setShowEnergyTracker(false)}
        onEnergyLogged={async (energy) => {
          setTodayEnergyLevel(energy);
          setShowEnergyTracker(false);
          setEnergyPromptShown(true);
          const todayISO = new Date().toISOString().split('T')[0];
          await AsyncStorage.setItem('energyPromptShown_' + todayISO, 'true');
        }}
      />

      <MicroCommitmentModal
        visible={showMicroCommitment}
        onClose={() => setShowMicroCommitment(false)}
        onCommitmentMade={loadData}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#74b9ff',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  greeting: {
    fontSize: 16,
    color: '#dff9ff',
    marginBottom: 4,
  },
  username: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: '#dff9ff',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  energyDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  energyEmoji: {
    fontSize: 16,
    marginRight: 4,
  },
  energyText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  motivationCard: {
    margin: 16,
    marginTop: -16,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  motivationText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    lineHeight: 24,
  },
  progressSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  progressCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  progressPercentage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#74b9ff',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#74b9ff',
    borderRadius: 4,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  quickActions: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: '#74b9ff',
    fontWeight: '600',
  },
  taskItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  taskLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  taskPriority: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginRight: 12,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  taskTime: {
    fontSize: 12,
    color: '#fd79a8',
    marginBottom: 2,
  },
  taskCategory: {
    fontSize: 12,
    color: '#666',
  },
  timeBlockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  timeBlockTime: {
    width: 80,
    alignItems: 'center',
    marginRight: 16,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  timeBlockContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeBlockTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
});
