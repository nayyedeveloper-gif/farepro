import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { orgAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { syncOrgContext } from '../../utils/orgStorage';
import { formatMMK } from '../../services/bookingApi';

interface TripJob {
  id: string;
  customerName: string;
  pickupAddress: string;
  dropoffAddress: string;
  status: string;
  driverId?: string;
  customerPhone?: string;
  distanceKm?: number;
  estimatedFare?: number;
  bookingSource?: string;
}

interface TripMessage {
  id: string;
  senderRole: string;
  body: string;
  createdAt: string;
}

const TRIP_ACTIONS: Record<string, { label: string; next: string } | undefined> = {
  en_route: { label: 'Arrived at pickup', next: 'arrived' },
  arrived: { label: 'Complete job', next: 'completed' },
};

const STATUS_LABEL: Record<string, string> = {
  assigned: 'Awaiting you',
  en_route: 'En route',
  arrived: 'At pickup',
  completed: 'Done',
  cancelled: 'Cancelled',
};

const STEPS = ['assigned', 'en_route', 'arrived', 'completed'] as const;

export default function DriverWorkspace() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscribe } = useSocket();
  const [hasOrg, setHasOrg] = useState(false);
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [trips, setTrips] = useState<TripJob[]>([]);
  const [history, setHistory] = useState<TripJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [commsTrip, setCommsTrip] = useState<TripJob | null>(null);
  const [commsMode, setCommsMode] = useState<'chat' | 'call' | null>(null);
  const [messages, setMessages] = useState<TripMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [callStatus, setCallStatus] = useState('');

  const load = useCallback(async () => {
    const ctx = await syncOrgContext();
    if (!ctx.hasOrg) {
      setHasOrg(false);
      setLoading(false);
      return;
    }
    setHasOrg(true);
    try {
      const [tripsRes, histRes] = await Promise.all([
        orgAPI.getTrips(),
        orgAPI.getTripHistory(),
      ]);
      setTrips(tripsRes.data || []);
      setHistory(histRes.data || []);
    } catch (err) {
      console.error('[DriverWorkspace] load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!hasOrg) return;
    return subscribe('trip.updated', (data: unknown) => {
      const trip = data as TripJob;
      if (!trip?.id || trip.driverId !== user?.id) return;
      setTrips(prev => {
        if (trip.status === 'completed' || trip.status === 'cancelled') {
          return prev.filter(t => t.id !== trip.id);
        }
        const idx = prev.findIndex(t => t.id === trip.id);
        if (idx === -1) return [trip, ...prev];
        const next = [...prev];
        next[idx] = trip;
        return next;
      });
      if (trip.status === 'completed' || trip.status === 'cancelled') {
        setHistory(prev => [trip, ...prev.filter(t => t.id !== trip.id)]);
      }
    });
  }, [hasOrg, subscribe, user?.id]);

  useEffect(() => {
    if (!hasOrg) return;
    return subscribe('trip.message', (data: unknown) => {
      const p = data as { tripId?: string; message?: TripMessage };
      if (p?.tripId === commsTrip?.id && p.message) {
        setMessages(prev => prev.some(m => m.id === p.message!.id) ? prev : [...prev, p.message!]);
      }
    });
  }, [hasOrg, subscribe, commsTrip?.id]);

  const handleTripAction = async (tripId: string, status: string) => {
    try {
      const res = await orgAPI.updateTrip(tripId, { status });
      if (status === 'completed') {
        setTrips(prev => prev.filter(t => t.id !== tripId));
        setHistory(prev => [res.data, ...prev]);
      } else {
        setTrips(prev => prev.map(t => t.id === tripId ? res.data : t));
      }
    } catch (err) {
      console.error('[DriverWorkspace] trip update failed:', err);
    }
  };

  const handleAccept = async (tripId: string) => {
    try {
      const res = await orgAPI.acceptTrip(tripId);
      setTrips(prev => prev.map(t => t.id === tripId ? res.data : t));
    } catch (err) {
      console.error('[DriverWorkspace] accept failed:', err);
    }
  };

  const handleReject = async (tripId: string) => {
    try {
      await orgAPI.rejectTrip(tripId);
      setTrips(prev => prev.filter(t => t.id !== tripId));
    } catch (err) {
      console.error('[DriverWorkspace] reject failed:', err);
    }
  };

  const handleCancel = async (tripId: string) => {
    if (!window.confirm('Cancel this trip?')) return;
    try {
      await orgAPI.cancelTrip(tripId, 'Driver cancelled');
      await load();
    } catch (err) {
      console.error('[DriverWorkspace] cancel failed:', err);
    }
  };

  const openChat = async (trip: TripJob) => {
    setCommsTrip(trip);
    setCommsMode('chat');
    try {
      const res = await orgAPI.getTripMessages(trip.id);
      setMessages(res.data || []);
    } catch {
      setMessages([]);
    }
  };

  const openCall = async (trip: TripJob) => {
    setCommsTrip(trip);
    setCommsMode('call');
    setCallStatus('Connecting…');
    try {
      await orgAPI.getTripCallToken(trip.id);
      setCallStatus('In-app voice ready (LiveKit). Use the mobile Driver app for full call UI.');
    } catch {
      setCallStatus('Voice call unavailable — check LiveKit config or use Chat.');
    }
  };

  const sendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commsTrip || !chatText.trim()) return;
    try {
      const res = await orgAPI.sendTripMessage(commsTrip.id, chatText.trim());
      setMessages(prev => [...prev, res.data]);
      setChatText('');
    } catch (err) {
      console.error('[DriverWorkspace] chat failed:', err);
    }
  };

  const closeComms = () => {
    setCommsMode(null);
    setCommsTrip(null);
    setMessages([]);
    setCallStatus('');
  };

  if (loading) {
    return <div className="ptt-work-empty"><p>Loading jobs…</p></div>;
  }

  if (!hasOrg) {
    return (
      <div className="ptt-work-empty">
        <p>Sign in with your taxi stand to see jobs.</p>
        <button type="button" className="ptt-btn-primary" onClick={() => navigate('/org/signin')}>
          Org Sign In
        </button>
      </div>
    );
  }

  const renderCard = (trip: TripJob, isHistory: boolean) => {
    const action = TRIP_ACTIONS[trip.status];
    const stepIdx = STEPS.indexOf(trip.status as typeof STEPS[number]);
    const canComms = !isHistory && ['assigned', 'en_route', 'arrived'].includes(trip.status);
    const canCancel = trip.status === 'en_route' || trip.status === 'arrived';

    return (
      <div key={trip.id} className={`ptt-work-card status-${trip.status}`}>
        <div className="ptt-work-card-top">
          <strong>{trip.customerName}</strong>
          <span className="ptt-work-badge">{STATUS_LABEL[trip.status] || trip.status}</span>
        </div>
        <div className="ptt-work-tags">
          <span className="ptt-work-tag taxi">Kilo Taxi</span>
        </div>
        {trip.customerPhone && <span className="ptt-work-phone">{trip.customerPhone}</span>}
        <span>{trip.pickupAddress}</span>
        <span>→ {trip.dropoffAddress}</span>
        {trip.estimatedFare != null && (
          <span className="ptt-work-fare">
            {formatMMK(trip.estimatedFare)}
            {trip.distanceKm != null ? ` · ${trip.distanceKm} km` : ''}
            {trip.bookingSource === 'customer' ? ' · App' : ''}
          </span>
        )}

        {!isHistory && (
          <div className="ptt-work-steps" aria-hidden>
            {STEPS.map((s, i) => (
              <span key={s} className={`ptt-work-step ${stepIdx > i ? 'done' : ''} ${stepIdx === i ? 'active' : ''}`} />
            ))}
          </div>
        )}

        {canComms && (
          <div className="ptt-work-actions">
            <button type="button" className="ptt-btn-primary ptt-work-action" onClick={() => openCall(trip)}>Voice</button>
            <button type="button" className="ptt-btn-ghost ptt-work-action" onClick={() => openChat(trip)}>Chat</button>
          </div>
        )}

        {!isHistory && trip.status === 'assigned' && (
          <div className="ptt-work-actions">
            <button type="button" className="ptt-btn-primary ptt-work-action" onClick={() => handleAccept(trip.id)}>Accept</button>
            <button type="button" className="ptt-btn-ghost ptt-work-action" onClick={() => handleReject(trip.id)}>Decline</button>
          </div>
        )}
        {!isHistory && action && (
          <button type="button" className="ptt-btn-primary ptt-work-action" onClick={() => handleTripAction(trip.id, action.next)}>
            {action.label}
          </button>
        )}
        {canCancel && (
          <button type="button" className="ptt-btn-ghost ptt-work-action ptt-work-cancel" onClick={() => handleCancel(trip.id)}>
            Cancel trip
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="ptt-workspace">
      <div className="ptt-work-segments" role="tablist">
        <button type="button" className={tab === 'active' ? 'active' : ''} onClick={() => setTab('active')}>Active</button>
        <button type="button" className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>History</button>
      </div>

      <section className="ptt-work-section">
        {tab === 'active' && (
          trips.length === 0
            ? <p className="ptt-work-muted">No active rides — wait for dispatch to assign.</p>
            : trips.map(t => renderCard(t, false))
        )}
        {tab === 'history' && (
          history.length === 0
            ? <p className="ptt-work-muted">No completed or cancelled trips yet.</p>
            : history.map(t => renderCard(t, true))
        )}
      </section>

      {commsMode && commsTrip && (
        <div className="ptt-work-modal-backdrop" onClick={closeComms} role="presentation">
          <div className="ptt-work-modal" onClick={e => e.stopPropagation()} role="dialog">
            <header>
              <h3>{commsMode === 'chat' ? 'In-app chat' : 'In-app voice'} — {commsTrip.customerName}</h3>
              <button type="button" className="ptt-btn-ghost" onClick={closeComms}>Close</button>
            </header>
            {commsMode === 'chat' ? (
              <>
                <div className="ptt-work-chat-list">
                  {messages.length === 0 && <p className="ptt-work-muted">Data-only messages (not SMS).</p>}
                  {messages.map(m => (
                    <div key={m.id} className={`ptt-work-bubble ${m.senderRole === 'driver' ? 'mine' : ''}`}>
                      {m.body}
                    </div>
                  ))}
                </div>
                <form className="ptt-work-chat-form" onSubmit={sendChat}>
                  <input value={chatText} onChange={e => setChatText(e.target.value)} placeholder="Message…" />
                  <button type="submit" className="ptt-btn-primary" disabled={!chatText.trim()}>Send</button>
                </form>
              </>
            ) : (
              <p className="ptt-work-muted">{callStatus}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
