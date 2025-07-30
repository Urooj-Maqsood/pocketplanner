import React, { useState, useEffect, useCallback } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

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

export default function StreakScreen() {
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    lastCheckedDate: "",
    lastCompletionDate: "",
  });
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date().toDateString();

  useFocusEffect(
    React.useCallback(() => {
      loadData();
      checkAndUpdateStreak();
    }, []),
  );

  const checkAndUpdateStreak = async () => {
    try {
      const tasksData = await AsyncStorage.getItem('tasks');
      if (!tasksData) return;

      const allTasks = JSON.parse(tasksData);
      const todayTasksList = allTasks.filter((task: Task) => task.date === today);

      console.log('Today tasks:', todayTasksList.length);
      console.log('Completed tasks:', todayTasksList.filter(t => t.completed).length);

      // Check if all tasks are completed OR if any micro-tasks linked to incomplete tasks are completed
      let allTasksCompleted = todayTasksList.length > 0 && todayTasksList.every((task: Task) => task.completed);

      // If not all tasks completed, check for micro-task completions that maintain streak
      if (!allTasksCompleted) {
        const incompleteTasks = todayTasksList.filter((task: Task) => !task.completed);
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

      if (allTasksCompleted && streakData.lastCompletionDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayString = yesterday.toDateString();

        let newStreakData = { ...streakData };

        if (streakData.lastCompletionDate === yesterdayString || streakData.currentStreak === 0) {
          newStreakData.currentStreak += 1;
        } else {
          newStreakData.currentStreak = 1;
        }

        newStreakData.longestStreak = Math.max(newStreakData.longestStreak, newStreakData.currentStreak);
        newStreakData.lastCompletionDate = today;
        newStreakData.lastCheckedDate = today;

        await AsyncStorage.setItem('streakData', JSON.stringify(newStreakData));
        setStreakData(newStreakData);

        // Show completion notification
        Alert.alert(
          '🎉 All Tasks Completed!',
          `Great job! You've completed all your tasks for today. Current streak: ${newStreakData.currentStreak} days!`,
          [{ text: 'Awesome!', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Error updating streak:', error);
    }
  };

  const loadData = async () => {
    try {
      // Load streak data
      const streakDataString = await AsyncStorage.getItem("streakData");
      if (streakDataString) {
        const data = JSON.parse(streakDataString);
        setStreakData(data);
      }

      // Load today's tasks
      const tasksData = await AsyncStorage.getItem("tasks");
      if (tasksData) {
        const allTasks = JSON.parse(tasksData);
        const todayTasksList = allTasks.filter(
          (task: Task) => task.date === today,
        );
        setTodayTasks(todayTasksList);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch (error) {
      console.error('Error refreshing streak data:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const resetStreak = async () => {
    Alert.alert(
      "Reset Streak",
      "Are you sure you want to reset your current streak? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              const newStreakData = {
                ...streakData,
                currentStreak: 0,
                lastCheckedDate: today,
              };
              await AsyncStorage.setItem(
                "streakData",
                JSON.stringify(newStreakData),
              );
              setStreakData(newStreakData);
            } catch (error) {
              console.error("Error resetting streak:", error);
            }
          },
        },
      ],
    );
  };

  const completedTasks = todayTasks.filter((task) => task.completed).length;
  const totalTasks = todayTasks.length;
  const completionRate =
    totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

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
        <ThemedText type="title" style={styles.title}>
          Streak Tracker
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Keep your daily momentum going! 🚀
        </ThemedText>
      </ThemedView>

      <View style={styles.streakContainer}>
        <View style={styles.streakCard}>
          <View style={styles.streakIcon}>
            <ThemedText style={styles.streakEmoji}>🔥</ThemedText>
          </View>
          <ThemedText style={styles.streakLabel}>Current Streak</ThemedText>
          <ThemedText style={styles.streakNumber}>
            {streakData.currentStreak}
          </ThemedText>
          <ThemedText style={styles.streakUnit}>Days</ThemedText>
        </View>

        <View style={styles.streakCard}>
          <View style={styles.streakIcon}>
            <ThemedText style={styles.streakEmoji}>🏆</ThemedText>
          </View>
          <ThemedText style={styles.streakLabel}>Longest Streak</ThemedText>
          <ThemedText style={styles.streakNumber}>
            {streakData.longestStreak}
          </ThemedText>
          <ThemedText style={styles.streakUnit}>Days</ThemedText>
        </View>
      </View>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Today's Progress
        </ThemedText>

        <View style={styles.progressContainer}>
          <View style={styles.progressInfo}>
            <ThemedText style={styles.progressText}>
              {completedTasks}/{totalTasks} Tasks Completed
            </ThemedText>
            <ThemedText style={styles.progressPercentage}>
              {completionRate.toFixed(0)}%
            </ThemedText>
          </View>

          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${completionRate}%` }]}
            />
          </View>
        </View>

        {totalTasks === 0 && (
          <View style={styles.noTasksContainer}>
            <Ionicons name="clipboard-outline" size={48} color="#ccc" />
            <ThemedText style={styles.noTasksText}>
              No tasks for today. Add some tasks to start building your streak!
            </ThemedText>
          </View>
        )}

        {totalTasks > 0 && completedTasks === totalTasks && (
          <View style={styles.celebrationContainer}>
            <Ionicons name="checkmark-circle" size={48} color="#00b894" />
            <ThemedText style={styles.celebrationText}>
              Congratulations! All tasks completed! 🎉
            </ThemedText>
          </View>
        )}
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          How Streaks Work
        </ThemedText>

        <View style={styles.infoItem}>
          <Ionicons name="checkmark-done" size={20} color="#6c5ce7" />
          <ThemedText style={styles.infoText}>
            Complete all your daily tasks to maintain your streak
          </ThemedText>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="calendar" size={20} color="#6c5ce7" />
          <ThemedText style={styles.infoText}>
            Streaks are checked once per day automatically
          </ThemedText>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="warning" size={20} color="#e17055" />
          <ThemedText style={styles.infoText}>
            Missing a day will reset your current streak to 0
          </ThemedText>
        </View>
      </ThemedView>

      <TouchableOpacity style={styles.resetButton} onPress={resetStreak}>
        <Ionicons name="refresh" size={20} color="#e17055" />
        <ThemedText style={styles.resetButtonText}>
          Reset Current Streak
        </ThemedText>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    maxWidth: '100%',
    alignSelf: 'center',
    width: '100%',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 16,
    paddingTop: 40,
    backgroundColor: "#6c5ce7",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  title: {
    color: "white",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    color: "#ddd6fe",
    fontSize: 16,
  },
  streakContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  streakCard: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 20,
    alignItems: "center",
    flex: 1,
    marginHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  streakIcon: {
    marginBottom: 8,
  },
  streakEmoji: {
    fontSize: 22,
  },
  streakLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    textAlign: "center",
  },
  streakNumber: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#6c5ce7",
    marginBottom: 4,
  },
  streakUnit: {
    fontSize: 14,
    color: "#333",
  },
  section: {
    marginHorizontal: 12,
    marginVertical: 8,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#333",
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressText: {
    fontSize: 16,
    color: "#333",
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#6c5ce7",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#00b894",
    borderRadius: 4,
  },
  noTasksContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  noTasksText: {
    color: "#999",
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 20,
  },
  celebrationContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  celebrationText: {
    color: "#00b894",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 12,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    color: "#666",
    fontSize: 14,
    lineHeight: 20,
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e17055",
  },
  resetButtonText: {
    color: "#e17055",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
});