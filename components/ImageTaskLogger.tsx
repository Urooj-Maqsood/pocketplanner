
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

interface ImageTask {
  id: string;
  title: string;
  description: string;
  imageUri: string;
  voiceNote?: string;
  created: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  category?: string;
}

interface ImageTaskLoggerProps {
  visible: boolean;
  onClose: () => void;
  onTaskCreated?: (task: ImageTask) => void;
}

export default function ImageTaskLogger({ visible, onClose, onTaskCreated }: ImageTaskLoggerProps) {
  const [imageTasks, setImageTasks] = useState<ImageTask[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadImageTasks();
    }
  }, [visible]);

  const loadImageTasks = async () => {
    try {
      const data = await AsyncStorage.getItem('imageTasks');
      if (data) {
        setImageTasks(JSON.parse(data));
      }
    } catch (error) {
      console.error('Error loading image tasks:', error);
    }
  };

  const saveImageTasks = async (tasks: ImageTask[]) => {
    try {
      await AsyncStorage.setItem('imageTasks', JSON.stringify(tasks));
    } catch (error) {
      console.error('Error saving image tasks:', error);
    }
  };

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please grant camera roll permissions to use this feature.');
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant camera permissions to use this feature.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const saveImageToDirectory = async (imageUri: string): Promise<string> => {
    try {
      // For web, just return the original URI since FileSystem operations aren't supported
      if (typeof window !== 'undefined') {
        return imageUri;
      }
      
      const filename = `task_image_${Date.now()}.jpg`;
      const directory = `${FileSystem.documentDirectory}task_images/`;
      
      // Create directory if it doesn't exist
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      
      const newPath = `${directory}${filename}`;
      await FileSystem.copyAsync({
        from: imageUri,
        to: newPath,
      });
      
      return newPath;
    } catch (error) {
      console.error('Error saving image:', error);
      return imageUri; // Return original URI if save fails
    }
  };

  const createImageTask = async () => {
    if (!selectedImage || !taskTitle.trim()) {
      Alert.alert('Missing Information', 'Please select an image and enter a task title.');
      return;
    }

    setIsLoading(true);

    try {
      // Save image to app directory
      const savedImageUri = await saveImageToDirectory(selectedImage);

      const newTask: ImageTask = {
        id: Date.now().toString(),
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        imageUri: savedImageUri,
        created: new Date().toISOString(),
        completed: false,
        priority: taskPriority,
      };

      const updatedTasks = [...imageTasks, newTask];
      setImageTasks(updatedTasks);
      await saveImageTasks(updatedTasks);

      // Add to regular tasks as well
      try {
        const regularTasks = await AsyncStorage.getItem('tasks');
        const tasks = regularTasks ? JSON.parse(regularTasks) : [];
        
        const today = new Date().toISOString().split('T')[0];
        
        const regularTask = {
          id: newTask.id,
          title: newTask.title,
          description: `📸 ${newTask.description}`,
          completed: false,
          priority: newTask.priority,
          date: today,
          created: newTask.created,
          hasImage: true,
          imageUri: newTask.imageUri,
        };

        tasks.push(regularTask);
        await AsyncStorage.setItem('tasks', JSON.stringify(tasks));
      } catch (taskError) {
        console.log('Regular task creation failed, but image task was created');
      }

      // Reset form
      setSelectedImage(null);
      setTaskTitle('');
      setTaskDescription('');
      setTaskPriority('medium');
      setShowCreateForm(false);

      if (onTaskCreated) {
        onTaskCreated(newTask);
      }

      Alert.alert('Success', 'Image-based task created successfully!');
    } catch (error) {
      console.error('Error creating image task:', error);
      Alert.alert('Error', 'Failed to create task. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTaskCompletion = async (taskId: string) => {
    const updatedTasks = imageTasks.map(task =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    );
    setImageTasks(updatedTasks);
    await saveImageTasks(updatedTasks);

    // Update regular tasks as well
    const regularTasks = await AsyncStorage.getItem('tasks');
    if (regularTasks) {
      const tasks = JSON.parse(regularTasks);
      const updatedRegularTasks = tasks.map((task: any) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      );
      await AsyncStorage.setItem('tasks', JSON.stringify(updatedRegularTasks));
    }
  };

  const deleteImageTask = async (taskId: string) => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this image task?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const taskToDelete = imageTasks.find(t => t.id === taskId);
            
            // Delete image file
            if (taskToDelete?.imageUri.startsWith(FileSystem.documentDirectory || '')) {
              try {
                await FileSystem.deleteAsync(taskToDelete.imageUri);
              } catch (error) {
                console.error('Error deleting image file:', error);
              }
            }

            // Remove from image tasks
            const updatedTasks = imageTasks.filter(task => task.id !== taskId);
            setImageTasks(updatedTasks);
            await saveImageTasks(updatedTasks);

            // Remove from regular tasks
            const regularTasks = await AsyncStorage.getItem('tasks');
            if (regularTasks) {
              const tasks = JSON.parse(regularTasks);
              const updatedRegularTasks = tasks.filter((task: any) => task.id !== taskId);
              await AsyncStorage.setItem('tasks', JSON.stringify(updatedRegularTasks));
            }
          }
        }
      ]
    );
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#e74c3c';
      case 'medium': return '#f39c12';
      case 'low': return '#27ae60';
      default: return '#74b9ff';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title">📸 Image Task Logger</ThemedText>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <ThemedText style={styles.closeButtonText}>×</ThemedText>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Create New Task Button */}
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setShowCreateForm(true)}
          >
            <ThemedText style={styles.createButtonText}>+ Add Image-Based Task</ThemedText>
          </TouchableOpacity>

          {/* Create Task Form */}
          {showCreateForm && (
            <View style={styles.createForm}>
              <ThemedText type="subtitle" style={styles.formTitle}>
                Create Visual Task
              </ThemedText>

              {/* Image Selection */}
              <View style={styles.imageSection}>
                {selectedImage ? (
                  <View style={styles.selectedImageContainer}>
                    <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => setSelectedImage(null)}
                    >
                      <ThemedText style={styles.removeImageText}>×</ThemedText>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.imagePickerButtons}>
                    <TouchableOpacity style={styles.imageButton} onPress={takePhoto}>
                      <ThemedText style={styles.imageButtonText}>📷 Take Photo</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
                      <ThemedText style={styles.imageButtonText}>🖼️ Choose Image</ThemedText>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Task Details */}
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Task Title</ThemedText>
                <TextInput
                  style={styles.textInput}
                  value={taskTitle}
                  onChangeText={setTaskTitle}
                  placeholder="Enter task title..."
                />
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Description</ThemedText>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={taskDescription}
                  onChangeText={setTaskDescription}
                  placeholder="Describe your visual task..."
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Priority Selection */}
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Priority</ThemedText>
                <View style={styles.priorityButtons}>
                  {(['low', 'medium', 'high'] as const).map((priority) => (
                    <TouchableOpacity
                      key={priority}
                      style={[
                        styles.priorityButton,
                        taskPriority === priority && { backgroundColor: getPriorityColor(priority) }
                      ]}
                      onPress={() => setTaskPriority(priority)}
                    >
                      <ThemedText
                        style={[
                          styles.priorityButtonText,
                          taskPriority === priority && { color: 'white' }
                        ]}
                      >
                        {priority.charAt(0).toUpperCase() + priority.slice(1)}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.formButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowCreateForm(false);
                    setSelectedImage(null);
                    setTaskTitle('');
                    setTaskDescription('');
                  }}
                >
                  <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.saveButton, isLoading && { opacity: 0.6 }]}
                  onPress={createImageTask}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <ThemedText style={styles.saveButtonText}>Create Task</ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Image Tasks List */}
          <View style={styles.tasksSection}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Your Visual Tasks ({imageTasks.length})
            </ThemedText>

            {imageTasks.length === 0 ? (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyStateText}>
                  📸 No image-based tasks yet
                </ThemedText>
                <ThemedText style={styles.emptyStateSubtext}>
                  Create visual tasks by adding images and voice notes
                </ThemedText>
              </View>
            ) : (
              imageTasks.map((task) => (
                <View key={task.id} style={styles.taskCard}>
                  <View style={styles.taskImage}>
                    <Image source={{ uri: task.imageUri }} style={styles.taskImageView} />
                    <View style={[styles.priorityIndicator, { backgroundColor: getPriorityColor(task.priority) }]} />
                  </View>
                  
                  <View style={styles.taskContent}>
                    <ThemedText style={[styles.taskTitle, task.completed && styles.completedTask]}>
                      {task.title}
                    </ThemedText>
                    
                    {task.description && (
                      <ThemedText style={styles.taskDescription}>
                        {task.description}
                      </ThemedText>
                    )}
                    
                    <ThemedText style={styles.taskDate}>
                      Created: {new Date(task.created).toLocaleDateString()}
                    </ThemedText>
                  </View>

                  <View style={styles.taskActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, task.completed && styles.completedButton]}
                      onPress={() => toggleTaskCompletion(task.id)}
                    >
                      <ThemedText style={styles.actionButtonText}>
                        {task.completed ? '✓' : '○'}
                      </ThemedText>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => deleteImageTask(task.id)}
                    >
                      <ThemedText style={styles.actionButtonText}>🗑️</ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: 'white',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  createButton: {
    backgroundColor: '#74b9ff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  createButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  createForm: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  formTitle: {
    marginBottom: 16,
    color: '#333',
  },
  imageSection: {
    marginBottom: 20,
  },
  selectedImageContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  selectedImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: 80,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e74c3c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  imagePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  imageButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    flex: 0.45,
  },
  imageButtonText: {
    fontSize: 16,
    color: '#666',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  priorityButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priorityButton: {
    flex: 0.3,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  priorityButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 0.4,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    flex: 0.55,
    backgroundColor: '#00b894',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tasksSection: {
    flex: 1,
  },
  sectionTitle: {
    marginBottom: 16,
    color: '#333',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  taskCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskImage: {
    position: 'relative',
    marginRight: 12,
  },
  taskImageView: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  priorityIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'white',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  taskDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  taskDate: {
    fontSize: 12,
    color: '#999',
  },
  completedTask: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  taskActions: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  completedButton: {
    backgroundColor: '#00b894',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
  },
  actionButtonText: {
    fontSize: 16,
    color: 'white',
  },
});
