/** Normalize Myanmar mobile input to 09xxxxxxxxx for API lookup */
export function normalizeMyanmarPhone(input: string): string {
  let p = input.trim().replace(/[\s-]/g, '');
  if (p.startsWith('+959')) return `0${p.slice(4)}`;
  if (p.startsWith('959')) return `0${p.slice(3)}`;
  if (p.startsWith('9') && p.length === 10) return `0${p}`;
  return p;
}
