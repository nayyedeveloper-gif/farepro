import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { bookingAPI, formatMMK, type PublicOrgInfo, type FareEstimate, type CustomerTrip } from '../../services/bookingApi';
import { geocodeAPI } from '../../services/geocodeApi';
import { getCurrentPosition } from '../../utils/leafletMap';
import PlaceSearchInput, { type SelectedPlace } from './PlaceSearchInput';
import BookingRouteMap from './BookingRouteMap';
import LiveTripTrackMap from './LiveTripTrackMap';
import './customer-booking.css';

const STATUS_LABELS: Record<string, string> = {
  requested: 'စောင့်ဆိုင်းနေသည်',
  pending: 'စောင့်ဆိုင်းနေသည်',
  assigned: 'ယာဉ်ခန့်ထားပြီး',
  en_route: 'လာရောက်နေသည်',
  arrived: 'ရောက်ရှိပြီး',
  completed: 'ပြီးဆုံး',
  cancelled: 'ပယ်ဖျက်',
};

export default function CustomerBooking() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const [org, setOrg] = useState<PublicOrgInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pickup, setPickup] = useState<SelectedPlace | null>(null);
  const [dropoff, setDropoff] = useState<SelectedPlace | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [estimate, setEstimate] = useState<FareEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);

  const [bookedTrip, setBookedTrip] = useState<CustomerTrip | null>(null);
  const [trackingPhone, setTrackingPhone] = useState('');

  useEffect(() => {
    if (!subdomain) return;
    bookingAPI.getOrg(subdomain)
      .then(res => setOrg(res.data))
      .catch(() => setError('Taxi service မတွေ့ပါ'))
      .finally(() => setLoading(false));
  }, [subdomain]);

  useEffect(() => {
    if (!subdomain || !pickup || !dropoff) {
      setEstimate(null);
      return;
    }
    let cancelled = false;
    setEstimating(true);
    setError('');
    bookingAPI.estimate(subdomain, {
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      dropoffLat: dropoff.lat,
      dropoffLng: dropoff.lng,
    })
      .then(res => { if (!cancelled) setEstimate(res.data); })
      .catch(() => { if (!cancelled) setError('အကွာအဝေး/ဈေး တွက်မရပါ'); })
      .finally(() => { if (!cancelled) setEstimating(false); });
    return () => { cancelled = true; };
  }, [pickup, dropoff, subdomain]);

  const handleUseMyLocation = async () => {
    setLocating(true);
    setError('');
    try {
      const pos = await getCurrentPosition();
      const res = await geocodeAPI.reverse(pos.coords.latitude, pos.coords.longitude);
      setPickup(res.data);
    } catch {
      setError('လက်ရှိနေရာ မရနိုင်ပါ — location permission ဖွင့်ပြီး ထပ်စမ်းပါ');
    } finally {
      setLocating(false);
    }
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subdomain || !estimate || !pickup || !dropoff) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await bookingAPI.createRide(subdomain, {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        pickupAddress: pickup.shortName,
        dropoffAddress: dropoff.shortName,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        paymentMethod,
      });
      setBookedTrip(res.data);
      setTrackingPhone(customerPhone.trim());
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Booking မအောင်မြင်ပါ');
    } finally {
      setSubmitting(false);
    }
  };

  const refreshStatus = useCallback(async () => {
    if (!subdomain || !bookedTrip || !trackingPhone) return;
    try {
      const res = await bookingAPI.getRideStatus(subdomain, bookedTrip.id, trackingPhone);
      setBookedTrip(res.data);
    } catch {
      /* ignore poll errors */
    }
  }, [subdomain, bookedTrip, trackingPhone]);

  useEffect(() => {
    if (!bookedTrip || bookedTrip.status === 'completed' || bookedTrip.status === 'cancelled') return;
    const t = setInterval(refreshStatus, 8000);
    return () => clearInterval(t);
  }, [bookedTrip, refreshStatus]);

  if (loading) {
    return <div className="cb-page"><div className="cb-card cb-loading">Loading...</div></div>;
  }

  if (error && !org) {
    return <div className="cb-page"><div className="cb-card cb-error">{error}</div></div>;
  }

  if (!org) return null;

  const title = org.customerAppTitle || org.name;

  if (bookedTrip) {
    const driverName = bookedTrip.driver
      ? `${bookedTrip.driver.firstName || ''} ${bookedTrip.driver.lastName || ''}`.trim() || bookedTrip.driver.username
      : null;
    return (
      <div className="cb-page">
        <div className="cb-header">
          {org.logoUrl ? <img src={org.logoUrl} alt="" className="cb-logo" /> : null}
          <h1>{title}</h1>
        </div>
        <div className="cb-card cb-success">
          <div className="cb-success-icon">✓</div>
          <h2>မှာယူမှု အောင်မြင်ပါသည်</h2>
          <p className="cb-status-badge">{STATUS_LABELS[bookedTrip.status] || bookedTrip.status}</p>
          <div className="cb-trip-summary">
            <div><span>မှ</span><strong>{bookedTrip.pickupAddress}</strong></div>
            <div><span>သို့</span><strong>{bookedTrip.dropoffAddress}</strong></div>
            {bookedTrip.distanceKm != null && (
              <div><span>အကွာအဝေး</span><strong>{bookedTrip.distanceKm} km</strong></div>
            )}
            {bookedTrip.estimatedFare != null && (
              <div className="cb-fare-row">
                <span>ခန့်မှန်းဈေး</span>
                <strong>{formatMMK(bookedTrip.estimatedFare)}</strong>
              </div>
            )}
            {driverName && (
              <div><span>ယာဉ်မောင်း</span><strong>{driverName}</strong></div>
            )}
          </div>
          <LiveTripTrackMap
            pickupLat={bookedTrip.pickupLat}
            pickupLng={bookedTrip.pickupLng}
            dropoffLat={bookedTrip.dropoffLat}
            dropoffLng={bookedTrip.dropoffLng}
            driverLat={bookedTrip.driverLat}
            driverLng={bookedTrip.driverLng}
          />
          <p className="cb-hint">ယာဉ်ခန့်ပြီးသည်နှင့် အကြောင်းကြားပါမည်။ ဤစာမျက်နှာကို ဖွင့်ထားနိုင်ပါသည်။</p>
          <button type="button" className="cb-btn-secondary" onClick={refreshStatus}>Refresh</button>
        </div>
        <p className="cb-powered">Powered by FarePro</p>
      </div>
    );
  }

  return (
    <div className="cb-page">
      <div className="cb-header">
        {org.logoUrl ? <img src={org.logoUrl} alt="" className="cb-logo" /> : null}
        <h1>{title}</h1>
        <p className="cb-tagline">Kilo Taxi — နေရာရှာပြီး ဈေးနှုန်း auto တွက်ပါသည်</p>
      </div>

      {!org.bookingEnabled ? (
        <div className="cb-card cb-error">Online booking ယာယီပိတ်ထားပါသည်</div>
      ) : (
        <form className="cb-card cb-form" onSubmit={handleBook}>
          {error && <div className="cb-form-error">{error}</div>}

          <BookingRouteMap pickup={pickup} dropoff={dropoff} />

          <label>
            အမည်
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} required placeholder="သင့်အမည်" />
          </label>
          <label>
            ဖုန်းနံပါတ်
            <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} required type="tel" placeholder="09xxxxxxxxx" />
          </label>

          <PlaceSearchInput
            id="pickup"
            label="ကားစီးမည့်နေရာ"
            placeholder="ရှာပါ — ဥပမာ Sanchaung, Junction City, Inya Lake"
            value={pickup}
            onChange={setPickup}
            onUseMyLocation={handleUseMyLocation}
            locating={locating}
          />

          <PlaceSearchInput
            id="dropoff"
            label="ရောက်မည့်နေရာ"
            placeholder="ရှာပါ — ဥပမာ Airport, Hledan, Tamwe"
            value={dropoff}
            onChange={setDropoff}
          />

          {(estimating || estimate) && (
            <div className="cb-estimate-box">
              {estimating ? (
                <span className="cb-estimate-note">အကွာအဝေး တွက်နေသည်...</span>
              ) : estimate ? (
                <>
                  <div className="cb-estimate-km">
                    {estimate.distanceKm} km
                    {estimate.durationMin ? ` · ~${Math.max(1, Math.round(estimate.durationMin))} မိနစ်` : ''}
                  </div>
                  <div className="cb-estimate-fare">{formatMMK(estimate.estimatedFare)}</div>
                  <span className="cb-estimate-note">
                    {org.fareRatePerKm.toLocaleString()} MMK/km · min {org.fareMinimum.toLocaleString()} MMK
                  </span>
                </>
              ) : null}
            </div>
          )}

          <label>
            ငွေပေးချေမှု
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option value="cash">ငွေသား (Cash)</option>
              <option value="wave">Wave</option>
              <option value="kbz">KBZ Pay</option>
            </select>
          </label>

          <button type="submit" className="cb-btn-primary" disabled={!estimate || estimating || submitting}>
            {submitting ? 'မှာယူနေသည်...' : 'ယာဉ်မှာယူရန်'}
          </button>
        </form>
      )}

      <p className="cb-powered">Powered by FarePro · Kilo Taxi</p>
    </div>
  );
}
