import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { T } from '../../constants/design';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

export default function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.track}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: T.surface,
    borderRadius: T.rMd,
    padding: 4,
    borderWidth: 1,
    borderColor: T.border,
  },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: T.rSm },
  segmentActive: { backgroundColor: T.brandDim },
  label: { fontSize: T.fsSm, fontWeight: '600', color: T.textMuted },
  labelActive: { color: T.brand },
});
