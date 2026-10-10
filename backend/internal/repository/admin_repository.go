package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type AdminRepository struct {
	db *Database
}

func NewAdminRepository(db *Database) *AdminRepository {
	return &AdminRepository{db: db}
}

// Dashboard Stats
func (r *AdminRepository) GetDashboardStats() (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Total users
	var totalUsers int
	err := r.db.Get(&totalUsers, "SELECT COUNT(*) FROM users")
	if err != nil {
		return nil, fmt.Errorf("failed to get total users: %w", err)
	}
	stats["totalUsers"] = totalUsers

	// Active users (online in last 5 minutes)
	var activeUsers int
	err = r.db.Get(&activeUsers, "SELECT COUNT(*) FROM users WHERE is_online = true OR last_seen > NOW() - INTERVAL '5 minutes'")
	if err != nil {
		// If query fails, set to 0
		activeUsers = 0
	}
	stats["activeUsers"] = activeUsers

	// Total messages
	var totalMessages int
	err = r.db.Get(&totalMessages, "SELECT COUNT(*) FROM messages")
	if err != nil {
		// If table doesn't exist, set to 0
		totalMessages = 0
	}
	stats["totalMessages"] = totalMessages

	// Total calls
	var totalCalls int
	err = r.db.Get(&totalCalls, "SELECT COUNT(*) FROM calls")
	if err != nil {
		// If table doesn't exist, set to 0
		totalCalls = 0
	}
	stats["totalCalls"] = totalCalls

	// Total files
	var totalFiles int
	err = r.db.Get(&totalFiles, "SELECT COUNT(*) FROM files")
	if err != nil {
		// If table doesn't exist, set to 0
		totalFiles = 0
	}
	stats["totalFiles"] = totalFiles

	// Storage used (in GB)
	var storageUsed float64
	err = r.db.Get(&storageUsed, "SELECT COALESCE(SUM(file_size), 0) / 1024 / 1024 / 1024 FROM files")
	if err != nil {
		// If table doesn't exist, set to 0
		storageUsed = 0
	}
	stats["storageUsed"] = fmt.Sprintf("%.2f GB", storageUsed)

	return stats, nil
}

// User Management
func (r *AdminRepository) GetAllUsers(page, limit int, search string) ([]map[string]interface{}, int, error) {
	offset := (page - 1) * limit

	query := `
		SELECT id, username, email, phone, first_name, last_name, avatar_url, is_online, is_banned, created_at, last_seen
		FROM users
		WHERE 1=1
	`
	args := []interface{}{}
	argIndex := 1

	if search != "" {
		query += fmt.Sprintf(" AND (username ILIKE $%d OR email ILIKE $%d OR first_name ILIKE $%d OR last_name ILIKE $%d)", argIndex, argIndex, argIndex, argIndex)
		args = append(args, "%"+search+"%")
		argIndex++
	}

	// Get total count
	countQuery := "SELECT COUNT(*) FROM users WHERE 1=1"
	if search != "" {
		countQuery += fmt.Sprintf(" AND (username ILIKE $1 OR email ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1)")
	}
	var total int
	var countErr error
	if search != "" {
		countErr = r.db.Get(&total, countQuery, "%"+search+"%")
	} else {
		countErr = r.db.Get(&total, countQuery)
	}
	if countErr != nil {
		return nil, 0, fmt.Errorf("failed to get users count: %w", countErr)
	}

	// Get users with pagination
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIndex, argIndex+1)
	if search != "" {
		args = append(args, limit, offset)
	} else {
		args = []interface{}{limit, offset}
	}

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get users: %w", err)
	}
	defer rows.Close()

	var users []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var username, email, phone, firstName, lastName, avatarURL string
		var isOnline, isBanned bool
		var createdAt, lastSeen time.Time

		err := rows.Scan(&id, &username, &email, &phone, &firstName, &lastName, &avatarURL, &isOnline, &isBanned, &createdAt, &lastSeen)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan user: %w", err)
		}

		user := map[string]interface{}{
			"id":        id.String(),
			"username":  username,
			"email":     email,
			"phone":     phone,
			"firstName": firstName,
			"lastName":  lastName,
			"avatarUrl": avatarURL,
			"isOnline":  isOnline,
			"isBanned":  isBanned,
			"createdAt": createdAt.Format("2006-01-02"),
			"lastSeen":  formatLastSeen(lastSeen, isOnline),
		}
		users = append(users, user)
	}

	// If no users found, return empty array instead of nil
	if users == nil {
		users = []map[string]interface{}{}
	}

	return users, total, nil
}

func (r *AdminRepository) BanUser(userID uuid.UUID, ban bool) error {
	query := `UPDATE users SET is_banned = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
	_, err := r.db.Exec(query, ban, userID)
	return err
}

func (r *AdminRepository) GetUserConversations(userID uuid.UUID) ([]map[string]interface{}, error) {
	query := `
		SELECT DISTINCT
			COALESCE(c.id, CASE WHEN dm.user1_id = $1 THEN dm.user2_id ELSE dm.user1_id END) as id,
			COALESCE(c.name, u.username) as name,
			COALESCE(c.type, 'direct') as type,
			COALESCE(m.content, '') as last_message,
			COALESCE(m.created_at, dm.created_at) as last_message_time,
			COALESCE(c.message_count, 0) as message_count
		FROM users u
		LEFT JOIN direct_messages dm ON (dm.user1_id = $1 OR dm.user2_id = $1)
		LEFT JOIN conversations c ON c.id = dm.conversation_id
		LEFT JOIN messages m ON m.conversation_id = COALESCE(c.id, dm.conversation_id)
		WHERE (dm.user1_id = $1 OR dm.user2_id = $1 OR c.id IN (
			SELECT conversation_id FROM conversation_members WHERE user_id = $1
		))
		ORDER BY COALESCE(m.created_at, dm.created_at) DESC
		LIMIT 50
	`

	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user conversations: %w", err)
	}
	defer rows.Close()

	var conversations []map[string]interface{}
	for rows.Next() {
		var id sql.NullString
		var name, convType, lastMessage string
		var lastMessageTime time.Time
		var messageCount int

		err := rows.Scan(&id, &name, &convType, &lastMessage, &lastMessageTime, &messageCount)
		if err != nil {
			return nil, fmt.Errorf("failed to scan conversation: %w", err)
		}

		conv := map[string]interface{}{
			"id":              id.String,
			"name":            name,
			"type":            convType,
			"lastMessage":     lastMessage,
			"lastMessageTime": formatTimeAgo(lastMessageTime),
			"messageCount":    messageCount,
		}
		conversations = append(conversations, conv)
	}

	return conversations, nil
}

// Group Management
func (r *AdminRepository) GetAllGroups(page, limit int, groupType string) ([]map[string]interface{}, int, error) {
	offset := (page - 1) * limit

	query := `
		SELECT c.id, c.name, c.type, c.created_at, c.updated_at, c.description,
		       COUNT(cp.user_id) as member_count
		FROM conversations c
		LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
		WHERE c.type IN ('group', 'channel')
	`
	args := []interface{}{}
	argIndex := 1

	if groupType != "" && groupType != "all" {
		query += fmt.Sprintf(" AND c.type = $%d", argIndex)
		args = append(args, groupType)
		argIndex++
	}

	query += " GROUP BY c.id, c.name, c.type, c.created_at, c.updated_at, c.description"

	// Get total count
	countQuery := `SELECT COUNT(*) FROM conversations WHERE type IN ('group', 'channel')`
	countArgs := []interface{}{}
	countArgIndex := 1
	if groupType != "" && groupType != "all" {
		countQuery += fmt.Sprintf(" AND type = $%d", countArgIndex)
		countArgs = append(countArgs, groupType)
		countArgIndex++
	}
	var total int
	var countErr error
	if len(countArgs) > 0 {
		countErr = r.db.Get(&total, countQuery, countArgs...)
	} else {
		countErr = r.db.Get(&total, countQuery)
	}
	if countErr != nil {
		return nil, 0, fmt.Errorf("failed to get groups count: %w", countErr)
	}

	// Get groups with pagination
	query += fmt.Sprintf(" ORDER BY c.created_at DESC LIMIT $%d OFFSET $%d", argIndex, argIndex+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get groups: %w", err)
	}
	defer rows.Close()

	var groups []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var name, convType, description string
		var memberCount int
		var createdAt, updatedAt time.Time

		err := rows.Scan(&id, &name, &convType, &createdAt, &updatedAt, &description, &memberCount)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan group: %w", err)
		}

		group := map[string]interface{}{
			"id":           id.String(),
			"name":         name,
			"type":         convType,
			"memberCount":  memberCount,
			"adminCount":   0, // Not tracking admins in current schema
			"createdAt":    createdAt.Format("2006-01-02"),
			"lastActivity": formatTimeAgo(updatedAt),
			"isPrivate":    convType == "private",
			"description":  description,
		}
		groups = append(groups, group)
	}

	if groups == nil {
		groups = []map[string]interface{}{}
	}

	return groups, total, nil
}

func (r *AdminRepository) DeleteGroup(groupID uuid.UUID) error {
	query := `DELETE FROM conversations WHERE id = $1`
	_, err := r.db.Exec(query, groupID)
	return err
}

// Content Moderation
func (r *AdminRepository) GetAllReports(page, limit int, status string) ([]map[string]interface{}, int, error) {
	offset := (page - 1) * limit

	query := `
		SELECT r.id, r.reporter_id, u1.username as reporter_name,
			   r.reported_user_id, u2.username as reported_user_name,
			   r.reported_message_id, r.reason, r.status, r.created_at
		FROM reports r
		LEFT JOIN users u1 ON r.reporter_id = u1.id
		LEFT JOIN users u2 ON r.reported_user_id = u2.id
		WHERE 1=1
	`
	args := []interface{}{}
	argIndex := 1

	if status != "" && status != "all" {
		query += fmt.Sprintf(" AND r.status = $%d", argIndex)
		args = append(args, status)
		argIndex++
	}

	// Get total count
	countQuery := `SELECT COUNT(*) FROM reports WHERE 1=1`
	countArgs := []interface{}{}
	countArgIndex := 1
	if status != "" && status != "all" {
		countQuery += fmt.Sprintf(" AND status = $%d", countArgIndex)
		countArgs = append(countArgs, status)
		countArgIndex++
	}
	var total int
	var countErr error
	if len(countArgs) > 0 {
		countErr = r.db.Get(&total, countQuery, countArgs...)
	} else {
		countErr = r.db.Get(&total, countQuery)
	}
	if countErr != nil {
		return nil, 0, fmt.Errorf("failed to get reports count: %w", countErr)
	}

	// Get reports with pagination
	query += fmt.Sprintf(" ORDER BY r.created_at DESC LIMIT $%d OFFSET $%d", argIndex, argIndex+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get reports: %w", err)
	}
	defer rows.Close()

	var reports []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var reporterName, reportedUserName, reason, reportStatus string
		var reporterID, reportedUserID, reportedMessageID uuid.UUID
		var createdAt time.Time

		err := rows.Scan(&id, &reporterID, &reporterName, &reportedUserID, &reportedUserName,
			&reportedMessageID, &reason, &reportStatus, &createdAt)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan report: %w", err)
		}

		report := map[string]interface{}{
			"id":                id.String(),
			"reporterId":        reporterID.String(),
			"reporterName":      reporterName,
			"reportedUserId":    reportedUserID.String(),
			"reportedUserName":  reportedUserName,
			"reportedMessageId": reportedMessageID.String(),
			"reason":            reason,
			"status":            reportStatus,
			"createdAt":         createdAt.Format("2006-01-02 15:04"),
		}
		reports = append(reports, report)
	}

	if reports == nil {
		reports = []map[string]interface{}{}
	}

	return reports, total, nil
}

func (r *AdminRepository) ModerateReport(reportID uuid.UUID, action string) error {
	var newStatus string
	switch action {
	case "delete", "block":
		newStatus = "resolved"
	case "dismiss":
		newStatus = "dismissed"
	default:
		return fmt.Errorf("invalid action: %s", action)
	}

	query := `UPDATE reports SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
	_, err := r.db.Exec(query, newStatus, reportID)
	return err
}

// File Management
func (r *AdminRepository) GetAllFiles(page, limit int, search, fileType string) ([]map[string]interface{}, int, error) {
	offset := (page - 1) * limit

	query := `
		SELECT f.id, f.filename, f.mime_type, f.file_size, f.uploader_id, u.username as uploader_name,
			   f.created_at, f.download_count, f.file_path
		FROM files f
		LEFT JOIN users u ON f.uploader_id = u.id
		WHERE 1=1
	`
	args := []interface{}{}
	argIndex := 1

	if search != "" {
		query += fmt.Sprintf(" AND f.filename ILIKE $%d", argIndex)
		args = append(args, "%"+search+"%")
		argIndex++
	}

	if fileType != "" && fileType != "all" {
		query += fmt.Sprintf(" AND f.mime_type LIKE $%d", argIndex)
		args = append(args, fileType+"%")
		argIndex++
	}

	// Get total count
	countQuery := `SELECT COUNT(*) FROM files f WHERE 1=1`
	countArgs := []interface{}{}
	countArgIndex := 1
	if search != "" {
		countQuery += fmt.Sprintf(" AND f.filename ILIKE $%d", countArgIndex)
		countArgs = append(countArgs, "%"+search+"%")
		countArgIndex++
	}
	if fileType != "" && fileType != "all" {
		countQuery += fmt.Sprintf(" AND f.mime_type LIKE $%d", countArgIndex)
		countArgs = append(countArgs, fileType+"%")
		countArgIndex++
	}

	var total int
	var countErr error
	if len(countArgs) > 0 {
		countErr = r.db.Get(&total, countQuery, countArgs...)
	} else {
		countErr = r.db.Get(&total, countQuery)
	}
	if countErr != nil {
		return nil, 0, fmt.Errorf("failed to get files count: %w", countErr)
	}

	// Get files with pagination
	query += fmt.Sprintf(" ORDER BY f.created_at DESC LIMIT $%d OFFSET $%d", argIndex, argIndex+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get files: %w", err)
	}
	defer rows.Close()

	var files []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var fileName, fileTypeName, uploaderName, fileURL string
		var uploaderID uuid.UUID
		var downloadCount int
		var fileSize int64
		var createdAt time.Time

		err := rows.Scan(&id, &fileName, &fileTypeName, &fileSize, &uploaderID, &uploaderName, &createdAt, &downloadCount, &fileURL)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan file: %w", err)
		}

		file := map[string]interface{}{
			"id":            id.String(),
			"fileName":      fileName,
			"fileType":      fileTypeName,
			"fileSize":      formatFileSize(fmt.Sprintf("%d", fileSize)),
			"uploaderId":    uploaderID.String(),
			"uploaderName":  uploaderName,
			"uploadDate":    createdAt.Format("2006-01-02 15:04"),
			"downloadCount": downloadCount,
			"fileUrl":       fileURL,
		}
		files = append(files, file)
	}

	if files == nil {
		files = []map[string]interface{}{}
	}

	return files, total, nil
}

func (r *AdminRepository) DeleteFile(fileID uuid.UUID) error {
	query := `DELETE FROM files WHERE id = $1`
	_, err := r.db.Exec(query, fileID)
	return err
}

// Call Management
func (r *AdminRepository) GetAllCalls(page, limit int, callType, status string) ([]map[string]interface{}, int, error) {
	offset := (page - 1) * limit

	query := `
		SELECT c.id, c.conversation_id, c.initiated_by, u.username as initiator_name,
			   c.call_type, c.status, c.started_at, c.ended_at, c.call_result
		FROM calls c
		LEFT JOIN users u ON c.initiated_by = u.id
		WHERE 1=1
	`
	args := []interface{}{}
	argIndex := 1

	if callType != "" && callType != "all" {
		query += fmt.Sprintf(" AND c.call_type = $%d", argIndex)
		args = append(args, callType)
		argIndex++
	}

	if status != "" && status != "all" {
		query += fmt.Sprintf(" AND c.status = $%d", argIndex)
		args = append(args, status)
		argIndex++
	}

	// Get total count
	countQuery := `SELECT COUNT(*) FROM calls c WHERE 1=1`
	countArgs := []interface{}{}
	countArgIndex := 1
	if callType != "" && callType != "all" {
		countQuery += fmt.Sprintf(" AND c.call_type = $%d", countArgIndex)
		countArgs = append(countArgs, callType)
		countArgIndex++
	}
	if status != "" && status != "all" {
		countQuery += fmt.Sprintf(" AND c.status = $%d", countArgIndex)
		countArgs = append(countArgs, status)
		countArgIndex++
	}
	var total int
	var countErr error
	if len(countArgs) > 0 {
		countErr = r.db.Get(&total, countQuery, countArgs...)
	} else {
		countErr = r.db.Get(&total, countQuery)
	}
	if countErr != nil {
		return nil, 0, fmt.Errorf("failed to get calls count: %w", countErr)
	}

	// Get calls with pagination
	query += fmt.Sprintf(" ORDER BY c.started_at DESC LIMIT $%d OFFSET $%d", argIndex, argIndex+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get calls: %w", err)
	}
	defer rows.Close()

	var calls []map[string]interface{}
	for rows.Next() {
		var id, conversationID, initiatedBy uuid.UUID
		var initiatorName, callType, callStatus, callResult string
		var startedAt, endedAt sql.NullTime

		err := rows.Scan(&id, &conversationID, &initiatedBy, &initiatorName, &callType, &callStatus, &startedAt, &endedAt, &callResult)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan call: %w", err)
		}

		// Calculate duration
		duration := 0
		if startedAt.Valid && endedAt.Valid {
			duration = int(endedAt.Time.Sub(startedAt.Time).Seconds())
		}

		call := map[string]interface{}{
			"id":             id.String(),
			"conversationId": conversationID.String(),
			"initiatorId":    initiatedBy.String(),
			"initiatorName":  initiatorName,
			"callType":       callType,
			"status":         callStatus,
			"duration":       duration,
			"startedAt":      formatTime(startedAt),
			"endedAt":        formatTime(endedAt),
			"callResult":     callResult,
		}
		calls = append(calls, call)
	}

	if calls == nil {
		calls = []map[string]interface{}{}
	}

	return calls, total, nil
}

// System Settings
func (r *AdminRepository) GetSystemSettings() (map[string]interface{}, error) {
	settings := make(map[string]interface{})

	// Get settings from database or use defaults
	var appName, appVersion string
	var maxFileSize, maxGroupMembers, storageLimit, rateLimitPerMinute int
	var enableRegistration, enableFileUpload, enableCalls, maintenanceMode bool

	query := `
		SELECT app_name, app_version, max_file_size, max_group_members, enable_registration,
			   enable_file_upload, enable_calls, maintenance_mode, storage_limit, rate_limit_per_minute
		FROM system_settings
		LIMIT 1
	`

	err := r.db.QueryRow(query).Scan(&appName, &appVersion, &maxFileSize, &maxGroupMembers, &enableRegistration,
		&enableFileUpload, &enableCalls, &maintenanceMode, &storageLimit, &rateLimitPerMinute)
	if err != nil {
		// Return default values if no settings found
		return map[string]interface{}{
			"appName":            "29 Jewellery Teamwork",
			"appVersion":         "1.0.0",
			"maxFileSize":        100,
			"allowedFileTypes":   []string{"image", "video", "audio", "document"},
			"maxGroupMembers":    200,
			"enableRegistration": true,
			"enableFileUpload":   true,
			"enableCalls":        true,
			"maintenanceMode":    false,
			"storageLimit":       10,
			"rateLimitPerMinute": 60,
		}, nil
	}

	// Get allowed file types
	var allowedFileTypes []string
	r.db.Select(&allowedFileTypes, "SELECT file_type FROM allowed_file_types")

	settings["appName"] = appName
	settings["appVersion"] = appVersion
	settings["maxFileSize"] = maxFileSize
	settings["allowedFileTypes"] = allowedFileTypes
	settings["maxGroupMembers"] = maxGroupMembers
	settings["enableRegistration"] = enableRegistration
	settings["enableFileUpload"] = enableFileUpload
	settings["enableCalls"] = enableCalls
	settings["maintenanceMode"] = maintenanceMode
	settings["storageLimit"] = storageLimit
	settings["rateLimitPerMinute"] = rateLimitPerMinute

	return settings, nil
}

func (r *AdminRepository) UpdateSystemSettings(settings map[string]interface{}) error {
	query := `
		INSERT INTO system_settings (app_name, app_version, max_file_size, max_group_members, enable_registration,
			enable_file_upload, enable_calls, maintenance_mode, storage_limit, rate_limit_per_minute)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (id) DO UPDATE SET
			app_name = EXCLUDED.app_name,
			app_version = EXCLUDED.app_version,
			max_file_size = EXCLUDED.max_file_size,
			max_group_members = EXCLUDED.max_group_members,
			enable_registration = EXCLUDED.enable_registration,
			enable_file_upload = EXCLUDED.enable_file_upload,
			enable_calls = EXCLUDED.enable_calls,
			maintenance_mode = EXCLUDED.maintenance_mode,
			storage_limit = EXCLUDED.storage_limit,
			rate_limit_per_minute = EXCLUDED.rate_limit_per_minute
	`

	_, err := r.db.Exec(query,
		settings["appName"],
		settings["appVersion"],
		settings["maxFileSize"],
		settings["maxGroupMembers"],
		settings["enableRegistration"],
		settings["enableFileUpload"],
		settings["enableCalls"],
		settings["maintenanceMode"],
		settings["storageLimit"],
		settings["rateLimitPerMinute"],
	)
	return err
}

// Helper functions
func formatLastSeen(lastSeen time.Time, isOnline bool) string {
	if isOnline {
		return "Online"
	}
	return formatTimeAgo(lastSeen)
}

func formatTimeAgo(t time.Time) string {
	if t.IsZero() {
		return "Never"
	}
	duration := time.Since(t)
	if duration < time.Minute {
		return "Just now"
	}
	if duration < time.Hour {
		return fmt.Sprintf("%d minutes ago", int(duration.Minutes()))
	}
	if duration < 24*time.Hour {
		return fmt.Sprintf("%d hours ago", int(duration.Hours()))
	}
	return fmt.Sprintf("%d days ago", int(duration.Hours()/24))
}

func formatTime(t sql.NullTime) string {
	if !t.Valid || t.Time.IsZero() {
		return ""
	}
	return t.Time.Format("2006-01-02 15:04")
}

func formatFileSize(size string) string {
	// Assuming size is stored in bytes, convert to appropriate unit
	// This is a simplified version
	return size
}
