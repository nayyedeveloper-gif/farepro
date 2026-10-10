import React from 'react';
import { View, TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../../constants/design';
import { L, S } from '../../constants/layout';

interface Props extends TextInputProps {
  value: string;
  onChangeText: (t: string) => void;
}

export default function SearchField({ value, onChangeText, placeholder = 'Search', ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="search" size={18} color={T.textMuted} style={styles.icon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={T.textFaint}
        value={value}
        onChangeText={onChangeText}
        selectionColor={T.brand}
        clearButtonMode="while-editing"
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: L.searchHeight,
    marginHorizontal: L.screenPadding,
    marginBottom: S.md,
    paddingHorizontal: S.lg,
    borderRadius: T.rMd,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
  },
  icon: { marginRight: S.sm },
  input: { flex: 1, fontSize: T.fsMd, color: T.text, paddingVertical: 0 },
});
