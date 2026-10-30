-- Demand surcharges on trips + org demand catalog
ALTER TABLE trips ADD COLUMN IF NOT EXISTS demand_mmk INTEGER NOT NULL DEFAULT 0;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS demand_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS demand_catalog_json TEXT NOT NULL DEFAULT '[]';
