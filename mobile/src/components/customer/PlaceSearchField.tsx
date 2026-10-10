import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Input from '../ui/Input';
import { geocodeService, type PlaceResult } from '../../services/geocodeService';
import { T } from '../../constants/design';
import { S } from '../../constants/layout';

interface Props {
  label: string;
  placeholder: string;
  value: PlaceResult | null;
  onChange: (place: PlaceResult | null) => void;
}

export default function PlaceSearchField({ label, placeholder, value, onChange }: Props) {
  const [query, setQuery] = useState(value?.shortName || '');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value) setQuery(value.shortName);
  }, [value]);

  const handleChange = (text: string) => {
    setQuery(text);
    onChange(null);
    if (timer.current) clearTimeout(timer.current);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await geocodeService.search(text.trim());
        setResults(res.data || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  const pick = (place: PlaceResult) => {
    setQuery(place.shortName);
    setResults([]);
    onChange(place);
  };

  return (
    <View style={styles.wrap}>
      <Input
        label={label}
        placeholder={placeholder}
        value={query}
        onChangeText={handleChange}
        icon="location-outline"
      />
      {searching && <ActivityIndicator size="small" color={T.brand} style={styles.spinner} />}
      {results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item, i) => `${item.lat}-${item.lng}-${i}`}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => pick(item)}>
              <Text style={styles.rowTitle} numberOfLines={1}>{item.shortName}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>{item.displayName}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: S.sm },
  spinner: { marginTop: -8, marginBottom: S.sm },
  list: {
    maxHeight: 180,
    borderRadius: T.rMd,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
    marginBottom: S.md,
  },
  row: { paddingHorizontal: S.lg, paddingVertical: S.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border },
  rowTitle: { fontSize: T.fsMd, color: T.text, fontWeight: '500' },
  rowSub: { fontSize: T.fsXs, color: T.textMuted, marginTop: 2 },
});
