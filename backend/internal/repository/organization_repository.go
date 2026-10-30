package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"telegram-clone/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type OrganizationRepository struct {
	db *sqlx.DB
}

func NewOrganizationRepository(db *sqlx.DB) *OrganizationRepository {
	return &OrganizationRepository{db: db}
}

func (r *OrganizationRepository) Migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS organizations (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		name VARCHAR(100) NOT NULL,
		subdomain VARCHAR(50) NOT NULL UNIQUE,
		plan VARCHAR(20) NOT NULL DEFAULT 'free',
		max_drivers INTEGER NOT NULL DEFAULT 10,
		max_channels INTEGER NOT NULL DEFAULT 5,
		owner_id UUID,
		logo_url TEXT DEFAULT '',
		is_active BOOLEAN DEFAULT true,
		created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS user_organizations (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
		role VARCHAR(20) NOT NULL DEFAULT 'driver',
		joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(user_id, organization_id)
	);

	CREATE INDEX IF NOT EXISTS idx_org_subdomain ON organizations(subdomain);
	CREATE INDEX IF NOT EXISTS idx_user_org_user ON user_organizations(user_id);
	CREATE INDEX IF NOT EXISTS idx_user_org_org ON user_organizations(organization_id);
	`
	_, err := r.db.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to migrate organizations tables: %w", err)
	}
	_, err = r.db.Exec(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS industry VARCHAR(50) NOT NULL DEFAULT 'general'`)
	if err != nil {
		return fmt.Errorf("failed to add industry column: %w", err)
	}
	fareCols := []string{
		`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS fare_rate_per_km INTEGER NOT NULL DEFAULT 1500`,
		`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS fare_minimum INTEGER NOT NULL DEFAULT 2000`,
		`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS fare_night_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1.2`,
		`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS fare_night_start INTEGER NOT NULL DEFAULT 22`,
		`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS fare_night_end INTEGER NOT NULL DEFAULT 5`,
		`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS booking_enabled BOOLEAN NOT NULL DEFAULT true`,
		`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS customer_app_title VARCHAR(100) NOT NULL DEFAULT ''`,
		`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS auto_dispatch BOOLEAN NOT NULL DEFAULT false`,
		`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS driver_credit_floor_mmk INTEGER NOT NULL DEFAULT -5000`,
		`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS wallet_payment_info TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS demand_catalog_json TEXT NOT NULL DEFAULT '[]'`,
	}
	for _, q := range fareCols {
		if _, err := r.db.Exec(q); err != nil {
			return fmt.Errorf("failed to migrate fare columns: %w", err)
		}
	}
	if _, err := r.db.Exec(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_balance_mmk INTEGER NOT NULL DEFAULT 0`); err != nil {
		return fmt.Errorf("failed to add billing_balance_mmk: %w", err)
	}
	_, err = r.db.Exec(`
		CREATE TABLE IF NOT EXISTS org_billing_ledger (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
			amount_mmk INTEGER NOT NULL,
			entry_type VARCHAR(20) NOT NULL DEFAULT 'credit',
			reason TEXT DEFAULT '',
			created_by UUID,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_org_billing_ledger_org ON org_billing_ledger(org_id, created_at DESC);
	`)
	if err != nil {
		return fmt.Errorf("failed to migrate org_billing_ledger: %w", err)
	}
	if _, err := r.db.Exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT false`); err != nil {
		return fmt.Errorf("failed to add is_platform_admin: %w", err)
	}
	return nil
}

const orgSelect = `id, name, subdomain, plan, max_drivers, max_channels, owner_id,
	COALESCE(industry, 'general') as industry, logo_url, is_active,
	COALESCE(fare_rate_per_km, 1500) as fare_rate_per_km,
	COALESCE(fare_minimum, 2000) as fare_minimum,
	COALESCE(fare_night_multiplier, 1.2) as fare_night_multiplier,
	COALESCE(fare_night_start, 22) as fare_night_start,
	COALESCE(fare_night_end, 5) as fare_night_end,
	COALESCE(booking_enabled, true) as booking_enabled,
	COALESCE(customer_app_title, '') as customer_app_title,
	COALESCE(billing_balance_mmk, 0) as billing_balance_mmk,
	COALESCE(auto_dispatch, false) as auto_dispatch,
	COALESCE(driver_credit_floor_mmk, -5000) as driver_credit_floor_mmk,
	COALESCE(wallet_payment_info, '') as wallet_payment_info,
	COALESCE(demand_catalog_json, '[]') as demand_catalog_json,
	created_at, updated_at`

func (r *OrganizationRepository) Create(org *models.Organization) error {
	query := `
		INSERT INTO organizations (id, name, subdomain, plan, max_drivers, max_channels, owner_id, industry, logo_url)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, name, subdomain, plan, max_drivers, max_channels, owner_id, industry, logo_url, is_active, created_at, updated_at
	`
	return r.db.QueryRow(query,
		org.ID, org.Name, org.Subdomain, org.Plan, org.MaxDrivers, org.MaxChannels, org.OwnerID, org.Industry, org.LogoURL,
	).Scan(
		&org.ID, &org.Name, &org.Subdomain, &org.Plan, &org.MaxDrivers, &org.MaxChannels,
		&org.OwnerID, &org.Industry, &org.LogoURL, &org.IsActive, &org.CreatedAt, &org.UpdatedAt,
	)
}

func (r *OrganizationRepository) GetBySubdomain(subdomain string) (*models.Organization, error) {
	query := `SELECT ` + orgSelect + ` FROM organizations WHERE subdomain = $1 AND is_active = true`
	var org models.Organization
	if err := r.db.Get(&org, query, subdomain); err != nil {
		return nil, err
	}
	return &org, nil
}

func (r *OrganizationRepository) GetByID(id uuid.UUID) (*models.Organization, error) {
	query := `SELECT ` + orgSelect + ` FROM organizations WHERE id = $1`
	var org models.Organization
	if err := r.db.Get(&org, query, id); err != nil {
		return nil, err
	}
	return &org, nil
}

func (r *OrganizationRepository) Update(org *models.Organization) error {
	query := `
		UPDATE organizations SET name = COALESCE($1, name), logo_url = COALESCE($2, logo_url), plan = COALESCE($3, plan), updated_at = CURRENT_TIMESTAMP
		WHERE id = $4
		RETURNING id, name, subdomain, plan, max_drivers, max_channels, owner_id, logo_url, is_active, created_at, updated_at
	`
	return r.db.QueryRow(query, org.Name, org.LogoURL, org.Plan, org.ID).Scan(
		&org.ID, &org.Name, &org.Subdomain, &org.Plan, &org.MaxDrivers, &org.MaxChannels,
		&org.OwnerID, &org.LogoURL, &org.IsActive, &org.CreatedAt, &org.UpdatedAt,
	)
}

func (r *OrganizationRepository) AddUserToOrg(userID, orgID uuid.UUID, role string) error {
	query := `INSERT INTO user_organizations (user_id, organization_id, role) VALUES ($1, $2, $3) ON CONFLICT (user_id, organization_id) DO UPDATE SET role = $3`
	_, err := r.db.Exec(query, userID, orgID, role)
	return err
}

func (r *OrganizationRepository) RemoveUserFromOrg(userID, orgID uuid.UUID) error {
	query := `DELETE FROM user_organizations WHERE user_id = $1 AND organization_id = $2`
	_, err := r.db.Exec(query, userID, orgID)
	return err
}

func (r *OrganizationRepository) GetOrgMembers(orgID uuid.UUID) ([]models.UserOrganization, error) {
	query := `
		SELECT uo.id, uo.user_id, uo.organization_id, uo.role, uo.joined_at,
			u.id as "user.id", u.username as "user.username", u.phone as "user.phone",
			u.first_name as "user.first_name", u.last_name as "user.last_name",
			u.avatar_url as "user.avatar_url", u.is_online as "user.is_online"
		FROM user_organizations uo
		JOIN users u ON uo.user_id = u.id
		WHERE uo.organization_id = $1
		ORDER BY uo.joined_at ASC
	`
	var members []models.UserOrganization
	if err := r.db.Select(&members, query, orgID); err != nil {
		return nil, err
	}
	return members, nil
}

func (r *OrganizationRepository) GetUserOrgRole(userID, orgID uuid.UUID) (string, error) {
	query := `SELECT role FROM user_organizations WHERE user_id = $1 AND organization_id = $2`
	var role string
	if err := r.db.Get(&role, query, userID, orgID); err != nil {
		if err == sql.ErrNoRows {
			return "", nil
		}
		return "", err
	}
	return role, nil
}

func (r *OrganizationRepository) GetUserOrganizations(userID uuid.UUID) ([]models.UserOrganization, error) {
	query := `
		SELECT uo.id, uo.user_id, uo.organization_id, uo.role, uo.joined_at,
			o.id as "organization.id", o.name as "organization.name", o.subdomain as "organization.subdomain",
			o.plan as "organization.plan", o.is_active as "organization.is_active"
		FROM user_organizations uo
		JOIN organizations o ON uo.organization_id = o.id
		WHERE uo.user_id = $1 AND o.is_active = true
		ORDER BY uo.joined_at ASC
	`
	var orgs []models.UserOrganization
	if err := r.db.Select(&orgs, query, userID); err != nil {
		return nil, err
	}
	return orgs, nil
}

func (r *OrganizationRepository) CountDrivers(orgID uuid.UUID) (int, error) {
	query := `SELECT COUNT(*) FROM user_organizations WHERE organization_id = $1 AND role = 'driver'`
	var count int
	if err := r.db.Get(&count, query, orgID); err != nil {
		return 0, err
	}
	return count, nil
}

func (r *OrganizationRepository) ListPlatformOrgs() ([]models.PlatformOrgSummary, error) {
	query := `
		SELECT o.id, o.name, o.subdomain, o.plan, COALESCE(o.industry, 'general') as industry,
			o.is_active, o.max_drivers, COALESCE(o.billing_balance_mmk, 0) as billing_balance_mmk, o.created_at,
			(SELECT COUNT(*)::int FROM user_organizations uo WHERE uo.organization_id = o.id AND uo.role = 'driver') as driver_count,
			(SELECT COUNT(*)::int FROM trips t WHERE t.org_id = o.id) as trip_count,
			(SELECT COUNT(*)::int FROM user_organizations uo JOIN users du ON du.id = uo.user_id
				WHERE uo.organization_id = o.id AND uo.role = 'driver' AND du.is_online) as online_drivers,
			COALESCE(NULLIF(TRIM(COALESCE(ou.first_name, '') || ' ' || COALESCE(ou.last_name, '')), ''), ou.username, '') as owner_name,
			COALESCE(ou.phone, '') as owner_phone
		FROM organizations o
		LEFT JOIN users ou ON ou.id = o.owner_id
		ORDER BY o.created_at DESC
	`
	var rows []models.PlatformOrgSummary
	if err := r.db.Select(&rows, query); err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []models.PlatformOrgSummary{}
	}
	return rows, nil
}

func (r *OrganizationRepository) PlatformStats() (map[string]int, error) {
	stats := map[string]int{}
	var orgs, active, drivers, trips int
	_ = r.db.Get(&orgs, `SELECT COUNT(*) FROM organizations`)
	_ = r.db.Get(&active, `SELECT COUNT(*) FROM organizations WHERE is_active = true`)
	_ = r.db.Get(&drivers, `SELECT COUNT(*) FROM user_organizations WHERE role = 'driver'`)
	_ = r.db.Get(&trips, `SELECT COUNT(*) FROM trips`)
	stats["organizations"] = orgs
	stats["activeOrganizations"] = active
	stats["drivers"] = drivers
	stats["trips"] = trips
	return stats, nil
}

func (r *OrganizationRepository) SetPlatformOrg(orgID uuid.UUID, plan string, maxDrivers *int, isActive *bool) (*models.Organization, error) {
	org, err := r.GetByID(orgID)
	if err != nil {
		return nil, err
	}
	if plan != "" {
		org.Plan = plan
	}
	if maxDrivers != nil && *maxDrivers > 0 {
		org.MaxDrivers = *maxDrivers
	}
	if isActive != nil {
		org.IsActive = *isActive
	}
	_, err = r.db.Exec(`
		UPDATE organizations
		SET plan = $1, max_drivers = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP
		WHERE id = $4
	`, org.Plan, org.MaxDrivers, org.IsActive, orgID)
	if err != nil {
		return nil, err
	}
	return r.GetByID(orgID)
}

func (r *OrganizationRepository) TopupBilling(orgID, actorID uuid.UUID, amount int, reason string) (*models.Organization, error) {
	if amount == 0 {
		return nil, fmt.Errorf("amount required")
	}
	tx, err := r.db.Beginx()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var bal int
	if err := tx.Get(&bal, `SELECT COALESCE(billing_balance_mmk, 0) FROM organizations WHERE id = $1 FOR UPDATE`, orgID); err != nil {
		return nil, err
	}
	entryType := "credit"
	delta := amount
	if amount < 0 {
		entryType = "debit"
		delta = -amount
		if bal < delta {
			return nil, fmt.Errorf("insufficient billing balance")
		}
		bal -= delta
	} else {
		bal += amount
	}
	if _, err := tx.Exec(`UPDATE organizations SET billing_balance_mmk = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, bal, orgID); err != nil {
		return nil, err
	}
	ledgerAmt := amount
	if entryType == "debit" {
		ledgerAmt = -delta
	}
	if reason == "" {
		reason = "platform_topup"
	}
	if _, err := tx.Exec(`
		INSERT INTO org_billing_ledger (org_id, amount_mmk, entry_type, reason, created_by)
		VALUES ($1, $2, $3, $4, $5)
	`, orgID, ledgerAmt, entryType, reason, actorID); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return r.GetByID(orgID)
}

func (r *OrganizationRepository) ListBillingLedger(orgID uuid.UUID, limit int) ([]models.OrgBillingLedger, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}
	var rows []models.OrgBillingLedger
	err := r.db.Select(&rows, `
		SELECT id, org_id, amount_mmk, entry_type, COALESCE(reason,'') as reason, created_by, created_at
		FROM org_billing_ledger WHERE org_id = $1
		ORDER BY created_at DESC LIMIT $2
	`, orgID, limit)
	if err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []models.OrgBillingLedger{}
	}
	return rows, nil
}

func (r *OrganizationRepository) CountChannels(orgID uuid.UUID) (int, error) {
	query := `SELECT COUNT(*) FROM ptt_channels WHERE organization_id = $1`
	var count int
	if err := r.db.Get(&count, query, orgID); err != nil {
		return 0, err
	}
	return count, nil
}

func (r *OrganizationRepository) UpdateFareSettings(orgID uuid.UUID, req models.UpdateFareSettingsRequest) (*models.Organization, error) {
	org, err := r.GetByID(orgID)
	if err != nil {
		return nil, err
	}
	if req.FareRatePerKm != nil {
		org.FareRatePerKm = *req.FareRatePerKm
	}
	if req.FareMinimum != nil {
		org.FareMinimum = *req.FareMinimum
	}
	if req.FareNightMultiplier != nil {
		org.FareNightMultiplier = *req.FareNightMultiplier
	}
	if req.FareNightStart != nil {
		org.FareNightStart = *req.FareNightStart
	}
	if req.FareNightEnd != nil {
		org.FareNightEnd = *req.FareNightEnd
	}
	if req.BookingEnabled != nil {
		org.BookingEnabled = *req.BookingEnabled
	}
	if req.CustomerAppTitle != nil {
		org.CustomerAppTitle = *req.CustomerAppTitle
	}
	if req.AutoDispatch != nil {
		org.AutoDispatch = *req.AutoDispatch
	}
	if req.DriverCreditFloorMMK != nil {
		org.DriverCreditFloorMMK = *req.DriverCreditFloorMMK
	}
	if req.WalletPaymentInfo != nil {
		org.WalletPaymentInfo = *req.WalletPaymentInfo
	}
	if req.DemandCatalog != nil {
		catalog := sanitizeDemandCatalog(*req.DemandCatalog)
		raw, err := json.Marshal(catalog)
		if err != nil {
			return nil, err
		}
		org.DemandCatalogJSON = string(raw)
	}
	if org.DemandCatalogJSON == "" {
		org.DemandCatalogJSON = "[]"
	}
	query := `
		UPDATE organizations SET
			fare_rate_per_km = $1, fare_minimum = $2, fare_night_multiplier = $3,
			fare_night_start = $4, fare_night_end = $5, booking_enabled = $6,
			customer_app_title = $7, auto_dispatch = $8, driver_credit_floor_mmk = $9,
			wallet_payment_info = $10, demand_catalog_json = $11, updated_at = CURRENT_TIMESTAMP
		WHERE id = $12
	`
	if _, err := r.db.Exec(query,
		org.FareRatePerKm, org.FareMinimum, org.FareNightMultiplier,
		org.FareNightStart, org.FareNightEnd, org.BookingEnabled,
		org.CustomerAppTitle, org.AutoDispatch, org.DriverCreditFloorMMK,
		org.WalletPaymentInfo, org.DemandCatalogJSON, orgID,
	); err != nil {
		return nil, err
	}
	return r.GetByID(orgID)
}

func sanitizeDemandCatalog(items []models.DemandCatalogItem) []models.DemandCatalogItem {
	out := make([]models.DemandCatalogItem, 0, len(items))
	seen := map[string]bool{}
	for _, item := range items {
		code := strings.TrimSpace(strings.ToLower(item.Code))
		name := strings.TrimSpace(item.Name)
		if code == "" || name == "" || seen[code] {
			continue
		}
		if item.AmountMmk < 0 {
			item.AmountMmk = 0
		}
		seen[code] = true
		out = append(out, models.DemandCatalogItem{
			Code:      code,
			Name:      name,
			AmountMmk: item.AmountMmk,
		})
	}
	return out
}

// ParseDemandCatalog returns the org catalog as stored.
// Empty / unset JSON falls back to built-in defaults so drivers always have options.
func ParseDemandCatalog(raw string) []models.DemandCatalogItem {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "[]" || raw == "null" {
		return models.DefaultDemandCatalog()
	}
	var items []models.DemandCatalogItem
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		return models.DefaultDemandCatalog()
	}
	cleaned := sanitizeDemandCatalog(items)
	if len(cleaned) == 0 {
		return models.DefaultDemandCatalog()
	}
	return cleaned
}
