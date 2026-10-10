import { useState, useEffect, useCallback } from 'react';
import api, { orgAPI } from '../../services/api';
import { useSocket } from '../../contexts/SocketContext';
import VoiceMessagePlayer from '../messaging/VoiceMessagePlayer';
import { MicIcon } from '../icons/Icons';

export interface PTTRecording {
  id: string;
  channelId: string;
  userId: string;
  fileUrl: string;
  durationMs: number;
  transcriptionText?: string;
  transcriptionStatus?: string;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    avatarUrl: string;
  };
}

interface PTTHistoryPanelProps {
  channelId: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms: number): string {
  const sec = Math.max(1, Math.round(ms / 1000));
  return `${sec}s`;
}

export default function PTTHistoryPanel({ channelId }: PTTHistoryPanelProps) {
  const { subscribe } = useSocket();
  const [recordings, setRecordings] = useState<PTTRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [transcribeMsg, setTranscribeMsg] = useState('');
  const [transcribingId, setTranscribingId] = useState<string | null>(null);

  const handleTranscribe = async (recordingId: string) => {
    setTranscribeMsg('');
    setTranscribingId(recordingId);
    try {
      const res = await orgAPI.requestTranscription(channelId, recordingId);
      const updated = res.data as PTTRecording;
      setRecordings(prev => prev.map(r => r.id === recordingId ? { ...r, ...updated } : r));
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; error?: string } } };
      const msg = ax.response?.data?.message || ax.response?.data?.error || 'Transcription unavailable';
      setTranscribeMsg(msg);
    } finally {
      setTranscribingId(null);
    }
  };

  const loadHistory = useCallback(async () => {
    try {
      const res = await api.get(`/channels/${channelId}/ptt-history?limit=50`);
      setRecordings(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('[PTTHistory] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    setLoading(true);
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const unsub = subscribe('ptt.history', (data: unknown) => {
      const rec = data as PTTRecording;
      if (rec.channelId !== channelId) return;
      setRecordings(prev => {
        if (prev.some(r => r.id === rec.id)) return prev;
        return [rec, ...prev];
      });
    });
    return unsub;
  }, [subscribe, channelId]);

  if (loading) {
    return <div className="ptt-history-empty">Loading voice history...</div>;
  }

  if (recordings.length === 0) {
    return (
      <div className="ptt-history-empty">
        <MicIcon size={32} />
        <p>No voice transmissions yet</p>
        <span>PTT recordings will appear here after you talk</span>
      </div>
    );
  }

  return (
    <div className="ptt-history-panel">
      {transcribeMsg && <p className="ptt-history-transcribe-msg">{transcribeMsg}</p>}
      {recordings.map(rec => {
        const name = rec.user?.firstName || rec.user?.username || 'Unknown';
        return (
          <div key={rec.id} className="ptt-history-item">
            <div className="ptt-history-meta">
              <span className="ptt-history-name">{name}</span>
              <span className="ptt-history-time">{formatTime(rec.createdAt)} · {formatDuration(rec.durationMs)}</span>
              {rec.transcriptionStatus === 'done' && rec.transcriptionText ? (
                <span className="ptt-history-transcribed">✓</span>
              ) : (
                <button
                  type="button"
                  className="ptt-history-transcribe-btn"
                  disabled={transcribingId === rec.id}
                  onClick={() => handleTranscribe(rec.id)}
                >
                  {transcribingId === rec.id ? '...' : 'Transcribe'}
                </button>
              )}
            </div>
            {rec.transcriptionText && (
              <p className="ptt-history-transcription">{rec.transcriptionText}</p>
            )}
            <VoiceMessagePlayer
              audioUrl={rec.fileUrl}
              duration={rec.durationMs / 1000}
            />
          </div>
        );
      })}
    </div>
  );
}
