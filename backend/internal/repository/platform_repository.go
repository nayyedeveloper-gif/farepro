package repository

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// PlatformRepository holds cross-stand read models for the FarePro super admin.
type PlatformRepository struct {
	db *sqlx.DB
}

func NewPlatformRepository(db *sqlx.DB) *PlatformRepository {
	return &PlatformRepository{db: db}
}

type PlatformOverview struct {
	Stands          int `json:"stands" db:"stands"`
	ActiveStands    int `json:"activeStands" db:"active_stands"`
	Drivers         int `json:"drivers" db:"drivers"`
	OnlineDrivers   int `json:"onlineDrivers" db:"online_drivers"`
	TripsToday      int `json:"tripsToday" db:"trips_today"`
	CompletedToday  int `json:"completedToday" db:"completed_today"`
	ActiveTrips     int `json:"activeTrips" db:"active_trips"`
	RevenueTodayMMK int `json:"revenueTodayMmk" db:"revenue_today_mmk"`
	TotalTrips      int `json:"totalTrips" db:"total_trips"`
	StandCreditMMK  int `json:"standCreditMmk" db:"stand_credit_mmk"`
	DriverWalletMMK int `json:"driverWalletMmk" db:"driver_wallet_mmk"`
}

type PlatformDailyPoint struct {
	Day        string `json:"day" db:"day"`
	Trips      int    `json:"trips" db:"trips"`
	Completed  int    `json:"completed" db:"completed"`
	RevenueMMK int    `json:"revenueMmk" db:"revenue_mmk"`
}

type PlatformDriverRow struct {
	UserID         uuid.UUID  `json:"userId" db:"user_id"`
	OrgID          uuid.UUID  `json:"orgId" db:"org_id"`
	OrgName        string     `json:"orgName" db:"org_name"`
	Subdomain      string     `json:"subdomain" db:"subdomain"`
	Username       string     `json:"username" db:"username"`
	FirstName      string     `json:"firstName" db:"first_name"`
	LastName       string     `json:"lastName" db:"last_name"`
	Phone          string     `json:"phone" db:"phone"`
	IsOnline       bool       `json:"isOnline" db:"is_online"`
	VehiclePlate   string     `json:"vehiclePlate" db:"vehicle_plate"`
	VehicleModel   string     `json:"vehicleModel" db:"vehicle_model"`
	WalletMMK      int        `json:"walletMmk" db:"wallet_mmk"`
	CompletedTrips int        `json:"completedTrips" db:"completed_trips"`
	Lat            *float64   `json:"lat,omitempty" db:"lat"`
	Lng            *float64   `json:"lng,omitempty" db:"lng"`
	LocationStatus *string    `json:"locationStatus,omitempty" db:"location_status"`
	LocationAt     *time.Time `json:"locationAt,omitempty" db:"location_at"`
	JoinedAt       time.Time  `json:"joinedAt" db:"joined_at"`
}

type PlatformTripRow struct {
	ID             uuid.UUID  `json:"id" db:"id"`
	OrgID          uuid.UUID  `json:"orgId" db:"org_id"`
	OrgName        string     `json:"orgName" db:"org_name"`
	Subdomain      string     `json:"subdomain" db:"subdomain"`
	CustomerName   string     `json:"customerName" db:"customer_name"`
	CustomerPhone  string     `json:"customerPhone" db:"customer_phone"`
	PickupAddress  string     `json:"pickupAddress" db:"pickup_address"`
	DropoffAddress string     `json:"dropoffAddress" db:"dropoff_address"`
	PickupLat      *float64   `json:"pickupLat,omitempty" db:"pickup_lat"`
	PickupLng      *float64   `json:"pickupLng,omitempty" db:"pickup_lng"`
	Status         string     `json:"status" db:"status"`
	DistanceKm     *float64   `json:"distanceKm,omitempty" db:"distance_km"`
	EstimatedFare  *int       `json:"estimatedFare,omitempty" db:"estimated_fare"`
	ActualFare     *int       `json:"actualFare,omitempty" db:"actual_fare"`
	PaymentMethod  string     `json:"paymentMethod" db:"payment_method"`
	BookingSource  string     `json:"bookingSource" db:"booking_source"`
	DriverID       *uuid.UUID `json:"driverId,omitempty" db:"driver_id"`
	DriverName     string     `json:"driverName" db:"driver_name"`
	CreatedAt      time.Time  `json:"createdAt" db:"created_at"`
}

type PlatformBillingRow struct {
	ID        uuid.UUID `json:"id" db:"id"`
	OrgID     uuid.UUID `json:"orgId" db:"org_id"`
	OrgName   string    `json:"orgName" db:"org_name"`
	AmountMMK int       `json:"amountMmk" db:"amount_mmk"`
	EntryType string    `json:"entryType" db:"entry_type"`
	Reason    string    `json:"reason" db:"reason"`
	ActorName string    `json:"actorName" db:"actor_name"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

type PlatformWalletRow struct {
	ID         uuid.UUID `json:"id" db:"id"`
	OrgID      uuid.UUID `json:"orgId" db:"org_id"`
	OrgName    string    `json:"orgName" db:"org_name"`
	UserID     uuid.UUID `json:"userId" db:"user_id"`
	DriverName string    `json:"driverName" db:"driver_name"`
	AmountMMK  int       `json:"amountMmk" db:"amount_mmk"`
	EntryType  string    `json:"entryType" db:"entry_type"`
	Reason     string    `json:"reason" db:"reason"`
	CreatedAt  time.Time `json:"createdAt" db:"created_at"`
}

type PlatformAdminRow struct {
	ID        uuid.UUID `json:"id" db:"id"`
	Username  string    `json:"username" db:"username"`
	Phone     string    `json:"phone" db:"phone"`
	FirstName string    `json:"firstName" db:"first_name"`
	LastName  string    `json:"lastName" db:"last_name"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

type PlatformMemberRow struct {
	UserID    uuid.UUID `json:"userId" db:"user_id"`
	Username  string    `json:"username" db:"username"`
	FirstName string    `json:"firstName" db:"first_name"`
	LastName  string    `json:"lastName" db:"last_name"`
	Phone     string    `json:"phone" db:"phone"`
	Role      string    `json:"role" db:"role"`
	IsOnline  bool      `json:"isOnline" db:"is_online"`
	JoinedAt  time.Time `json:"joinedAt" db:"joined_at"`
}

func (r *PlatformRepository) Overview() (*PlatformOverview, error) {
	var o PlatformOverview
	err := r.db.Get(&o, `
		SELECT
			(SELECT COUNT(*)::int FROM organizations) AS stands,
			(SELECT COUNT(*)::int FROM organizations WHERE is_active) AS active_stands,
			(SELECT COUNT(*)::int FROM user_organizations WHERE role = 'driver') AS drivers,
			(SELECT COUNT(*)::int FROM user_organizations uo JOIN users u ON u.id = uo.user_id
				WHERE uo.role = 'driver' AND u.is_online) AS online_drivers,
			(SELECT COUNT(*)::int FROM trips WHERE created_at >= date_trunc('day', NOW())) AS trips_today,
			(SELECT COUNT(*)::int FROM trips WHERE status = 'completed' AND updated_at >= date_trunc('day', NOW())) AS completed_today,
			(SELECT COUNT(*)::int FROM trips WHERE status IN ('assigned','en_route','arrived')) AS active_trips,
			(SELECT COALESCE(SUM(COALESCE(actual_fare, estimated_fare, 0)), 0)::int FROM trips
				WHERE status = 'completed' AND updated_at >= date_trunc('day', NOW())) AS revenue_today_mmk,
			(SELECT COUNT(*)::int FROM trips) AS total_trips,
			(SELECT COALESCE(SUM(billing_balance_mmk), 0)::int FROM organizations) AS stand_credit_mmk,
			(SELECT COALESCE(SUM(balance_mmk), 0)::int FROM driver_wallets) AS driver_wallet_mmk
	`)
	if err != nil {
		return nil, err
	}
	return &o, nil
}

func (r *PlatformRepository) DailySeries(days int) ([]PlatformDailyPoint, error) {
	if days <= 0 || days > 90 {
		days = 14
	}
	var rows []PlatformDailyPoint
	err := r.db.Select(&rows, `
		SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
			COUNT(t.id)::int AS trips,
			COUNT(t.id) FILTER (WHERE t.status = 'completed')::int AS completed,
			COALESCE(SUM(COALESCE(t.actual_fare, t.estimated_fare, 0)) FILTER (WHERE t.status = 'completed'), 0)::int AS revenue_mmk
		FROM generate_series(date_trunc('day', NOW()) - ($1::int - 1) * INTERVAL '1 day', date_trunc('day', NOW()), INTERVAL '1 day') AS d(day)
		LEFT JOIN trips t ON date_trunc('day', t.created_at) = d.day
		GROUP BY d.day
		ORDER BY d.day
	`, days)
	if rows == nil {
		rows = []PlatformDailyPoint{}
	}
	return rows, err
}

func (r *PlatformRepository) ListDrivers(orgID *uuid.UUID, q string, onlineOnly bool) ([]PlatformDriverRow, error) {
	query := `
		WITH loc AS (
			SELECT DISTINCT ON (user_id) user_id, latitude, longitude, status, updated_at
			FROM ptt_channel_locations
			ORDER BY user_id, updated_at DESC
		)
		SELECT uo.user_id, o.id AS org_id, o.name AS org_name, o.subdomain,
			u.username, COALESCE(u.first_name, '') AS first_name, COALESCE(u.last_name, '') AS last_name,
			COALESCE(u.phone, '') AS phone, COALESCE(u.is_online, false) AS is_online,
			COALESCE(dp.vehicle_plate, '') AS vehicle_plate, COALESCE(dp.vehicle_model, '') AS vehicle_model,
			COALESCE(dw.balance_mmk, 0) AS wallet_mmk,
			(SELECT COUNT(*)::int FROM trips t WHERE t.org_id = o.id AND t.driver_id = uo.user_id AND t.status = 'completed') AS completed_trips,
			loc.latitude AS lat, loc.longitude AS lng, loc.status AS location_status, loc.updated_at AS location_at,
			COALESCE(uo.joined_at, NOW()) AS joined_at
		FROM user_organizations uo
		JOIN organizations o ON o.id = uo.organization_id
		JOIN users u ON u.id = uo.user_id
		LEFT JOIN driver_profiles dp ON dp.org_id = o.id AND dp.user_id = uo.user_id
		LEFT JOIN driver_wallets dw ON dw.org_id = o.id AND dw.user_id = uo.user_id
		LEFT JOIN loc ON loc.user_id = uo.user_id
		WHERE uo.role = 'driver'`
	args := []interface{}{}
	n := 1
	if orgID != nil {
		query += fmt.Sprintf(" AND o.id = $%d", n)
		args = append(args, *orgID)
		n++
	}
	if q = strings.TrimSpace(q); q != "" {
		query += fmt.Sprintf(" AND (u.username ILIKE $%d OR u.first_name ILIKE $%d OR u.last_name ILIKE $%d OR u.phone ILIKE $%d OR dp.vehicle_plate ILIKE $%d)", n, n, n, n, n)
		args = append(args, "%"+q+"%")
		n++
	}
	if onlineOnly {
		query += " AND u.is_online"
	}
	query += " ORDER BY u.is_online DESC, o.name, u.first_name LIMIT 500"

	var rows []PlatformDriverRow
	if err := r.db.Select(&rows, query, args...); err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []PlatformDriverRow{}
	}
	return rows, nil
}

func (r *PlatformRepository) ListTrips(orgID *uuid.UUID, status string, limit int) ([]PlatformTripRow, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	query := `
		SELECT t.id, t.org_id, o.name AS org_name, o.subdomain,
			t.customer_name, COALESCE(t.customer_phone, '') AS customer_phone,
			t.pickup_address, t.dropoff_address, t.pickup_lat, t.pickup_lng,
			t.status, t.distance_km, t.estimated_fare, t.actual_fare,
			COALESCE(t.payment_method, 'cash') AS payment_method,
			COALESCE(t.booking_source, 'dispatcher') AS booking_source,
			t.driver_id,
			COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), u.username, '') AS driver_name,
			t.created_at
		FROM trips t
		JOIN organizations o ON o.id = t.org_id
		LEFT JOIN users u ON u.id = t.driver_id
		WHERE 1=1`
	args := []interface{}{}
	n := 1
	if orgID != nil {
		query += fmt.Sprintf(" AND t.org_id = $%d", n)
		args = append(args, *orgID)
		n++
	}
	switch status {
	case "":
	case "active":
		query += " AND t.status IN ('assigned','en_route','arrived')"
	case "open":
		query += " AND t.status IN ('pending','requested')"
	default:
		query += fmt.Sprintf(" AND t.status = $%d", n)
		args = append(args, status)
		n++
	}
	query += fmt.Sprintf(" ORDER BY t.created_at DESC LIMIT %d", limit)

	var rows []PlatformTripRow
	if err := r.db.Select(&rows, query, args...); err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []PlatformTripRow{}
	}
	return rows, nil
}

func (r *PlatformRepository) ListBilling(limit int) ([]PlatformBillingRow, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	var rows []PlatformBillingRow
	err := r.db.Select(&rows, `
		SELECT l.id, l.org_id, o.name AS org_name, l.amount_mmk, l.entry_type,
			COALESCE(l.reason, '') AS reason,
			COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), u.username, '') AS actor_name,
			l.created_at
		FROM org_billing_ledger l
		JOIN organizations o ON o.id = l.org_id
		LEFT JOIN users u ON u.id = l.created_by
		ORDER BY l.created_at DESC
		LIMIT $1
	`, limit)
	if rows == nil {
		rows = []PlatformBillingRow{}
	}
	return rows, err
}

func (r *PlatformRepository) ListWalletLedger(orgID *uuid.UUID, limit int) ([]PlatformWalletRow, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	query := `
		SELECT l.id, l.org_id, o.name AS org_name, l.user_id,
			COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), u.username, '') AS driver_name,
			l.amount_mmk, l.entry_type, COALESCE(l.reason, '') AS reason, l.created_at
		FROM driver_wallet_ledger l
		JOIN organizations o ON o.id = l.org_id
		JOIN users u ON u.id = l.user_id`
	args := []interface{}{}
	if orgID != nil {
		query += " WHERE l.org_id = $1"
		args = append(args, *orgID)
	}
	query += fmt.Sprintf(" ORDER BY l.created_at DESC LIMIT %d", limit)
	var rows []PlatformWalletRow
	if err := r.db.Select(&rows, query, args...); err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []PlatformWalletRow{}
	}
	return rows, nil
}

func (r *PlatformRepository) ListMembers(orgID uuid.UUID) ([]PlatformMemberRow, error) {
	var rows []PlatformMemberRow
	err := r.db.Select(&rows, `
		SELECT uo.user_id, u.username, COALESCE(u.first_name, '') AS first_name, COALESCE(u.last_name, '') AS last_name,
			COALESCE(u.phone, '') AS phone, uo.role, COALESCE(u.is_online, false) AS is_online, COALESCE(uo.joined_at, NOW()) AS joined_at
		FROM user_organizations uo
		JOIN users u ON u.id = uo.user_id
		WHERE uo.organization_id = $1
		ORDER BY CASE uo.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'dispatcher' THEN 2 ELSE 3 END, u.first_name
	`, orgID)
	if rows == nil {
		rows = []PlatformMemberRow{}
	}
	return rows, err
}

func (r *PlatformRepository) ListAdmins() ([]PlatformAdminRow, error) {
	var rows []PlatformAdminRow
	err := r.db.Select(&rows, `
		SELECT id, username, COALESCE(phone, '') AS phone, COALESCE(first_name, '') AS first_name,
			COALESCE(last_name, '') AS last_name, created_at
		FROM users WHERE is_platform_admin = true
		ORDER BY created_at
	`)
	if rows == nil {
		rows = []PlatformAdminRow{}
	}
	return rows, err
}

func (r *PlatformRepository) SetAdminByPhone(phone string, enabled bool) (int64, error) {
	res, err := r.db.Exec(`UPDATE users SET is_platform_admin = $1, updated_at = NOW() WHERE phone = $2`, enabled, strings.TrimSpace(phone))
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func (r *PlatformRepository) SetAdminByID(id uuid.UUID, enabled bool) error {
	_, err := r.db.Exec(`UPDATE users SET is_platform_admin = $1, updated_at = NOW() WHERE id = $2`, enabled, id)
	return err
}

func (r *PlatformRepository) CountAdmins() (int, error) {
	var n int
	err := r.db.Get(&n, `SELECT COUNT(*) FROM users WHERE is_platform_admin = true`)
	return n, err
}
