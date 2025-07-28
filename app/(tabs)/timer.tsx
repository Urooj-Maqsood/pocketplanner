import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TimerScreen() {
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes in seconds
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [focusTime, setFocusTime] = useState(25);
  const [breakTime, setBreakTime] = useState(5);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const WORK_TIME = focusTime * 60; // Custom focus time in seconds
  const BREAK_TIME = breakTime * 60; // Custom break time in seconds

  useEffect(() => {
    loadStats();
    loadTimerSettings();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadTimerSettings();
    }, [])
  );

  useEffect(() => {
    // Update timeLeft when timer settings change
    if (!isActive) {
      setTimeLeft(isBreak ? BREAK_TIME : WORK_TIME);
    }
  }, [focusTime, breakTime, isBreak, isActive]);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(time => {
          if (time <= 1) {
            return 0;
          }
          return time - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive]);

  useEffect(() => {
    if (timeLeft === 0 && isActive) {
      handleTimerComplete();
    }
  }, [timeLeft, isActive]);

  const loadStats = async () => {
    try {
      const today = new Date().toDateString();
      const pomodoroData = await AsyncStorage.getItem('pomodoroStats');
      if (pomodoroData) {
        const stats = JSON.parse(pomodoroData);
        const todayStats = stats[today] || { completed: 0, total: 0 };
        setSessionsCompleted(todayStats.completed);
      }
    } catch (error) {
      console.error('Error loading pomodoro stats:', error);
    }
  };

  const loadTimerSettings = async () => {
    try {
      const timerSettings = await AsyncStorage.getItem('timerSettings');
      if (timerSettings) {
        const settings = JSON.parse(timerSettings);
        const newFocusTime = settings.focusTime || 25;
        const newBreakTime = settings.breakTime || 5;
        setFocusTime(newFocusTime);
        setBreakTime(newBreakTime);

        // Update current timeLeft if timer is not running
        if (!isActive) {
          setTimeLeft(isBreak ? newBreakTime * 60 : newFocusTime * 60);
        }
      }
    } catch (error) {
      console.error('Error loading timer settings:', error);
    }
  };

  const saveStats = async (completed: number) => {
    try {
      const today = new Date().toDateString();
      const pomodoroData = await AsyncStorage.getItem('pomodoroStats');
      const stats = pomodoroData ? JSON.parse(pomodoroData) : {};

      stats[today] = {
        completed: completed,
        total: (stats[today]?.total || 0) + 1,
      };

      await AsyncStorage.setItem('pomodoroStats', JSON.stringify(stats));
    } catch (error) {
      console.error('Error saving pomodoro stats:', error);
    }
  };

  const handleTimerComplete = () => {
    setIsActive(false);

    if (!isBreak) {
      // Work session completed
      const newCompleted = sessionsCompleted + 1;
      setSessionsCompleted(newCompleted);
      saveStats(newCompleted);

      Alert.alert(
        'Work Session Complete!',
        `Time for a ${breakTime}-minute break.`,
        [
          {
            text: 'Start Break',
            onPress: () => {
              setIsBreak(true);
              setTimeLeft(BREAK_TIME);
            },
          },
        ]
      );
    } else {
      // Break completed
      Alert.alert(
        'Break Complete!',
        'Ready for your next work session?',
        [
          {
            text: 'Start Work',
            onPress: () => {
              setIsBreak(false);
              setTimeLeft(WORK_TIME);
            },
          },
        ]
      );
    }
  };

  const startTimer = () => {
    setIsActive(true);
  };

  const pauseTimer = () => {
    setIsActive(false);
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(isBreak ? BREAK_TIME : WORK_TIME);
  };

  const switchMode = () => {
    const newIsBreak = !isBreak;
    setIsBreak(newIsBreak);
    setTimeLeft(newIsBreak ? BREAK_TIME : WORK_TIME);
    setIsActive(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = isBreak 
    ? ((breakTime * 60 - timeLeft) / (breakTime * 60)) * 100
    : ((focusTime * 60 - timeLeft) / (focusTime * 60)) * 100;

    const onRefresh = useCallback(async () => {
      setRefreshing(true);
      try {
        // Reset timer state if needed
        if (!isActive) {
          setTimeLeft(isBreak ? BREAK_TIME : WORK_TIME);
          setIsBreak(false);
        }
      } catch (error) {
        console.error('Error refreshing timer:', error);
      } finally {
        setRefreshing(false);
      }
    }, [isActive, isBreak, WORK_TIME, BREAK_TIME]);

  return (
    <ThemedView style={styles.container}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >

      <ThemedView style={[styles.header, { backgroundColor: isBreak ? '#00b894' : '#e17055' }]}>
        <ThemedText type="title" style={styles.title}>Pomodoro Timer</ThemedText>
        <ThemedText style={styles.subtitle}>
          {isBreak ? 'Break Time' : 'Focus Time'}
        </ThemedText>
      </ThemedView>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <ThemedText style={styles.statNumber}>{sessionsCompleted}</ThemedText>
          <ThemedText style={styles.statLabel}>Completed Today</ThemedText>
        </View>
      </View>

      <View style={styles.timerContainer}>
        <View style={styles.progressRing}>
          <View style={[styles.progressFill, { 
            height: `${progress}%`,
            backgroundColor: isBreak ? '#00b894' : '#e17055',
          }]} />
          <View style={styles.timerContent}>
            <ThemedText style={styles.timerText}>{formatTime(timeLeft)}</ThemedText>
            <ThemedText style={styles.timerLabel}>
              {isBreak ? 'Break' : 'Focus'}
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity 
          style={[styles.controlButton, styles.secondaryButton]}
          onPress={switchMode}
        >
          <ThemedText style={styles.secondaryButtonText}>
            Switch to {isBreak ? 'Work' : 'Break'}
          </ThemedText>
        </TouchableOpacity>

        <View style={styles.mainControls}>
          <TouchableOpacity 
            style={[styles.controlButton, styles.resetButton]}
            onPress={resetTimer}
          >
            <ThemedText style={styles.resetButtonText}>Reset</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.controlButton, styles.primaryButton, {
              backgroundColor: isBreak ? '#00b894' : '#e17055',
            }]}
            onPress={isActive ? pauseTimer : startTimer}
          >
            <ThemedText style={styles.primaryButtonText}>
              {isActive ? 'Pause' : 'Start'}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.infoContainer}>
        <ThemedText style={styles.infoTitle}>How Pomodoro Works:</ThemedText>
        <ThemedText style={styles.infoText}>
          • Work for {focusTime} minutes with full focus
        </ThemedText>
        <ThemedText style={styles.infoText}>
          • Take a {breakTime}-minute break
        </ThemedText>
        <ThemedText style={styles.infoText}>
          • Repeat to boost productivity
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 120,
  },
  header: {
    padding: 20,
    paddingTop: 50,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    alignItems: 'center',
    marginHorizontal: -20,
    marginBottom: 20,
  },
  title: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
  },
  statsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
    zIndex: 10,
    position: 'relative',
  },
  statCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e17055',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  timerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 280,
  },
  progressRing: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    opacity: 0.08,
    zIndex: 1,
  },
  timerContent: {
    alignItems: 'center',
    zIndex: 2,
    position: 'relative',
    paddingHorizontal: 10,
  },
  timerText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    letterSpacing: 1,
    lineHeight: 36,
  },
  timerLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '500',
  },
  controlsContainer: {
    padding: 20,
    paddingBottom: 30,
  },
  mainControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
  },
  controlButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  primaryButton: {
    backgroundColor: '#e17055',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#ddd',
    alignSelf: 'center',
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#666',
    fontSize: 13,
    fontWeight: 'bold',
  },
  resetButton: {
    backgroundColor: '#ddd',
  },
  resetButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoContainer: {
    marginHorizontal: 12,
    marginVertical: 8,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 3,
  },
});