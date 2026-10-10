import React from 'react';
import SettingsPageShell from '../SettingsPageShell';
import SettingsGroup from '../SettingsGroup';
import SettingsRow from '../SettingsRow';
import { BrandMark } from '../../brand/BrandMark';

interface AboutPageProps {
  onBack: () => void;
}

const AboutPage: React.FC<AboutPageProps> = ({ onBack }) => (
  <SettingsPageShell title="About" onBack={onBack}>
    <div className="zello-about-logo-wrap">
      <BrandMark size={72} />
      <p className="zello-about-appname">FarePro</p>
      <p className="zello-about-version">Version 1.0.0</p>
    </div>

    <SettingsGroup label="App Info">
      <SettingsRow label="Version" value="1.0.0" showArrow={false} />
      <div className="tg-set-divider" />
      <SettingsRow label="Platform" value="Web" showArrow={false} />
      <div className="tg-set-divider" />
      <SettingsRow label="Build" value="Production" showArrow={false} />
    </SettingsGroup>

    <SettingsGroup label="Legal">
      <SettingsRow label="Terms of Service" onClick={() => {}} />
      <div className="tg-set-divider" />
      <SettingsRow label="Privacy Policy" onClick={() => {}} />
    </SettingsGroup>
  </SettingsPageShell>
);

export default AboutPage;
