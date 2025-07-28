
import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Task {
  id: string;
  title: string;
  completed: boolean;
  date: string;
}

interface Task {
  id: string;
  title: string;
  completed: boolean;
  date: string;
  linkedToTaskId?: string;
  isMicroTask?: boolean;
  hasMicroTaskActive?: boolean;
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastCheckedDate: string;
  lastCompletionDate: string;
}

export default function StreakTracker() {
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    lastCheckedDate: '',
    lastCompletionDate: ''
  });

  const today = new Date().toDateString();

  useEffect(() => {
    loadStreakData();
  }, []);

  useEffect(() => {
    if (streakData.lastCheckedDate !== '') {
      checkAndUpdateStreak();
    }
  }, [streakData]);

  useEffect(() => {
    // Check streak whenever component mounts or tasks might have changed
    const interval = setInterval(() => {
      checkAndUpdateStreak();
    }, 2000); // Check every 2 seconds for real-time updates

    return () => clearInterval(interval);
  }, []);

  const loadStreakData = async () => {
    try {
      const streakDataString = await AsyncStorage.getItem('streakData');
      if (streakDataString) {
        const data = JSON.parse(streakDataString);
        setStreakData(data);
      }
    } catch (error) {
      console.error('Error loading streak data:', error);
    }
  };

  const saveStreakData = async (data: StreakData) => {
    try {
      await AsyncStorage.setItem('streakData', JSON.stringify(data));
      setStreakData(data);
    } catch (error) {
      console.error('Error saving streak data:', error);
    }
  };

  const checkAndUpdateStreak = async () => {
    try {
      // Get today's tasks
      const tasksData = await AsyncStorage.getItem('tasks');
      if (!tasksData) {
        return;
      }

      const allTasks = JSON.parse(tasksData);
      const todayTasks = allTasks.filter((task: Task) => task.date === today);

      // Check if all tasks are completed OR if micro-tasks maintain streak
      let allTasksCompleted = todayTasks.length > 0 && todayTasks.every((task: Task) => task.completed);
      
      // If not all tasks completed, check for micro-task completions that maintain streak
      if (!allTasksCompleted) {
        const incompleteTasks = todayTasks.filter((task: Task) => !task.completed);
        const hasCompletedMicroTasks = incompleteTasks.some((incompleteTask: Task) => {
          // Check if this incomplete task has a completed micro-task
          const linkedMicroTasks = allTasks.filter((task: Task) => 
            task.linkedToTaskId === incompleteTask.id && task.completed
          );
          return linkedMicroTasks.length > 0;
        });
        
        // If we have completed micro-tasks for incomplete parent tasks, consider streak maintained
        if (hasCompletedMicroTasks) {
          allTasksCompleted = true;
        }
      }

      let newStreakData = { ...streakData };

      if (allTasksCompleted) {
        // All tasks completed today
        if (streakData.lastCompletionDate !== today) {
          // Only update if we haven't already counted today
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayString = yesterday.toDateString();

          if (streakData.lastCompletionDate === yesterdayString || streakData.currentStreak === 0) {
            // Continue streak or start new streak
            newStreakData.currentStreak += 1;
          } else {
            // Gap in completion, start new streak
            newStreakData.currentStreak = 1;
          }
          
          newStreakData.longestStreak = Math.max(newStreakData.longestStreak, newStreakData.currentStreak);
          newStreakData.lastCompletionDate = today;
          newStreakData.lastCheckedDate = today;
          
          await saveStreakData(newStreakData);
        }
      } else {
        // Not all tasks completed - only reset if we haven't checked today
        if (streakData.lastCheckedDate !== today) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayString = yesterday.toDateString();

          // Reset streak if we missed yesterday and had a streak
          if (streakData.lastCompletionDate !== yesterdayString && streakData.currentStreak > 0) {
            const lastCompletionDate = new Date(streakData.lastCompletionDate || today);
            const daysDifference = Math.floor((new Date(today).getTime() - lastCompletionDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysDifference > 1) {
              newStreakData.currentStreak = 0;
              newStreakData.lastCheckedDate = today;
              await saveStreakData(newStreakData);
            }
          }
        }
      }

    } catch (error) {
      console.error('Error checking streak:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.streakItem}>
        <ThemedText style={styles.streakLabel}>Current Streak</ThemedText>
        <View style={styles.streakValueContainer}>
          <ThemedText style={styles.streakNumber}>{streakData.currentStreak}</ThemedText>
          <ThemedText style={styles.streakUnit}>Days 🔥</ThemedText>
        </View>
      </View>

      <View style={styles.streakItem}>
        <ThemedText style={styles.streakLabel}>Longest Streak</ThemedText>
        <View style={styles.streakValueContainer}>
          <ThemedText style={styles.streakNumber}>{streakData.longestStreak}</ThemedText>
          <ThemedText style={styles.streakUnit}>Days 🏆</ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  streakItem: {
    alignItems: 'center',
    flex: 1,
  },
  streakLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  streakValueContainer: {
    alignItems: 'center',
  },
  streakNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6c5ce7',
  },
  streakUnit: {
    fontSize: 12,
    color: '#333',
    marginTop: 2,
  },
});
