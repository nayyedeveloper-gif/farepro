import React from 'react';

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Loading...' }) => (
  <div className="app-loading">
    <div className="app-loading-spinner" />
    <span>{message}</span>
  </div>
);

export default LoadingScreen;
