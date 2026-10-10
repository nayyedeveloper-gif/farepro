import { Platform } from 'react-native';

// Conditional import for expo-notifications (requires development build for SDK 53+)
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
  // Configure notification behavior for calls
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
  console.warn('expo-notifications not available. Call notifications require development build.');
}

// Call notification channels for Android
export async function setupCallNotificationChannels() {
  if (!Notifications || Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('incoming_call', {
    name: 'Incoming Calls',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250, 250, 250],
    lightColor: '#208AEF',
    sound: 'default',
    enableVibrate: true,
    bypassDnd: true,
  });

  await Notifications.setNotificationChannelAsync('call_ended', {
    name: 'Call Ended',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250],
    lightColor: '#208AEF',
    sound: 'default',
  });
}

// Schedule incoming call notification (works even when app is closed)
export async function scheduleIncomingCallNotification({
  callerName,
  callType,
  conversationId,
  callId,
}: {
  callerName: string;
  callType: 'audio' | 'video';
  conversationId: string;
  callId: string;
}) {
  if (!Notifications) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${callType === 'video' ? 'Video' : 'Audio'} Call`,
      body: `${callerName} is calling you`,
      data: {
        type: 'incoming_call',
        conversationId,
        callId,
        callType,
        callerName,
      },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      categoryIdentifier: 'incoming_call',
      sticky: true, // Keep notification visible
    },
    trigger: null, // Show immediately
  });
}

// Schedule call ended notification
export async function scheduleCallEndedNotification({
  callerName,
  duration,
}: {
  callerName: string;
  duration?: number;
}) {
  if (!Notifications) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Call Ended',
      body: duration
        ? `Call with ${callerName} ended (${Math.floor(duration / 60)}m ${duration % 60}s)`
        : `Call with ${callerName} ended`,
      data: { type: 'call_ended' },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
      categoryIdentifier: 'call_ended',
    },
    trigger: null,
  });
}

// Cancel call notification
export async function cancelCallNotification() {
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// Handle notification response (tap on notification)
export function setupNotificationResponseHandler(handler: (data: any) => void) {
  if (!Notifications) return { remove: () => {} };
  return Notifications.addNotificationResponseReceivedListener((response: any) => {
    const data = response.notification.request.content.data;
    handler(data);
  });
}

// Handle notification received (foreground)
export function setupNotificationReceivedHandler(handler: (notification: any) => void) {
  if (!Notifications) return { remove: () => {} };
  return Notifications.addNotificationReceivedListener(handler);
}
