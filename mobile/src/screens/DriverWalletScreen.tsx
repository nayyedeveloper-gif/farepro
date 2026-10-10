import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/ui/Screen';
import AppBar from '../components/ui/AppBar';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { orgService, type MyWalletResponse, type WalletLedgerEntry, type TopupRequest } from '../services/orgService';
import { useUi } from '../contexts/UiContext';
import { wsClient } from '../utils/websocket';
import { T } from '../constants/design';
import { L, S } from '../constants/layout';
import { formatMMK } from '../utils/tripUtils';

const METHODS: Array<{ id: string; label: string; color: string }> = [
  { id: 'kbzpay', label: 'KBZPay', color: '#1d4ed8' },
  { id: 'wavepay', label: 'WavePay', color: '#eab308' },
  { id: 'ayapay', label: 'AYA Pay', color: '#dc2626' },
  { id: 'cbpay', label: 'CB Pay', color: '#0ea5e9' },
  { id: 'bank', label: 'Bank', color: '#64748b' },
  { id: 'cash', label: 'Cash', color: '#16a34a' },
];

const QUICK_AMOUNTS = [5000, 10000, 20000, 50000];

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  pending: { label: 'စစ်ဆေးနေသည်', color: T.busy },
  approved: { label: 'အတည်ပြုပြီး', color: T.online },
  rejected: { label: 'ငြင်းပယ်ခံရ', color: T.danger },
};

function ledgerLabel(e: WalletLedgerEntry): { title: string; icon: keyof typeof Ionicons.glyphMap } {
  const reason = e.reason || '';
  if (reason.startsWith('trip:')) return { title: 'Commission', icon: 'car-outline' };
  if (reason.startsWith('topup:')) return { title: 'Top-up', icon: 'add-circle-outline' };
  if (e.entryType === 'credit') return { title: reason || 'Credit', icon: 'add-circle-outline' };
  if (e.entryType === 'adjust') return { title: reason || 'Adjustment', icon: 'swap-horizontal-outline' };
  return { title: reason || 'Debit', icon: 'remove-circle-outline' };
}

function signedAmount(e: WalletLedgerEntry) {
  if (e.entryType === 'debit' || e.entryType === 'commission') return -Math.abs(e.amountMmk);
  return e.amountMmk;
}

export default function DriverWalletScreen() {
  const router = useRouter();
  const { showError, showBanner } = useUi();
  const [data, setData] = useState<MyWalletResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [method, setMethod] = useState('kbzpay');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await orgService.getMyWallet();
      setData(res.data as MyWalletResponse);
    } catch (err) {
      showError(err, 'Could not load wallet.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showError]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const unsub = wsClient.subscribe('wallet.topup_reviewed', (payload: unknown) => {
      const req = payload as TopupRequest;
      if (req?.status === 'approved') {
        showBanner(`Top-up ${formatMMK(req.amountMmk)} အတည်ပြုပြီးပါပြီ`, 'success');
      } else if (req?.status === 'rejected') {
        showBanner(`Top-up ငြင်းပယ်ခံရသည်${req.reviewNote ? `: ${req.reviewNote}` : ''}`, 'warning', 8000);
      }
      load();
    });
    return () => { unsub(); };
  }, [load, showBanner]);

  const submit = async () => {
    const amountMmk = Math.round(Number(amount.replace(/[^\d]/g, '')));
    if (!amountMmk || amountMmk < 500) {
      showBanner('ငွေပမာဏ အနည်းဆုံး 500 Ks ထည့်ပါ', 'warning');
      return;
    }
    if (method !== 'cash' && reference.trim().length < 4) {
      showBanner('Transaction ID (ငွေလွှဲအမှတ်) ထည့်ပါ', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      await orgService.createTopup({ amountMmk, method, reference: reference.trim(), note: note.trim() });
      showBanner('Top-up တောင်းဆိုမှု ပို့ပြီးပါပြီ — Owner အတည်ပြုရန် စောင့်ပါ', 'success');
      setAmount('');
      setReference('');
      setNote('');
      setShowForm(false);
      load();
    } catch (err) {
      showError(err, 'Could not submit top-up.');
    } finally {
      setSubmitting(false);
    }
  };

  const balance = data?.wallet?.balanceMmk ?? 0;
  const floor = data?.creditFloorMmk ?? -5000;
  const blocked = data ? !data.canReceiveJobs : false;
  const inDebt = balance < 0;
  const ledger = data?.ledger || [];
  const requests = data?.topupRequests || [];

  return (
    <Screen>
      <AppBar title="Wallet" subtitle="Commission & top-up" onBack={() => router.back()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={T.brand} />
          }
        >
          <Card glow style={blocked ? { ...styles.balanceCard, ...styles.balanceBlocked } : styles.balanceCard}>
            <Text style={styles.balanceLabel}>လက်ကျန်ငွေ</Text>
            <Text style={[styles.balance, inDebt && { color: T.danger }]}>
              {loading ? '—' : formatMMK(balance)}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: blocked ? T.dangerDim : T.pttDim }]}>
              <Ionicons name={blocked ? 'pause-circle' : 'checkmark-circle'} size={14} color={blocked ? T.danger : T.online} />
              <Text style={[styles.statusText, { color: blocked ? T.danger : T.online }]}>
                {blocked ? 'Job အသစ်များ ရပ်ထားသည် — ငွေဖြည့်ပါ' : 'Job များ လက်ခံနိုင်သည်'}
              </Text>
            </View>
            <Text style={styles.balanceHint}>
              ခရီးတစ်ခုစီ commission {data?.commissionRate ?? 10}% (အနည်းဆုံး {formatMMK(data?.commissionMin ?? 200)}) နုတ်ပါမည်။
              {' '}လက်ကျန် {formatMMK(floor)} အောက်ရောက်ပါက job အသစ်မရတော့ပါ။
            </Text>
            <Button
              label={showForm ? 'Close' : 'ငွေဖြည့်မည် (Top-up)'}
              variant={showForm ? 'outline' : 'brand'}
              onPress={() => setShowForm(v => !v)}
              fullWidth
              style={{ marginTop: S.md }}
            />
          </Card>

          {showForm && (
            <Card style={styles.card}>
              {!!data?.paymentInfo && (
                <View style={styles.payInfo}>
                  <View style={styles.payInfoHead}>
                    <Ionicons name="information-circle" size={16} color={T.brand} />
                    <Text style={styles.payInfoTitle}>Stand သို့ ငွေလွှဲရန်</Text>
                  </View>
                  <Text style={styles.payInfoText} selectable>{data.paymentInfo}</Text>
                </View>
              )}

              <Text style={styles.fieldLabel}>ငွေပေးချေနည်း</Text>
              <View style={styles.methods}>
                {METHODS.filter(m => !data?.topupMethods || data.topupMethods.includes(m.id)).map(m => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.method, method === m.id && { borderColor: m.color, backgroundColor: `${m.color}22` }]}
                    onPress={() => setMethod(m.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: method === m.id }}
                  >
                    <Text style={[styles.methodText, method === m.id && { color: T.text }]}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>ပမာဏ</Text>
              <View style={styles.quick}>
                {QUICK_AMOUNTS.map(a => (
                  <TouchableOpacity key={a} style={styles.quickBtn} onPress={() => setAmount(String(a))}>
                    <Text style={styles.quickText}>{a.toLocaleString()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Input
                placeholder="Amount (Ks)"
                keyboardType="number-pad"
                value={amount}
                onChangeText={setAmount}
                icon="cash-outline"
              />
              {method !== 'cash' && (
                <Input
                  label="Transaction ID"
                  placeholder="e.g. 0123456789012345"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={100}
                  value={reference}
                  onChangeText={setReference}
                  icon="receipt-outline"
                />
              )}
              <Input
                label="Note (optional)"
                placeholder="မှတ်ချက်"
                maxLength={500}
                value={note}
                onChangeText={setNote}
              />
              <Button label="Owner ထံ ပို့မည်" onPress={submit} loading={submitting} fullWidth style={{ marginTop: S.sm }} />
              <Text style={styles.formHint}>
                Owner က ငွေရောက်ကြောင်း စစ်ပြီး အတည်ပြုမှ wallet ထဲ ဝင်ပါမည်။
              </Text>
            </Card>
          )}

          {requests.length > 0 && (
            <>
              <Text style={styles.section}>Top-up requests</Text>
              <Card style={styles.listCard}>
                {requests.slice(0, 10).map((r, i) => {
                  const st = STATUS_STYLE[r.status] || { label: r.status, color: T.textMuted };
                  return (
                    <View key={r.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                      <View style={styles.rowMain}>
                        <Text style={styles.rowTitle}>
                          {METHODS.find(m => m.id === r.method)?.label || r.method}
                          {r.reference ? ` · ${r.reference}` : ''}
                        </Text>
                        <Text style={styles.rowSub}>
                          {new Date(r.createdAt).toLocaleString()}
                          {r.status === 'rejected' && r.reviewNote ? ` · ${r.reviewNote}` : ''}
                        </Text>
                      </View>
                      <View style={styles.rowRight}>
                        <Text style={styles.rowAmount}>{formatMMK(r.amountMmk)}</Text>
                        <Text style={[styles.rowStatus, { color: st.color }]}>{st.label}</Text>
                      </View>
                    </View>
                  );
                })}
              </Card>
            </>
          )}

          <Text style={styles.section}>History</Text>
          <Card style={styles.listCard}>
            {ledger.length === 0 ? (
              <Text style={styles.empty}>{loading ? 'Loading…' : 'No transactions yet'}</Text>
            ) : (
              ledger.map((e, i) => {
                const meta = ledgerLabel(e);
                const amt = signedAmount(e);
                return (
                  <View key={e.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                    <Ionicons name={meta.icon} size={20} color={amt < 0 ? T.danger : T.online} />
                    <View style={styles.rowMain}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{meta.title}</Text>
                      <Text style={styles.rowSub}>{new Date(e.createdAt).toLocaleString()}</Text>
                    </View>
                    <Text style={[styles.rowAmount, { color: amt < 0 ? T.danger : T.online }]}>
                      {amt < 0 ? '−' : '+'}{formatMMK(Math.abs(amt))}
                    </Text>
                  </View>
                );
              })
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingTop: S.md, paddingBottom: S.xxxl },
  balanceCard: { marginHorizontal: L.screenPadding, marginBottom: S.lg, alignItems: 'center' },
  balanceBlocked: { borderColor: T.danger, borderWidth: 1 },
  balanceLabel: { fontSize: T.fsSm, color: T.textMuted },
  balance: { fontSize: T.fsHero, fontWeight: '800', color: T.text, marginVertical: S.sm },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: S.md, paddingVertical: 6, borderRadius: T.rFull,
  },
  statusText: { fontSize: T.fsXs, fontWeight: '700' },
  balanceHint: { fontSize: T.fsXs, color: T.textMuted, textAlign: 'center', lineHeight: 18, marginTop: S.md },
  card: { marginHorizontal: L.screenPadding, marginBottom: S.lg, gap: S.sm },
  payInfo: { backgroundColor: T.brandDim, borderRadius: T.rMd, padding: S.md, marginBottom: S.sm },
  payInfoHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  payInfoTitle: { flex: 1, fontSize: T.fsSm, fontWeight: '700', color: T.brand },
  payInfoText: { fontSize: T.fsSm, color: T.text, lineHeight: 20 },
  fieldLabel: { fontSize: T.fsXs, fontWeight: '600', color: T.textMuted, marginTop: S.xs },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  method: {
    paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: T.rMd,
    borderWidth: 1, borderColor: T.borderStrong,
  },
  methodText: { fontSize: T.fsSm, fontWeight: '600', color: T.textSecondary },
  quick: { flexDirection: 'row', gap: S.sm },
  quickBtn: {
    flex: 1, alignItems: 'center', paddingVertical: S.sm, borderRadius: T.rMd, backgroundColor: T.surfaceRaised,
  },
  quickText: { fontSize: T.fsSm, fontWeight: '600', color: T.text },
  formHint: { fontSize: T.fsXs, color: T.textMuted, textAlign: 'center', marginTop: S.xs },
  section: {
    fontSize: T.fsXs, fontWeight: '600', color: T.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.8, marginHorizontal: L.screenPadding + S.xs, marginBottom: S.sm,
  },
  listCard: { marginHorizontal: L.screenPadding, marginBottom: S.lg, paddingVertical: S.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.md },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: T.fsMd, fontWeight: '600', color: T.text },
  rowSub: { fontSize: T.fsXs, color: T.textMuted, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  rowAmount: { fontSize: T.fsMd, fontWeight: '700', color: T.text },
  rowStatus: { fontSize: T.fsXs, fontWeight: '600', marginTop: 2 },
  empty: { fontSize: T.fsSm, color: T.textMuted, textAlign: 'center', paddingVertical: S.lg },
});
