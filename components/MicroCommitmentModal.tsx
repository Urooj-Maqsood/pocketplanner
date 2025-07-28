import React, { useState } from 'react';
import { Modal, View, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
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
  linkedToTaskId?: string;
  isMicroTask?: boolean;
}

interface MicroCommitmentModalProps {
  visible: boolean;
  onClose: () => void;
  originalTask: Task | null;
  onMicroTaskCreated: (microTask: Task) => void;
}

export default function MicroCommitmentModal({ 
  visible, 
  onClose, 
  originalTask, 
  onMicroTaskCreated 
}: MicroCommitmentModalProps) {
  const [microStepTitle, setMicroStepTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const createMicroTask = async () => {
    if (!originalTask || microStepTitle.trim() === '') {
      Alert.alert('Error', 'Please enter a micro-step description');
      return;
    }

    setIsCreating(true);

    try {
      // Get today's date
      const today = new Date();
      const todayString = today.toDateString();

      // Create micro-task
      const microTask: Task = {
        id: `micro_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: microStepTitle.trim(),
        completed: false,
        date: todayString,
        priority: originalTask.priority || 'medium',
        deadline: originalTask.deadline,
        importance: originalTask.importance,
        urgency: originalTask.urgency,
        focusType: originalTask.focusType,
        linkedToTaskId: originalTask.id,
        isMicroTask: true,
      };

      // Save to AsyncStorage
      const tasksData = await AsyncStorage.getItem('tasks');
      const allTasks = tasksData ? JSON.parse(tasksData) : [];
      allTasks.push(microTask);
      await AsyncStorage.setItem('tasks', JSON.stringify(allTasks));

      // Update original task to mark it as having an active micro-task
      const updatedTasks = allTasks.map((task: Task) => 
        task.id === originalTask.id 
          ? { ...task, hasMicroTaskActive: true }
          : task
      );
      await AsyncStorage.setItem('tasks', JSON.stringify(updatedTasks));

      onMicroTaskCreated(microTask);
      setMicroStepTitle('');
      onClose();

      Alert.alert(
        'Micro-Step Created! 🎯',
        `Your next step "${microTask.title}" has been added to today's tasks. Small progress is still progress!`,
        [{ text: 'Got it!', style: 'default' }]
      );

    } catch (error) {
      console.error('Error creating micro-task:', error);
      Alert.alert('Error', 'Failed to create micro-step. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setMicroStepTitle('');
    onClose();
  };

  if (!originalTask) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
    >
      <View style={styles.modalOverlay}>
        <ThemedView style={styles.modalContent}>
          <View style={styles.header}>
            <ThemedText style={styles.emoji}>🔄</ThemedText>
            <ThemedText style={styles.title}>Break It Down</ThemedText>
          </View>

          <ThemedText style={styles.subtitle}>
            This task wasn't completed. Let's create a small, manageable next step for today:
          </ThemedText>

          <View style={styles.originalTaskCard}>
            <ThemedText style={styles.originalTaskLabel}>Original Task:</ThemedText>
            <ThemedText style={styles.originalTaskTitle}>{originalTask.title}</ThemedText>
          </View>

          <View style={styles.inputSection}>
            <ThemedText style={styles.inputLabel}>What's one small step you can take today?</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="e.g., Write outline, Read 5 pages, Make one phone call..."
              value={microStepTitle}
              onChangeText={setMicroStepTitle}
              placeholderTextColor="#999"
              multiline={true}
              maxLength={100}
              autoFocus={true}
            />
            <ThemedText style={styles.characterCount}>
              {microStepTitle.length}/100 characters
            </ThemedText>
          </View>

          <View style={styles.examplesSection}>
            <ThemedText style={styles.examplesTitle}>💡 Examples of good micro-steps:</ThemedText>
            <ThemedText style={styles.exampleText}>• "Read first 5 pages"</ThemedText>
            <ThemedText style={styles.exampleText}>• "Create project folder"</ThemedText>
            <ThemedText style={styles.exampleText}>• "Send follow-up email"</ThemedText>
            <ThemedText style={styles.exampleText}>• "List 3 main points"</ThemedText>
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity 
              style={styles.skipButton}
              onPress={handleClose}
            >
              <ThemedText style={styles.skipButtonText}>Skip for Now</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.createButton, isCreating && styles.createButtonDisabled]}
              onPress={createMicroTask}
              disabled={isCreating || microStepTitle.trim() === ''}
            >
              <ThemedText style={styles.createButtonText}>
                {isCreating ? 'Creating...' : 'Create Micro-Step'}
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
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  emoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  originalTaskCard: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#6c5ce7',
  },
  originalTaskLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  originalTaskTitle: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 60,
    backgroundColor: '#f8f9fa',
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  examplesSection: {
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  examplesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2196f3',
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  skipButton: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#666',
    fontWeight: 'bold',
    fontSize: 14,
  },
  createButton: {
    flex: 2,
    backgroundColor: '#00b894',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#ccc',
  },
  createButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
});