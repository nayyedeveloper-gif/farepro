import Constants from 'expo-constants';

export type AppVariant = 'driver' | 'customer';

const variant = (Constants.expoConfig?.extra?.appVariant as AppVariant) || 'driver';

export const isDriverApp = variant === 'driver';
export const isCustomerApp = variant === 'customer';
export const appVariant = variant;
