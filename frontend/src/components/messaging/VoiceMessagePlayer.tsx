import React, { useState, useRef, useEffect } from 'react';
import { PlayIcon, PauseIcon } from '../icons/Icons';

interface VoiceMessagePlayerProps {
  audioUrl: string;
  duration?: number;
}

const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({ audioUrl, duration }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioUrl && !totalDuration) {
      generateWaveform();
    }
  }, [audioUrl]);

  const generateWaveform = async () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      const samples = 40;
      const blockSize = Math.floor(channelData.length / samples);
      const waveform: number[] = [];
      
      for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(channelData[i * blockSize + j]);
        }
        waveform.push(sum / blockSize);
      }
      
      const max = Math.max(...waveform);
      const normalizedWaveform = waveform.map(value => (value / max) * 100);
      setWaveformData(normalizedWaveform);
      setTotalDuration(audioBuffer.duration);
      
      audioContext.close();
    } catch (error) {
      console.error('Failed to generate waveform:', error);
      const fallbackWaveform = Array.from({ length: 40 }, () => Math.random() * 100);
      setWaveformData(fallbackWaveform);
    }
  };

  const togglePlay = async () => {
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Failed to play audio:', error);
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    generateWaveform();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="voice-message-player">
      <audio
        ref={audioRef}
        src={audioUrl}
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onLoadedMetadata={() => {
          if (audioRef.current && !totalDuration) {
            setTotalDuration(audioRef.current.duration);
          }
        }}
      />
      <button
        className="voice-play-btn"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
      </button>
      <div className="voice-waveform-container">
        <div className="voice-waveform">
          {waveformData.length > 0 ? (
            waveformData.map((value, index) => (
              <div
                key={index}
                className="voice-waveform-bar"
                style={{
                  height: `${Math.max(15, value)}%`,
                  backgroundColor: index / waveformData.length < progress / 100 
                    ? 'var(--teamlink-blue)' 
                    : 'var(--teamlink-gray)',
                  opacity: isPlaying ? 1 : 0.7,
                }}
              />
            ))
          ) : (
            Array.from({ length: 40 }).map((_, index) => (
              <div
                key={index}
                className="voice-waveform-bar"
                style={{
                  height: `${20 + Math.random() * 50}%`,
                  backgroundColor: 'var(--teamlink-gray)',
                  opacity: 0.7,
                }}
              />
            ))
          )}
        </div>
      </div>
      <span className="voice-duration">{formatTime(totalDuration)}</span>
    </div>
  );
};

export default VoiceMessagePlayer;
