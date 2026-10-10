import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { isCustomerApp } from '../config/appVariant';
import { T } from '../constants/design';

function DriverIndex() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: T.bg }}>
        <ActivityIndicator size="large" color={T.brand} />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/(tabs)/ptt" />;
  }

  return <Redirect href="/org-login" />;
}

export default function Index() {
  if (isCustomerApp) {
    return <Redirect href="/(customer)" />;
  }

  return <DriverIndex />;
}
