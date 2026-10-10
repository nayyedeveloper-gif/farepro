package repository

import (
	"database/sql"
	"fmt"
	"telegram-clone/internal/models"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type ShiftRepository struct {
	db *sqlx.DB
}

func NewShiftRepository(db *sqlx.DB) *ShiftRepository {
	return &ShiftRepository{db: db}
}

func (r *ShiftRepository) Migrate() error {
	query := `
		CREATE TABLE IF NOT EXISTS retail_shifts (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			location_name VARCHAR(100) NOT NULL,
			role_label VARCHAR(50) NOT NULL DEFAULT 'staff',
			status VARCHAR(20) NOT NULL DEFAULT 'active',
			clock_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			clock_out TIMESTAMPTZ
		);
		CREATE INDEX IF NOT EXISTS idx_retail_shifts_org ON retail_shifts(org_id);
		CREATE INDEX IF NOT EXISTS idx_retail_shifts_user ON retail_shifts(user_id);
		CREATE INDEX IF NOT EXISTS idx_retail_shifts_active ON retail_shifts(org_id, status);
	`
	_, err := r.db.Exec(query)
	return err
}

const shiftSelect = `
	SELECT s.id, s.org_id, s.user_id, s.location_name, s.role_label, s.status,
		s.clock_in, s.clock_out,
		u.id as "user.id", u.username as "user.username",
		u.first_name as "user.first_name", u.last_name as "user.last_name",
		u.avatar_url as "user.avatar_url"
	FROM retail_shifts s
	JOIN users u ON s.user_id = u.id
`

func (r *ShiftRepository) ListByOrg(orgID uuid.UUID, status string, limit int) ([]models.RetailShift, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	query := shiftSelect + ` WHERE s.org_id = $1`
	args := []interface{}{orgID}
	if status != "" {
		query += ` AND s.status = $2`
		args = append(args, status)
	}
	query += ` ORDER BY s.clock_in DESC LIMIT ` + fmt.Sprintf("%d", limit)

	var shifts []models.RetailShift
	if err := r.db.Select(&shifts, query, args...); err != nil {
		return nil, fmt.Errorf("failed to list shifts: %w", err)
	}
	if shifts == nil {
		shifts = []models.RetailShift{}
	}
	return shifts, nil
}

func (r *ShiftRepository) GetActiveForUser(orgID, userID uuid.UUID) (*models.RetailShift, error) {
	query := shiftSelect + ` WHERE s.org_id = $1 AND s.user_id = $2 AND s.status = 'active' LIMIT 1`
	var shift models.RetailShift
	if err := r.db.Get(&shift, query, orgID, userID); err != nil {
		return nil, err
	}
	return &shift, nil
}

func (r *ShiftRepository) ClockIn(shift *models.RetailShift) error {
	active, err := r.GetActiveForUser(shift.OrgID, shift.UserID)
	if err == nil && active != nil {
		return fmt.Errorf("already clocked in")
	}
	if err != nil && err != sql.ErrNoRows {
		return err
	}

	query := `
		INSERT INTO retail_shifts (id, org_id, user_id, location_name, role_label, status, clock_in)
		VALUES ($1, $2, $3, $4, $5, 'active', NOW())
		RETURNING clock_in
	`
	return r.db.QueryRowx(query,
		shift.ID, shift.OrgID, shift.UserID, shift.LocationName, shift.RoleLabel,
	).Scan(&shift.ClockIn)
}

func (r *ShiftRepository) ClockOut(orgID, userID uuid.UUID) (*models.RetailShift, error) {
	shift, err := r.GetActiveForUser(orgID, userID)
	if err != nil {
		return nil, fmt.Errorf("no active shift")
	}

	now := time.Now()
	query := `
		UPDATE retail_shifts SET status = 'completed', clock_out = $1
		WHERE id = $2
		RETURNING clock_out
	`
	if err := r.db.QueryRowx(query, now, shift.ID).Scan(&shift.ClockOut); err != nil {
		return nil, err
	}
	shift.Status = "completed"
	return shift, nil
}

func (r *ShiftRepository) GetByID(orgID, shiftID uuid.UUID) (*models.RetailShift, error) {
	query := shiftSelect + ` WHERE s.id = $1 AND s.org_id = $2`
	var shift models.RetailShift
	if err := r.db.Get(&shift, query, shiftID, orgID); err != nil {
		return nil, err
	}
	return &shift, nil
}
