import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Configure notification behavior for maximum visibility
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

export interface NotificationSettings {
  preStartMinutes: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export interface ScheduledNotification {
  id: string;
  taskId: string;
  taskTitle: string;
  type: 'pre-start' | 'due-time' | 'halfway-reminder' | 'final-warning';
  scheduledTime: Date;
  notificationId: string;
}

const NOTIFICATION_SETTINGS_KEY = 'notification_settings';
const SCHEDULED_NOTIFICATIONS_KEY = 'scheduled_notifications';

// Default notification settings
const defaultSettings: NotificationSettings = {
  preStartMinutes: 15,
  soundEnabled: false,
  vibrationEnabled: false,
};

// Helper function to convert 12-hour time format to 24-hour format
export const convertTo24HourFormat = (time12h: string): string => {
  if (!time12h) return time12h;

  // If already in 24-hour format, return as is
  if (!time12h.toLowerCase().includes('am') && !time12h.toLowerCase().includes('pm')) {
    return time12h;
  }

  const [time, modifier] = time12h.split(/\s?(AM|PM|am|pm)/i);
  let [hours, minutes] = time.split(':');

  if (hours === '12') {
    hours = '00';
  }

  if (modifier.toLowerCase() === 'pm') {
    hours = parseInt(hours, 10) + 12;
  }

  return `${hours.toString().padStart(2, '0')}:${minutes}`;
};

// Check if running in Expo Go
const isExpoGo = (): boolean => {
  return Constants.executionEnvironment === 'storeClient';
};

const isWebPlatform = (): boolean => {
  return Platform.OS === 'web';
};

// Initialize notifications with better error handling
export const initializeNotifications = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'web') {
      // Try to request web notification permission
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          console.log('Web notifications enabled');
          return true;
        } else {
          console.log('Web notifications denied, but app will continue to work');
          return false;
        }
      } else {
        console.log('Web notifications not supported, but app will continue to work');
        return false;
      }
    }

    if (Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient') {
      console.log('Expo Go detected - notifications have limited functionality');
      // Still return false but don't prevent app functionality
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      } catch (permissionError) {
        console.log('Permission request failed, continuing without notifications');
        return false;
      }
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted, but app will continue to work');
      return false;
    }

    try {
      await Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    } catch (handlerError) {
      console.log('Notification handler setup failed, continuing without notifications');
      return false;
    }

    return true;
  } catch (error) {
    console.log('Notifications not available, but app will continue to work');
    return false;
  }
};

// Get notification settings
export const getNotificationSettings = async (): Promise<NotificationSettings> => {
  try {
    const settings = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    return settings ? JSON.parse(settings) : defaultSettings;
  } catch (error) {
    console.error('Error getting notification settings:', error);
    return defaultSettings;
  }
};

// Save notification settings
export const saveNotificationSettings = async (settings: NotificationSettings): Promise<void> => {
  try {
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving notification settings:', error);
  }
};

// Get scheduled notifications
export const getScheduledNotifications = async (): Promise<ScheduledNotification[]> => {
  try {
    const notifications = await AsyncStorage.getItem(SCHEDULED_NOTIFICATIONS_KEY);
    return notifications ? JSON.parse(notifications) : [];
  } catch (error) {
    console.error('Error getting scheduled notifications:', error);
    return [];
  }
};

// Save scheduled notifications
const saveScheduledNotifications = async (notifications: ScheduledNotification[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(SCHEDULED_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  } catch (error) {
    console.error('Error saving scheduled notifications:', error);
  }
};

// Web notification helper
const showWebNotification = (title: string, body: string, icon?: string): void => {
  if (isWebPlatform() && 'Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: icon || '/favicon.ico',
      badge: '/favicon.ico',
      requireInteraction: true,
      tag: 'pocketplanner-notification',
    });

    // Auto-close after 10 seconds
    setTimeout(() => {
      notification.close();
    }, 10000);

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    notification.onerror = (error) => {
      console.log('Web notification error:', error);
    };
  }
};

// Schedule task notifications
export const scheduleTaskNotifications = async (
  taskId: string,
  taskTitle: string,
  deadline: Date,
  preStartMinutes: number = 15,
  estimatedDuration?: number
): Promise<void> => {
  try {
    if (isExpoGo() || isWebPlatform() || !Device.isDevice) {
      return;
    }

    const settings = await getNotificationSettings();
    const reminderMinutes = preStartMinutes || settings.preStartMinutes;
    const scheduledNotifications = await getScheduledNotifications();

    // Remove any existing notifications for this task
    await cancelTaskNotifications(taskId);

    const now = new Date();

    // Only schedule deadline notification if the deadline is in the future
    if (deadline > now) {
      const dueTimeNotificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔴 DEADLINE REACHED!',
          body: `Time's up! The task "${taskTitle}" is now due. Mark as complete if finished!`,
          data: { taskId, type: 'due-time' },
          sound: settings.soundEnabled,
          priority: Notifications.AndroidNotificationPriority.MAX,
          sticky: Platform.OS === 'android',
          autoDismiss: false,
          vibrate: settings.vibrationEnabled ? [0, 500, 250, 500, 250, 500] : undefined,
          ...(Platform.OS === 'android' && {
            channelId: 'urgent-reminders',
          }),
        },
        trigger: {
          date: deadline,
        },
      });

      scheduledNotifications.push({
        id: `${taskId}-due-time`,
        taskId,
        taskTitle,
        type: 'due-time',
        scheduledTime: deadline,
        notificationId: dueTimeNotificationId,
      });

      // Calculate time for final warning (15 minutes before deadline)
      const finalWarningTime = new Date(deadline.getTime() - 15 * 60000);
      if (finalWarningTime > now) {
        const finalWarningNotificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: '🚨 URGENT: Final Warning!',
            body: `Only 15 minutes left to complete "${taskTitle}"! Finish up now!`,
            data: { taskId, type: 'final-warning' },
            sound: settings.soundEnabled ? 'default' : false,
            priority: Notifications.AndroidNotificationPriority.MAX,
            sticky: true,
            autoDismiss: false,
            vibrate: settings.vibrationEnabled ? [0, 500, 250, 500, 250, 500] : [],
          },
          trigger: {
            date: finalWarningTime,
            channelId: Platform.OS === 'android' ? 'urgent-reminders' : undefined,
          },
        });

        scheduledNotifications.push({
          id: `${taskId}-final-warning`,
          taskId,
          taskTitle,
          type: 'final-warning',
          scheduledTime: finalWarningTime,
          notificationId: finalWarningNotificationId,
        });
      }

      // Schedule pre-start notification
      if (estimatedDuration && estimatedDuration > 0) {
        const taskStartTime = new Date(deadline.getTime() - estimatedDuration * 60000);
        const preStartTime = new Date(taskStartTime.getTime() - reminderMinutes * 60000);

        if (preStartTime > now && taskStartTime > now) {
          let preStartNotificationId;
          try {
            preStartNotificationId = await Notifications.scheduleNotificationAsync({
              content: {
                title: '⏰ Task Starting Soon',
                body: `Your task "${taskTitle}" should start in ${reminderMinutes} minutes to meet the deadline. Get ready!`,
                data: { taskId, type: 'pre-start' },
                sound: settings.soundEnabled ? 'default' : false,
                priority: Notifications.AndroidNotificationPriority.HIGH,
                sticky: false,
                autoDismiss: false,
                vibrate: settings.vibrationEnabled ? [0, 250, 250, 250] : [],
              },
              trigger: {
                date: preStartTime,
                channelId: Platform.OS === 'android' ? 'task-reminders' : undefined,
              },
            });
          } catch (scheduleError) {
            console.log('Unable to schedule notification, continuing without it');
            return;
          }

          scheduledNotifications.push({
            id: `${taskId}-pre-start`,
            taskId,
            taskTitle,
            type: 'pre-start',
            scheduledTime: preStartTime,
            notificationId: preStartNotificationId,
          });

          // Schedule halfway reminder for long tasks
          if (estimatedDuration > 30) {
            const halfwayTime = new Date(taskStartTime.getTime() + (estimatedDuration * 30000));
            if (halfwayTime > now && halfwayTime < deadline) {
              const halfwayNotificationId = await Notifications.scheduleNotificationAsync({
                content: {
                  title: '📝 Progress Check',
                  body: `How's your task "${taskTitle}" going? You're halfway to the deadline!`,
                  data: { taskId, type: 'halfway-reminder' },
                  sound: settings.soundEnabled ? 'default' : false,
                  priority: Notifications.AndroidNotificationPriority.DEFAULT,
                  vibrate: settings.vibrationEnabled ? [0, 250, 250, 250] : [],
                },
                trigger: {
                  date: halfwayTime,
                  channelId: Platform.OS === 'android' ? 'task-reminders' : undefined,
                },
              });

              scheduledNotifications.push({
                id: `${taskId}-halfway`,
                taskId,
                taskTitle,
                type: 'halfway-reminder',
                scheduledTime: halfwayTime,
                notificationId: halfwayNotificationId,
              });
            }
          }
        }
      } else {
        // Simple reminder before deadline
        const reminderTime = new Date(deadline.getTime() - reminderMinutes * 60000);
        if (reminderTime > now) {
          const reminderNotificationId = await Notifications.scheduleNotificationAsync({
            content: {
              title: '⏰ Task Reminder',
              body: `Don't forget about your task "${taskTitle}"! Deadline approaching in ${reminderMinutes} minutes.`,
              data: { taskId, type: 'pre-start' },
              sound: settings.soundEnabled ? 'default' : false,
              priority: Notifications.AndroidNotificationPriority.HIGH,
              sticky: false,
              autoDismiss: false,
              vibrate: settings.vibrationEnabled ? [0, 250, 250, 250] : [],
            },
            trigger: {
              date: reminderTime,
              channelId: Platform.OS === 'android' ? 'task-reminders' : undefined,
            },
          });

          scheduledNotifications.push({
            id: `${taskId}-pre-start`,
            taskId,
            taskTitle,
            type: 'pre-start',
            scheduledTime: reminderTime,
            notificationId: reminderNotificationId,
          });
        }
      }
    }

    await saveScheduledNotifications(scheduledNotifications);

    const scheduledCount = scheduledNotifications.length;
    console.log(`Scheduled ${scheduledCount} notifications for task: ${taskTitle}`);
  } catch (error) {
    console.error('Error scheduling task notifications:', error);
  }
};

// Cancel notifications for a specific task
export const cancelTaskNotifications = async (taskId: string): Promise<void> => {
  try {
    if (isWebPlatform()) {
      console.log('Web platform: Cannot cancel scheduled web notifications');
      return;
    }

    if (isExpoGo() || !Device.isDevice) {
      console.log('Notification cancellation skipped - limited functionality');
      return;
    }

    const scheduledNotifications = await getScheduledNotifications();
    const taskNotifications = scheduledNotifications.filter(n => n.taskId === taskId);

    // Cancel each notification
    for (const notification of taskNotifications) {
      await Notifications.cancelScheduledNotificationAsync(notification.notificationId);
    }

    // Remove from scheduled notifications
    const remainingNotifications = scheduledNotifications.filter(n => n.taskId !== taskId);
    await saveScheduledNotifications(remainingNotifications);

    console.log(`Cancelled notifications for task: ${taskId}`);
  } catch (error) {
    console.error('Error cancelling task notifications:', error);
  }
};

// Cancel all scheduled notifications
export const cancelAllNotifications = async (): Promise<void> => {
  try {
    if (isWebPlatform()) {
      console.log('Web platform: Cannot cancel all web notifications');
      await saveScheduledNotifications([]);
      return;
    }

    if (isExpoGo() || !Device.isDevice) {
      console.log('Notification cancellation skipped - limited functionality');
      await saveScheduledNotifications([]);      return;
    }

    await Notifications.cancelAllScheduledNotificationsAsync();
    await saveScheduledNotifications([]);
    console.log('All notifications cancelled');
  } catch (error) {
    console.error('Error cancelling all notifications:', error);
  }
};

// Clean up expired notifications
export const cleanupExpiredNotifications = async (): Promise<void> => {
  try {
    const scheduledNotifications = await getScheduledNotifications();
    const now = new Date();

    const activeNotifications = scheduledNotifications.filter(n => n.scheduledTime > now);

    if (activeNotifications.length !== scheduledNotifications.length) {
      await saveScheduledNotifications(activeNotifications);
      console.log('Cleaned up expired notifications');
    }
  } catch (error) {
    console.error('Error cleaning up expired notifications:', error);
  }
};

// Snooze a notification
export const snoozeNotification = async (
  taskId: string,
  taskTitle: string,
  snoozeMinutes: number = 5
): Promise<string | null> => {
  try {
    if (isWebPlatform()) {
      setTimeout(() => {
        showWebNotification(
          `💤 Snooze Reminder: ${taskTitle}`,
          `This is your snooze reminder for "${taskTitle}". Time to get back to work!`
        );
      }, snoozeMinutes * 60 * 1000);

      return `web-${taskId}-snooze-${Date.now()}`;
    }

    if (isExpoGo() || !Device.isDevice) {
      console.log('Snooze notification not supported in current environment');
      return null;
    }

    const snoozeTime = new Date();
    snoozeTime.setMinutes(snoozeTime.getMinutes() + snoozeMinutes);

    const settings = await getNotificationSettings();

    const snoozeNotificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `💤 Snooze Reminder: ${taskTitle}`,
        body: `This is your snooze reminder for "${taskTitle}". Time to get back to work!`,
        data: { taskId, type: 'snooze' },
        sound: settings.soundEnabled ? 'default' : false,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: settings.vibrationEnabled ? [0, 250, 250, 250] : [],
      },
      trigger: {
        date: snoozeTime,
        channelId: Platform.OS === 'android' ? 'task-reminders' : undefined,
      },
    });

    // Save snooze notification
    const scheduledNotifications = await getScheduledNotifications();
    scheduledNotifications.push({
      id: `${taskId}-snooze-${Date.now()}`,
      taskId,
      taskTitle,
      type: 'snooze' as any,
      scheduledTime: snoozeTime,
      notificationId: snoozeNotificationId,
    });
    await saveScheduledNotifications(scheduledNotifications);

    return snoozeNotificationId;
  } catch (error) {
    console.error('Error snoozing notification:', error);
    return null;
  }
};

// Send immediate task completion notification
export const sendTaskCompletionNotification = async (taskTitle: string, taskId: string): Promise<void> => {
  try {
    if (isWebPlatform()) {
      showWebNotification(
        '🎉 Task Completed!',
        `Congratulations! You've successfully completed "${taskTitle}"`
      );
      return;
    }

    if (isExpoGo() || !Device.isDevice) {
      console.log('Task completion notification not supported in current environment');
      return;
    }

    const settings = await getNotificationSettings();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎉 Task Completed!',
        body: `Congratulations! You've successfully completed "${taskTitle}"`,
        data: { taskId, type: 'task-completed' },
        sound: settings.soundEnabled ? 'default' : false,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: settings.vibrationEnabled ? [0, 250, 250, 250] : [],
      },
      trigger: {
        seconds: 1, // Send immediately
      },
    });

    console.log(`Task completion notification sent for: ${taskTitle}`);
  } catch (error) {
    console.error('Error sending task completion notification:', error);
  }
};

// Get notification statistics
export const getNotificationStats = async (): Promise<{
  totalScheduled: number;
  preStartCount: number;
  dueTimeCount: number;
  halfwayCount: number;
  finalWarningCount: number;
  upcomingCount: number;
}> => {
  try {
    const scheduledNotifications = await getScheduledNotifications();
    const now = new Date();

    const upcoming = scheduledNotifications.filter(n => n.scheduledTime > now);
    const preStartCount = upcoming.filter(n => n.type === 'pre-start').length;
    const dueTimeCount = upcoming.filter(n => n.type === 'due-time').length;
    const halfwayCount = upcoming.filter(n => n.type === 'halfway-reminder').length;
    const finalWarningCount = upcoming.filter(n => n.type === 'final-warning').length;

    return {
      totalScheduled: scheduledNotifications.length,
      preStartCount,
      dueTimeCount,
      halfwayCount,
      finalWarningCount,
      upcomingCount: upcoming.length,
    };
  } catch (error) {
    console.error('Error getting notification stats:', error);
    return {
      totalScheduled: 0,
      preStartCount: 0,
      dueTimeCount: 0,
      halfwayCount: 0,
      finalWarningCount: 0,
      upcomingCount: 0,
    };
  }
};