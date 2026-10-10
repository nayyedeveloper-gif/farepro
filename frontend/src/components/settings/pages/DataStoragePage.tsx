import React, { useEffect, useState } from 'react';
import SettingsPageShell from '../SettingsPageShell';
import SettingsGroup from '../SettingsGroup';
import SettingsToggle from '../SettingsToggle';
import SettingsRow from '../SettingsRow';
import { DatabaseIcon } from '../../icons/Icons';

interface DataStoragePageProps {
  onBack: () => void;
}

const DataStoragePage: React.FC<DataStoragePageProps> = ({ onBack }) => {
  const [autoDownload, setAutoDownload] = useState(() => localStorage.getItem('data_autoDownload') !== 'false');

  useEffect(() => { localStorage.setItem('data_autoDownload', String(autoDownload)); }, [autoDownload]);

  return (
    <SettingsPageShell title="Data and Storage" onBack={onBack}>
      <SettingsGroup label="Automatic Media Download">
        <SettingsToggle
          label="Auto-Download Media"
          hint="Automatically download photos and files"
          checked={autoDownload}
          onChange={setAutoDownload}
        />
      </SettingsGroup>

      <SettingsGroup label="Storage Usage">
        <SettingsRow label="Cache Size" value="—" showArrow={false} />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow
          icon={<DatabaseIcon size={18} />}
          label="Clear Cache and Reload"
          onClick={() => { localStorage.clear(); window.location.reload(); }}
        />
      </SettingsGroup>
    </SettingsPageShell>
  );
};

export default DataStoragePage;
