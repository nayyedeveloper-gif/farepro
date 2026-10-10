import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, Image, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import Screen from '../components/ui/Screen';
import AppBar from '../components/ui/AppBar';
import { T } from '../constants/design';
import { L, S } from '../constants/layout';
import { orgService } from '../services/orgService';
import { useAuth } from '../contexts/AuthContext';
import { useUi } from '../contexts/UiContext';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { normalizeMyanmarPhone } from '../utils/phoneUtils';
import { API_URL } from '../config/api';
import type { User } from '../types';

export default function OrgLoginScreen() {
  const router = useRouter();
  const { setSession } = useAuth();
  const { showError } = useUi();
  const [subdomain, setSubdomain] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const sub = subdomain.trim().toLowerCase();
    const normalizedPhone = normalizeMyanmarPhone(phone);
    if (!sub || !normalizedPhone || !password) {
      Alert.alert('Error', 'Subdomain, phone, and password are required');
      return;
    }
    setLoading(true);
    try {
      const res = await orgService.login({ phone: normalizedPhone, password }, sub);
      const data = res.data as { token?: string; user?: User; organization?: { name?: string } };
      if (data?.token && data?.user) {
        await setSession(data.token, data.user);
        router.replace('/(tabs)/ptt' as never);
      }
    } catch (err: unknown) {
      showError(err, 'Sign in failed. Check subdomain, phone, and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <AppBar title="Driver Sign In" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.logoWrap}>
              <Image source={require('../../assets/images/icon.png')} style={styles.logo} />
            </View>
            <Text style={styles.title}>FarePro Driver</Text>
            <Text style={styles.sub}>PTT, jobs & fleet tools</Text>
          </View>

          <Card glow style={styles.form}>
            <Text style={styles.fieldLabel}>Taxi stand code</Text>
            <View style={styles.subdomainRow}>
              <TextInput
                style={styles.subdomainInput}
                placeholder="yourstand"
                placeholderTextColor={T.textFaint}
                value={subdomain}
                onChangeText={t => setSubdomain(t.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Input
              label="Phone"
              icon="call-outline"
              placeholder="09xxxxxxxxx"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Input
              label="Password"
              icon="lock-closed-outline"
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              secureToggle
              secureVisible={showPassword}
              onSecureToggle={() => setShowPassword(v => !v)}
            />
            <Button label={loading ? 'Signing in…' : 'Sign In'} onPress={handleLogin} loading={loading} fullWidth />
          </Card>

          {__DEV__ && (
            <Text style={styles.devHint}>API: {API_URL}</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: L.screenPadding, paddingBottom: S.xxxl },
  hero: { alignItems: 'center', paddingVertical: S.xxl },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: T.brandDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logo: { width: 48, height: 48, borderRadius: 12 },
  title: { fontSize: T.fsXl, fontWeight: '700', color: T.text },
  sub: { fontSize: T.fsSm, color: T.textMuted, marginTop: 6 },
  form: { marginBottom: 16 },
  fieldLabel: { fontSize: T.fsSm, color: T.textSecondary, marginBottom: 8 },
  subdomainRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  subdomainInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: T.rMd,
    paddingHorizontal: 14,
    color: T.text,
    fontSize: T.fsMd,
    backgroundColor: T.surfaceGlass,
  },
  devHint: { fontSize: T.fsXs, color: T.textFaint, textAlign: 'center', marginTop: 8 },
});
