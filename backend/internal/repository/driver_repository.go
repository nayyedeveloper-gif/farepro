package repository

import (
	"fmt"
	"strings"
	"telegram-clone/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type DriverRepository struct {
	db *sqlx.DB
}

func NewDriverRepository(db *sqlx.DB) *DriverRepository {
	return &DriverRepository{db: db}
}

func (r *DriverRepository) Migrate() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS driver_profiles (
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
		)`,
		`CREATE TABLE IF NOT EXISTS driver_wallets (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			balance_mmk INTEGER NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(org_id, user_id)
		)`,
		`CREATE TABLE IF NOT EXISTS driver_wallet_ledger (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			wallet_id UUID NOT NULL REFERENCES driver_wallets(id) ON DELETE CASCADE,
			org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			amount_mmk INTEGER NOT NULL,
			entry_type VARCHAR(20) NOT NULL DEFAULT 'adjust',
			reason TEXT NOT NULL DEFAULT '',
			created_by UUID REFERENCES users(id) ON DELETE SET NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_driver_profiles_org ON driver_profiles(org_id)`,
		`CREATE INDEX IF NOT EXISTS idx_driver_wallets_org ON driver_wallets(org_id)`,
		`CREATE INDEX IF NOT EXISTS idx_driver_wallet_ledger_user ON driver_wallet_ledger(org_id, user_id)`,
		`CREATE TABLE IF NOT EXISTS driver_topup_requests (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			amount_mmk INTEGER NOT NULL CHECK (amount_mmk > 0),
			method VARCHAR(20) NOT NULL,
			reference VARCHAR(100) NOT NULL DEFAULT '',
			note TEXT NOT NULL DEFAULT '',
			status VARCHAR(20) NOT NULL DEFAULT 'pending',
			reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
			reviewed_at TIMESTAMPTZ,
			review_note TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_driver_topup_org_status ON driver_topup_requests(org_id, status, created_at DESC)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_topup_ref ON driver_topup_requests(org_id, method, reference) WHERE reference <> '' AND status <> 'rejected'`,
	}
	for _, q := range queries {
		if _, err := r.db.Exec(q); err != nil {
			return fmt.Errorf("driver migrate: %w", err)
		}
	}
	return nil
}

func (r *DriverRepository) EnsureProfileAndWallet(orgID, userID uuid.UUID) error {
	_, err := r.db.Exec(`
		INSERT INTO driver_profiles (org_id, user_id)
		VALUES ($1, $2)
		ON CONFLICT (org_id, user_id) DO NOTHING
	`, orgID, userID)
	if err != nil {
		return err
	}
	_, err = r.db.Exec(`
		INSERT INTO driver_wallets (org_id, user_id, balance_mmk)
		VALUES ($1, $2, 0)
		ON CONFLICT (org_id, user_id) DO NOTHING
	`, orgID, userID)
	return err
}

func (r *DriverRepository) GetProfile(orgID, userID uuid.UUID) (*models.DriverProfile, error) {
	var p models.DriverProfile
	err := r.db.Get(&p, `
		SELECT id, org_id, user_id, vehicle_plate, vehicle_model, vehicle_color,
			license_no, nrc, COALESCE(notes, '') as notes, created_at, updated_at
		FROM driver_profiles WHERE org_id = $1 AND user_id = $2
	`, orgID, userID)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *DriverRepository) UpsertProfile(orgID, userID uuid.UUID, req models.UpdateDriverProfileRequest) (*models.DriverProfile, error) {
	if err := r.EnsureProfileAndWallet(orgID, userID); err != nil {
		return nil, err
	}
	_, err := r.db.Exec(`
		UPDATE driver_profiles SET
			vehicle_plate = $3, vehicle_model = $4, vehicle_color = $5,
			license_no = $6, nrc = $7, notes = $8, updated_at = NOW()
		WHERE org_id = $1 AND user_id = $2
	`, orgID, userID, req.VehiclePlate, req.VehicleModel, req.VehicleColor, req.LicenseNo, req.NRC, req.Notes)
	if err != nil {
		return nil, err
	}
	return r.GetProfile(orgID, userID)
}

func (r *DriverRepository) GetWallet(orgID, userID uuid.UUID) (*models.DriverWallet, error) {
	var w models.DriverWallet
	err := r.db.Get(&w, `
		SELECT id, org_id, user_id, balance_mmk, created_at, updated_at
		FROM driver_wallets WHERE org_id = $1 AND user_id = $2
	`, orgID, userID)
	if err != nil {
		return nil, err
	}
	return &w, nil
}

func (r *DriverRepository) ListProfilesByOrg(orgID uuid.UUID) ([]models.DriverProfile, error) {
	var rows []models.DriverProfile
	err := r.db.Select(&rows, `
		SELECT id, org_id, user_id, vehicle_plate, vehicle_model, vehicle_color,
			license_no, nrc, COALESCE(notes, '') as notes, created_at, updated_at
		FROM driver_profiles WHERE org_id = $1
	`, orgID)
	if err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []models.DriverProfile{}
	}
	return rows, nil
}

func (r *DriverRepository) ListWalletsByOrg(orgID uuid.UUID) ([]models.DriverWallet, error) {
	var rows []models.DriverWallet
	err := r.db.Select(&rows, `
		SELECT id, org_id, user_id, balance_mmk, created_at, updated_at
		FROM driver_wallets WHERE org_id = $1
	`, orgID)
	if err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []models.DriverWallet{}
	}
	return rows, nil
}

func (r *DriverRepository) AdjustWallet(orgID, userID, actorID uuid.UUID, amount int, entryType, reason string) (*models.DriverWallet, error) {
	if entryType == "" {
		entryType = "adjust"
	}
	if err := r.EnsureProfileAndWallet(orgID, userID); err != nil {
		return nil, err
	}
	tx, err := r.db.Beginx()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var w models.DriverWallet
	if err := tx.Get(&w, `
		SELECT id, org_id, user_id, balance_mmk, created_at, updated_at
		FROM driver_wallets WHERE org_id = $1 AND user_id = $2 FOR UPDATE
	`, orgID, userID); err != nil {
		return nil, err
	}

	newBal := w.BalanceMMK
	absAmt := amount
	if absAmt < 0 {
		absAmt = -absAmt
	}
	switch entryType {
	case "credit":
		newBal = w.BalanceMMK + absAmt
		amount = absAmt
	case "debit", "commission":
		newBal = w.BalanceMMK - absAmt
		amount = absAmt
	default: // adjust: signed delta
		newBal = w.BalanceMMK + amount
		entryType = "adjust"
	}
	// Commission is always recorded (driver owes the stand); other reductions
	// may not push the wallet below zero. Increases are always allowed.
	if entryType != "commission" && newBal < 0 && newBal < w.BalanceMMK {
		return nil, fmt.Errorf("insufficient balance")
	}

	if _, err := tx.Exec(`
		UPDATE driver_wallets SET balance_mmk = $1, updated_at = NOW() WHERE id = $2
	`, newBal, w.ID); err != nil {
		return nil, err
	}

	ledgerAmt := amount
	if entryType == "debit" || entryType == "commission" {
		ledgerAmt = -amount
	} else if entryType == "adjust" {
		ledgerAmt = amount
	}

	if _, err := tx.Exec(`
		INSERT INTO driver_wallet_ledger (wallet_id, org_id, user_id, amount_mmk, entry_type, reason, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, w.ID, orgID, userID, ledgerAmt, entryType, reason, actorID); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return r.GetWallet(orgID, userID)
}

func (r *DriverRepository) HasLedgerReason(orgID uuid.UUID, reason string) (bool, error) {
	var n int
	err := r.db.Get(&n, `SELECT COUNT(*) FROM driver_wallet_ledger WHERE org_id = $1 AND reason = $2`, orgID, reason)
	return n > 0, err
}

func (r *DriverRepository) ListLedger(orgID, userID uuid.UUID, limit int) ([]models.DriverWalletLedger, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}
	var rows []models.DriverWalletLedger
	err := r.db.Select(&rows, `
		SELECT id, wallet_id, org_id, user_id, amount_mmk, entry_type,
			COALESCE(reason, '') as reason, created_by, created_at
		FROM driver_wallet_ledger
		WHERE org_id = $1 AND user_id = $2
		ORDER BY created_at DESC
		LIMIT $3
	`, orgID, userID, limit)
	if err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []models.DriverWalletLedger{}
	}
	return rows, nil
}

func (r *DriverRepository) CountTripsByDriver(orgID, userID uuid.UUID) (active, completed, cancelled int, err error) {
	err = r.db.Get(&active, `
		SELECT COUNT(*) FROM trips
		WHERE org_id = $1 AND driver_id = $2
		  AND status IN ('assigned', 'en_route', 'arrived', 'pending', 'requested')
	`, orgID, userID)
	if err != nil {
		return
	}
	err = r.db.Get(&completed, `
		SELECT COUNT(*) FROM trips WHERE org_id = $1 AND driver_id = $2 AND status = 'completed'
	`, orgID, userID)
	if err != nil {
		return
	}
	err = r.db.Get(&cancelled, `
		SELECT COUNT(*) FROM trips WHERE org_id = $1 AND driver_id = $2 AND status = 'cancelled'
	`, orgID, userID)
	return
}

const topupSelect = `
	SELECT t.id, t.org_id, t.user_id,
		COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), u.username) AS driver_name,
		COALESCE(u.phone, '') AS phone,
		t.amount_mmk, t.method, t.reference, t.note, t.status, t.review_note, t.reviewed_at, t.created_at
	FROM driver_topup_requests t
	JOIN users u ON u.id = t.user_id`

// ErrDuplicateTopupReference is returned when a payment reference was already submitted.
var ErrDuplicateTopupReference = fmt.Errorf("this payment reference was already submitted")

func (r *DriverRepository) CreateTopupRequest(orgID, userID uuid.UUID, req models.CreateTopupRequest) (*models.DriverTopupRequest, error) {
	var id uuid.UUID
	err := r.db.Get(&id, `
		INSERT INTO driver_topup_requests (org_id, user_id, amount_mmk, method, reference, note)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
	`, orgID, userID, req.AmountMMK, req.Method, req.Reference, req.Note)
	if err != nil {
		if strings.Contains(err.Error(), "idx_driver_topup_ref") {
			return nil, ErrDuplicateTopupReference
		}
		return nil, err
	}
	return r.GetTopupRequest(orgID, id)
}

func (r *DriverRepository) GetTopupRequest(orgID, id uuid.UUID) (*models.DriverTopupRequest, error) {
	var t models.DriverTopupRequest
	if err := r.db.Get(&t, topupSelect+` WHERE t.org_id = $1 AND t.id = $2`, orgID, id); err != nil {
		return nil, err
	}
	return &t, nil
}

// ListTopupRequests lists a stand's requests; userID narrows to one driver, status "" means all.
func (r *DriverRepository) ListTopupRequests(orgID uuid.UUID, userID *uuid.UUID, status string, limit int) ([]models.DriverTopupRequest, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	query := topupSelect + ` WHERE t.org_id = $1`
	args := []interface{}{orgID}
	if userID != nil {
		args = append(args, *userID)
		query += fmt.Sprintf(" AND t.user_id = $%d", len(args))
	}
	if status != "" {
		args = append(args, status)
		query += fmt.Sprintf(" AND t.status = $%d", len(args))
	}
	query += fmt.Sprintf(" ORDER BY t.created_at DESC LIMIT %d", limit)
	var rows []models.DriverTopupRequest
	if err := r.db.Select(&rows, query, args...); err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []models.DriverTopupRequest{}
	}
	return rows, nil
}

// ClaimTopupRequest moves a pending request to the given status exactly once.
func (r *DriverRepository) ClaimTopupRequest(orgID, id, reviewerID uuid.UUID, status, note string) (*models.DriverTopupRequest, error) {
	res, err := r.db.Exec(`
		UPDATE driver_topup_requests
		SET status = $1, reviewed_by = $2, reviewed_at = NOW(), review_note = $3
		WHERE org_id = $4 AND id = $5 AND status = 'pending'
	`, status, reviewerID, note, orgID, id)
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, fmt.Errorf("request is no longer pending")
	}
	return r.GetTopupRequest(orgID, id)
}

func (r *DriverRepository) RevertTopupClaim(orgID, id uuid.UUID) {
	_, _ = r.db.Exec(`
		UPDATE driver_topup_requests SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL
		WHERE org_id = $1 AND id = $2
	`, orgID, id)
}

// WalletBalances returns balance per driver for eligibility checks.
func (r *DriverRepository) WalletBalances(orgID uuid.UUID) (map[uuid.UUID]int, error) {
	rows := []struct {
		UserID  uuid.UUID `db:"user_id"`
		Balance int       `db:"balance_mmk"`
	}{}
	if err := r.db.Select(&rows, `SELECT user_id, balance_mmk FROM driver_wallets WHERE org_id = $1`, orgID); err != nil {
		return nil, err
	}
	out := make(map[uuid.UUID]int, len(rows))
	for _, row := range rows {
		out[row.UserID] = row.Balance
	}
	return out, nil
}
