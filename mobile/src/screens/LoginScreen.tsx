import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Screen from '../components/ui/Screen';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { useUi } from '../contexts/UiContext';
import { T } from '../constants/design';
import { L, S } from '../constants/layout';

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { showError } = useUi();

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setIsLoading(true);
    try {
      await login(phone, password);
      router.replace('/(tabs)/ptt');
    } catch (error: unknown) {
      showError(error, 'Invalid credentials. Check your phone and password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.logoRing}>
              <Image source={require('../../assets/images/icon.png')} style={styles.logo} />
            </View>
            <Text style={styles.brand}>TeamLink</Text>
            <Text style={styles.tagline}>Push-to-talk for teams that move</Text>
          </View>

          <Card glow style={styles.card}>
            <Input
              label="Phone Number"
              icon="call-outline"
              placeholder="+959..."
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
            <Input
              label="Password"
              icon="lock-closed-outline"
              placeholder="Enter password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              secureToggle
              secureVisible={showPassword}
              onSecureToggle={() => setShowPassword(v => !v)}
            />
            <Button label="Sign In" onPress={handleLogin} loading={isLoading} fullWidth />
          </Card>

          <TouchableOpacity onPress={() => router.push('/register')} style={styles.link}>
            <Text style={styles.linkText}>New here? </Text>
            <Text style={styles.linkBold}>Create account</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/org-login' as never)} style={styles.orgLink}>
            <Text style={styles.orgText}>Sign in with organization →</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: L.screenPadding, paddingTop: S.xxxl * 2 },
  hero: { alignItems: 'center', marginBottom: 32 },
  logoRing: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: T.brandDim,
    borderWidth: 2,
    borderColor: T.brandGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logo: { width: 56, height: 56, borderRadius: 14 },
  brand: { fontSize: T.fsHero, fontWeight: '800', color: T.text, letterSpacing: -0.5 },
  tagline: { fontSize: T.fsSm, color: T.textMuted, marginTop: 8 },
  card: { marginBottom: 20 },
  link: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  linkText: { color: T.textMuted, fontSize: T.fsMd },
  linkBold: { color: T.brand, fontWeight: '600', fontSize: T.fsMd },
  orgLink: { alignItems: 'center', marginTop: 20 },
  orgText: { color: T.textSecondary, fontSize: T.fsSm },
});
