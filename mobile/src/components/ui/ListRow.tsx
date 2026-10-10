import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../../constants/design';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  showChevron?: boolean;
  iconColor?: string;
}

export default function ListRow({
  icon, label, hint, value, onPress, danger, showChevron = true, iconColor,
}: Props) {
  const color = iconColor ?? (danger ? T.danger : T.brand);
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.iconWrap, { backgroundColor: danger ? T.dangerDim : T.brandDim }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.label, danger && { color: T.danger }]}>{label}</Text>
        {hint && <Text style={styles.hint}>{hint}</Text>}
        {value && <Text style={styles.value}>{value}</Text>}
      </View>
      {showChevron && onPress && <Ionicons name="chevron-forward" size={18} color={T.textFaint} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: T.rSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1 },
  label: { fontSize: T.fsMd, fontWeight: '500', color: T.text },
  hint: { fontSize: T.fsXs, color: T.textMuted, marginTop: 2 },
  value: { fontSize: T.fsSm, color: T.textSecondary, marginTop: 2 },
});
