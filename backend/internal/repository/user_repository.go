package repository

import (
	"database/sql"
	"errors"
	"strings"
	"telegram-clone/internal/models"

	"github.com/google/uuid"
)

type UserRepository struct {
	db *Database
}

func NewUserRepository(db *Database) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(user *models.User) error {
	if user.ID == uuid.Nil {
		user.ID = uuid.New()
	}
	// Phone-only accounts (stand owners, invited drivers) have no email or a
	// display-name username; both columns are UNIQUE NOT NULL.
	if strings.TrimSpace(user.Email) == "" {
		user.Email = user.ID.String() + "@phone.farepro.local"
		var taken bool
		if err := r.db.Get(&taken, `SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)`, user.Username); err == nil && taken {
			base := user.Username
			if len(base) > 42 {
				base = base[:42]
			}
			user.Username = base + "-" + user.ID.String()[:6]
		}
	}

	query := `
		INSERT INTO users (id, username, email, password_hash, phone, first_name, last_name, avatar_url, bio)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, username, email, phone, first_name, last_name, avatar_url, bio, is_online, last_seen, created_at, updated_at
	`

	err := r.db.QueryRow(query,
		user.ID,
		user.Username,
		user.Email,
		user.PasswordHash,
		user.Phone,
		user.FirstName,
		user.LastName,
		user.AvatarURL,
		user.Bio,
	).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.Phone,
		&user.FirstName,
		&user.LastName,
		&user.AvatarURL,
		&user.Bio,
		&user.IsOnline,
		&user.LastSeen,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	return err
}

func (r *UserRepository) GetByEmail(email string) (*models.User, error) {
	query := `
		SELECT id, username, email, password_hash, phone, first_name, last_name, avatar_url, bio, is_online, last_seen, created_at, updated_at
		FROM users WHERE email = $1
	`

	var user models.User
	err := r.db.Get(&user, query, email)
	if err != nil {
		return nil, err
	}

	return &user, nil
}

func (r *UserRepository) GetByPhone(phone string) (*models.User, error) {
	query := `
		SELECT id, username, email, password_hash, phone, first_name, last_name, avatar_url, bio, is_online, last_seen, created_at, updated_at
		FROM users WHERE phone = $1
	`

	var user models.User
	err := r.db.Get(&user, query, phone)
	if err != nil {
		return nil, err
	}

	return &user, nil
}

func (r *UserRepository) GetByID(id uuid.UUID) (*models.User, error) {
	query := `
		SELECT id, username, email, phone, first_name, last_name, avatar_url, bio, is_online,
			COALESCE(is_platform_admin, false) as is_platform_admin,
			last_seen, created_at, updated_at
		FROM users WHERE id = $1
	`

	var user models.User
	err := r.db.Get(&user, query, id)
	if err != nil {
		return nil, err
	}

	return &user, nil
}

func (r *UserRepository) IsBanned(userID uuid.UUID) (bool, error) {
	var banned bool
	err := r.db.Get(&banned, `SELECT COALESCE(is_banned, false) FROM users WHERE id = $1`, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return banned, err
}

func (r *UserRepository) SetPasswordHash(userID uuid.UUID, hash string) error {
	_, err := r.db.Exec(`UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, hash, userID)
	return err
}

func (r *UserRepository) SetPlatformAdmin(userID uuid.UUID, enabled bool) error {
	_, err := r.db.Exec(`UPDATE users SET is_platform_admin = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, enabled, userID)
	return err
}

func (r *UserRepository) Search(query string, excludeID uuid.UUID, limit int) ([]models.User, error) {
	sqlQuery := `
		SELECT id, username, email, phone, first_name, last_name, avatar_url, bio, is_online, last_seen, created_at, updated_at
		FROM users
		WHERE (username ILIKE $1 OR email ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1)
		AND id != $2
		ORDER BY first_name, last_name
		LIMIT $3
	`

	var users []models.User
	err := r.db.Select(&users, sqlQuery, "%"+query+"%", excludeID, limit)
	if err != nil {
		return nil, err
	}

	return users, nil
}

func (r *UserRepository) Update(user *models.User) error {
	query := `
		UPDATE users
		SET first_name = COALESCE($1, first_name),
		    last_name = COALESCE($2, last_name),
		    bio = COALESCE($3, bio),
		    phone = COALESCE($4, phone),
		    avatar_url = COALESCE($5, avatar_url),
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $6
		RETURNING id, username, email, phone, first_name, last_name, avatar_url, bio, is_online, last_seen, created_at, updated_at
	`

	err := r.db.QueryRow(query,
		&user.FirstName,
		&user.LastName,
		&user.Bio,
		&user.Phone,
		&user.AvatarURL,
		user.ID,
	).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.Phone,
		&user.FirstName,
		&user.LastName,
		&user.AvatarURL,
		&user.Bio,
		&user.IsOnline,
		&user.LastSeen,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	return err
}

func (r *UserRepository) SetOnlineStatus(id uuid.UUID, online bool) error {
	query := `
		UPDATE users
		SET is_online = $1, last_seen = CURRENT_TIMESTAMP
		WHERE id = $2
	`

	_, err := r.db.Exec(query, online, id)
	return err
}

func (r *UserRepository) AddContact(userID, contactID uuid.UUID) error {
	query := `
		INSERT INTO contacts (user_id, contact_id)
		VALUES ($1, $2)
		ON CONFLICT (user_id, contact_id) DO NOTHING
	`

	_, err := r.db.Exec(query, userID, contactID)
	return err
}

func (r *UserRepository) GetContacts(userID uuid.UUID) ([]models.User, error) {
	query := `
		SELECT u.id, u.username, u.email, u.phone, u.first_name, u.last_name, u.avatar_url, u.bio, u.is_online, u.last_seen, u.created_at, u.updated_at
		FROM contacts c
		JOIN users u ON c.contact_id = u.id
		WHERE c.user_id = $1
		ORDER BY u.first_name, u.last_name
	`

	var users []models.User
	err := r.db.Select(&users, query, userID)
	if err != nil {
		return nil, err
	}

	return users, nil
}

func (r *UserRepository) RemoveContact(userID, contactID uuid.UUID) error {
	query := `DELETE FROM contacts WHERE user_id = $1 AND contact_id = $2`
	_, err := r.db.Exec(query, userID, contactID)
	return err
}
