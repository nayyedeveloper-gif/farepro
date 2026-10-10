import React, { useState, useRef, useEffect } from 'react';
import { messageAPI, fileAPI } from '../../services/api';
import { AttachIcon, SendIcon, SmileIcon, StickerIcon, MicIcon, PlayIcon, PauseIcon, TrashIcon } from '../icons/Icons';
import EmojiPicker from '../common/EmojiPicker';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { soundService } from '../../services/SoundService';
import MediaTypeLabel from '../common/MediaTypeLabel';

interface MessageInputProps {
  conversationId: string | null;
  onMessageSent: () => void;
  replyToMessage?: any;
  onClearReply?: () => void;
  participants?: any[];
}

const MessageInput: React.FC<MessageInputProps> = ({
  conversationId,
  onMessageSent,
  replyToMessage,
  onClearReply,
  participants = [],
}) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const { send } = useSocket();
  const { user } = useAuth();

  const emitTyping = (text: string) => {
    if (!conversationId) return;
    if (text.trim()) {
      send('typing.start', {
        conversationId,
        userName: user?.firstName || user?.username || 'User',
      });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = window.setTimeout(() => {
        send('typing.stop', { conversationId });
      }, 2500);
    } else {
      send('typing.stop', { conversationId });
    }
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    emitTyping(value);

    // Detect @ symbol for mentions
    const cursorPosition = value.length;
    const lastAtIndex = value.lastIndexOf('@');

    if (lastAtIndex !== -1 && (lastAtIndex === cursorPosition - 1 || value.substring(lastAtIndex + 1, cursorPosition).length > 0)) {
      const query = value.substring(lastAtIndex + 1, cursorPosition);
      setMentionQuery(query);
      setShowMentionSuggestions(true);
      setMentionIndex(0);
    } else {
      setShowMentionSuggestions(false);
      setMentionQuery('');
    }
  };

  const filteredParticipants = participants.filter(p => {
    const name = (p.firstName || p.username || '').toLowerCase();
    return name.includes(mentionQuery.toLowerCase());
  });

  const handleSelectMention = (participant: any) => {
    const lastAtIndex = content.lastIndexOf('@');
    const beforeMention = content.substring(0, lastAtIndex);
    const mentionText = `@${participant.firstName || participant.username}`;
    setContent(beforeMention + mentionText + ' ');
    setShowMentionSuggestions(false);
    setMentionQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showMentionSuggestions) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex(prev => (prev + 1) % filteredParticipants.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex(prev => (prev - 1 + filteredParticipants.length) % filteredParticipants.length);
    } else if (e.key === 'Enter' && filteredParticipants.length > 0) {
      e.preventDefault();
      handleSelectMention(filteredParticipants[mentionIndex]);
    } else if (e.key === 'Escape') {
      setShowMentionSuggestions(false);
      setMentionQuery('');
    }
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !conversationId) return;

    setLoading(true);
    try {
      send('typing.stop', { conversationId });
      await messageAPI.sendMessage(conversationId, {
        content,
        messageType: 'text',
        replyToId: replyToMessage?.id,
      });
      soundService.playMessageSent();
      setContent('');
      onMessageSent();
      onClearReply?.();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId) return;

    setLoading(true);
    try {
      const uploadResponse = await fileAPI.uploadFile(file);
      const fileUrl = uploadResponse.data.url;
      
      // Determine message type based on file
      let messageType = 'file';
      if (file.type.startsWith('image/')) {
        messageType = 'image';
      } else if (file.type.startsWith('video/')) {
        messageType = 'video';
      } else if (file.type.startsWith('audio/')) {
        messageType = 'audio';
      }

      await messageAPI.sendMessage(conversationId, {
        content: file.name,
        messageType,
        fileUrl,
      });
      onMessageSent();
    } catch (error) {
      console.error('Failed to upload file:', error);
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const generateWaveform = async (audioBlob: Blob): Promise<void> => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      const samples = 50; // Number of bars in waveform
      const blockSize = Math.floor(channelData.length / samples);
      const waveform: number[] = [];
      
      for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(channelData[i * blockSize + j]);
        }
        waveform.push(sum / blockSize);
      }
      
      // Normalize waveform
      const max = Math.max(...waveform);
      const normalizedWaveform = waveform.map(value => (value / max) * 100);
      setWaveformData(normalizedWaveform);
      
      // Set audio duration
      setAudioDuration(audioBuffer.duration);
      
      audioContext.close();
    } catch (error) {
      console.error('Failed to generate waveform:', error);
      // Fallback to random waveform if generation fails
      const fallbackWaveform = Array.from({ length: 50 }, () => Math.random() * 100);
      setWaveformData(fallbackWaveform);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedAudio(audioBlob);
        setRecordingDuration(0);

        // Generate waveform data from the recorded audio
        await generateWaveform(audioBlob);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingDuration(0);

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const playRecordedAudio = async () => {
    if (!recordedAudio) return;

    const audioUrl = URL.createObjectURL(recordedAudio);
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    // Set up audio context for real-time visualization
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;
    
    const source = audioContext.createMediaElementSource(audio);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;
    
    source.connect(analyser);
    analyser.connect(audioContext.destination);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateWaveform = () => {
      if (!isPlaying) return;
      
      analyser.getByteFrequencyData(dataArray);
      
      // Convert frequency data to waveform bars
      const bars: number[] = [];
      const step = Math.floor(dataArray.length / 50);
      
      for (let i = 0; i < 50; i++) {
        const value = dataArray[i * step];
        bars.push((value / 255) * 100);
      }
      
      setWaveformData(bars);
      animationFrameRef.current = requestAnimationFrame(updateWaveform);
    };

    audio.onplay = () => {
      setIsPlaying(true);
      setPlaybackDuration(0);
      playbackTimerRef.current = setInterval(() => {
        setPlaybackDuration(prev => prev + 1);
      }, 1000);
      updateWaveform();
    };

    audio.onended = () => {
      setIsPlaying(false);
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      URL.revokeObjectURL(audioUrl);
      audioContext.close();
      
      // Regenerate static waveform
      generateWaveform(recordedAudio);
    };

    audio.play();
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    }
  };

  const sendVoiceMessage = async () => {
    if (!recordedAudio || !conversationId) return;

    setLoading(true);
    try {
      const audioFile = new File([recordedAudio], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
      const uploadResponse = await fileAPI.uploadFile(audioFile);
      const fileUrl = uploadResponse.data.url;

      await messageAPI.sendMessage(conversationId, {
        content: 'Voice message',
        messageType: 'audio',
        fileUrl,
        duration: Math.floor(audioDuration),
      });
      onMessageSent();
      
      // Reset recording state
      setRecordedAudio(null);
      setPlaybackDuration(0);
    } catch (error) {
      console.error('Failed to send voice message:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteRecording = () => {
    setRecordedAudio(null);
    setPlaybackDuration(0);
    setAudioDuration(0);
    setWaveformData([]);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const handleVoiceRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setContent(prev => prev + emoji);
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!conversationId) {
    return null;
  }

  return (
    <div className="message-input">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
      />
      {replyToMessage && (
        <div className="reply-preview">
          <div className="reply-preview-content">
            <span className="reply-preview-label">Replying to</span>
            <span className="reply-preview-text">
              {replyToMessage.messageType === 'image' || replyToMessage.messageType === 'video' || replyToMessage.messageType === 'audio' || replyToMessage.messageType === 'file' ? (
                <MediaTypeLabel type={replyToMessage.messageType === 'file' ? 'file' : replyToMessage.messageType} />
              ) : (
                replyToMessage.content?.substring(0, 50) || 'Message'
              )}
            </span>
          </div>
          <button
            type="button"
            className="reply-preview-close"
            onClick={onClearReply}
          >
            <TrashIcon size={14} />
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <button
          type="button"
          className="action-btn attach-btn"
          onClick={handleAttachClick}
          title="Attach file"
          disabled={loading || isRecording}
        >
          <AttachIcon size={22} />
        </button>
        {isRecording ? (
          <div className="recording-indicator">
            <span className="recording-dot"></span>
            <span className="recording-time">{formatRecordingTime(recordingDuration)}</span>
          </div>
        ) : recordedAudio ? (
          <div className="voice-preview">
            <button
              type="button"
              className="voice-preview-btn play"
              onClick={isPlaying ? stopPlayback : playRecordedAudio}
              disabled={loading}
              title={isPlaying ? 'Pause' : 'Play'}
              aria-label={isPlaying ? 'Pause recording' : 'Play recording'}
            >
              {isPlaying ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
            </button>
            <div className="voice-preview-info">
              <div className="voice-preview-waveform">
                {waveformData.length > 0 ? (
                  waveformData.map((value, index) => (
                    <div
                      key={index}
                      className="waveform-bar"
                      style={{
                        height: `${Math.max(10, value)}%`,
                        opacity: isPlaying ? 1 : 0.6,
                      }}
                    />
                  ))
                ) : (
                  Array.from({ length: 50 }).map((_, index) => (
                    <div
                      key={index}
                      className="waveform-bar"
                      style={{
                        height: `${20 + Math.random() * 60}%`,
                        opacity: 0.6,
                      }}
                    />
                  ))
                )}
              </div>
              <div className="voice-preview-meta">
                <span className="voice-preview-time">{formatRecordingTime(playbackDuration)}</span>
                {audioDuration > 0 && (
                  <span className="voice-preview-duration">
                    / {formatRecordingTime(Math.floor(audioDuration))}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              className="voice-preview-btn delete"
              onClick={deleteRecording}
              disabled={loading}
              title="Delete recording"
              aria-label="Delete recording"
            >
              <TrashIcon size={16} />
            </button>
            <button
              type="button"
              className="voice-preview-btn send"
              onClick={sendVoiceMessage}
              disabled={loading}
              title="Send voice message"
              aria-label="Send voice message"
            >
              <SendIcon size={16} />
            </button>
          </div>
        ) : (
          <div className="message-input-field">
            <input
              type="text"
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write a message..."
              disabled={loading}
            />
            <div className="message-input-inline-actions">
              <button
                type="button"
                className="action-btn inline"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                title="Emoji"
                disabled={loading}
              >
                <SmileIcon size={22} />
              </button>
              <button
                type="button"
                className="action-btn inline"
                title="Stickers"
                disabled={loading}
              >
                <StickerIcon size={22} />
              </button>
            </div>
            {showMentionSuggestions && filteredParticipants.length > 0 && (
              <div className="mention-suggestions">
                {filteredParticipants.map((participant, index) => (
                  <div
                    key={participant.id}
                    className={`mention-item ${index === mentionIndex ? 'selected' : ''}`}
                    onClick={() => handleSelectMention(participant)}
                  >
                    <div className="mention-avatar">
                      {participant.avatarUrl ? (
                        <img src={participant.avatarUrl} alt="" />
                      ) : (
                        <span className="avatar-placeholder">
                          {(participant.firstName || participant.username || 'U').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="mention-name">
                      {participant.firstName || participant.username || 'Unknown'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {!isRecording && !recordedAudio && content.trim() && (
          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="send-btn"
          >
            <SendIcon size={20} />
          </button>
        )}
        {isRecording && (
          <button
            type="button"
            className="action-btn voice-btn recording"
            onClick={handleVoiceRecord}
            title="Stop recording"
            disabled={loading}
          >
            <TrashIcon size={22} />
          </button>
        )}
        {!isRecording && !recordedAudio && !content.trim() && (
          <button
            type="button"
            className="action-btn voice-btn"
            onClick={handleVoiceRecord}
            title="Voice message"
            disabled={loading}
          >
            <MicIcon size={22} />
          </button>
        )}
      </form>
      {showEmojiPicker && (
        <EmojiPicker
          onEmojiSelect={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}
    </div>
  );
};

export default MessageInput;
