package repository

import (
	"fmt"
	"strings"
	"telegram-clone/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type CustomerRepository struct {
	db *sqlx.DB
}

func NewCustomerRepository(db *sqlx.DB) *CustomerRepository {
	return &CustomerRepository{db: db}
}

func (r *CustomerRepository) Migrate() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS customers (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
			name VARCHAR(100) NOT NULL,
			phone VARCHAR(20) NOT NULL,
			notes TEXT NOT NULL DEFAULT '',
			trip_count INTEGER NOT NULL DEFAULT 0,
			last_trip_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (org_id, phone)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(org_id)`,
		`CREATE INDEX IF NOT EXISTS idx_customers_org_name ON customers(org_id, name)`,
		`ALTER TABLE trips ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL`,
		`CREATE INDEX IF NOT EXISTS idx_trips_customer ON trips(customer_id)`,
	}
	for _, q := range queries {
		if _, err := r.db.Exec(q); err != nil {
			return fmt.Errorf("customer migrate: %w", err)
		}
	}
	if err := r.BackfillFromTrips(); err != nil {
		return fmt.Errorf("customer backfill: %w", err)
	}
	return nil
}

const customerSelect = `
	SELECT id, org_id, name, phone, COALESCE(notes, '') as notes,
		trip_count, last_trip_at, created_at, updated_at
	FROM customers
`

func (r *CustomerRepository) ListByOrg(orgID uuid.UUID, search string, limit int) ([]models.Customer, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	search = strings.TrimSpace(search)
	var customers []models.Customer
	var err error
	if search == "" {
		err = r.db.Select(&customers, customerSelect+`
			WHERE org_id = $1
			ORDER BY COALESCE(last_trip_at, created_at) DESC
			LIMIT $2
		`, orgID, limit)
	} else {
		like := "%" + search + "%"
		err = r.db.Select(&customers, customerSelect+`
			WHERE org_id = $1 AND (name ILIKE $2 OR phone ILIKE $2 OR notes ILIKE $2)
			ORDER BY COALESCE(last_trip_at, created_at) DESC
			LIMIT $3
		`, orgID, like, limit)
	}
	if err != nil {
		return nil, err
	}
	if customers == nil {
		customers = []models.Customer{}
	}
	return customers, nil
}

func (r *CustomerRepository) GetByID(orgID, id uuid.UUID) (*models.Customer, error) {
	var c models.Customer
	if err := r.db.Get(&c, customerSelect+` WHERE id = $1 AND org_id = $2`, id, orgID); err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *CustomerRepository) GetByPhone(orgID uuid.UUID, phone string) (*models.Customer, error) {
	phone = strings.TrimSpace(phone)
	var c models.Customer
	if err := r.db.Get(&c, customerSelect+` WHERE org_id = $1 AND phone = $2`, orgID, phone); err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *CustomerRepository) Create(c *models.Customer) error {
	query := `
		INSERT INTO customers (id, org_id, name, phone, notes)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING created_at, updated_at, trip_count
	`
	return r.db.QueryRow(query, c.ID, c.OrgID, c.Name, c.Phone, c.Notes).
		Scan(&c.CreatedAt, &c.UpdatedAt, &c.TripCount)
}

func (r *CustomerRepository) Update(c *models.Customer) error {
	_, err := r.db.Exec(`
		UPDATE customers
		SET name = $3, phone = $4, notes = $5, updated_at = NOW()
		WHERE id = $1 AND org_id = $2
	`, c.ID, c.OrgID, c.Name, c.Phone, c.Notes)
	return err
}

func (r *CustomerRepository) Delete(orgID, id uuid.UUID) error {
	res, err := r.db.Exec(`DELETE FROM customers WHERE id = $1 AND org_id = $2`, id, orgID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("customer not found")
	}
	return nil
}

// UpsertByPhone creates or updates a customer and bumps trip_count / last_trip_at.
func (r *CustomerRepository) UpsertByPhone(orgID uuid.UUID, name, phone string) (*models.Customer, error) {
	name = strings.TrimSpace(name)
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return nil, fmt.Errorf("phone required")
	}
	if name == "" {
		name = phone
	}

	existing, err := r.GetByPhone(orgID, phone)
	if err == nil && existing != nil {
		_, _ = r.db.Exec(`
			UPDATE customers
			SET name = CASE WHEN $3 <> '' THEN $3 ELSE name END,
				trip_count = trip_count + 1,
				last_trip_at = NOW(),
				updated_at = NOW()
			WHERE id = $1 AND org_id = $2
		`, existing.ID, orgID, name)
		return r.GetByID(orgID, existing.ID)
	}

	c := &models.Customer{
		ID:    uuid.New(),
		OrgID: orgID,
		Name:  name,
		Phone: phone,
	}
	if err := r.Create(c); err != nil {
		return nil, err
	}
	_, _ = r.db.Exec(`
		UPDATE customers SET trip_count = 1, last_trip_at = NOW(), updated_at = NOW() WHERE id = $1
	`, c.ID)
	return r.GetByID(orgID, c.ID)
}

func (r *CustomerRepository) LinkTrip(orgID, tripID, customerID uuid.UUID) error {
	_, err := r.db.Exec(`
		UPDATE trips SET customer_id = $3, updated_at = NOW()
		WHERE id = $1 AND org_id = $2
	`, tripID, orgID, customerID)
	return err
}

// BackfillFromTrips creates customers from historical trip phones and links trips.
func (r *CustomerRepository) BackfillFromTrips() error {
	_, err := r.db.Exec(`
		INSERT INTO customers (id, org_id, name, phone, notes, trip_count, last_trip_at)
		SELECT gen_random_uuid(), t.org_id,
			COALESCE(NULLIF(MAX(t.customer_name), ''), MAX(t.customer_phone)),
			t.customer_phone,
			'',
			COUNT(*)::int,
			MAX(t.created_at)
		FROM trips t
		WHERE COALESCE(TRIM(t.customer_phone), '') <> ''
			AND NOT EXISTS (
				SELECT 1 FROM customers c
				WHERE c.org_id = t.org_id AND c.phone = t.customer_phone
			)
		GROUP BY t.org_id, t.customer_phone
	`)
	if err != nil {
		return fmt.Errorf("backfill insert customers: %w", err)
	}
	_, err = r.db.Exec(`
		UPDATE trips t
		SET customer_id = c.id, updated_at = NOW()
		FROM customers c
		WHERE t.org_id = c.org_id
			AND t.customer_phone = c.phone
			AND t.customer_id IS NULL
	`)
	if err != nil {
		return fmt.Errorf("backfill link trips: %w", err)
	}
	_, err = r.db.Exec(`
		UPDATE customers c SET
			trip_count = COALESCE((
				SELECT COUNT(*)::int FROM trips t WHERE t.customer_id = c.id
			), 0),
			last_trip_at = (
				SELECT MAX(t.created_at) FROM trips t WHERE t.customer_id = c.id
			),
			updated_at = NOW()
	`)
	if err != nil {
		return fmt.Errorf("backfill recount: %w", err)
	}
	return nil
}

func (r *CustomerRepository) ListTrips(orgID, customerID uuid.UUID, limit int) ([]models.Trip, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}
	query := `
		SELECT t.id, t.org_id, t.channel_id, t.driver_id, t.customer_id, t.created_by,
			t.customer_name, t.pickup_address, t.dropoff_address,
			t.pickup_lat, t.pickup_lng, t.dropoff_lat, t.dropoff_lng,
			t.status, COALESCE(t.notes, '') as notes,
			COALESCE(t.customer_phone, '') as customer_phone,
			t.distance_km, t.estimated_fare, t.actual_fare,
			COALESCE(t.demand_mmk, 0) as demand_mmk,
			COALESCE(t.demand_json, '[]') as demand_json,
			COALESCE(t.payment_method, 'cash') as payment_method,
			COALESCE(t.booking_source, 'dispatcher') as booking_source,
			COALESCE(t.service_type, 'taxi') as service_type,
			COALESCE(t.vehicle_type, 'car') as vehicle_type,
			COALESCE(t.parcel_notes, '') as parcel_notes,
			t.driver_lat, t.driver_lng, t.driver_location_at,
			t.created_at, t.updated_at
		FROM trips t
		WHERE t.org_id = $1 AND (t.customer_id = $2 OR (
			t.customer_id IS NULL AND t.customer_phone = (SELECT phone FROM customers WHERE id = $2 AND org_id = $1)
		))
		ORDER BY t.created_at DESC
		LIMIT $3
	`
	var trips []models.Trip
	if err := r.db.Select(&trips, query, orgID, customerID, limit); err != nil {
		return nil, err
	}
	if trips == nil {
		trips = []models.Trip{}
	}
	return trips, nil
}
