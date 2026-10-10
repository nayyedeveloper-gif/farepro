-- Separate kilo taxi vs delivery jobs; delivery vehicle types
ALTER TABLE trips ADD COLUMN IF NOT EXISTS service_type VARCHAR(20) NOT NULL DEFAULT 'taxi';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(20) NOT NULL DEFAULT 'car';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS parcel_notes TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_trips_org_service ON trips(org_id, service_type);
CREATE INDEX IF NOT EXISTS idx_trips_org_service_status ON trips(org_id, service_type, status);
