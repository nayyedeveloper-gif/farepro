import React from 'react';
import { useUi } from '../../contexts/UiContext';
import Banner from './Banner';

export default function GlobalBanner() {
  const { banner, hideBanner } = useUi();
  if (!banner) return null;
  return (
    <Banner
      type={banner.type}
      message={banner.message}
      onDismiss={hideBanner}
    />
  );
}
