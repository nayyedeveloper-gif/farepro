export const TRIP_STATUS: Record<string, { label: string; labelMm: string; color: string }> = {
  assigned: { label: 'Awaiting you', labelMm: 'လက်ခံရန် စောင့်', color: '#f39c12' },
  en_route: { label: 'En route', labelMm: 'လာရောက်နေ', color: '#3b82f6' },
  arrived: { label: 'At pickup', labelMm: 'ရောက်ရှိပြီး', color: '#2d9c78' },
  completed: { label: 'Done', labelMm: 'ပြီးဆုံး', color: '#5c6b7a' },
  cancelled: { label: 'Cancelled', labelMm: 'ပယ်ဖျက်', color: '#e74c3c' },
};

export const TRIP_STEPS = ['assigned', 'en_route', 'arrived', 'completed'] as const;

export function formatMMK(amount: number): string {
  return `${amount.toLocaleString()} MMK`;
}

export function driverDisplayName(driver?: { firstName?: string; lastName?: string; username?: string }) {
  if (!driver) return '';
  const name = [driver.firstName, driver.lastName].filter(Boolean).join(' ');
  return name || driver.username || '';
}
