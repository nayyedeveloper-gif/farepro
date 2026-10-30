package repository

import (
	"fmt"
	"telegram-clone/internal/models"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type TripRepository struct {
	db *sqlx.DB
}

func NewTripRepository(db *sqlx.DB) *TripRepository {
	return &TripRepository{db: db}
}

func (r *TripRepository) Migrate() error {
	query := `
		CREATE TABLE IF NOT EXISTS trips (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
			channel_id UUID REFERENCES ptt_channels(id) ON DELETE SET NULL,
			driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
			created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			customer_name VARCHAR(100) NOT NULL,
			pickup_address TEXT NOT NULL,
			dropoff_address TEXT NOT NULL,
			pickup_lat DOUBLE PRECISION,
			pickup_lng DOUBLE PRECISION,
			dropoff_lat DOUBLE PRECISION,
			dropoff_lng DOUBLE PRECISION,
			status VARCHAR(20) NOT NULL DEFAULT 'pending',
			notes TEXT DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_trips_org ON trips(org_id);
		CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id);
		CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(org_id, status);
	`
	_, err := r.db.Exec(query)
	if err != nil {
		return err
	}
	tripCols := []string{
		`ALTER TABLE trips ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20) NOT NULL DEFAULT ''`,
		`ALTER TABLE trips ADD COLUMN IF NOT EXISTS distance_km DOUBLE PRECISION`,
		`ALTER TABLE trips ADD COLUMN IF NOT EXISTS estimated_fare INTEGER`,
		`ALTER TABLE trips ADD COLUMN IF NOT EXISTS actual_fare INTEGER`,
		`ALTER TABLE trips ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'cash'`,
		`ALTER TABLE trips ADD COLUMN IF NOT EXISTS booking_source VARCHAR(20) NOT NULL DEFAULT 'dispatcher'`,
		`ALTER TABLE trips ADD COLUMN IF NOT EXISTS driver_lat DOUBLE PRECISION`,
		`ALTER TABLE trips ADD COLUMN IF NOT EXISTS driver_lng DOUBLE PRECISION`,
		`ALTER TABLE trips ADD COLUMN IF NOT EXISTS driver_location_at TIMESTAMPTZ`,
		`ALTER TABLE trips ADD COLUMN IF NOT EXISTS service_type VARCHAR(20) NOT NULL DEFAULT 'taxi'`,
		`ALTER TABLE trips ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(20) NOT NULL DEFAULT 'car'`,
		`ALTER TABLE trips ADD COLUMN IF NOT EXISTS parcel_notes TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE trips ADD COLUMN IF NOT EXISTS customer_id UUID`,
		`ALTER TABLE trips ADD COLUMN IF NOT EXISTS demand_mmk INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE trips ADD COLUMN IF NOT EXISTS demand_json TEXT NOT NULL DEFAULT '[]'`,
	}
	for _, q := range tripCols {
		if _, err := r.db.Exec(q); err != nil {
			return err
		}
	}
	return nil
}

const tripSelect = `
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
		t.created_at, t.updated_at,
		u.id as "driver.id", COALESCE(u.username, '') as "driver.username",
		COALESCE(u.first_name, '') as "driver.first_name", COALESCE(u.last_name, '') as "driver.last_name",
		COALESCE(u.avatar_url, '') as "driver.avatar_url",
		COALESCE(u.phone, '') as "driver.phone"
	FROM trips t
	LEFT JOIN users u ON t.driver_id = u.id
`

func (r *TripRepository) ListByOrg(orgID uuid.UUID, status string, limit int) ([]models.Trip, error) {
	return r.ListByOrgFiltered(orgID, status, "", limit)
}

func (r *TripRepository) ListByOrgFiltered(orgID uuid.UUID, status, serviceType string, limit int) ([]models.Trip, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	query := tripSelect + ` WHERE t.org_id = $1`
	args := []interface{}{orgID}
	argN := 2
	if status != "" {
		query += fmt.Sprintf(` AND t.status = $%d`, argN)
		args = append(args, status)
		argN++
	}
	if serviceType == "taxi" || serviceType == "delivery" {
		query += fmt.Sprintf(` AND COALESCE(t.service_type, 'taxi') = $%d`, argN)
		args = append(args, serviceType)
		argN++
	}
	query += ` ORDER BY t.created_at DESC LIMIT ` + fmt.Sprintf("%d", limit)

	var trips []models.Trip
	if err := r.db.Select(&trips, query, args...); err != nil {
		return nil, fmt.Errorf("failed to list trips: %w", err)
	}
	if trips == nil {
		trips = []models.Trip{}
	}
	for i := range trips {
		normalizeTripDriver(&trips[i])
	}
	return trips, nil
}

func normalizeTripDriver(trip *models.Trip) {
	if trip != nil && trip.DriverID == nil {
		trip.Driver = nil
	}
}

func (r *TripRepository) GetByID(orgID, tripID uuid.UUID) (*models.Trip, error) {
	query := tripSelect + ` WHERE t.id = $1 AND t.org_id = $2`
	var trip models.Trip
	if err := r.db.Get(&trip, query, tripID, orgID); err != nil {
		return nil, err
	}
	normalizeTripDriver(&trip)
	return &trip, nil
}

func (r *TripRepository) Create(trip *models.Trip) error {
	if trip.ServiceType == "" {
		trip.ServiceType = "taxi"
	}
	trip.ServiceType = models.NormalizeServiceType(trip.ServiceType)
	trip.VehicleType = models.NormalizeVehicleType(trip.ServiceType, trip.VehicleType)
	query := `
		INSERT INTO trips (id, org_id, channel_id, driver_id, customer_id, created_by,
			customer_name, pickup_address, dropoff_address,
			pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, status, notes,
			customer_phone, distance_km, estimated_fare, actual_fare, payment_method, booking_source,
			service_type, vehicle_type, parcel_notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
		RETURNING created_at, updated_at
	`
	return r.db.QueryRowx(query,
		trip.ID, trip.OrgID, trip.ChannelID, trip.DriverID, trip.CustomerID, trip.CreatedBy,
		trip.CustomerName, trip.PickupAddress, trip.DropoffAddress,
		trip.PickupLat, trip.PickupLng, trip.DropoffLat, trip.DropoffLng,
		trip.Status, trip.Notes, trip.CustomerPhone, trip.DistanceKm,
		trip.EstimatedFare, trip.ActualFare, trip.PaymentMethod, trip.BookingSource,
		trip.ServiceType, trip.VehicleType, trip.ParcelNotes,
	).Scan(&trip.CreatedAt, &trip.UpdatedAt)
}

func (r *TripRepository) Update(trip *models.Trip) error {
	if trip.DemandJSON == "" {
		trip.DemandJSON = "[]"
	}
	query := `
		UPDATE trips
		SET channel_id = $1, driver_id = $2, customer_name = $3,
			pickup_address = $4, dropoff_address = $5, status = $6, notes = $7,
			customer_phone = $8, distance_km = $9, estimated_fare = $10, actual_fare = $11,
			payment_method = $12, demand_mmk = $13, demand_json = $14, updated_at = NOW()
		WHERE id = $15 AND org_id = $16
		RETURNING updated_at
	`
	return r.db.QueryRowx(query,
		trip.ChannelID, trip.DriverID, trip.CustomerName,
		trip.PickupAddress, trip.DropoffAddress, trip.Status, trip.Notes,
		trip.CustomerPhone, trip.DistanceKm, trip.EstimatedFare, trip.ActualFare,
		trip.PaymentMethod, trip.DemandMmk, trip.DemandJSON, trip.ID, trip.OrgID,
	).Scan(&trip.UpdatedAt)
}

func (r *TripRepository) GetPublicByID(orgID, tripID uuid.UUID, customerPhone string) (*models.Trip, error) {
	query := tripSelect + ` WHERE t.id = $1 AND t.org_id = $2 AND t.customer_phone = $3`
	var trip models.Trip
	if err := r.db.Get(&trip, query, tripID, orgID, customerPhone); err != nil {
		return nil, err
	}
	normalizeTripDriver(&trip)
	return &trip, nil
}

func (r *TripRepository) ListActiveForDriver(driverID uuid.UUID) ([]models.Trip, error) {
	query := tripSelect + `
		WHERE t.driver_id = $1 AND t.status IN ('assigned', 'en_route', 'arrived')
		ORDER BY t.updated_at DESC
	`
	var trips []models.Trip
	if err := r.db.Select(&trips, query, driverID); err != nil {
		return nil, err
	}
	if trips == nil {
		trips = []models.Trip{}
	}
	for i := range trips {
		normalizeTripDriver(&trips[i])
	}
	return trips, nil
}

func (r *TripRepository) UpdateDriverLocation(tripID, orgID, driverID uuid.UUID, lat, lng float64) (*models.Trip, error) {
	query := `
		UPDATE trips
		SET driver_lat = $1, driver_lng = $2, driver_location_at = NOW(), updated_at = NOW()
		WHERE id = $3 AND org_id = $4 AND driver_id = $5
		  AND status IN ('en_route', 'arrived')
	`
	res, err := r.db.Exec(query, lat, lng, tripID, orgID, driverID)
	if err != nil {
		return nil, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return nil, fmt.Errorf("trip not found or not active")
	}
	return r.GetByID(orgID, tripID)
}

func (r *TripRepository) ListHistoryForDriver(driverID uuid.UUID, limit int) ([]models.Trip, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}
	query := tripSelect + `
		WHERE t.driver_id = $1 AND t.status IN ('completed', 'cancelled')
		ORDER BY t.updated_at DESC LIMIT ` + fmt.Sprintf("%d", limit)
	var trips []models.Trip
	if err := r.db.Select(&trips, query, driverID); err != nil {
		return nil, err
	}
	if trips == nil {
		trips = []models.Trip{}
	}
	for i := range trips {
		normalizeTripDriver(&trips[i])
	}
	return trips, nil
}

func (r *TripRepository) CancelByDriver(tripID, orgID, driverID uuid.UUID, reason string) (*models.Trip, error) {
	trip, err := r.GetByID(orgID, tripID)
	if err != nil || trip == nil {
		return nil, fmt.Errorf("not found")
	}
	if trip.DriverID == nil || *trip.DriverID != driverID {
		return nil, fmt.Errorf("forbidden")
	}
	if trip.Status != "en_route" && trip.Status != "arrived" {
		return nil, fmt.Errorf("cannot cancel")
	}
	trip.Status = "cancelled"
	if reason != "" {
		trip.Notes = reason
	}
	if err := r.Update(trip); err != nil {
		return nil, err
	}
	return r.GetByID(orgID, tripID)
}

func (r *TripRepository) FleetDrivers(orgID uuid.UUID) ([]models.FleetDriverPin, error) {
	query := `
		SELECT t.driver_id, COALESCE(u.first_name,'') as first_name, COALESCE(u.last_name,'') as last_name,
			t.driver_lat as lat, t.driver_lng as lng, t.status, t.id as trip_id
		FROM trips t
		JOIN users u ON t.driver_id = u.id
		WHERE t.org_id = $1 AND t.status IN ('en_route','arrived')
		  AND t.driver_lat IS NOT NULL AND t.driver_lng IS NOT NULL
	`
	var pins []models.FleetDriverPin
	if err := r.db.Select(&pins, query, orgID); err != nil {
		return nil, err
	}
	if pins == nil {
		pins = []models.FleetDriverPin{}
	}
	return pins, nil
}

func (r *TripRepository) DemandHeat(orgID uuid.UUID) ([]models.DemandHeatPoint, error) {
	query := `
		SELECT ROUND(pickup_lat::numeric, 3)::float8 as lat,
		       ROUND(pickup_lng::numeric, 3)::float8 as lng,
		       COUNT(*)::int as weight
		FROM trips
		WHERE org_id = $1 AND pickup_lat IS NOT NULL AND pickup_lng IS NOT NULL
		  AND created_at > NOW() - INTERVAL '7 days'
		GROUP BY 1, 2
		HAVING COUNT(*) >= 1
		ORDER BY weight DESC
		LIMIT 80
	`
	var pts []models.DemandHeatPoint
	if err := r.db.Select(&pts, query, orgID); err != nil {
		return nil, err
	}
	if pts == nil {
		pts = []models.DemandHeatPoint{}
	}
	return pts, nil
}

// DailyOpsReport returns taxi ride + driver settlement stats for a calendar day (org local via date string YYYY-MM-DD).
func (r *TripRepository) DailyOpsReport(orgID uuid.UUID, day string) (*models.DailyOpsReport, error) {
	if day == "" {
		day = time.Now().UTC().Format("2006-01-02")
	}
	report := &models.DailyOpsReport{Date: day, Drivers: []models.DriverDaySettlement{}}

	err := r.db.QueryRow(`
		SELECT
			COUNT(*)::int,
			COUNT(*) FILTER (WHERE status = 'completed')::int,
			COUNT(*) FILTER (WHERE status = 'cancelled')::int,
			COUNT(*) FILTER (WHERE status IN ('requested','pending','assigned','accepted','en_route','arrived','in_progress'))::int,
			COUNT(*) FILTER (WHERE status = 'requested')::int,
			COALESCE(SUM(COALESCE(actual_fare, estimated_fare, 0)) FILTER (WHERE status = 'completed'), 0)::int
		FROM trips
		WHERE org_id = $1
			AND COALESCE(service_type, 'taxi') = 'taxi'
			AND created_at::date = $2::date
	`, orgID, day).Scan(
		&report.TotalTrips,
		&report.Completed,
		&report.Cancelled,
		&report.Active,
		&report.Requested,
		&report.FareTotal,
	)
	if err != nil {
		return nil, err
	}

	var drivers []models.DriverDaySettlement
	err = r.db.Select(&drivers, `
		SELECT t.driver_id,
			COALESCE(u.first_name, '') as first_name,
			COALESCE(u.last_name, '') as last_name,
			COALESCE(u.username, '') as username,
			COUNT(*)::int as completed_trips,
			COALESCE(SUM(COALESCE(t.actual_fare, t.estimated_fare, 0)), 0)::int as fare_total,
			COALESCE(w.balance_mmk, 0)::int as wallet_balance
		FROM trips t
		JOIN users u ON u.id = t.driver_id
		LEFT JOIN driver_wallets w ON w.org_id = t.org_id AND w.user_id = t.driver_id
		WHERE t.org_id = $1
			AND t.status = 'completed'
			AND t.driver_id IS NOT NULL
			AND COALESCE(t.service_type, 'taxi') = 'taxi'
			AND t.created_at::date = $2::date
		GROUP BY t.driver_id, u.first_name, u.last_name, u.username, w.balance_mmk
		ORDER BY fare_total DESC, completed_trips DESC
	`, orgID, day)
	if err != nil {
		return nil, err
	}
	if drivers == nil {
		drivers = []models.DriverDaySettlement{}
	}
	report.Drivers = drivers
	return report, nil
}

// BusyDriverIDs returns drivers currently holding an assigned or in-progress trip.
func (r *TripRepository) BusyDriverIDs(orgID uuid.UUID) (map[uuid.UUID]bool, error) {
	var ids []uuid.UUID
	err := r.db.Select(&ids, `
		SELECT DISTINCT driver_id FROM trips
		WHERE org_id = $1 AND driver_id IS NOT NULL AND status IN ('assigned', 'en_route', 'arrived')
	`, orgID)
	out := make(map[uuid.UUID]bool, len(ids))
	for _, id := range ids {
		out[id] = true
	}
	return out, err
}
