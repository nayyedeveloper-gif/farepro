-- Driver profiles + wallets per organization (Kilo Taxi)
CREATE TABLE IF NOT EXISTS driver_profiles (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	vehicle_plate VARCHAR(40) NOT NULL DEFAULT '',
	vehicle_model VARCHAR(80) NOT NULL DEFAULT '',
	vehicle_color VARCHAR(40) NOT NULL DEFAULT '',
	license_no VARCHAR(80) NOT NULL DEFAULT '',
	nrc VARCHAR(80) NOT NULL DEFAULT '',
	notes TEXT NOT NULL DEFAULT '',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE(org_id, user_id)
);

CREATE TABLE IF NOT EXISTS driver_wallets (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	balance_mmk INTEGER NOT NULL DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE(org_id, user_id)
);

CREATE TABLE IF NOT EXISTS driver_wallet_ledger (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	wallet_id UUID NOT NULL REFERENCES driver_wallets(id) ON DELETE CASCADE,
	org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	amount_mmk INTEGER NOT NULL,
	entry_type VARCHAR(20) NOT NULL DEFAULT 'adjust',
	reason TEXT NOT NULL DEFAULT '',
	created_by UUID REFERENCES users(id) ON DELETE SET NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_profiles_org ON driver_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_driver_wallets_org ON driver_wallets(org_id);
CREATE INDEX IF NOT EXISTS idx_driver_wallet_ledger_user ON driver_wallet_ledger(org_id, user_id);
