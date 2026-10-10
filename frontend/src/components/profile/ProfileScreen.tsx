import React from 'react';
import SettingsScreen from '../settings/SettingsScreen';

interface ProfileScreenProps {
  onClose: () => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ onClose }) => (
  <SettingsScreen onClose={onClose} />
);

export default ProfileScreen;
