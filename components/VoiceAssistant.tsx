
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendTaskCompletionNotification } from '@/services/notificationService';

interface VoiceAssistantProps {
  onTaskCreated?: (task: any) => void;
  onTaskCompleted?: (taskId: string) => void;
}

export default function VoiceAssistant({ onTaskCreated, onTaskCompleted }: VoiceAssistantProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    // Check if speech recognition is supported
    if (Platform.OS === 'web' && 'webkitSpeechRecognition' in window) {
      setIsSupported(true);
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';
      
      recognitionInstance.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        handleVoiceCommand(transcript);
        setIsListening(false);
      };
      
      recognitionInstance.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        Alert.alert('Voice Error', 'Could not understand your command. Please try again.');
      };
      
      recognitionInstance.onend = () => {
        setIsListening(false);
      };
      
      setRecognition(recognitionInstance);
    } else if (Platform.OS === 'ios' || Platform.OS === 'android') {
      // For mobile, show alternative input method
      setIsSupported(true);
    } else {
      setIsSupported(false);
    }
  }, []);

  const handleVoiceCommand = async (transcript: string) => {
    console.log('Voice command:', transcript);
    
    try {
      // Command patterns
      if (transcript.includes('add task') || transcript.includes('create task') || transcript.includes('new task')) {
        const taskTitle = extractTaskTitle(transcript);
        if (taskTitle) {
          await createTaskFromVoice(taskTitle);
        } else {
          Alert.alert('Voice Assistant', 'Please specify the task title. Say "Add task [task name]"');
        }
      } else if (transcript.includes('complete task') || transcript.includes('mark complete')) {
        const taskTitle = extractTaskTitle(transcript);
        if (taskTitle) {
          await completeTaskFromVoice(taskTitle);
        } else {
          Alert.alert('Voice Assistant', 'Please specify which task to complete.');
        }
      } else if (transcript.includes('list tasks') || transcript.includes('show tasks')) {
        await listTasks();
      } else if (transcript.includes('help') || transcript.includes('commands')) {
        showVoiceCommands();
      } else {
        Alert.alert('Voice Assistant', 'Command not recognized. Say "help" to see available commands.');
      }
    } catch (error) {
      console.error('Error processing voice command:', error);
      Alert.alert('Voice Assistant', 'Error processing your command. Please try again.');
    }
  };

  const extractTaskTitle = (transcript: string): string => {
    // Extract task title from various command patterns
    const patterns = [
      /add task (.+)/i,
      /create task (.+)/i,
      /new task (.+)/i,
      /complete task (.+)/i,
      /mark complete (.+)/i,
    ];
    
    for (const pattern of patterns) {
      const match = transcript.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return '';
  };

  const createTaskFromVoice = async (title: string) => {
    try {
      const tasksData = await AsyncStorage.getItem('tasks');
      const tasks = tasksData ? JSON.parse(tasksData) : [];
      
      const newTask = {
        id: Date.now().toString(),
        title: title,
        completed: false,
        date: new Date().toDateString(),
        createdAt: new Date().toISOString(),
        voiceCreated: true,
      };
      
      tasks.push(newTask);
      await AsyncStorage.setItem('tasks', JSON.stringify(tasks));
      
      if (onTaskCreated) {
        onTaskCreated(newTask);
      }
      
      Alert.alert('Voice Assistant', `Task "${title}" created successfully!`);
    } catch (error) {
      console.error('Error creating task from voice:', error);
      Alert.alert('Voice Assistant', 'Failed to create task. Please try again.');
    }
  };

  const completeTaskFromVoice = async (title: string) => {
    try {
      const tasksData = await AsyncStorage.getItem('tasks');
      if (!tasksData) {
        Alert.alert('Voice Assistant', 'No tasks found.');
        return;
      }
      
      const tasks = JSON.parse(tasksData);
      const taskIndex = tasks.findIndex((task: any) => 
        task.title.toLowerCase().includes(title.toLowerCase()) && !task.completed
      );
      
      if (taskIndex === -1) {
        Alert.alert('Voice Assistant', `Task "${title}" not found or already completed.`);
        return;
      }
      
      tasks[taskIndex].completed = true;
      tasks[taskIndex].completedAt = new Date().toISOString();
      
      await AsyncStorage.setItem('tasks', JSON.stringify(tasks));
      
      if (onTaskCompleted) {
        onTaskCompleted(tasks[taskIndex].id);
      }
      
      // Send completion notification
      try {
        await sendTaskCompletionNotification(tasks[taskIndex].title, tasks[taskIndex].id);
      } catch (notificationError) {
        console.log('Task completion notification failed:', notificationError);
      }
      
      Alert.alert('Voice Assistant', `Task "${tasks[taskIndex].title}" marked as complete!`);
    } catch (error) {
      console.error('Error completing task from voice:', error);
      Alert.alert('Voice Assistant', 'Failed to complete task. Please try again.');
    }
  };

  const listTasks = async () => {
    try {
      const tasksData = await AsyncStorage.getItem('tasks');
      if (!tasksData) {
        Alert.alert('Voice Assistant', 'No tasks found.');
        return;
      }
      
      const tasks = JSON.parse(tasksData);
      const pendingTasks = tasks.filter((task: any) => !task.completed);
      
      if (pendingTasks.length === 0) {
        Alert.alert('Voice Assistant', 'No pending tasks found. Great job!');
        return;
      }
      
      const taskList = pendingTasks.slice(0, 5).map((task: any, index: number) => 
        `${index + 1}. ${task.title}`
      ).join('\n');
      
      Alert.alert('Voice Assistant', `Your pending tasks:\n\n${taskList}`);
    } catch (error) {
      console.error('Error listing tasks:', error);
      Alert.alert('Voice Assistant', 'Failed to retrieve tasks.');
    }
  };

  const showVoiceCommands = () => {
    const commands = [
      '• "Add task [task name]" - Create a new task',
      '• "Complete task [task name]" - Mark task as done',
      '• "List tasks" - Show your pending tasks',
      '• "Help" - Show this list',
    ].join('\n');
    
    Alert.alert('Voice Commands', commands);
  };

  const startListening = async () => {
    if (!isSupported) {
      Alert.alert(
        'Voice Assistant', 
        'Voice commands are not supported on this device. Available on web browsers with speech recognition support.'
      );
      return;
    }

    // For mobile devices, show text input alternative
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Alert.prompt(
        'Voice Command',
        'Enter your command (e.g., "add task buy groceries", "complete task homework", "list tasks"):',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Execute',
            onPress: (text) => {
              if (text) {
                handleVoiceCommand(text.toLowerCase());
              }
            }
          }
        ],
        'plain-text'
      );
      return;
    }
    
    // Check microphone permission first for web
    try {
      if (Platform.OS === 'web' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // Permission granted, stop the stream
          stream.getTracks().forEach(track => track.stop());
        } catch (permissionError) {
          Alert.alert(
            'Microphone Permission Required',
            'Please allow microphone access to use voice commands. You may need to click the microphone icon in your browser\'s address bar.',
            [
              { text: 'Cancel' },
              { 
                text: 'Help', 
                onPress: () => Alert.alert(
                  'Enable Microphone',
                  '1. Look for a microphone icon in your browser\'s address bar\n2. Click it and select "Allow"\n3. Try the voice command again\n\nOr check your browser settings for microphone permissions.'
                )
              }
            ]
          );
          return;
        }
      }
    } catch (error) {
      console.error('Permission check failed:', error);
    }
    
    if (recognition && !isListening) {
      try {
        setIsListening(true);
        recognition.start();
      } catch (error) {
        console.error('Failed to start recognition:', error);
        setIsListening(false);
        Alert.alert(
          'Voice Recognition Error',
          'Failed to start voice recognition. Please check your microphone permissions and try again.'
        );
      }
    }
  };

  const stopListening = () => {
    if (recognition && isListening) {
      recognition.stop();
      setIsListening(false);
    }
  };

  if (!isSupported) {
    return (
      <View style={styles.container}>
        <TouchableOpacity 
          style={[styles.voiceButton, styles.disabledButton]} 
          disabled={true}
        >
          <Ionicons name="mic-off" size={24} color="#999" />
          <Text style={styles.disabledText}>Voice not supported</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.voiceButton, isListening && styles.listeningButton]}
        onPress={isListening ? stopListening : startListening}
        onLongPress={showVoiceCommands}
      >
        <Ionicons 
          name={isListening ? "mic" : "mic-outline"} 
          size={24} 
          color={isListening ? "#fff" : "#6c5ce7"} 
        />
        <Text style={[styles.buttonText, isListening && styles.listeningText]}>
          {isListening ? 'Listening...' : Platform.OS === 'web' ? 'Voice Commands' : 'Voice/Text Commands'}
        </Text>
      </TouchableOpacity>
      
      {isListening && (
        <View style={styles.listeningIndicator}>
          <Text style={styles.listeningLabel}>🎤 Speak your command...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 10,
  },
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f8f9ff',
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#6c5ce7',
    gap: 8,
  },
  listeningButton: {
    backgroundColor: '#6c5ce7',
    borderColor: '#5848c4',
  },
  disabledButton: {
    backgroundColor: '#f5f5f5',
    borderColor: '#ddd',
  },
  buttonText: {
    color: '#6c5ce7',
    fontWeight: '600',
    fontSize: 14,
  },
  listeningText: {
    color: '#fff',
  },
  disabledText: {
    color: '#999',
    fontSize: 12,
  },
  listeningIndicator: {
    marginTop: 10,
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#e3f2fd',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#2196f3',
  },
  listeningLabel: {
    color: '#1976d2',
    fontSize: 12,
    fontWeight: '500',
  },
});
