import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Screen from '../../components/ui/Screen';
import AppBar from '../../components/ui/AppBar';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { T } from '../../constants/design';
import { L, S } from '../../constants/layout';

export default function StandPickerScreen() {
  const router = useRouter();
  const [subdomain, setSubdomain] = useState('');

  const goBook = (sub: string) => {
    router.push({ pathname: '/(customer)/book', params: { subdomain: sub.trim().toLowerCase() } } as never);
  };

  return (
    <Screen>
      <AppBar title="FarePro Ride" subtitle="Kilo Taxi မှာယူရန်" variant="large" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.lead}>Stand code ထည့်ပြီး မှာယူပါ</Text>

        <Card style={styles.card}>
          <Input
            label="Stand code (subdomain)"
            placeholder="yourstand"
            value={subdomain}
            onChangeText={setSubdomain}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            label="Continue"
            onPress={() => goBook(subdomain)}
            disabled={!subdomain.trim()}
            fullWidth
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: S.xxxl },
  lead: { fontSize: T.fsSm, color: T.textMuted, marginHorizontal: L.screenPadding, marginBottom: S.lg, lineHeight: 20 },
  card: { marginHorizontal: L.screenPadding, marginBottom: S.md },
  standName: { fontSize: T.fsLg, fontWeight: '600', color: T.text },
  standCode: { fontSize: T.fsSm, color: T.brand, marginTop: S.xs },
});
