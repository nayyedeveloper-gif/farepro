import React, { useEffect, useState } from 'react';
import SettingsPageShell from '../SettingsPageShell';
import SettingsGroup from '../SettingsGroup';
import SettingsToggle from '../SettingsToggle';

interface PrivacySecurityPageProps {
  onBack: () => void;
}

const PrivacySecurityPage: React.FC<PrivacySecurityPageProps> = ({ onBack }) => {
  const [showPhone, setShowPhone] = useState(() => localStorage.getItem('priv_showPhone') !== 'false');
  const [showLastSeen, setShowLastSeen] = useState(() => localStorage.getItem('priv_showLastSeen') !== 'false');
  const [showReadReceipts, setShowReadReceipts] = useState(() => localStorage.getItem('priv_readReceipts') !== 'false');

  useEffect(() => { localStorage.setItem('priv_showPhone', String(showPhone)); }, [showPhone]);
  useEffect(() => { localStorage.setItem('priv_showLastSeen', String(showLastSeen)); }, [showLastSeen]);
  useEffect(() => { localStorage.setItem('priv_readReceipts', String(showReadReceipts)); }, [showReadReceipts]);

  return (
    <SettingsPageShell title="Privacy and Security" onBack={onBack}>
      <SettingsGroup label="Privacy" footer="These preferences are saved locally on this device.">
        <SettingsToggle
          label="Phone Number"
          hint="Who can see my phone number"
          checked={showPhone}
          onChange={setShowPhone}
        />
        <div className="tg-set-divider" />
        <SettingsToggle
          label="Last Seen & Online"
          hint="Who can see when you were last online"
          checked={showLastSeen}
          onChange={setShowLastSeen}
        />
        <div className="tg-set-divider" />
        <SettingsToggle
          label="Read Receipts"
          hint="Show double-check when messages are read"
          checked={showReadReceipts}
          onChange={setShowReadReceipts}
        />
      </SettingsGroup>
    </SettingsPageShell>
  );
};

export default PrivacySecurityPage;
