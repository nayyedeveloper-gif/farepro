import { Platform } from 'react-native';

// Import expo-notifications (requires development build for SDK 53+)
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
  // Configure notification behavior
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (e) {
  console.warn('expo-notifications not available. Notifications will not work in Expo Go SDK 53+. Use a development build for full notification support.');
}

// Request notification permissions
export async function requestNotificationPermissions() {
  if (!Notifications) return false;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Notification permissions not granted');
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F26522',
    });

    await Notifications.setNotificationChannelAsync('calls', {
      name: 'Calls',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250, 250, 250],
      lightColor: '#F26522',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250],
      lightColor: '#F26522',
      sound: 'default',
    });
  }

  return true;
}

// Get permission status without prompting
export async function getNotificationPermissionStatus(): Promise<string> {
  if (!Notifications) return 'undetermined';
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

// Get push notification token
export async function getPushToken() {
  if (!Notifications) return null;

  const permissionsGranted = await requestNotificationPermissions();
  if (!permissionsGranted) return null;

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: 'your-project-id', // Replace with your Expo project ID
  });

  return token.data;
}

// Schedule local notification for incoming call
export async function scheduleCallNotification({
  callerName,
  callType,
  conversationId,
}: {
  callerName: string;
  callType: 'audio' | 'video';
  conversationId: string;
}) {
  if (!Notifications) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${callType === 'video' ? 'Video' : 'Audio'} Call`,
      body: `${callerName} is calling you`,
      data: { type: 'call', conversationId, callType },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      categoryIdentifier: 'calls',
    },
    trigger: null, // Show immediately
  });
}

// Schedule local notification for new message
export async function scheduleMessageNotification({
  senderName,
  message,
  conversationId,
}: {
  senderName: string;
  message: string;
  conversationId: string;
}) {
  if (!Notifications) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: senderName,
      body: message.length > 50 ? message.substring(0, 50) + '...' : message,
      data: { type: 'message', conversationId },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
      categoryIdentifier: 'messages',
    },
    trigger: null, // Show immediately
  });
}

// Cancel all notifications
export async function cancelAllNotifications() {
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
}

// Add notification response listener
export function addNotificationResponseListener(
  handler: (response: any) => void
) {
  if (!Notifications) return { remove: () => {} };
  return Notifications.addNotificationResponseReceivedListener(handler);
}

// Add notification received listener (foreground)
export function addNotificationReceivedListener(
  handler: (notification: any) => void
) {
  if (!Notifications) return { remove: () => {} };
  return Notifications.addNotificationReceivedListener(handler);
}
