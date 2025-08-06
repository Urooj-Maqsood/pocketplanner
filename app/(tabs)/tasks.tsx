import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useFocusEffect } from '@react-navigation/native';
import NotificationSettingsModal from '@/components/NotificationSettings';
import {
  initializeNotifications,
  scheduleTaskNotifications,
  cancelTaskNotifications,
  getNotificationSettings,
  cleanupExpiredNotifications,
  sendTaskCompletionNotification,
} from '@/services/notificationService';
import SmartTaskSuggestions from '@/components/SmartTaskSuggestions';
import VoiceAssistant from '@/components/VoiceAssistant';
import ImageTaskLogger from '@/components/ImageTaskLogger';
import MicroCommitmentModal from '@/components/MicroCommitmentModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Task {
  id: string;
  title: string;
  completed: boolean;
  date: string;
  priority?: 'high' | 'medium' | 'low';
  deadline?: string;
  importance?: number; // 1-5 scale
  urgency?: number; // 1-5 scale
  estimatedDuration?: number; // in minutes
  focusType?: 'deep-focus' | 'creative' | 'administrative' | 'low-energy';
  linkedToTaskId?: string; // For micro-tasks
  isMicroTask?: boolean;
  hasMicroTaskActive?: boolean; // For parent tasks
}

interface TimeBlock {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  date: string;
  linkedTaskId?: string; // Optional linked task ID
  linkedTaskTitle?: string; // Store task title for display
}

export default function TasksScreen() {
  // Initialize today at the very beginning - use consistent YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newTaskImportance, setNewTaskImportance] = useState(3);
  const [newTaskUrgency, setNewTaskUrgency] = useState(3);
  const [newTaskFocusType, setNewTaskFocusType] = useState<'deep-focus' | 'creative' | 'administrative' | 'low-energy'>('administrative');

  // Auto-update priority based on Eisenhower Matrix when importance or urgency changes
  useEffect(() => {
    const calculatedPriority = calculateTaskPriority({ importance: newTaskImportance, urgency: newTaskUrgency } as Task);
    setNewTaskPriority(calculatedPriority);
  }, [newTaskImportance, newTaskUrgency]);

  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [showTimeBlockModal, setShowTimeBlockModal] = useState(false);
  const [newTimeBlock, setNewTimeBlock] = useState({
    title: '',
    startTime: '',
    endTime: '',
    date: new Date().toISOString().split('T')[0], // Always use proper YYYY-MM-DD format
    linkedTaskId: '',
  });
  const [breakdownTasks, setBreakdownTasks] = useState<any[]>([]);
  const [showBreakdownTasks, setShowBreakdownTasks] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [showSmartSuggestions, setShowSmartSuggestions] = useState(false);
  const [suggestedDeadline, setSuggestedDeadline] = useState('');
  const [showOverloadWarning, setShowOverloadWarning] = useState(false);
  const [taskHistory, setTaskHistory] = useState<Task[]>([]);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [notificationReminderMinutes, setNotificationReminderMinutes] = useState(15);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showMicroCommitmentModal, setShowMicroCommitmentModal] = useState(false);
  const [selectedTaskForMicro, setSelectedTaskForMicro] = useState<Task | null>(null);
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);
  const [showImageTaskLogger, setShowImageTaskLogger] = useState(false);
  const [refreshing, setRefreshing] = useState(false);


  // Smart Prioritization Helper Functions
  const analyzeTaskHistory = async () => {
    try {
      const tasksData = await AsyncStorage.getItem('tasks');
      if (tasksData) {
        const allTasks = JSON.parse(tasksData);
        const completedTasks = allTasks.filter((task: Task) => task.completed);
        setTaskHistory(completedTasks);
        return completedTasks;
      }
      return [];
    } catch (error) {
      console.error('Error analyzing task history:', error);
      return [];
    }
  };

  const suggestSmartDeadline = (taskTitle: string) => {
    if (taskHistory.length === 0) {
      // Default suggestion for new users
      const defaultDeadline = new Date();
      defaultDeadline.setDate(defaultDeadline.getDate() + 3);
      return defaultDeadline.toISOString().split('T')[0];
    }

    // Analyze similar tasks and completion patterns
    const similarTasks = taskHistory.filter(task => 
      task.title.toLowerCase().includes(taskTitle.toLowerCase().split(' ')[0]) ||
      taskTitle.toLowerCase().includes(task.title.toLowerCase().split(' ')[0])
    );

    if (similarTasks.length > 0) {
      // Calculate average completion time for similar tasks
      const avgDays = similarTasks.reduce((acc, task) => {
        const taskDate = new Date(task.date);
        const completionDate = new Date(); // Assuming completed today for simplicity
        return acc + Math.abs(completionDate.getTime() - taskDate.getTime()) / (1000 * 60 * 60 * 24);
      }, 0) / similarTasks.length;

      const suggestedDate = new Date();
      suggestedDate.setDate(suggestedDate.getDate() + Math.ceil(avgDays));
      return suggestedDate.toISOString().split('T')[0];
    }

    // Default fallback
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 2);
    return defaultDate.toISOString().split('T')[0];
  };

  const calculateTaskPriority = (task: Task): 'high' | 'medium' | 'low' => {
    const importance = task.importance || 3;
    const urgency = task.urgency || 3;

    // Eisenhower Matrix logic
    if (urgency >= 4 && importance >= 4) return 'high';
    if (urgency >= 3 && importance >= 3) return 'medium';
    return 'low';
  };

  const sortTasksByPriority = (tasksToSort: Task[]) => {
    return tasksToSort.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const aPriority = calculateTaskPriority(a);
      const bPriority = calculateTaskPriority(b);
      return priorityOrder[bPriority] - priorityOrder[aPriority];
    });
  };

  const checkForOverload = (tasks: Task[]) => {
    const todayTasks = tasks.filter(task => task.date === today);
    const highPriorityTasks = todayTasks.filter(task => calculateTaskPriority(task) === 'high');

    if (highPriorityTasks.length > 5) {
      setShowOverloadWarning(true);
    } else {
      setShowOverloadWarning(false);
    }
  };

  const loadTasks = async () => {
    try {
      // Load tasks with error handling - prioritize this to reduce loading time
      try {
        const tasksData = await AsyncStorage.getItem('tasks');
        if (tasksData) {
          const allTasks = JSON.parse(tasksData);
          const todayTasks = allTasks.filter((task: Task) => {
            // Convert task.date to YYYY-MM-DD format if it's in a different format
            let taskDate = task.date;
            if (taskDate && taskDate.includes(' ')) {
              // If task.date is in toDateString() format, convert to YYYY-MM-DD
              taskDate = new Date(task.date).toISOString().split('T')[0];
            }
            return taskDate === today;
          });
          const sortedTasks = sortTasksByPriority(todayTasks);
          setTasks(sortedTasks);
          checkForOverload(sortedTasks);
        }
      } catch (taskError) {
        console.log('Error loading tasks, starting fresh');
        setTasks([]);
      }

      // Load time blocks with error handling
      try {
        const timeBlocksData = await AsyncStorage.getItem('timeBlocks');
        if (timeBlocksData) {
          const allTimeBlocks = JSON.parse(timeBlocksData);
          const todayBlocks = allTimeBlocks.filter((block: TimeBlock) => {
            // Ensure consistent date format comparison
            let blockDate = block.date;
            if (blockDate && blockDate.includes(' ')) {
              // If block.date is in toDateString() format, convert to YYYY-MM-DD
              blockDate = new Date(block.date).toISOString().split('T')[0];
            }
            return blockDate === today;
          });
          setTimeBlocks(todayBlocks);
        }
      } catch (timeBlockError) {
        console.log('Error loading time blocks, starting fresh');
        setTimeBlocks([]);
      }

      // Load notification settings asynchronously to avoid blocking
      setTimeout(async () => {
        try {
          const enabledState = await AsyncStorage.getItem('notifications_enabled');
          const isEnabled = enabledState === 'true';
          setNotificationsEnabled(isEnabled);

          if (isEnabled) {
            try {
              await initializeNotifications();
              const settings = await getNotificationSettings();
              setNotificationReminderMinutes(settings.preStartMinutes);
              await cleanupExpiredNotifications();
            } catch (notificationError) {
              console.log('Notification setup failed');
            }
          }
        } catch (notificationError) {
          console.log('Notifications not available');
          setNotificationsEnabled(false);
        }
      }, 100);

      // Analyze task history asynchronously
      setTimeout(() => {
        analyzeTaskHistory().catch(() => console.log('Task history analysis failed'));
      }, 200);

    } catch (error) {
      console.log('Error during initialization, but app will continue to work');
    }
  };

  const loadTimeBlocks = async () => {
    try {
      const timeBlocksData = await AsyncStorage.getItem('timeBlocks');
      if (timeBlocksData) {
        const allTimeBlocks = JSON.parse(timeBlocksData);
        const todayBlocksList = allTimeBlocks.filter((block: TimeBlock) => {
          // Ensure consistent date format comparison
          let blockDate = block.date;
          if (blockDate.includes(' ')) {
            // If block.date is in toDateString() format, convert to YYYY-MM-DD
            blockDate = new Date(block.date).toISOString().split('T')[0];
          }
          return blockDate === today;
        });
        setTimeBlocks(todayBlocksList);
      }
    } catch (error) {
      console.error('Error loading time blocks:', error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadTasks();
      loadTimeBlocks();
    }, [])
  );

    const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTasks().then(() => setRefreshing(false));
  }, []);

  const addTask = async () => {
    if (newTaskTitle.trim() === '') return;

    // Use provided deadline or generate smart suggestion
    const finalDeadline = newTaskDeadline || suggestSmartDeadline(newTaskTitle.trim());
    if (!newTaskDeadline) {
      setSuggestedDeadline(finalDeadline);
    }

    const newTask: Task = {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
      completed: false,
      date: today,
      priority: newTaskPriority,
      deadline: finalDeadline,
      importance: newTaskImportance,
      urgency: newTaskUrgency,
      focusType: newTaskFocusType,
    };

    try {
      const tasksData = await AsyncStorage.getItem('tasks');
      const allTasks = tasksData ? JSON.parse(tasksData) : [];
      allTasks.push(newTask);
      await AsyncStorage.setItem('tasks', JSON.stringify(allTasks));

      const updatedTasks = sortTasksByPriority([...tasks, newTask]);
      setTasks(updatedTasks);
      checkForOverload(updatedTasks);

      // Schedule notifications if enabled and deadline is set
      if (notificationsEnabled && finalDeadline) {
        try {
          const deadlineDate = new Date(finalDeadline);
          const now = new Date();

          if (deadlineDate > now) {
            await scheduleTaskNotifications(
              newTask.id,
              newTask.title,
              deadlineDate,
              notificationReminderMinutes,
              undefined // No estimated duration
            );

            Alert.alert(
              'Task Added',
              `Task "${newTask.title}" has been added with notifications scheduled.`,
              [{ text: 'OK', style: 'default' }]
            );
          }
        } catch (notificationError) {
          console.log('Notification scheduling failed, but task was created successfully');
          // Don't show error to user since task was created successfully
        }
      }

      // Reset form fields
      setNewTaskTitle('');
      setNewTaskDeadline('');
      setNewTaskPriority('medium');
      setNewTaskImportance(3);
      setNewTaskUrgency(3);
      setNewTaskFocusType('administrative');
      setShowAdvancedOptions(false);


      if (!newTaskDeadline) {
        setShowSmartSuggestions(true);
      }

      // Auto-hide suggestions after 3 seconds
      setTimeout(() => setShowSmartSuggestions(false), 3000);
    } catch (error) {
      console.error('Error adding task:', error);
      Alert.alert('Error', 'Failed to add task');
    }
  };

  const toggleTask = async (taskId: string) => {
    try {
      const taskToToggle = tasks.find(task => task.id === taskId);
      if (!taskToToggle) return;

      const updatedTasks = tasks.map(task =>
        task.id === taskId ? { 
          ...task, 
          completed: !task.completed,
          completedAt: !task.completed ? new Date().toISOString() : undefined
        } : task
      );

      setTasks(updatedTasks);
      await AsyncStorage.setItem('tasks', JSON.stringify(updatedTasks));

      // Show completion notification and send push notification
      if (!taskToToggle.completed) {
        // Show alert
        Alert.alert(
          '✅ Task Completed!',
          `Great job! You've completed "${taskToToggle.title}"`,
          [{ text: 'Nice!', style: 'default' }]
        );

        // Send push notification if notifications are enabled
        if (notificationsEnabled) {
          try {
            await sendTaskCompletionNotification(taskToToggle.title, taskId);
          } catch (notificationError) {
            console.log('Task completion notification failed:', notificationError);
          }
        }
      }

      loadTasks(); // Refresh the view
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  };

  const handleMicroCommitmentOffer = (task: Task) => {
    setSelectedTaskForMicro(task);
    setShowMicroCommitmentModal(true);
  };

  const handleTaskCreated = (newTask: any) => {
    // Reload tasks to show the newly created task
    loadTasks();
  };

  const handleTaskCompleted = (taskId: string) => {
    // Toggle the task completion
    toggleTask(taskId);
  };

  const handleMicroTaskCreated = (microTask: Task) => {
    // Reload tasks to show the new micro-task
    loadTasks();

    // Show success toast
    setTimeout(() => {
      Alert.alert(
        '🎯 Micro-Step Ready!',
        `Your micro-step "${microTask.title}" is scheduled for tomorrow. Small progress is still progress!`,
        [{ text: 'Great!', style: 'default' }]
      );
    }, 500);
  };

  const deleteTask = async (taskId: string) => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Cancel notifications for this task
              try {
                await cancelTaskNotifications(taskId);
              } catch (notificationError) {
                console.log('Notification cancellation failed, continuing with delete');
              }

              // Get all tasks from storage
              const tasksData = await AsyncStorage.getItem('tasks');
              const allTasks = tasksData ? JSON.parse(tasksData) : [];

              // Filter out the task to delete from all tasks
              const updatedAllTasks = allTasks.filter((task: Task) => task.id !== taskId);

              // Save updated tasks back to storage
              await AsyncStorage.setItem('tasks', JSON.stringify(updatedAllTasks));

              // Update local state immediately
              const updatedLocalTasks = tasks.filter(task => task.id !== taskId);
              setTasks(updatedLocalTasks);

              Alert.alert('Success', 'Task deleted successfully!');
            } catch (error) {
              console.error('Error deleting task:', error);
              Alert.alert('Error', 'Failed to delete task. Please try again.');
            }
          },
        },
      ]
    );
  };

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setEditTaskTitle(task.title);
    setShowEditModal(true);
  };

  const saveEditTask = async () => {
    if (!editingTask || editTaskTitle.trim() === '') return;

    try {
      const tasksData = await AsyncStorage.getItem('tasks');
      const allTasks = tasksData ? JSON.parse(tasksData) : [];

      const updatedTasks = allTasks.map((task: Task) => 
        task.id === editingTask.id ? { ...task, title: editTaskTitle.trim() } : task
      );

      await AsyncStorage.setItem('tasks', JSON.stringify(updatedTasks));

      setTasks(prev => prev.map(task => 
        task.id === editingTask.id ? { ...task, title: editTaskTitle.trim() } : task
      ));

      setShowEditModal(false);
      setEditingTask(null);
      setEditTaskTitle('');
    } catch (error) {
      console.error('Error editing task:', error);
      Alert.alert('Error', 'Failed to edit task');
    }
  };

  const addTimeBlock = async () => {
    if (!newTimeBlock.title || !newTimeBlock.startTime || !newTimeBlock.endTime) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Validate time format
    const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i;
    if (!timeRegex.test(newTimeBlock.startTime.trim()) || !timeRegex.test(newTimeBlock.endTime.trim())) {
      Alert.alert('Error', 'Please enter valid time format (e.g., 9:30 AM)');
      return;
    }

    try {
      const timeBlock: TimeBlock = {
        id: Date.now().toString(),
        title: newTimeBlock.title,
        startTime: newTimeBlock.startTime.trim(),
        endTime: newTimeBlock.endTime.trim(),
        date: newTimeBlock.date,
        linkedTaskId: newTimeBlock.linkedTaskId,
        linkedTaskTitle: newTimeBlock.linkedTaskId 
          ? tasks.find(task => task.id === newTimeBlock.linkedTaskId)?.title || ''
          : undefined,
      };

      const timeBlocksData = await AsyncStorage.getItem('timeBlocks');
      const existingBlocks = timeBlocksData ? JSON.parse(timeBlocksData) : [];
      const updatedBlocks = [...existingBlocks, timeBlock];
      await AsyncStorage.setItem('timeBlocks', JSON.stringify(updatedBlocks));

      const linkedTaskTitle = timeBlock.linkedTaskTitle;
      const formattedDate = new Date(newTimeBlock.date).toDateString();

      // Force refresh of time blocks
      await loadTimeBlocks();

      // Update current display if the time block is for today
      if (formattedDate === today) {
        setTimeBlocks(prev => [...prev, timeBlock]);
      }

      setNewTimeBlock({ title: '', startTime: '', endTime: '', date: new Date().toISOString().split('T')[0], linkedTaskId: '' });
      setShowTimeBlockModal(false);

      Alert.alert('Success', `Time block created${linkedTaskTitle ? ` and linked to task: ${linkedTaskTitle}` : ''}`);
    } catch (error) {
      console.error('Error adding time block:', error);
      Alert.alert('Error', 'Failed to add time block');
    }
  };

  const deleteTimeBlock = async (blockId: string) => {
    Alert.alert(
      'Delete Time Block',
      'Are you sure you want to delete this time block?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const timeBlocksData = await AsyncStorage.getItem('timeBlocks');
              const allTimeBlocks = timeBlocksData ? JSON.parse(timeBlocksData) : [];
              const updatedBlocks = allTimeBlocks.filter((block: TimeBlock) => block.id !== blockId);
              await AsyncStorage.setItem('timeBlocks', JSON.stringify(updatedBlocks));
              setTimeBlocks(prev => prev.filter(block => block.id !== blockId));
            } catch (error) {
              console.error('Error deleting time block:', error);
            }
          },
        },
      ]
    );
  };

  const formatTimeForDisplay = (time: string) => {
    // If time already includes AM/PM, return as is
    if (time.toLowerCase().includes('am') || time.toLowerCase().includes('pm')) {
      return time;
    }

    // Otherwise, convert 24-hour to 12-hour format
    const [hours, minutes] = time.split(':');
    let period = 'AM';
    let formattedHours = parseInt(hours, 10);

    if (formattedHours >= 12) {
      period = 'PM';
      if (formattedHours > 12) {
        formattedHours -= 12;
      }
    }
    if (formattedHours === 0) {
      formattedHours = 12;
    }

    return `${formattedHours}:${minutes} ${period}`;
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={true}
      bounces={true}
    >
      <ThemedView style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <ThemedText type="title" style={styles.title}>Tasks & Planning</ThemedText>
            <ThemedText style={styles.date}>{new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'short', 
              day: 'numeric' 
            })}</ThemedText>
          </View>
          <TouchableOpacity 
            style={[
              styles.notificationButton,
              !notificationsEnabled && styles.notificationButtonDisabled
            ]}
            onPress={() => setShowNotificationSettings(true)}
          >
            {notificationsEnabled ? (
              <ThemedText style={styles.notificationButtonText}>🔔</ThemedText>
            ) : (
              <View style={styles.disabledBellContainer}>
                <ThemedText style={styles.notificationButtonText}>🔔</ThemedText>
                <View style={styles.redCutLine} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ThemedView>

      {showOverloadWarning && (
        <View style={styles.warningBanner}>
          <ThemedText style={styles.warningText}>
            ⚠️ You have many high-priority tasks today. Consider redistributing some to avoid overload.
          </ThemedText>
          <TouchableOpacity onPress={() => setShowOverloadWarning(false)}>
            <ThemedText style={styles.dismissText}>×</ThemedText>
          </TouchableOpacity>
        </View>
      )}

      {showSmartSuggestions && (
        <View style={styles.suggestionBanner}>
          <ThemedText style={styles.suggestionText}>
            🧠 Smart suggestion: Deadline set to {new Date(suggestedDeadline).toLocaleDateString()} based on your task history
          </ThemedText>
          <TouchableOpacity onPress={() => setShowSmartSuggestions(false)}>
            <ThemedText style={styles.dismissText}>×</ThemedText>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>Add New Task</ThemedText>

        {/* Task Title */}
        <View style={styles.inputGroup}>
          <ThemedText style={styles.inputLabel}>Task Title *</ThemedText>
          <TextInput
            style={styles.taskInput}
            placeholder="Enter task title..."
            value={newTaskTitle}
            onChangeText={setNewTaskTitle}
            placeholderTextColor="#999"
          />
        </View>

        {/* Deadline */}
        <View style={styles.inputGroup}>
          <ThemedText style={styles.inputLabel}>Deadline</ThemedText>
          <View style={styles.deadlineInputContainer}>
            <TextInput
              style={styles.deadlineInput}
              placeholder="2024-12-25"
              value={newTaskDeadline}
              onChangeText={(text) => {
                // Auto-format as user types
                let formatted = text.replace(/[^\d]/g, ''); // Remove non-digits
                if (formatted.length >= 4) {
                  formatted = formatted.substring(0, 4) + '-' + formatted.substring(4);
                }
                if (formatted.length >= 7) {
                  formatted = formatted.substring(0, 7) + '-' + formatted.substring(7);
                }
                if (formatted.length > 10) {
                  formatted = formatted.substring(0, 10);
                }
                setNewTaskDeadline(formatted);
              }}
              placeholderTextColor="#999"
              keyboardType="numeric"
              maxLength={10}
            />
            <ThemedText style={styles.dateFormatHint}>YYYY-MM-DD</ThemedText>
          </View>
          <ThemedText style={styles.dateExample}>
            Example: {new Date().getFullYear()}-{String(new Date().getMonth() + 1).padStart(2, '0')}-{String(new Date().getDate()).padStart(2, '0')} (Today)
          </ThemedText>
        </View>

        {/* Priority Selector */}
        <View style={styles.inputGroup}>
          <ThemedText style={styles.inputLabel}>
            Priority {showAdvancedOptions && <ThemedText style={styles.autoUpdatedText}>(Auto-updated by Eisenhower Matrix)</ThemedText>}
          </ThemedText>
          <View style={styles.prioritySelector}>
            <TouchableOpacity 
              style={[
                styles.priorityButton, 
                newTaskPriority === 'high' && styles.priorityButtonActive,
                showAdvancedOptions && styles.priorityButtonDisabled
              ]}
              onPress={() => !showAdvancedOptions && setNewTaskPriority('high')}
              disabled={showAdvancedOptions}
            >
              <View style={[styles.priorityDot, styles.priorityDotHigh]} />
              <ThemedText style={[styles.priorityButtonText, newTaskPriority === 'high' && styles.priorityButtonTextActive]}>
                High
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.priorityButton, 
                newTaskPriority === 'medium' && styles.priorityButtonActive,
                showAdvancedOptions && styles.priorityButtonDisabled
              ]}
              onPress={() => !showAdvancedOptions && setNewTaskPriority('medium')}
              disabled={showAdvancedOptions}
            >
              <View style={[styles.priorityDot, styles.priorityDotMedium]} />
              <ThemedText style={[styles.priorityButtonText, newTaskPriority === 'medium' && styles.priorityButtonTextActive]}>
                Medium
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.priorityButton, 
                newTaskPriority === 'low' && styles.priorityButtonActive,
                showAdvancedOptions && styles.priorityButtonDisabled
              ]}
              onPress={() => !showAdvancedOptions && setNewTaskPriority('low')}
              disabled={showAdvancedOptions}
            >
              <View style={[styles.priorityDot, styles.priorityDotLow]} />
              <ThemedText style={[styles.priorityButtonText, newTaskPriority === 'low' && styles.priorityButtonTextActive]}>
                Low
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Focus Type Selector */}
        <View style={styles.inputGroup}>
          <ThemedText style={styles.inputLabel}>Focus Type</ThemedText>
          <ThemedText style={styles.focusTypeDescription}>
            Choose the type of focus this task requires for better scheduling
          </ThemedText>
          <View style={styles.focusTypeSelector}>
            <TouchableOpacity 
              style={[
                styles.focusTypeButton, 
                newTaskFocusType === 'deep-focus' && styles.focusTypeButtonActive
              ]}
              onPress={() => setNewTaskFocusType('deep-focus')}
            >
              <ThemedText style={styles.focusTypeIcon}>🧠</ThemedText>
              <ThemedText style={[styles.focusTypeButtonText, newTaskFocusType === 'deep-focus' && styles.focusTypeButtonTextActive]}>
                Deep Focus
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.focusTypeButton, 
                newTaskFocusType === 'creative' && styles.focusTypeButtonActive
              ]}
              onPress={() => setNewTaskFocusType('creative')}
            >
              <ThemedText style={styles.focusTypeIcon}>🎨</ThemedText>
              <ThemedText style={[styles.focusTypeButtonText, newTaskFocusType === 'creative' && styles.focusTypeButtonTextActive]}>
                Creative
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.focusTypeButton, 
                newTaskFocusType === 'administrative' && styles.focusTypeButtonActive
              ]}
              onPress={() => setNewTaskFocusType('administrative')}
            >
              <ThemedText style={styles.focusTypeIcon}>📋</ThemedText>
              <ThemedText style={[styles.focusTypeButtonText, newTaskFocusType === 'administrative' && styles.focusTypeButtonTextActive]}>
                Admin
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.focusTypeButton, 
                newTaskFocusType === 'low-energy' && styles.focusTypeButtonActive
              ]}
              onPress={() => setNewTaskFocusType('low-energy')}
            >
              <ThemedText style={styles.focusTypeIcon}>😴</ThemedText>
              <ThemedText style={[styles.focusTypeButtonText, newTaskFocusType === 'low-energy' && styles.focusTypeButtonTextActive]}>
                Low Energy
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Advanced Options Toggle */}
        <TouchableOpacity 
          style={styles.advancedToggle}
          onPress={() => setShowAdvancedOptions(!showAdvancedOptions)}
        >
          <ThemedText style={styles.advancedToggleText}>
            {showAdvancedOptions ? '▼' : '▶'} Advanced Options (Eisenhower Matrix)
          </ThemedText>
        </TouchableOpacity>

        {/* Advanced Options */}
        {showAdvancedOptions && (
          <View style={styles.advancedOptions}>
            <ThemedText style={styles.matrixExplanation}>
              📊 The Eisenhower Matrix helps prioritize tasks based on importance and urgency
            </ThemedText>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Importance (1-5)</ThemedText>
              <ThemedText style={styles.scaleDescription}>How important is this task for your goals?</ThemedText>
              <View style={styles.scaleSelector}>
                {[1, 2, 3, 4, 5].map(value => (
                  <TouchableOpacity
                    key={value}
                    style={[styles.scaleButton, newTaskImportance === value && styles.scaleButtonActive]}
                    onPress={() => setNewTaskImportance(value)}
                  >
                    <ThemedText style={[styles.scaleButtonText, newTaskImportance === value && styles.scaleButtonTextActive]}>
                      {value}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Urgency (1-5)</ThemedText>
              <ThemedText style={styles.scaleDescription}>How time-sensitive is this task?</ThemedText>
              <View style={styles.scaleSelector}>
                {[1, 2, 3, 4, 5].map(value => (
                  <TouchableOpacity
                    key={value}
                    style={[styles.scaleButton,newTaskUrgency === value && styles.scaleButtonActive]}
                    onPress={() => setNewTaskUrgency(value)}                  >
                    <ThemedText style={[styles.scaleButtonText, newTaskUrgency === value && styles.scaleButtonTextActive]}>
                      {value}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Show calculated priority from Eisenhower Matrix */}
            <View style={styles.calculatedPriority}>
              <ThemedText style={styles.calculatedPriorityLabel}>
                📋 Eisenhower Matrix suggests: 
              </ThemedText>
              <View style={[styles.priorityBadge, styles[`priority${calculateTaskPriority({ importance: newTaskImportance, urgency: newTaskUrgency } as Task).charAt(0).toUpperCase() + calculateTaskPriority({ importance: newTaskImportance, urgency: newTaskUrgency } as Task).slice(1)}Badge`]]}>
                <ThemedText style={styles.priorityBadgeText}>
                  {calculateTaskPriority({ importance: newTaskImportance, urgency: newTaskUrgency } as Task).toUpperCase()}```python
 PRIORITY
                </ThemedText>
              </View>
            </View>
          </View>
        )}



        {/* Add Button */}
        <TouchableOpacity style={styles.addTaskButton} onPress={addTask}>
          <ThemedText style={styles.addTaskButtonText}>Add Task</ThemedText>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Today's Tasks</ThemedText>
          <TouchableOpacity
            style={styles.voiceButton}
            onPress={() => setShowVoiceAssistant(true)}
          >
            <ThemedText style={styles.voiceButtonText}>🎤 Voice</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.voiceButton, { backgroundColor: '#e17055' }]}
            onPress={() => setShowImageTaskLogger(true)}
          >
            <ThemedText style={styles.voiceButtonText}>📸 Image</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.breakdownButton}
            onPress={() => setShowBreakdownTasks(!showBreakdownTasks)}
          >
            <ThemedText style={styles.breakdownButtonText}>
              {showBreakdownTasks ? '🔽' : '▶️'} Breakdown ({breakdownTasks.length})
            </ThemedText>
          </TouchableOpacity>
        </View>
        {tasks.length === 0 ? (
          <ThemedText style={styles.emptyText}>No tasks yet. Add your first task above!</ThemedText>
        ) : (
          tasks.map(task => {
            const priority = task.priority || calculateTaskPriority(task);
            const priorityStyle = priority === 'high' ? styles.priorityHighTask :
                                priority === 'medium' ? styles.priorityMediumTask :
                                styles.priorityLowTask;

            // Check if this is a micro-task or has micro-tasks
            const isMicroTask = task.isMicroTask;
            const hasMicroTaskActive = task.hasMicroTaskActive;

            return (
              <View key={task.id} style={[
                styles.taskItem,
                priorityStyle,
                isMicroTask && styles.microTaskItem,
                hasMicroTaskActive && styles.parentTaskWithMicro
              ]}>
                <TouchableOpacity
                  style={styles.taskCheckbox}
                  onPress={() => toggleTask(task.id)}
                >
                  <View style={[styles.checkbox, task.completed && styles.checkboxCompleted]}>
                    {task.completed && <ThemedText style={styles.checkmark}>✓</ThemedText>}
                  </View>
                </TouchableOpacity>
                <View style={styles.taskContent}>
                  <View style={styles.taskTitleRow}>
                    {isMicroTask && <ThemedText style={styles.microTaskIcon}>🔁</ThemedText>}
                    <ThemedText style={[
                      styles.taskText,
                      task.completed && styles.taskTextCompleted,
                      isMicroTask && styles.microTaskText
                    ]}>
                      {task.title}
                    </ThemedText>
                  </View>

                  {isMicroTask && (
                    <ThemedText style={styles.microTaskLabel}>
                      💫 Micro-Step • Rolling over from larger task
                    </ThemedText>
                  )}

                  {hasMicroTaskActive && !task.completed && (
                    <ThemedText style={styles.parentTaskStatus}>
                      🔄 In Progress – Micro-Step Active
                    </ThemedText>
                  )}

                  {task.deadline && (
                    <ThemedText style={styles.taskDeadline}>
                      📅 Due: {new Date(task.deadline).toLocaleDateString()}
                    </ThemedText>
                  )}
                  <ThemedText style={[styles.taskPriority, { color: priority === 'high' ? '#e74c3c' : priority === 'medium' ? '#f39c12' : '#27ae60' }]}>
                    {priority === 'high' ? '🔴 High Priority' :
                     priority === 'medium' ? '🟡 Medium Priority' : '🟢 Low Priority'}
                  </ThemedText>
                  {task.focusType && (
                    <ThemedText style={styles.taskFocusType}>
                      {task.focusType === 'deep-focus' ? '🧠 Deep Focus' :
                       task.focusType === 'creative' ? '🎨 Creative' :
                       task.focusType === 'administrative' ? '📋 Administrative' :
                       '😴 Low Energy'}
                    </ThemedText>
                  )}
                </View>
                <View style={styles.taskActions}>
                  {!isMicroTask && !task.completed && !hasMicroTaskActive && (
                    <TouchableOpacity
                      style={styles.microCommitmentButton}
                      onPress={() => handleMicroCommitmentOffer(task)}
                    >
                      <ThemedText style={styles.microCommitmentButtonText}>🔄</ThemedText>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => openEditTask(task)}
                  >
                    <ThemedText style={styles.editButtonText}>✎</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteTask(task.id)}
                  >
                    <ThemedText style={styles.deleteButtonText}>×</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Breakdown Tasks Section */}
        {showBreakdownTasks && (
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>🧩 Breakdown Tasks</ThemedText>
            {breakdownTasks.length === 0 ? (
              <ThemedText style={styles.emptyText}>No breakdown tasks yet</ThemedText>
            ) : (
              breakdownTasks.map((breakdown) => (
                <View key={breakdown.id} style={styles.breakdownCard}>
                  <ThemedText style={styles.breakdownTitle}>{breakdown.taskTitle}</ThemedText>
                  <ThemedText style={styles.breakdownDate}>
                    Created: {new Date(breakdown.createdAt).toLocaleDateString()}
                  </ThemedText>
                  {breakdown.steps.map((step: string, index: number) => (
                    <ThemedText key={index} style={styles.breakdownStep}>
                      {index + 1}. {step}
                    </ThemedText>
                  ))}
                </View>
              ))
            )}
          </View>
        )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Time Blocks</ThemedText>
          <TouchableOpacity
            style={styles.addTimeBlockButton}
            onPress={() => setShowTimeBlockModal(true)}
          >
            <ThemedText style={styles.addTimeBlockButtonText}>+ Add Block</ThemedText>
          </TouchableOpacity>
        </View>

        {timeBlocks.length === 0 ? (
          <ThemedText style={styles.emptyText}>No time blocks scheduled. Add one to get started!</ThemedText>
        ) : (
          timeBlocks.map(block => (
            <View key={block.id} style={[styles.timeBlockItem, block.linkedTaskId && styles.timeBlockLinked]}>
              <View style={styles.timeBlockInfo}>
                <View style={styles.timeBlockHeader}>
                  <ThemedText style={styles.timeBlockTime}>
                    {formatTimeForDisplay(block.startTime)} - {formatTimeForDisplay(block.endTime)}
                  </ThemedText>
                  <ThemedText style={styles.timeBlockDate}>
                    📅 {new Date(block.date).toLocaleDateString()}
                  </ThemedText>
                </View>
                <ThemedText style={styles.timeBlockTitle}>{block.title}</ThemedText>
                {block.linkedTaskId && block.linkedTaskTitle && (
                  <View style={styles.linkedTaskInfo}>
                    <ThemedText style={styles.linkedTaskLabel}>🔗 Linked Task:</ThemedText>
                    <ThemedText style={styles.linkedTaskTitle}>{block.linkedTaskTitle}</ThemedText>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteTimeBlock(block.id)}
              >
                <ThemedText style={styles.deleteButtonText}>×</ThemedText>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <Modal
        visible={showTimeBlockModal}
        transparent={true}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
          >
            <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" style={styles.modalTitle}>Add Time Block</ThemedText>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setShowTimeBlockModal(false);
                  setNewTimeBlock({
                    title: '',
                    startTime: '',
                    endTime: '',
                    date: new Date().toISOString().split('T')[0],
                    linkedTaskId: ''
                  });
                }}
              >
                <ThemedText style={styles.modalCloseButtonText}>✕</ThemedText>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollContent}
              contentContainerStyle={styles.modalScrollContainer}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              bounces={true}
            >
              <SmartTaskSuggestions
                tasks={tasks}
                onTaskSelect={(task) => {
                  setNewTimeBlock(prev => ({
                    ...prev,
                    linkedTaskId: task.id,
                    title: task.title
                  }));
                }}
              />

            <View style={styles.taskSelectionSection}>
              <ThemedText style={styles.taskLinkLabel}>Select Task (Optional)</ThemedText>
              <TouchableOpacity
                style={styles.taskDropdown}
                onPress={() => {
                  const taskOptions = ['Custom Time Block', ...tasks.map(task => task.title)];

                  Alert.alert(
                    'Select Task',
                    'Choose a task to schedule or create a custom time block:',
                    [
                      ...taskOptions.map((taskTitle, index) => ({
                        text: taskTitle,
                        onPress: () => {
                          if (index === 0) {
                            // "Custom Time Block" option selected
                            setNewTimeBlock(prev => ({
                              ...prev,
                              linkedTaskId: '',
                              title: prev.title || 'Custom Time Block'
                            }));
                          } else {
                            // Task selected
                            const selectedTask = tasks[index - 1];
                            setNewTimeBlock(prev => ({
                              ...prev,
                              linkedTaskId: selectedTask.id,
                              title: selectedTask.title
                            }));
                          }
                        }
                      })),
                      {
                        text: 'Cancel',
                        style: 'cancel'
                      }
                    ]
                  );
                }}
              >
                <ThemedText style={styles.taskDropdownText}>
                  {newTimeBlock.linkedTaskId
                    ? `📋 ${tasks.find(task => task.id === newTimeBlock.linkedTaskId)?.title || 'Select Task'}`
                    : '➕ Select Task or Create Custom'}
                </ThemedText>
                <ThemedText style={styles.dropdownArrow}>▼</ThemedText>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Time block title..."
              value={newTimeBlock.title}
              onChangeText={(text) => setNewTimeBlock(prev => ({ ...prev, title: text }))}
              placeholderTextColor="#999"
            />

            <View style={styles.dateInputContainer}>
              <TextInput
                style={styles.dateInput}
                placeholder={`Date (e.g., ${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')})`}
                value={newTimeBlock.date}
                onChangeText={(text) => {
                  // Auto-format as user types
                  let formatted = text.replace(/[^\d]/g, ''); // Remove non-digits
                  if (formatted.length >= 4) {
                    formatted = formatted.substring(0, 4) + '-' + formatted.substring(4);
                  }
                  if (formatted.length >= 7) {
                    formatted = formatted.substring(0, 7) + '-' + formatted.substring(7);
                  }
                  if (formatted.length > 10) {
                    formatted = formatted.substring(0, 10);
                  }
                  setNewTimeBlock(prev => ({ ...prev, date: formatted }));
                }}
                placeholderTextColor="#999"
                keyboardType="numeric"
                maxLength={10}
              />
              <TouchableOpacity
                style={styles.todayButton}
                onPress={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setNewTimeBlock(prev => ({ ...prev, date: today }));
                }}
              >
                <ThemedText style={styles.todayButtonText}>Today</ThemedText>
              </TouchableOpacity>
            </View>
            <ThemedText style={styles.dateHint}>
              Format: YYYY-MM-DD (Year-Month-Day)
            </ThemedText>

            <View style={styles.timeInputContainer}>
              <ThemedText style={styles.timeInputLabel}>Start Time</ThemedText>
              <View style={styles.timeInputRow}>
                <TextInput
                  style={styles.timeInput}
                  placeholder="09:00"
                  value={newTimeBlock.startTime.replace(/ (AM|PM)/i, '')}
                  onChangeText={(text) => {
                    // Auto-format time input (HH:MM)
                    let formatted = text.replace(/[^\d]/g, '');
                    if (formatted.length >= 2) {
                      formatted = formatted.substring(0, 2) + ':' + formatted.substring(2);
                    }
                    if (formatted.length > 5) {
                      formatted = formatted.substring(0, 5);
                    }

                    const currentPeriod = newTimeBlock.startTime.match(/(AM|PM)/i)?.[0] || 'AM';
                    setNewTimeBlock(prev => ({
                      ...prev,
                      startTime: formatted + (formatted ? ` ${currentPeriod}` : '')
                    }));
                  }}
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  maxLength={5}
                />
                <View style={styles.amPmSelector}>
                  <TouchableOpacity
                    style={[
                      styles.amPmButton,
                      newTimeBlock.startTime.includes('AM') && styles.amPmButtonActive
                    ]}
                    onPress={() => {
                      const timeOnly = newTimeBlock.startTime.replace(/ (AM|PM)/i, '');
                      setNewTimeBlock(prev => ({
                        ...prev,
                        startTime: timeOnly + (timeOnly ? ' AM' : '')
                      }));
                    }}
                  >
                    <ThemedText style={[
                      styles.amPmButtonText,
                      newTimeBlock.startTime.includes('AM') && styles.amPmButtonTextActive
                    ]}>AM</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.amPmButton,
                      newTimeBlock.startTime.includes('PM') && styles.amPmButtonActive
                    ]}
                    onPress={() => {
                      const timeOnly = newTimeBlock.startTime.replace(/ (AM|PM)/i, '');
                      setNewTimeBlock(prev => ({
                        ...prev,
                        startTime: timeOnly + (timeOnly ? ' PM' : '')
                      }));
                    }}
                  >
                    <ThemedText style={[
                      styles.amPmButtonText,
                      newTimeBlock.startTime.includes('PM') && styles.amPmButtonTextActive
                    ]}>PM</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
              <ThemedText style={styles.timeFormatHint}>Enter time in HH:MM format</ThemedText>
            </View>

            <View style={styles.timeInputContainer}>
              <ThemedText style={styles.timeInputLabel}>End Time</ThemedText>
              <View style={styles.timeInputRow}>
                <TextInput
                  style={styles.timeInput}
                  placeholder="10:30"
                  value={newTimeBlock.endTime.replace(/ (AM|PM)/i, '')}
                  onChangeText={(text) => {
                    // Auto-format time input (HH:MM)
                    let formatted = text.replace(/[^\d]/g, '');
                    if (formatted.length >= 2) {
                      formatted = formatted.substring(0, 2) + ':' + formatted.substring(2);
                    }
                    if (formatted.length > 5) {
                      formatted = formatted.substring(0, 5);
                    }

                    // Keep existing AM/PM or default to PM
                    const currentPeriod = newTimeBlock.endTime.match(/(AM|PM)/gi)?.[0] || 'PM';
                    setNewTimeBlock(prev => ({
                      ...prev,
                      endTime: formatted ? formatted + ' ' + currentPeriod : ''
                    }));
                  }}
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  maxLength={5}
                />
                <View style={styles.amPmSelector}>
                  <TouchableOpacity
                    style={[
                      styles.amPmButton,
                      newTimeBlock.endTime.includes('AM') && styles.amPmButtonActive
                    ]}
                    onPress={() => {
                      const timeOnly = newTimeBlock.endTime.replace(/ (AM|PM)/i, '');
                      setNewTimeBlock(prev => ({
                        ...prev,
                        endTime: timeOnly + (timeOnly ? ' AM' : '')
                      }));
                    }}
                  >
                    <ThemedText style={[
                      styles.amPmButtonText,
                      newTimeBlock.endTime.includes('AM') && styles.amPmButtonTextActive
                    ]}>AM</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.amPmButton,
                      newTimeBlock.endTime.includes('PM') && styles.amPmButtonActive
                    ]}
                    onPress={() => {
                      const timeOnly = newTimeBlock.endTime.replace(/ (AM|PM)/i, '');
                      setNewTimeBlock(prev => ({
                        ...prev,
                        endTime: timeOnly + (timeOnly ? ' PM' : '')
                      }));
                    }}
                  >
                    <ThemedText style={[
                      styles.amPmButtonText,
                      newTimeBlock.endTime.includes('PM') && styles.amPmButtonTextActive
                    ]}>PM</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
              <ThemedText style={styles.timeFormatHint}>Enter time in HH:MM format</ThemedText>
            </View>

            {newTimeBlock.linkedTaskId && (
              <View style={styles.linkedTaskIndicator}>
                <ThemedText style={styles.linkedTaskText}>
                  🔗 Linked to: {tasks.find(task => task.id === newTimeBlock.linkedTaskId)?.title}
                </ThemedText>
                <TouchableOpacity
                  style={styles.clearTaskLink}
                  onPress={() => setNewTimeBlock(prev => ({ ...prev, linkedTaskId: '', title: '' }))}
                >
                  <ThemedText style={styles.clearTaskLinkText}>✕ Clear</ThemedText>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowTimeBlockModal(false);
                  setNewTimeBlock({
                    title: '',
                    startTime: '',
                    endTime: '',
                    date: new Date().toISOString().split('T')[0],
                    linkedTaskId: ''
                  });
                }}
              >
                <ThemedText style={styles.modalCancelButtonText}>Cancel</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalAddButton}
                onPress={addTimeBlock}
              >
                <ThemedText style={styles.modalAddButtonText}>Add Block</ThemedText>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>Edit Task</ThemedText>

            <TextInput
              style={styles.modalInput}
              placeholder="Task title..."
              value={editTaskTitle}
              onChangeText={setEditTaskTitle}
              placeholderTextColor="#999"
              autoFocus={true}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowEditModal(false);
                  setEditingTask(null);
                  setEditTaskTitle('');
                }}
              >
                <ThemedText style={styles.modalCancelButtonText}>Cancel</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalAddButton}
                onPress={saveEditTask}
              >
                <ThemedText style={styles.modalAddButtonText}>Save</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <VoiceAssistant
          visible={showVoiceAssistant}
          onClose={() => setShowVoiceAssistant(false)}
          onTaskCreated={handleTaskCreated}
          onTaskCompleted={handleTaskCompleted}
        />

        <ImageTaskLogger
          visible={showImageTaskLogger}
          onClose={() => setShowImageTaskLogger(false)}
          onTaskCreated={(imageTask) => {
            // Refresh tasks to show newly created image task
            loadTasks();
            setShowImageTaskLogger(false);
          }}
        />

      {showNotificationSettings && (
        <NotificationSettingsModal
          visible={showNotificationSettings}
          onClose={() => {
            setShowNotificationSettings(false);
            // Refresh notification state when modal closes
            setTimeout(() => {
              loadTasks();
            }, 200);
          }}
        />
      )}

      <MicroCommitmentModal
        visible={showMicroCommitmentModal}
        onClose={() => setShowMicroCommitmentModal(false)}
        originalTask={selectedTaskForMicro}
        onMicroTaskCreated={handleMicroTaskCreated}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
    maxWidth: '100%',
    alignSelf: 'center',
    width: '100%',
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 16,
    paddingTop: 40,
    backgroundColor: '#00b894',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 8,
    paddingHorizontal: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 40,
    height: 40,
  },
  notificationButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    opacity: 0.8,
  },
  notificationButtonText: {
    fontSize: 18,
    lineHeight: 20,
    textAlign: 'center',
  },
  disabledBellContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
  },
  redCutLine: {
    position: 'absolute',
    width: 24,
    height: 3,
    backgroundColor: '#e74c3c',
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
    top: '50%',
    left: '50%',
    marginTop: -1.5,
    marginLeft: -12,
  },
  title: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  date: {
    color: '#b2fab4',
    fontSize: 14,
  },
  section: {
    marginHorizontal: 8,
    marginVertical: 8,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 100,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  taskInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#f8f9fa',
  },
  deadlineInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  deadlineInput: {
    flex: 1,
    padding: 12,
    fontSize: 15,
  },
  dateFormatHint: {
    fontSize: 10,
    color: '#6c5ce7',
    fontWeight: 'bold',
    paddingRight: 8,
    backgroundColor: '#e8e5ff',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginRight: 6,
  },
  dateExample: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  prioritySelector: {
    flexDirection: 'row',
    gap: 6,
  },
  priorityButton: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    flexDirection: 'row',
    gap: 4,
  },
  priorityButtonActive: {
    backgroundColor: '#00b894',
    borderColor: '#00b894',
  },
  priorityButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  priorityButtonTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 2,
  },
  priorityDotHigh: {
    backgroundColor: '#e74c3c',
  },
  priorityDotMedium: {
    backgroundColor: '#f39c12',
  },
  priorityDotLow: {
    backgroundColor: '#27ae60',
  },
  advancedToggle: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  advancedToggleText: {
    fontSize: 13,
    color: '#6c5ce7',
    fontWeight: '600',
  },
  advancedOptions: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  scaleSelector: {
    flexDirection: 'row',
    gap: 6,
  },
  scaleButton: {
    width: 36,
    height: 36,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scaleButtonActive: {
    backgroundColor: '#6c5ce7',
    borderColor: '#6c5ce7',
  },
  scaleButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },
  scaleButtonTextActive: {
    color: 'white',
  },
  addTaskButton: {
    backgroundColor: '#00b894',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  addTaskButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
  },
  addTimeBlockButton: {
    backgroundColor: '#6c5ce7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addTimeBlockButtonText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
    voiceButton: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  emptyText: {
    color: '#999',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  taskCheckbox: {
    marginRight: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCompleted: {
    backgroundColor: '#00b894',
    borderColor: '#00b894',
  },
  checkmark: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
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
  taskActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editButton: {
    padding: 4,
  },
  editButtonText: {
    color: '#6c5ce7',
    fontSize: 14,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 4,
  },
  deleteButtonText: {
    color: '#e17055',
    fontSize: 18,
    fontWeight: 'bold',
  },
  timeBlockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 4,
  },
  timeBlockLinked: {
    backgroundColor: '#f8f9ff',
    borderColor: '#6c5ce7',
    borderWidth: 1,
  },
  timeBlockInfo: {
    flex: 1,
  },
  timeBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  timeBlockTime: {
    fontSize: 12,
    color: '#6c5ce7',
    fontWeight: 'bold',
  },
  timeBlockDate: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
  timeBlockTitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  linkedTaskInfo: {
    backgroundColor: '#e8f5e8',
    padding: 6,
    borderRadius: 4,
    marginTop: 4,
  },
  linkedTaskLabel: {
    fontSize: 10,
    color: '#27ae60',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  linkedTaskTitle: {
    fontSize: 12,
    color: '#27ae60',
    fontStyle: 'italic',
  },
  taskSelectionSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6c5ce7',
  },
  taskLinkLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  timeInputContainer: {
    marginBottom: 12,
  },
  timeInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  timeFormatHint: {
    fontSize: 11,
    color: '#6c5ce7',
    marginTop: 2,
    fontStyle: 'italic',
  },
  linkedTaskIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  linkedTaskText: {
    fontSize: 12,
    color: '#27ae60',
    fontWeight: '500',
    flex: 1,
  },
  taskDropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
  },
  taskDropdownText: {
    flex: 1,
    fontSize: 14,
    color: '#333',    },
  dropdownArrow: {
    fontSize: 12,
    color: '#666',
  },
  clearTaskLink: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#ffebee',
    borderRadius: 4,
  },
  clearTaskLinkText: {
    fontSize: 10,
    color: '#e74c3c',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '95%',
    minHeight: '60%',
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },
  modalScrollContent: {
    flex: 1,
    maxHeight: '100%',
  },
  modalScrollContainer: {
    padding: 16,
    paddingBottom: 60,
    flexGrow: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 14,
    textAlign: 'center',
    color: '#333',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 10,
    backgroundColor: '#f8f9fa',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 10,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalAddButton: {
    flex: 1,
    backgroundColor: '#6c5ce7',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalAddButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  todayButton: {
    backgroundColor: '#6c5ce7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  todayButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  dateHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  // Smart Prioritization Styles
  warningBanner: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    margin: 20,
    marginBottom: 0,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    flex: 1,
  },
  suggestionBanner: {
    backgroundColor: '#d1ecf1',
    borderColor: '#bee5eb',
    borderWidth: 1,
    margin: 20,
    marginBottom: 0,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  suggestionText: {
    color: '#0c5460',
    fontSize: 14,
    flex: 1,
  },
  dismissText: {
    color: '#666',
    fontSize: 18,
    fontWeight: 'bold',
    paddingLeft: 10,
  },
  priorityIndicator: {
    width: 4,
    height: '100%',
    marginRight: 12,
    borderRadius: 2,
  },
  priorityHighIndicator: {
    backgroundColor: '#e74c3c',
  },
  priorityMediumIndicator: {
    backgroundColor: '#f39c12',
  },
  priorityLowIndicator: {
    backgroundColor: '#27ae60',
  },
  priorityHigh: {
    borderLeftColor: '#e74c3c',
    borderLeftWidth: 3,
  },
  priorityMedium: {
    borderLeftColor: '#f39c12',
    borderLeftWidth: 3,
  },
  priorityLow: {
    borderLeftColor: '#27ae60',
    borderLeftWidth: 3,
  },
  taskContent: {
    flex: 1,
  },
  taskDeadline: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  taskPriority: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  matrixExplanation: {
    fontSize: 12,
    color: '#6c5ce7',
    marginBottom: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  scaleDescription: {
    fontSize: 11,
    color: '#666',
    marginBottom: 6,
    fontStyle: 'italic',
  },
  calculatedPriority: {
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  calculatedPriorityLabel: {
    fontSize: 12,
    color: '#333',
    marginBottom: 6,
    fontWeight: '600',
  },
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 100,
    alignItems: 'center',
  },
  priorityBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: 'white',
  },
  priorityHighBadge: {
    backgroundColor: '#e74c3c',
  },
  priorityMediumBadge: {
    backgroundColor: '#f39c12',
  },
  priorityLowBadge: {
    backgroundColor: '#27ae60',
  },
  // Ensure priority styles are properly applied to task items
  priorityHighTask: {
    borderLeftColor: '#e74c3c',
    borderLeftWidth: 4,
    backgroundColor: '#fff5f5',
  },
  priorityMediumTask: {
    borderLeftColor: '#f39c12',
    borderLeftWidth: 4,
    backgroundColor: '#fffef5',
  },
  priorityLowTask: {
    borderLeftColor: '#27ae60',
    borderLeftWidth: 4,
    backgroundColor: '#f5fff5',
  },
  priorityButtonDisabled: {
    opacity: 0.6,
  },
  autoUpdatedText: {
    fontSize: 11,
    color: '#6c5ce7',
    fontStyle: 'italic',
    fontWeight: 'normal',
  },
  durationSelector: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  durationButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  durationButtonActive: {
    backgroundColor: '#00b894',
    borderColor: '#00b894',
  },
  durationButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  durationButtonTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  focusTypeDescription: {
    fontSize: 11,
    color: '#666',
    marginBottom: 6,
    fontStyle: 'italic',
  },
  focusTypeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  focusTypeButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  focusTypeButtonActive: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
  },
  focusTypeIcon: {
    fontSize: 16,
  },
  focusTypeButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  focusTypeButtonTextActive: {
    color: '#2196f3',
    fontWeight: 'bold',
  },
  taskFocusType: {
    fontSize: 11,
    color: '#2196f3',
    fontWeight: '600',
    marginTop: 2,
  },
  amPmSelector: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  amPmButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRightWidth: 1,
    borderRightColor: '#ddd',
    minWidth: 50,
    alignItems: 'center',
  },
  amPmButtonActive: {
    backgroundColor: '#6c5ce7',
  },
  amPmButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  amPmButtonTextActive: {
    color: 'white',
  },
  microTaskItem: {
    backgroundColor: '#f0f8ff',
    borderLeftColor: '#2196f3',
    borderLeftWidth: 4,
  },
  parentTaskWithMicro: {
    backgroundColor: '#fff8e1',
    borderLeftColor: '#ff9800',
    borderLeftWidth: 4,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  microTaskIcon: {
    fontSize: 14,
    color: '#2196f3',
  },
  microTaskText: {
    fontStyle: 'italic',
    color: '#2196f3',
  },
  microTaskLabel: {
    fontSize: 11,
    color: '#2196f3',
    fontWeight: '600',
    marginTop: 2,
  },
  parentTaskStatus: {
    fontSize: 11,
    color: '#ff9800',
    fontWeight: '600',
    marginTop: 2,
  },
  microCommitmentButton: {
    padding: 4,
    backgroundColor: '#e3f2fd',
    borderRadius: 4,
    marginRight: 4,
  },
  microCommitmentButtonText: {
    color: '#2196f3',
    fontSize: 14,
    fontWeight: 'bold',
  },
  breakdownButton: {
    backgroundColor: '#6c5ce7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  breakdownCard: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginVertical: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#6c5ce7',
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  breakdownDate: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 10,
  },
  breakdownStep: {
    fontSize: 14,
    marginVertical: 2,
    paddingLeft: 10,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.7,
    marginVertical: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
});