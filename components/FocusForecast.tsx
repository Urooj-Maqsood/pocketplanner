
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface EnergyLog {
  date: string;
  energy: number;
}

interface Task {
  id: string;
  title: string;
  completed: boolean;
  date: string;
  focusType?: 'deep-focus' | 'creative' | 'administrative' | 'low-energy';
}

const { width } = Dimensions.get('window');

export default function FocusForecast() {
  const [energyLogs, setEnergyLogs] = useState<EnergyLog[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [weeklyPattern, setWeeklyPattern] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    loadDataAndGenerateInsights();
  }, []);

  const loadDataAndGenerateInsights = async () => {
    try {
      // Load energy logs
      const energyLogData = await AsyncStorage.getItem('dailyEnergyLog');
      const logs: EnergyLog[] = energyLogData ? JSON.parse(energyLogData) : [];
      setEnergyLogs(logs);

      // Load completed tasks
      const tasksData = await AsyncStorage.getItem('tasks');
      const allTasks: Task[] = tasksData ? JSON.parse(tasksData) : [];
      const completed = allTasks.filter(task => task.completed);
      setCompletedTasks(completed);

      // Generate insights
      const generatedInsights = generateInsights(logs, completed);
      setInsights(generatedInsights);

      // Generate weekly pattern
      const pattern = generateWeeklyPattern(logs);
      setWeeklyPattern(pattern);

    } catch (error) {
      console.error('Error loading focus forecast data:', error);
    }
  };

  const generateInsights = (logs: EnergyLog[], tasks: Task[]): string[] => {
    const insights: string[] = [];

    if (logs.length === 0) {
      insights.push("Start logging your daily energy to get personalized insights!");
      return insights;
    }

    // Energy level insights
    const avgEnergy = logs.reduce((sum, log) => sum + log.energy, 0) / logs.length;
    const roundedAvg = Math.round(avgEnergy * 10) / 10;
    
    if (avgEnergy >= 4) {
      insights.push(`🚀 You maintain high energy levels (${roundedAvg}/5 average). Great for tackling deep focus tasks!`);
    } else if (avgEnergy >= 3) {
      insights.push(`😊 You have balanced energy levels (${roundedAvg}/5 average). Mix different types of tasks throughout the day.`);
    } else {
      insights.push(`💪 Your energy levels are building up (${roundedAvg}/5 average). Focus on low-energy and administrative tasks.`);
    }

    // Task completion insights
    if (tasks.length > 0) {
      const focusTypeStats = tasks.reduce((stats, task) => {
        if (task.focusType) {
          stats[task.focusType] = (stats[task.focusType] || 0) + 1;
        }
        return stats;
      }, {} as { [key: string]: number });

      const topFocusType = Object.entries(focusTypeStats).sort((a, b) => b[1] - a[1])[0];
      
      if (topFocusType) {
        const typeEmoji = {
          'deep-focus': '🧠',
          'creative': '🎨',
          'administrative': '📋',
          'low-energy': '😴'
        };
        
        insights.push(`${typeEmoji[topFocusType[0] as keyof typeof typeEmoji]} You excel at ${topFocusType[0].replace('-', ' ')} tasks (${topFocusType[1]} completed recently).`);
      }
    }

    // Recent energy trend
    if (logs.length >= 3) {
      const recentLogs = logs.slice(-3);
      const trend = recentLogs[recentLogs.length - 1].energy - recentLogs[0].energy;
      
      if (trend > 0) {
        insights.push("📈 Your energy is trending upward. Time to tackle challenging tasks!");
      } else if (trend < 0) {
        insights.push("📉 Your energy is declining. Consider scheduling easier tasks or taking breaks.");
      } else {
        insights.push("➡️ Your energy is stable. Maintain your current task scheduling pattern.");
      }
    }

    // Weekly pattern insights
    if (logs.length >= 7) {
      const dayOfWeek = new Date().getDay();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const weeklyAvg = generateWeeklyPattern(logs);
      
      const todayPattern = weeklyAvg[dayOfWeek.toString()];
      const bestDay = Object.entries(weeklyAvg).sort((a, b) => b[1] - a[1])[0];
      
      if (bestDay && parseFloat(bestDay[0]) !== dayOfWeek) {
        const bestDayName = dayNames[parseInt(bestDay[0])];
        insights.push(`🗓️ You typically have highest energy on ${bestDayName}s. Plan your most important tasks accordingly.`);
      }
    }

    return insights;
  };

  const generateWeeklyPattern = (logs: EnergyLog[]): { [key: string]: number } => {
    const pattern: { [key: string]: number } = {};
    const counts: { [key: string]: number } = {};

    logs.forEach(log => {
      const dayOfWeek = new Date(log.date).getDay();
      const dayKey = dayOfWeek.toString();
      
      pattern[dayKey] = (pattern[dayKey] || 0) + log.energy;
      counts[dayKey] = (counts[dayKey] || 0) + 1;
    });

    // Calculate averages
    Object.keys(pattern).forEach(day => {
      pattern[day] = pattern[day] / counts[day];
    });

    return pattern;
  };

  const getEnergyBarHeight = (energy: number): number => {
    return Math.max(20, (energy / 5) * 100);
  };

  const getEnergyColor = (energy: number): string => {
    if (energy >= 4) return '#4CAF50';
    if (energy >= 3) return '#FFC107';
    if (energy >= 2) return '#FF9800';
    return '#F44336';
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>📊 Focus Forecast</ThemedText>
      
      {energyLogs.length > 0 && (
        <View style={styles.chartContainer}>
          <ThemedText style={styles.chartTitle}>Weekly Energy Pattern</ThemedText>
          <View style={styles.chart}>
            {dayNames.map((day, index) => (
              <View key={day} style={styles.chartBar}>
                <View 
                  style={[
                    styles.bar,
                    { 
                      height: getEnergyBarHeight(weeklyPattern[index.toString()] || 0),
                      backgroundColor: getEnergyColor(weeklyPattern[index.toString()] || 0)
                    }
                  ]}
                />
                <ThemedText style={styles.dayLabel}>{day}</ThemedText>
                {weeklyPattern[index.toString()] && (
                  <ThemedText style={styles.energyValue}>
                    {Math.round(weeklyPattern[index.toString()] * 10) / 10}
                  </ThemedText>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.insightsContainer}>
        <ThemedText style={styles.insightsTitle}>🧠 Smart Insights</ThemedText>
        <ScrollView style={styles.insightsList} showsVerticalScrollIndicator={false}>
          {insights.map((insight, index) => (
            <View key={index} style={styles.insightItem}>
              <ThemedText style={styles.insightText}>{insight}</ThemedText>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.statsContainer}>
        <ThemedText style={styles.statsTitle}>📈 Quick Stats</ThemedText>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <ThemedText style={styles.statNumber}>{energyLogs.length}</ThemedText>
            <ThemedText style={styles.statLabel}>Days Logged</ThemedText>
          </View>
          <View style={styles.statCard}>
            <ThemedText style={styles.statNumber}>{completedTasks.length}</ThemedText>
            <ThemedText style={styles.statLabel}>Tasks Done</ThemedText>
          </View>
          <View style={styles.statCard}>
            <ThemedText style={styles.statNumber}>
              {energyLogs.length > 0 ? 
                Math.round((energyLogs.reduce((sum, log) => sum + log.energy, 0) / energyLogs.length) * 10) / 10 : 
                0}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Avg Energy</ThemedText>
          </View>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
    textAlign: 'center',
  },
  chartContainer: {
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingHorizontal: 8,
  },
  chartBar: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: 20,
    borderRadius: 10,
    marginBottom: 8,
  },
  dayLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  energyValue: {
    fontSize: 10,
    color: '#333',
    fontWeight: '600',
  },
  insightsContainer: {
    marginBottom: 20,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  insightsList: {
    maxHeight: 200,
  },
  insightItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  insightText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  statsContainer: {
    marginTop: 12,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196f3',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
});
