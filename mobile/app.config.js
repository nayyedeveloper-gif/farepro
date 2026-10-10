/** @type {import('expo/config').ExpoConfig} */
const variant = process.env.APP_VARIANT || 'driver';
const base = require('./app.json').expo;

const isCustomer = variant === 'customer';

module.exports = {
  expo: {
    ...base,
    name: isCustomer ? 'TeamLink Ride' : 'TeamLink Driver',
    slug: isCustomer ? 'teamlink-ride' : 'teamlink-driver',
    scheme: isCustomer ? 'teamlink-ride' : 'teamlink-driver',
    extra: {
      ...base.extra,
      appVariant: variant,
    },
    ios: {
      ...base.ios,
      bundleIdentifier: isCustomer
        ? 'com.nayyemaung.teamlink.customer'
        : 'com.nayyemaung.teamlink.driver',
    },
    android: {
      ...base.android,
      package: isCustomer
        ? 'com.nayyemaung.teamlink.customer'
        : 'com.nayyemaung.teamlink.driver',
    },
  },
};
