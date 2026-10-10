import React from 'react';

interface ImageViewerModalProps {
  imageUrl: string;
  onClose: () => void;
}

const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ imageUrl, onClose }) => {
  return (
    <div className="image-viewer-overlay" onClick={onClose}>
      <div className="image-viewer-content" onClick={(e) => e.stopPropagation()}>
        <button className="image-viewer-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <img src={imageUrl} alt="Full size view" />
      </div>
    </div>
  );
};

export default ImageViewerModal;
