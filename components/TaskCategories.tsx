
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TaskCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface TaskTag {
  id: string;
  name: string;
  color: string;
}

interface TaskCategoriesProps {
  visible: boolean;
  onClose: () => void;
  onCategorySelect?: (category: TaskCategory) => void;
  onTagSelect?: (tag: TaskTag) => void;
}

const predefinedColors = [
  '#74b9ff', '#0984e3', '#6c5ce7', '#a29bfe',
  '#fd79a8', '#e84393', '#00b894', '#00cec9',
  '#fdcb6e', '#e17055', '#636e72', '#2d3436'
];

const predefinedIcons = [
  'home', 'briefcase', 'school', 'fitness', 'medical',
  'car', 'restaurant', 'book', 'musical-notes', 'camera',
  'heart', 'star', 'rocket', 'leaf', 'code'
];

export default function TaskCategories({ visible, onClose, onCategorySelect, onTagSelect }: TaskCategoriesProps) {
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [tags, setTags] = useState<TaskTag[]>([]);
  const [activeTab, setActiveTab] = useState<'categories' | 'tags'>('categories');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [selectedColor, setSelectedColor] = useState(predefinedColors[0]);
  const [selectedIcon, setSelectedIcon] = useState(predefinedIcons[0]);

  useEffect(() => {
    if (visible) {
      loadCategoriesAndTags();
    }
  }, [visible]);

  const loadCategoriesAndTags = async () => {
    try {
      const savedCategories = await AsyncStorage.getItem('taskCategories');
      const savedTags = await AsyncStorage.getItem('taskTags');

      if (savedCategories) {
        setCategories(JSON.parse(savedCategories));
      } else {
        // Set default categories
        const defaultCategories: TaskCategory[] = [
          { id: '1', name: 'Work', color: '#74b9ff', icon: 'briefcase' },
          { id: '2', name: 'Personal', color: '#fd79a8', icon: 'home' },
          { id: '3', name: 'Health', color: '#00b894', icon: 'fitness' },
          { id: '4', name: 'Learning', color: '#6c5ce7', icon: 'book' },
        ];
        setCategories(defaultCategories);
        await AsyncStorage.setItem('taskCategories', JSON.stringify(defaultCategories));
      }

      if (savedTags) {
        setTags(JSON.parse(savedTags));
      }
    } catch (error) {
      console.error('Error loading categories and tags:', error);
    }
  };

  const saveCategoriesAndTags = async (newCategories: TaskCategory[], newTags: TaskTag[]) => {
    try {
      await AsyncStorage.setItem('taskCategories', JSON.stringify(newCategories));
      await AsyncStorage.setItem('taskTags', JSON.stringify(newTags));
    } catch (error) {
      console.error('Error saving categories and tags:', error);
    }
  };

  const addNewItem = async () => {
    if (!newItemName.trim()) {
      Alert.alert('Error', 'Please enter a name.');
      return;
    }

    const id = Date.now().toString();

    if (activeTab === 'categories') {
      const newCategory: TaskCategory = {
        id,
        name: newItemName.trim(),
        color: selectedColor,
        icon: selectedIcon,
      };
      const updatedCategories = [...categories, newCategory];
      setCategories(updatedCategories);
      await saveCategoriesAndTags(updatedCategories, tags);
    } else {
      const newTag: TaskTag = {
        id,
        name: newItemName.trim(),
        color: selectedColor,
      };
      const updatedTags = [...tags, newTag];
      setTags(updatedTags);
      await saveCategoriesAndTags(categories, updatedTags);
    }

    setNewItemName('');
    setShowAddModal(false);
    setSelectedColor(predefinedColors[0]);
    setSelectedIcon(predefinedIcons[0]);
  };

  const deleteItem = async (id: string, type: 'category' | 'tag') => {
    Alert.alert(
      `Delete ${type}`,
      `Are you sure you want to delete this ${type}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (type === 'category') {
              const updatedCategories = categories.filter(c => c.id !== id);
              setCategories(updatedCategories);
              await saveCategoriesAndTags(updatedCategories, tags);
            } else {
              const updatedTags = tags.filter(t => t.id !== id);
              setTags(updatedTags);
              await saveCategoriesAndTags(categories, updatedTags);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>Categories & Tags</ThemedText>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'categories' && styles.activeTab]}
            onPress={() => setActiveTab('categories')}
          >
            <ThemedText style={[styles.tabText, activeTab === 'categories' && styles.activeTabText]}>
              Categories
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'tags' && styles.activeTab]}
            onPress={() => setActiveTab('tags')}
          >
            <ThemedText style={[styles.tabText, activeTab === 'tags' && styles.activeTabText]}>
              Tags
            </ThemedText>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {activeTab === 'categories' ? (
            <View style={styles.grid}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[styles.categoryItem, { backgroundColor: category.color }]}
                  onPress={() => onCategorySelect?.(category)}
                  onLongPress={() => deleteItem(category.id, 'category')}
                >
                  <Ionicons name={category.icon as any} size={24} color="white" />
                  <ThemedText style={styles.categoryText}>{category.name}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.tagsList}>
              {tags.map((tag) => (
                <TouchableOpacity
                  key={tag.id}
                  style={[styles.tagItem, { backgroundColor: tag.color }]}
                  onPress={() => onTagSelect?.(tag)}
                  onLongPress={() => deleteItem(tag.id, 'tag')}
                >
                  <ThemedText style={styles.tagText}>#{tag.name}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={24} color="white" />
          <ThemedText style={styles.addButtonText}>
            Add {activeTab === 'categories' ? 'Category' : 'Tag'}
          </ThemedText>
        </TouchableOpacity>

        {/* Add Item Modal */}
        <Modal visible={showAddModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ThemedText style={styles.modalTitle}>
                Add New {activeTab === 'categories' ? 'Category' : 'Tag'}
              </ThemedText>

              <TextInput
                style={styles.nameInput}
                value={newItemName}
                onChangeText={setNewItemName}
                placeholder={`Enter ${activeTab === 'categories' ? 'category' : 'tag'} name`}
                autoFocus
              />

              <ThemedText style={styles.colorLabel}>Choose Color:</ThemedText>
              <View style={styles.colorGrid}>
                {predefinedColors.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      selectedColor === color && styles.selectedColor,
                    ]}
                    onPress={() => setSelectedColor(color)}
                  />
                ))}
              </View>

              {activeTab === 'categories' && (
                <>
                  <ThemedText style={styles.iconLabel}>Choose Icon:</ThemedText>
                  <ScrollView horizontal style={styles.iconScroll}>
                    {predefinedIcons.map((icon) => (
                      <TouchableOpacity
                        key={icon}
                        style={[
                          styles.iconOption,
                          selectedIcon === icon && styles.selectedIcon,
                        ]}
                        onPress={() => setSelectedIcon(icon)}
                      >
                        <Ionicons name={icon as any} size={24} color="#333" />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowAddModal(false)}
                >
                  <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={addNewItem}>
                  <ThemedText style={styles.saveButtonText}>Add</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#74b9ff',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: 'white',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryItem: {
    width: '48%',
    aspectRatio: 1.5,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#74b9ff',
    marginHorizontal: 16,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 12,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  colorLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#333',
  },
  iconLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  iconScroll: {
    marginBottom: 20,
  },
  iconOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedIcon: {
    borderColor: '#74b9ff',
    backgroundColor: '#e7f3ff',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#74b9ff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
