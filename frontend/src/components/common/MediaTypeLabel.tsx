import React from 'react';
import { ImageIcon, VideoIcon, MicIcon, FileIcon } from '../icons/Icons';

type MediaType = 'image' | 'video' | 'audio' | 'file';

const CONFIG: Record<MediaType, { Icon: React.FC<{ size?: number; className?: string }>; label: string }> = {
  image: { Icon: ImageIcon, label: 'Photo' },
  video: { Icon: VideoIcon, label: 'Video' },
  audio: { Icon: MicIcon, label: 'Voice message' },
  file: { Icon: FileIcon, label: 'File' },
};

interface MediaTypeLabelProps {
  type: MediaType;
  prefix?: string;
  size?: number;
  className?: string;
}

const MediaTypeLabel: React.FC<MediaTypeLabelProps> = ({ type, prefix, size = 14, className = '' }) => {
  const { Icon, label } = CONFIG[type];
  return (
    <span className={`media-type-label ${className}`.trim()}>
      {prefix && <span>{prefix}</span>}
      <Icon size={size} />
      <span>{label}</span>
    </span>
  );
};

export const getMediaPreviewText = (type: MediaType): string => {
  return CONFIG[type].label;
};

export default MediaTypeLabel;
