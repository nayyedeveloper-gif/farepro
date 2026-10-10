import { useEffect, useRef, useState } from 'react';
import { geocodeAPI, type PlaceResult } from '../../services/geocodeApi';

export type SelectedPlace = PlaceResult;

interface PlaceSearchInputProps {
  id: string;
  label: string;
  placeholder: string;
  value: SelectedPlace | null;
  onChange: (place: SelectedPlace | null) => void;
  onUseMyLocation?: () => void;
  locating?: boolean;
}

export default function PlaceSearchInput({
  id,
  label,
  placeholder,
  value,
  onChange,
  onUseMyLocation,
  locating,
}: PlaceSearchInputProps) {
  const [query, setQuery] = useState(value?.shortName || '');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value?.shortName || '');
  }, [value]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const runSearch = (text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await geocodeAPI.search(text.trim());
        setResults(res.data || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  const handleInput = (text: string) => {
    setQuery(text);
    if (value && text !== value.shortName) {
      onChange(null);
    }
    runSearch(text);
  };

  const pick = (place: PlaceResult) => {
    onChange(place);
    setQuery(place.shortName);
    setOpen(false);
    setResults([]);
  };

  return (
    <div className="cb-place-field" ref={wrapRef}>
      <div className="cb-place-label-row">
        <label htmlFor={id}>{label}</label>
        {onUseMyLocation && (
          <button type="button" className="cb-locate-btn" onClick={onUseMyLocation} disabled={locating}>
            {locating ? '...' : '📍 လက်ရှိနေရာ'}
          </button>
        )}
      </div>
      <input
        id={id}
        type="text"
        value={query}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        placeholder={placeholder}
        autoComplete="off"
        required={!value}
      />
      {value && <span className="cb-place-coords">✓ {value.lat.toFixed(4)}, {value.lng.toFixed(4)}</span>}
      {(open && results.length > 0) && (
        <ul className="cb-place-results" role="listbox">
          {results.map((r, i) => (
            <li key={`${r.lat}-${r.lng}-${i}`}>
              <button type="button" onClick={() => pick(r)}>
                <strong>{r.shortName}</strong>
                <span>{r.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {searching && <span className="cb-place-hint">ရှာဖွေနေသည်...</span>}
      {!searching && query.length >= 2 && results.length === 0 && open && (
        <span className="cb-place-hint">နေရာ မတွေ့ပါ — English သို့မဟုတ် မြန်မာအမည် ထပ်ရှာကြည့်ပါ</span>
      )}
    </div>
  );
}
