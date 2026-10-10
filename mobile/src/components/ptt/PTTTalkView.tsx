import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Image,
  Alert,
  ActionSheetIOS,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { T } from '../../constants/design';
import { L, S } from '../../constants/layout';
import IconButton from '../ui/IconButton';
import Banner from '../ui/Banner';

const WAVE_HEIGHTS = [0.3, 0.5, 0.9, 0.45, 1, 0.55, 0.75, 0.4, 0.65];

export interface PTTChannel {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  memberCount?: number;
  isPrivate?: boolean;
}

interface Props {
  channel: PTTChannel;
  avatarUrl?: string | null;
  activeSpeaker?: string | null;
  isTransmitting: boolean;
  isBusy: boolean;
  isOnline?: boolean;
  onBack: () => void;
  onTransmitStart: () => void;
  onTransmitEnd: () => void;
  onRefresh: () => void;
  onOpenProfile: () => void;
  onOpenMembers: () => void;
  onOpenFleet: () => void;
  onEmergency: () => void;
  error?: string | null;
  onClearError?: () => void;
}

function WaveformAvatar({ imageUrl, online }: { imageUrl?: string | null; online?: boolean }) {
  return (
    <View style={styles.avatarOuter}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.avatarImage} />
      ) : (
        <View style={styles.waveform}>
          {WAVE_HEIGHTS.map((h, i) => (
            <View key={i} style={[styles.waveBar, { height: 26 * h }]} />
          ))}
        </View>
      )}
      {online !== false && (
        <View style={styles.onlineBadge}>
          <Ionicons name="checkmark" size={10} color="#fff" />
        </View>
      )}
    </View>
  );
}

function TopNavItem({
  icon,
  active,
  onPress,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  onPress?: () => void;
  label: string;
}) {
  return (
    <TouchableOpacity
      style={styles.topNavItem}
      onPress={onPress}
      accessibilityLabel={label}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={24} color={active ? T.text : T.textSecondary} />
    </TouchableOpacity>
  );
}

export default function PTTTalkView({
  channel,
  avatarUrl,
  activeSpeaker,
  isTransmitting,
  isBusy,
  isOnline = true,
  onBack,
  onTransmitStart,
  onTransmitEnd,
  onRefresh,
  onOpenProfile,
  onOpenMembers,
  onOpenFleet,
  onEmergency,
  error,
  onClearError,
}: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [speakerOn, setSpeakerOn] = useState(true);
  const [handsetMode, setHandsetMode] = useState(false);

  const pttSize = Math.min(width * 0.62, 280);

  const subtitle = activeSpeaker
    ? `${activeSpeaker} is speaking`
    : isTransmitting
      ? 'You are transmitting'
      : channel.description?.trim() || 'Talk to me to test your audio';

  const showMoreMenu = () => {
    const options = ['Fleet map', 'Emergency alert', 'Channel info', 'Cancel'];
    const cancelButtonIndex = 3;

    const onSelect = (index?: number) => {
      if (index === 0) onOpenFleet();
      else if (index === 1) onEmergency();
      else if (index === 2) onOpenProfile();
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex, destructiveButtonIndex: 1 },
        onSelect,
      );
    } else {
      Alert.alert('Options', undefined, [
        { text: 'Fleet map', onPress: () => onOpenFleet() },
        { text: 'Emergency alert', style: 'destructive', onPress: () => onEmergency() },
        { text: 'Channel info', onPress: () => onOpenProfile() },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const innerSize = pttSize - 52;
  const ringSize = innerSize + 10;

  return (
    <View style={styles.root}>
      {/* Top app bar */}
      <View style={styles.topNav}>
        <IconButton icon="chevron-back" onPress={onBack} color={T.text} accessibilityLabel="Channels" />
        <View style={styles.topNavRight}>
          <View style={styles.topNavTabs}>
            <TopNavItem icon="mic-outline" active label="Talk" />
            <TopNavItem icon="chatbubble-ellipses-outline" onPress={onOpenMembers} label="Messages" />
            <View style={styles.topNavUnderline} />
          </View>
          <IconButton icon="ellipsis-vertical" onPress={showMoreMenu} color={T.text} accessibilityLabel="More" />
        </View>
      </View>

      {error ? <Banner type="error" message={error} onDismiss={onClearError} /> : null}

      {/* Channel strip */}
      <View style={styles.channelStrip}>
        <TouchableOpacity style={styles.channelStripMain} onPress={onOpenProfile} activeOpacity={0.85}>
          <WaveformAvatar imageUrl={avatarUrl} online={isOnline} />
          <View style={styles.channelText}>
            <Text style={styles.channelName} numberOfLines={1}>{channel.name}</Text>
            <Text style={styles.channelSub} numberOfLines={2}>{subtitle}</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.channelActions}>
          <IconButton icon="refresh-outline" onPress={onRefresh} color={T.text} accessibilityLabel="Refresh" />
          <IconButton icon="chevron-down" onPress={onOpenProfile} color={T.text} accessibilityLabel="Details" />
        </View>
      </View>

      {/* Hero PTT — press & hold */}
      <View style={styles.pttArea}>
        <Pressable
          onPressIn={() => {
            if (!isBusy || isTransmitting) onTransmitStart();
          }}
          onPressOut={() => {
            if (isTransmitting) onTransmitEnd();
          }}
          disabled={isBusy && !isTransmitting}
          style={({ pressed }) => [
            styles.pttOuter,
            {
              width: pttSize,
              height: pttSize,
              borderRadius: pttSize / 2,
              opacity: pressed ? 0.92 : 1,
            },
            isTransmitting && styles.pttOuterActive,
            isBusy && !isTransmitting && styles.pttOuterBusy,
          ]}
          accessibilityLabel="Push to talk"
        >
          <View
            style={[
              styles.pttMidRing,
              {
                width: pttSize - 20,
                height: pttSize - 20,
                borderRadius: (pttSize - 20) / 2,
              },
            ]}
          >
            <View
              style={[
                styles.pttOrangeRing,
                {
                  width: ringSize,
                  height: ringSize,
                  borderRadius: ringSize / 2,
                },
                isTransmitting && styles.pttOrangeRingActive,
              ]}
            >
              <View
                style={[
                  styles.pttInner,
                  {
                    width: innerSize,
                    height: innerSize,
                    borderRadius: innerSize / 2,
                  },
                  isTransmitting && styles.pttInnerActive,
                ]}
              >
                {isBusy && !isTransmitting ? (
                  <Ionicons name="volume-high" size={56} color={T.textMuted} />
                ) : (
                  <Ionicons name="mic" size={56} color="#fff" />
                )}
              </View>
            </View>
          </View>
        </Pressable>

        {(activeSpeaker || isTransmitting) && (
          <Text style={styles.txHint}>
            {isTransmitting ? 'Release to stop' : `${activeSpeaker} is speaking`}
          </Text>
        )}
      </View>

      {/* Bottom toolbar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomLeft}>
          <IconButton
            icon={speakerOn ? 'volume-high-outline' : 'volume-mute-outline'}
            onPress={() => setSpeakerOn(v => !v)}
            color={T.text}
            size={26}
            accessibilityLabel="Speaker"
          />
          <IconButton
            icon="phone-portrait-outline"
            onPress={() => setHandsetMode(v => !v)}
            color={handsetMode ? T.brand : T.text}
            size={26}
            accessibilityLabel="Handset"
          />
        </View>
        <View style={styles.bottomRight}>
          <Ionicons
            name="cellular-outline"
            size={26}
            color={isOnline ? T.text : T.textMuted}
            style={styles.signalIcon}
          />
          <IconButton
            icon="options-outline"
            onPress={() => router.push('/settings' as never)}
            color={T.text}
            size={26}
            accessibilityLabel="Audio settings"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S.sm,
    height: 48,
    backgroundColor: '#0a0a0a',
  },
  topNavRight: { flexDirection: 'row', alignItems: 'center' },
  topNavTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    paddingBottom: 3,
  },
  topNavUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 6,
    right: 6,
    height: 3,
    borderRadius: 2,
    backgroundColor: T.brand,
  },
  topNavItem: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingRight: S.xs,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  channelStripMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: L.screenPadding,
    gap: S.md,
  },
  avatarOuter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#3a3f45',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 54, height: 54, borderRadius: 27 },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 30,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  onlineBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: T.online,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  channelText: { flex: 1 },
  channelName: { fontSize: 18, fontWeight: '700', color: '#fff' },
  channelSub: { fontSize: T.fsSm, color: 'rgba(255,255,255,0.45)', marginTop: 3, lineHeight: 18 },
  channelActions: { flexDirection: 'row', alignItems: 'center' },
  pttArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: S.xxl,
  },
  pttOuter: {
    backgroundColor: '#1e2126',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  pttOuterActive: {
    shadowColor: T.brand,
    shadowOpacity: 0.35,
  },
  pttOuterBusy: {
    opacity: 0.75,
  },
  pttMidRing: {
    backgroundColor: '#353b42',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pttOrangeRing: {
    borderWidth: 3,
    borderColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  pttOrangeRingActive: {
    borderColor: T.brand,
    borderWidth: 4,
  },
  pttInner: {
    backgroundColor: '#2a2f35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pttInnerActive: {
    backgroundColor: '#3d3428',
  },
  txHint: {
    marginTop: S.xl,
    fontSize: T.fsSm,
    color: T.brand,
    fontWeight: '600',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: L.screenPadding,
    paddingBottom: S.lg,
    paddingTop: S.md,
  },
  bottomLeft: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  bottomRight: { flexDirection: 'row', alignItems: 'center', gap: S.lg },
  signalIcon: { marginRight: S.xs },
});
