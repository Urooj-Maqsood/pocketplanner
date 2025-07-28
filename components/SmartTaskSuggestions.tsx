
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Task {
  id: string;
  title: string;
  completed: boolean;
  date: string;
  priority?: 'high' | 'medium' | 'low';
  deadline?: string;
  importance?: number;
  urgency?: number;
  focusType?: 'deep-focus' | 'creative' | 'administrative' | 'low-energy';
}

interface EnergyLog {
  date: string;
  energy: number;
}

interface SmartTaskSuggestionsProps {
  tasks: Task[];
  onTaskSelect: (task: Task) => void;
}

export default function SmartTaskSuggestions({ tasks, onTaskSelect }: SmartTaskSuggestionsProps) {
  const [suggestedTasks, setSuggestedTasks] = useState<Task[]>([]);
  const [todayEnergyLevel, setTodayEnergyLevel] = useState<number>(3);
  const [currentTimeContext, setCurrentTimeContext] = useState<'morning' | 'afternoon' | 'evening'>('morning');

  useEffect(() => {
    loadEnergyAndGenerateSuggestions();
  }, [tasks]);

  const loadEnergyAndGenerateSuggestions = async () => {
    try {
      // Get current time context
      const hour = new Date().getHours();
      let timeContext: 'morning' | 'afternoon' | 'evening' = 'morning';
      
      if (hour >= 6 && hour < 12) {
        timeContext = 'morning';
      } else if (hour >= 12 && hour < 18) {
        timeContext = 'afternoon';
      } else {
        timeContext = 'evening';
      }
      
      setCurrentTimeContext(timeContext);

      // Load today's energy level
      const today = new Date().toISOString().split('T')[0];
      const energyLogData = await AsyncStorage.getItem('dailyEnergyLog');
      
      let currentEnergyLevel = 3; // Default to neutral
      
      if (energyLogData) {
        const logs: EnergyLog[] = JSON.parse(energyLogData);
        const todayLog = logs.find(log => log.date === today);
        
        if (todayLog) {
          currentEnergyLevel = todayLog.energy;
        } else {
          // Use historical data to predict energy level based on time
          currentEnergyLevel = await predictEnergyLevel(logs, timeContext);
        }
      }
      
      setTodayEnergyLevel(currentEnergyLevel);
      
      // Generate smart suggestions
      const suggestions = generateSmartSuggestions(tasks, currentEnergyLevel, timeContext);
      setSuggestedTasks(suggestions);
      
    } catch (error) {
      console.error('Error loading energy and generating suggestions:', error);
    }
  };

  const predictEnergyLevel = async (logs: EnergyLog[], timeContext: 'morning' | 'afternoon' | 'evening'): Promise<number> => {
    if (logs.length === 0) return 3;

    // Get energy patterns for the current time context
    const dayOfWeek = new Date().getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Filter logs for similar time contexts (simplified prediction)
    const recentLogs = logs.slice(-14); // Last 2 weeks
    
    if (recentLogs.length === 0) return 3;
    
    // Simple average with time-based adjustments
    const avgEnergy = recentLogs.reduce((sum, log) => sum + log.energy, 0) / recentLogs.length;
    
    // Adjust based on time context and day type
    let adjustedEnergy = avgEnergy;
    
    if (timeContext === 'morning') {
      adjustedEnergy += isWeekend ? 0.5 : 0.3; // Higher energy in mornings
    } else if (timeContext === 'evening') {
      adjustedEnergy -= 0.5; // Lower energy in evenings
    }
    
    return Math.max(1, Math.min(5, Math.round(adjustedEnergy)));
  };

  const generateSmartSuggestions = (tasks: Task[], energyLevel: number, timeContext: 'morning' | 'afternoon' | 'evening'): Task[] => {
    const incompleteTasks = tasks.filter(task => !task.completed);
    
    if (incompleteTasks.length === 0) return [];
    
    // Score tasks based on energy level and time context
    const scoredTasks = incompleteTasks.map(task => {
      let score = 0;
      
      // Base score from priority
      if (task.priority === 'high') score += 3;
      else if (task.priority === 'medium') score += 2;
      else score += 1;
      
      // Score based on focus type match with energy level
      if (task.focusType) {
        switch (task.focusType) {
          case 'deep-focus':
            if (energyLevel >= 4) score += 3;
            else if (energyLevel === 3) score += 1;
            else score -= 1;
            break;
          case 'creative':
            if (energyLevel >= 3) score += 2;
            else score -= 1;
            break;
          case 'administrative':
            if (energyLevel >= 2) score += 1;
            break;
          case 'low-energy':
            if (energyLevel <= 2) score += 3;
            else if (energyLevel === 3) score += 1;
            break;
        }
      }
      
      // Time context bonuses
      if (timeContext === 'morning') {
        if (task.focusType === 'deep-focus') score += 2;
        if (task.focusType === 'creative') score += 1;
      } else if (timeContext === 'afternoon') {
        if (task.focusType === 'administrative') score += 1;
      } else if (timeContext === 'evening') {
        if (task.focusType === 'low-energy') score += 2;
        if (task.focusType === 'administrative') score += 1;
      }
      
      // Deadline urgency
      if (task.deadline) {
        const deadlineDate = new Date(task.deadline);
        const today = new Date();
        const daysUntilDeadline = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilDeadline <= 1) score += 4;
        else if (daysUntilDeadline <= 3) score += 2;
        else if (daysUntilDeadline <= 7) score += 1;
      }
      
      return { task, score };
    });
    
    // Sort by score (highest first) and return top 5
    return scoredTasks
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => item.task);
  };

  const getEnergyLevelText = (level: number): string => {
    switch (level) {
      case 1: return 'Very Low';
      case 2: return 'Low';
      case 3: return 'Neutral';
      case 4: return 'High';
      case 5: return 'Very High';
      default: return 'Unknown';
    }
  };

  const getEnergyEmoji = (level: number): string => {
    switch (level) {
      case 1: return '😴';
      case 2: return '😔';
      case 3: return '😐';
      case 4: return '😊';
      case 5: return '🚀';
      default: return '❓';
    }
  };

  const getTimeContextText = (context: 'morning' | 'afternoon' | 'evening'): string => {
    switch (context) {
      case 'morning': return 'Morning';
      case 'afternoon': return 'Afternoon';
      case 'evening': return 'Evening';
      default: return 'Unknown';
    }
  };

  if (suggestedTasks.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.title}>🤖 Smart Task Suggestions</ThemedText>
        <ThemedText style={styles.emptyText}>
          No tasks available for suggestions. Add some tasks to get personalized recommendations!
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>🤖 Smart Task Suggestions</ThemedText>
      
      <View style={styles.contextInfo}>
        <View style={styles.contextItem}>
          <ThemedText style={styles.contextLabel}>Energy Level:</ThemedText>
          <View style={styles.energyDisplay}>
            <ThemedText style={styles.energyEmoji}>{getEnergyEmoji(todayEnergyLevel)}</ThemedText>
            <ThemedText style={styles.energyText}>{getEnergyLevelText(todayEnergyLevel)}</ThemedText>
          </View>
        </View>
        
        <View style={styles.contextItem}>
          <ThemedText style={styles.contextLabel}>Time Context:</ThemedText>
          <ThemedText style={styles.timeText}>{getTimeContextText(currentTimeContext)}</ThemedText>
        </View>
      </View>

      <ThemedText style={styles.subtitle}>
        Based on your energy level and time of day, here are the best tasks for you right now:
      </ThemedText>

      <ScrollView style={styles.tasksList} showsVerticalScrollIndicator={false}>
        {suggestedTasks.map((task, index) => (
          <TouchableOpacity
            key={task.id}
            style={styles.taskItem}
            onPress={() => onTaskSelect(task)}
          >
            <View style={styles.taskRank}>
              <ThemedText style={styles.rankNumber}>{index + 1}</ThemedText>
            </View>
            
            <View style={styles.taskContent}>
              <ThemedText style={styles.taskTitle}>{task.title}</ThemedText>
              
              <View style={styles.taskMeta}>
                {task.focusType && (
                  <View style={styles.focusTypeTag}>
                    <ThemedText style={styles.focusTypeText}>
                      {task.focusType === 'deep-focus' ? '🧠 Deep Focus' :
                       task.focusType === 'creative' ? '🎨 Creative' :
                       task.focusType === 'administrative' ? '📋 Admin' :
                       '😴 Low Energy'}
                    </ThemedText>
                  </View>
                )}
                
                {task.priority && (
                  <View style={[styles.priorityTag, {
                    backgroundColor: task.priority === 'high' ? '#ffebee' : 
                                   task.priority === 'medium' ? '#fff3e0' : '#e8f5e8'
                  }]}>
                    <ThemedText style={[styles.priorityText, {
                      color: task.priority === 'high' ? '#e74c3c' : 
                             task.priority === 'medium' ? '#f39c12' : '#27ae60'
                    }]}>
                      {task.priority}
                    </ThemedText>
                  </View>
                )}
              </View>

              {task.deadline && (
                <ThemedText style={styles.deadline}>
                  📅 Due: {new Date(task.deadline).toLocaleDateString()}
                </ThemedText>
              )}
            </View>
            
            <View style={styles.selectButton}>
              <ThemedText style={styles.selectButtonText}>+</ThemedText>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  contextInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  contextItem: {
    alignItems: 'center',
  },
  contextLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  energyDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  energyEmoji: {
    fontSize: 16,
  },
  energyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196f3',
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  tasksList: {
    maxHeight: 300,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  taskRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2196f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  taskMeta: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  focusTypeTag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  focusTypeText: {
    fontSize: 10,
    color: '#2196f3',
    fontWeight: '600',
  },
  priorityTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  deadline: {
    fontSize: 11,
    color: '#666',
  },
  selectButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#00b894',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 20,
    lineHeight: 20,
  },
});
