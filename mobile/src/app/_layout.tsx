import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../contexts/AuthContext';
import { UiProvider } from '../contexts/UiContext';
import { CallProvider } from '../contexts/CallContext';
import { PTTProvider } from '../contexts/PTTContext';
import IncomingCallModal from '../components/IncomingCallModal';
import ActiveCallScreen from '../screens/ActiveCallScreen';
import { addNotificationResponseListener } from '../utils/notifications';
import { isCustomerApp } from '../config/appVariant';

function NotificationHandler() {
  const router = useRouter();

  useEffect(() => {
    if (isCustomerApp) return;
    const subscription = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;

      if (data?.type === 'call' && data?.conversationId) {
        router.push(`/chat?conversationId=${data.conversationId}`);
      } else if (data?.type === 'message' && data?.conversationId) {
        router.push(`/chat?conversationId=${data.conversationId}`);
      }
    });

    return () => subscription.remove();
  }, [router]);

  return null;
}

function CustomerRoot() {
  return (
    <SafeAreaProvider>
      <UiProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(customer)" />
        </Stack>
      </UiProvider>
    </SafeAreaProvider>
  );
}

function DriverRoot() {
  return (
    <SafeAreaProvider>
      <UiProvider>
        <AuthProvider>
          <CallProvider>
            <PTTProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="org-login" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="meter" />
              </Stack>
              <NotificationHandler />
              <IncomingCallModal />
              <ActiveCallScreen />
            </PTTProvider>
          </CallProvider>
        </AuthProvider>
      </UiProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return isCustomerApp ? <CustomerRoot /> : <DriverRoot />;
}
