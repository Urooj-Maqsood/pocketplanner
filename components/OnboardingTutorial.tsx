
import React, { useState } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface OnboardingStep {
  title: string;
  description: string;
  icon: string;
  image?: string;
}

interface OnboardingTutorialProps {
  visible: boolean;
  onComplete: () => void;
}

const { width, height } = Dimensions.get('window');

const onboardingSteps: OnboardingStep[] = [
  {
    title: 'Welcome to PocketPlanner!',
    description: 'Your personal productivity companion that helps you organize tasks, manage time, and stay focused.',
    icon: 'rocket',
  },
  {
    title: 'Create and Organize Tasks',
    description: 'Add tasks with priorities, due dates, and categories. Break down complex projects into manageable steps.',
    icon: 'checkbox',
  },
  {
    title: 'Schedule Time Blocks',
    description: 'Plan your day by scheduling specific time blocks for important tasks and activities.',
    icon: 'calendar',
  },
  {
    title: 'Use the Pomodoro Timer',
    description: 'Boost your focus with the built-in Pomodoro timer. Work in focused sessions with regular breaks.',
    icon: 'timer',
  },
  {
    title: 'Track Your Progress',
    description: 'Monitor your productivity with streak tracking, statistics, and achievement badges.',
    icon: 'trophy',
  },
  {
    title: 'Stay Notified',
    description: 'Get reminders for tasks, deadlines, and focus sessions to stay on track.',
    icon: 'notifications',
  },
];

export default function OnboardingTutorial({ visible, onComplete }: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    try {
      await AsyncStorage.setItem('onboardingCompleted', 'true');
      onComplete();
    } catch (error) {
      console.error('Error saving onboarding completion:', error);
      onComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const step = onboardingSteps[currentStep];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <ThemedText style={styles.skipText}>Skip</ThemedText>
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            {onboardingSteps.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  index === currentStep ? styles.activeProgressDot : null,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name={step.icon as any} size={80} color="#74b9ff" />
          </View>

          <ThemedText style={styles.title}>{step.title}</ThemedText>
          <ThemedText style={styles.description}>{step.description}</ThemedText>

          {step.image && (
            <Image source={{ uri: step.image }} style={styles.stepImage} />
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handlePrevious}
            style={[styles.navButton, currentStep === 0 && styles.disabledButton]}
            disabled={currentStep === 0}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={currentStep === 0 ? '#ccc' : '#74b9ff'}
            />
            <ThemedText
              style={[
                styles.navButtonText,
                currentStep === 0 && styles.disabledText,
              ]}
            >
              Previous
            </ThemedText>
          </TouchableOpacity>

          <ThemedText style={styles.stepCounter}>
            {currentStep + 1} of {onboardingSteps.length}
          </ThemedText>

          <TouchableOpacity onPress={handleNext} style={styles.navButton}>
            <ThemedText style={styles.navButtonText}>
              {currentStep === onboardingSteps.length - 1 ? 'Get Started' : 'Next'}
            </ThemedText>
            <Ionicons name="chevron-forward" size={24} color="#74b9ff" />
          </TouchableOpacity>
        </View>
      </View>
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
  },
  skipButton: {
    padding: 8,
  },
  skipText: {
    fontSize: 16,
    color: '#666',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ddd',
    marginHorizontal: 4,
  },
  activeProgressDot: {
    backgroundColor: '#74b9ff',
    width: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    lineHeight: 24,
    marginBottom: 40,
  },
  stepImage: {
    width: width * 0.8,
    height: 200,
    borderRadius: 12,
    marginTop: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  navButtonText: {
    fontSize: 16,
    color: '#74b9ff',
    fontWeight: '600',
    marginHorizontal: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    color: '#ccc',
  },
  stepCounter: {
    fontSize: 14,
    color: '#999',
  },
});
