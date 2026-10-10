import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../../constants/design';

interface Props extends TextInputProps {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  secureToggle?: boolean;
  secureVisible?: boolean;
  onSecureToggle?: () => void;
}

export default function Input({
  label, icon, secureToggle, secureVisible, onSecureToggle, style, ...rest
}: Props) {
  return (
    <View style={styles.wrap}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.field}>
        {icon && <Ionicons name={icon} size={18} color={T.textMuted} style={styles.icon} />}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={T.textFaint}
          selectionColor={T.brand}
          {...rest}
        />
        {secureToggle && (
          <TouchableOpacity onPress={onSecureToggle} hitSlop={8}>
            <Ionicons
              name={secureVisible ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={T.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: T.fsSm, fontWeight: '500', color: T.textSecondary, marginBottom: 8 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: T.rMd,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surfaceGlass,
    paddingHorizontal: 14,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: T.fsMd, color: T.text },
});
