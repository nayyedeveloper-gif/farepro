package main

import (
	"log"
	"os"
	"telegram-clone/internal/auth"
	"telegram-clone/internal/config"
	"telegram-clone/internal/handlers"
	"telegram-clone/internal/middleware"
	"telegram-clone/internal/push"
	"telegram-clone/internal/repository"
	"telegram-clone/internal/socket"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func main() {
	// Set timezone to UTC for consistent time handling
	time.Local = time.UTC

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Set Gin mode
	gin.SetMode(cfg.Server.GinMode)

	// Initialize database
	db, err := repository.NewDatabase(&cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize repositories
	userRepo := repository.NewUserRepository(db)
	messageRepo := repository.NewMessageRepository(db)
	callRepo := repository.NewCallRepository(db)
	storyRepo := repository.NewStoryRepository(db)
	if err := storyRepo.Migrate(); err != nil {
		log.Fatalf("Failed to migrate stories table: %v", err)
	}
	// Organizations must exist before PTT channels (organization_id FK).
	orgRepo := repository.NewOrganizationRepository(db.DB)
	if err := orgRepo.Migrate(); err != nil {
		log.Fatalf("Failed to migrate organizations table: %v", err)
	}
	channelRepo := repository.NewChannelRepository(db.DB)
	if err := channelRepo.Migrate(); err != nil {
		log.Fatalf("Failed to migrate PTT channels table: %v", err)
	}
	channelMsgRepo := repository.NewChannelMessageRepository(db.DB)
	if err := channelMsgRepo.Migrate(); err != nil {
		log.Fatalf("Failed to migrate PTT channel messages table: %v", err)
	}
	channelLocRepo := repository.NewChannelLocationRepository(db.DB)
	if err := channelLocRepo.Migrate(); err != nil {
		log.Fatalf("Failed to migrate PTT channel locations table: %v", err)
	}
	pttRecordingRepo := repository.NewPTTRecordingRepository(db.DB)
	if err := pttRecordingRepo.Migrate(); err != nil {
		log.Fatalf("Failed to migrate PTT recordings table: %v", err)
	}
	geofenceRepo := repository.NewGeofenceRepository(db.DB)
	if err := geofenceRepo.Migrate(); err != nil {
		log.Fatalf("Failed to migrate geofence tables: %v", err)
	}
	tripRepo := repository.NewTripRepository(db.DB)
	if err := tripRepo.Migrate(); err != nil {
		log.Fatalf("Failed to migrate trips table: %v", err)
	}
	tripMsgRepo := repository.NewTripMessageRepository(db.DB)
	if err := tripMsgRepo.Migrate(); err != nil {
		log.Fatalf("Failed to migrate trip messages table: %v", err)
	}
	shiftRepo := repository.NewShiftRepository(db.DB)
	if err := shiftRepo.Migrate(); err != nil {
		log.Fatalf("Failed to migrate retail shifts table: %v", err)
	}
	driverRepo := repository.NewDriverRepository(db.DB)
	if err := driverRepo.Migrate(); err != nil {
		log.Fatalf("Failed to migrate driver profile/wallet tables: %v", err)
	}
	customerRepo := repository.NewCustomerRepository(db.DB)
	if err := customerRepo.Migrate(); err != nil {
		log.Fatalf("Failed to migrate customers table: %v", err)
	}

	// Initialize JWT service
	jwtService, err := auth.NewJWTService(cfg.JWT.Secret, cfg.JWT.Expiration)
	if err != nil {
		log.Fatalf("Failed to initialize JWT service: %v", err)
	}

	qrStore := auth.NewQRStore()

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(userRepo, orgRepo, jwtService, qrStore)
	userHandler := handlers.NewUserHandler(userRepo)
	messageHandler := handlers.NewMessageHandler(messageRepo, userRepo)
	callHandler := handlers.NewCallHandler(messageRepo, userRepo, callRepo, cfg.LiveKit)
	adminHandler := handlers.NewAdminHandler(repository.NewAdminRepository(db))
	adHandler := handlers.NewAdHandler(repository.NewAdRepository(db))
	// Initialize push service (VAPID keys auto-generated if not set in env)
	vapidPublic := cfg.VAPID.PublicKey
	vapidPrivate := cfg.VAPID.PrivateKey
	if vapidPublic == "" || vapidPrivate == "" {
		var err2 error
		vapidPrivate, vapidPublic, err2 = webpush.GenerateVAPIDKeys()
		if err2 != nil {
			log.Printf("Warning: VAPID key generation failed: %v - push notifications disabled", err2)
		} else {
			log.Printf("Generated VAPID keys. Set in .env to persist:\nVAPID_PUBLIC_KEY=%s\nVAPID_PRIVATE_KEY=%s", vapidPublic, vapidPrivate)
		}
	}
	pushSvc := push.NewService(vapidPublic, vapidPrivate, cfg.VAPID.Subject)
	notificationHandler := handlers.NewNotificationHandler(callRepo, pushSvc)
	fileHandler := handlers.NewFileHandler("./uploads", cfg.Server.BaseURL)
	storyHandler := handlers.NewStoryHandler(storyRepo)
	channelHandler := handlers.NewChannelHandler(channelRepo)
	channelMsgHandler := handlers.NewChannelMessageHandler(channelMsgRepo, channelRepo, userRepo)
	geofenceHandler := handlers.NewGeofenceHandler(geofenceRepo, orgRepo, userRepo, notificationHandler)
	tripHandler := handlers.NewTripHandler(tripRepo, orgRepo, userRepo, customerRepo, notificationHandler).
		WithDriverRepos(driverRepo, channelLocRepo)
	tripCommsHandler := handlers.NewTripCommsHandler(tripRepo, tripMsgRepo, orgRepo, cfg.LiveKit)
	bookingHandler := handlers.NewBookingHandler(tripRepo, orgRepo, customerRepo, notificationHandler).
		WithAutoDispatch(tripHandler.MaybeAutoDispatch)
	geocodeHandler := handlers.NewGeocodeHandler()
	shiftHandler := handlers.NewShiftHandler(shiftRepo, orgRepo)
	channelLocHandler := handlers.NewChannelLocationHandler(channelLocRepo, channelRepo, geofenceRepo, orgRepo, geofenceHandler)
	pttRecordingHandler := handlers.NewPTTRecordingHandler(pttRecordingRepo, channelRepo, userRepo, "./uploads")
	orgHandler := handlers.NewOrganizationHandler(orgRepo, userRepo, channelLocRepo, channelRepo, jwtService)
	driverHandler := handlers.NewDriverHandler(driverRepo, orgRepo, tripRepo)
	demoHandler := handlers.NewDemoHandler(userRepo, orgRepo, driverRepo, orgHandler)
	demoHandler.Seed()
	customerHandler := handlers.NewCustomerHandler(customerRepo, orgRepo)
	platformRepo := repository.NewPlatformRepository(db.DB)
	if err := platformRepo.Migrate(); err != nil {
		log.Fatal("Failed to migrate platform admin tables:", err)
	}
	middleware.SetBanLookup(userRepo.IsBanned)
	platformHandler := handlers.NewPlatformHandler(orgRepo, userRepo).
		WithConsole(platformRepo, driverRepo, orgHandler).
		WithSystem(handlers.SystemInfo{
			LiveKitURL:  cfg.LiveKit.URL,
			DemoEnabled: os.Getenv("DEMO_MODE") == "true",
			StartedAt:   time.Now(),
		})

	// Start WebSocket hub
	socket.SetParticipantLookup(func(conversationID uuid.UUID) ([]uuid.UUID, error) {
		users, err := messageRepo.GetConversationParticipants(conversationID)
		if err != nil {
			return nil, err
		}
		ids := make([]uuid.UUID, len(users))
		for i, u := range users {
			ids[i] = u.ID
		}
		return ids, nil
	})
	socket.SetChannelMemberLookup(func(channelID uuid.UUID) ([]uuid.UUID, error) {
		members, err := channelRepo.GetChannelMembers(channelID)
		if err != nil {
			return nil, err
		}
		ids := make([]uuid.UUID, len(members))
		for i, m := range members {
			ids[i] = m.ID
		}
		return ids, nil
	})
	socket.SetUserChannelsLookup(func(userID uuid.UUID) ([]uuid.UUID, error) {
		channels, err := channelRepo.GetUserChannels(userID)
		if err != nil {
			return nil, err
		}
		ids := make([]uuid.UUID, len(channels))
		for i, ch := range channels {
			ids[i] = ch.ID
		}
		return ids, nil
	})
	socket.SetPresenceHandlers(
		func(userID uuid.UUID, sessionCount int) {
			if sessionCount > 0 {
				_ = userRepo.SetOnlineStatus(userID, true)
			}
		},
		func(userID uuid.UUID, sessionCount int) {
			if sessionCount == 0 {
				_ = userRepo.SetOnlineStatus(userID, false)
			}
		},
	)
	socket.StartHub()

	// Create router
	router := gin.Default()
	if err := router.SetTrustedProxies([]string{"127.0.0.1", "::1"}); err != nil {
		log.Printf("trusted proxies: %v", err)
	}

	// CORS middleware
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// WebSocket endpoint
	router.GET("/ws", middleware.AuthMiddleware(jwtService), socket.HandleWebSocket)

	// API routes
	api := router.Group("/api")
	{
		// Auth routes
		auth := api.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/qr/create", authHandler.CreateQRSession)
			auth.GET("/qr/status/:sessionId", authHandler.GetQRSessionStatus)
			auth.POST("/qr/approve", middleware.AuthMiddleware(jwtService), authHandler.ApproveQRSession)
			auth.POST("/logout", middleware.AuthMiddleware(jwtService), authHandler.Logout)
			auth.GET("/me", middleware.AuthMiddleware(jwtService), authHandler.GetMe)
			auth.GET("/devices", middleware.AuthMiddleware(jwtService), authHandler.GetDevices)
			auth.DELETE("/devices/others", middleware.AuthMiddleware(jwtService), authHandler.TerminateOtherDevices)
			auth.DELETE("/devices/:clientId", middleware.AuthMiddleware(jwtService), authHandler.TerminateDevice)
		}

		// User routes
		users := api.Group("/users")
		users.Use(middleware.AuthMiddleware(jwtService))
		{
			users.GET("/search", userHandler.SearchUsers)
			users.GET("/:id", userHandler.GetUser)
			users.PUT("/profile", demoHandler.Guard, userHandler.UpdateProfile)
			users.POST("/avatar", userHandler.UpdateAvatar)
			users.POST("/contacts", userHandler.AddContact)
			users.GET("/contacts", userHandler.GetContacts)
			users.DELETE("/contacts/:id", userHandler.RemoveContact)
		}

		// Message routes
		messages := api.Group("/messages")
		messages.Use(middleware.AuthMiddleware(jwtService))
		{
			messages.POST("/conversations", messageHandler.CreateConversation)
			messages.POST("/conversations/join", messageHandler.JoinChannel)
			messages.POST("/conversations/add-members", messageHandler.AddMembers)
			messages.PUT("/conversations/:id", messageHandler.UpdateConversation)
			messages.DELETE("/conversations/:id", messageHandler.DeleteConversation)
			messages.GET("/conversations", messageHandler.GetConversations)
			messages.GET("/conversations/:id/messages", messageHandler.GetMessages)
			messages.POST("/conversations/:id/messages", messageHandler.SendMessage)
			messages.PUT("/messages/:id", messageHandler.UpdateMessage)
			messages.DELETE("/messages/:id", messageHandler.DeleteMessage)
			messages.POST("/messages/:id/pin", messageHandler.PinMessage)
			messages.POST("/messages/:id/unpin", messageHandler.UnpinMessage)
			messages.POST("/conversations/:id/read", messageHandler.MarkAsRead)
			messages.GET("/conversations/:id/calls", callHandler.GetConversationCalls)
		}

		// Call routes
		calls := api.Group("/calls")
		calls.Use(middleware.AuthMiddleware(jwtService))
		{
			calls.GET("/history", callHandler.GetHistory)
			calls.GET("/sessions", callHandler.GetSessions)
			calls.POST("/dial", callHandler.Dial)
			calls.POST("/token", callHandler.GetToken)
			calls.POST("/initiate", callHandler.InitiateCall)
			calls.POST("/:callId/join", callHandler.JoinCall)
			calls.POST("/:callId/leave", callHandler.LeaveCall)
			calls.POST("/:callId/end", callHandler.EndCall)
		}

		notifications := api.Group("/notifications")
		notifications.Use(middleware.AuthMiddleware(jwtService))
		{
			notifications.GET("", notificationHandler.GetNotifications)
			notifications.POST("/read", notificationHandler.MarkAllRead)
			notifications.POST("/push/subscribe", notificationHandler.SavePushSubscription)
			notifications.POST("/push/unsubscribe", notificationHandler.DeletePushSubscription)
		}
		// Public VAPID key (needed by frontend before auth)
		api.GET("/vapid-public-key", func(c *gin.Context) {
			c.JSON(200, gin.H{"publicKey": vapidPublic})
		})

		// Story routes
		stories := api.Group("/stories")
		stories.Use(middleware.AuthMiddleware(jwtService))
		{
			stories.POST("", storyHandler.CreateStory)
			stories.GET("", storyHandler.GetAllStories)
			stories.GET("/user/:userId", storyHandler.GetUserStories)
			stories.POST("/:id/view", storyHandler.ViewStory)
			stories.DELETE("/:id", storyHandler.DeleteStory)
		}

		// File routes
		files := api.Group("/files")
		files.Use(middleware.AuthMiddleware(jwtService))
		{
			files.POST("/upload", fileHandler.UploadFile)
		}

		// FarePro platform super-admin (multi-tenant)
		platform := api.Group("/platform")
		platform.Use(middleware.AuthMiddleware(jwtService))
		platform.Use(middleware.PlatformAdminMiddleware(userRepo))
		{
			platform.GET("/stats", platformHandler.Stats)
			platform.GET("/overview", platformHandler.Overview)
			platform.GET("/orgs", platformHandler.ListOrgs)
			platform.POST("/orgs", platformHandler.CreateOrg)
			platform.GET("/orgs/:id", platformHandler.GetOrg)
			platform.PATCH("/orgs/:id", platformHandler.UpdateOrg)
			platform.POST("/orgs/:id/topup", platformHandler.TopupOrg)
			platform.GET("/orgs/:id/billing", platformHandler.OrgBillingLedger)
			platform.POST("/orgs/:id/drivers/:userId/wallet", platformHandler.AdjustDriverWallet)
			platform.GET("/drivers", platformHandler.ListDrivers)
			platform.GET("/trips", platformHandler.ListTrips)
			platform.GET("/map", platformHandler.LiveMap)
			platform.GET("/billing", platformHandler.ListBilling)
			platform.GET("/admins", platformHandler.ListAdmins)
			platform.POST("/admins", platformHandler.GrantAdmin)
			platform.DELETE("/admins/:userId", platformHandler.RevokeAdmin)
			platform.GET("/users", platformHandler.ListUsers)
			platform.POST("/users/:id/suspend", platformHandler.SuspendUser)
			platform.POST("/users/:id/restore", platformHandler.RestoreUser)
			platform.POST("/users/:id/reset-password", middleware.RateLimit(20, 5), platformHandler.ResetUserPassword)
			platform.GET("/audit", platformHandler.ListAudit)
			platform.GET("/system", platformHandler.SystemHealth)
		}

		// Legacy messenger admin routes
		admin := api.Group("/admin")
		admin.Use(middleware.AuthMiddleware(jwtService))
		admin.Use(middleware.PlatformAdminMiddleware(userRepo))
		{
			admin.GET("/dashboard/stats", adminHandler.GetDashboardStats)
			admin.GET("/users", adminHandler.GetUsers)
			admin.POST("/users/:id/ban", adminHandler.BanUser)
			admin.GET("/users/:id/conversations", adminHandler.GetUserConversations)
			admin.GET("/groups", adminHandler.GetGroups)
			admin.DELETE("/groups/:id", adminHandler.DeleteGroup)
			admin.GET("/reports", adminHandler.GetReports)
			admin.POST("/reports/:id/moderate", adminHandler.ModerateReport)
			admin.GET("/files", adminHandler.GetFiles)
			admin.DELETE("/files/:id", adminHandler.DeleteFile)
			admin.GET("/calls", adminHandler.GetCalls)
			admin.GET("/settings", adminHandler.GetSystemSettings)
			admin.PUT("/settings", adminHandler.UpdateSystemSettings)
			admin.GET("/ads", adHandler.GetAllAds)
			admin.POST("/ads", adHandler.CreateAd)
			admin.PUT("/ads/:id", adHandler.UpdateAd)
			admin.DELETE("/ads/:id", adHandler.DeleteAd)
			admin.GET("/ads/analytics", adHandler.GetAdAnalytics)
		}

		// Public ad routes
		api.GET("/ads/active", adHandler.GetActiveAds)
		api.POST("/ads/:id/impression", adHandler.TrackImpression)
		api.POST("/ads/:id/click", adHandler.TrackClick)

		// Public geocode (Yangon place search for customer booking)
		api.GET("/geocode/search", geocodeHandler.SearchPlaces)
		api.GET("/geocode/reverse", geocodeHandler.ReverseGeocode)

		api.GET("/demo/accounts", middleware.RateLimit(30, 10), demoHandler.Accounts)

		// Public customer booking (kilo taxi SaaS)
		book := api.Group("/book/:subdomain")
		book.Use(middleware.RateLimit(90, 30))
		{
			book.GET("", bookingHandler.GetPublicOrg)
			book.POST("/estimate", bookingHandler.EstimateFare)
			book.GET("/route", bookingHandler.RoutePreview)
			book.POST("/rides", bookingHandler.CreateBooking)
			book.GET("/rides/:id", bookingHandler.GetBookingStatus)
			book.GET("/rides/:id/messages", tripCommsHandler.CustomerListMessages)
			book.POST("/rides/:id/messages", tripCommsHandler.CustomerSendMessage)
			book.POST("/rides/:id/call/token", tripCommsHandler.CustomerCallToken)
		}

		// Organization / SaaS routes
		org := api.Group("/org")
		{
			org.POST("/signup", orgHandler.Signup)
			org.POST("/login", orgHandler.Login)
			org.GET("/check-subdomain", orgHandler.CheckSubdomain)
			org.GET("/industry-templates", orgHandler.ListIndustryTemplates)
			org.GET("/enterprise-features", orgHandler.GetEnterpriseFeatures)
		}

		orgProtected := api.Group("/org")
		orgProtected.Use(middleware.AuthMiddleware(jwtService))
		{
			orgProtected.GET("", orgHandler.GetOrg)
			orgProtected.GET("/context", orgHandler.GetContext)
			orgProtected.PUT("", demoHandler.Guard, orgHandler.UpdateOrg)
			orgProtected.GET("/fare-settings", orgHandler.GetFareSettings)
			orgProtected.PUT("/fare-settings", orgHandler.UpdateFareSettings)
			orgProtected.GET("/members", orgHandler.GetMembers)
			orgProtected.POST("/members/invite", demoHandler.Guard, orgHandler.InviteDriver)
			orgProtected.PATCH("/members/:userId/role", demoHandler.Guard, orgHandler.UpdateMemberRole)
			orgProtected.DELETE("/members/:userId", demoHandler.Guard, orgHandler.RemoveMember)
			orgProtected.GET("/drivers", driverHandler.ListDrivers)
			orgProtected.GET("/drivers/:userId", driverHandler.GetDriver)
			orgProtected.PUT("/drivers/:userId/profile", driverHandler.UpdateProfile)
			orgProtected.POST("/drivers/:userId/wallet/adjust", driverHandler.AdjustWallet)
			orgProtected.GET("/me/wallet", driverHandler.MyWallet)
			orgProtected.POST("/me/wallet/topups", driverHandler.CreateTopupRequest)
			orgProtected.GET("/wallet/topups", driverHandler.ListTopupRequests)
			orgProtected.POST("/wallet/topups/:id/approve", driverHandler.ApproveTopupRequest)
			orgProtected.POST("/wallet/topups/:id/reject", driverHandler.RejectTopupRequest)
			orgProtected.GET("/route", handlers.OrgRoutePreview)
			orgProtected.POST("/drivers/:userId/ptt-channel", orgHandler.EnsureDriverPTTChannel)
			orgProtected.GET("/customers", customerHandler.List)
			orgProtected.POST("/customers", customerHandler.Create)
			orgProtected.GET("/customers/:id", customerHandler.Get)
			orgProtected.PATCH("/customers/:id", customerHandler.Update)
			orgProtected.DELETE("/customers/:id", customerHandler.Delete)
			orgProtected.GET("/customers/:id/trips", customerHandler.ListTrips)
			orgProtected.GET("/channels", orgHandler.ListOrgChannels)
			orgProtected.POST("/channels", orgHandler.CreateOrgChannel)
			orgProtected.PATCH("/channels/:id", orgHandler.UpdateOrgChannel)
			orgProtected.DELETE("/channels/:id", orgHandler.DeleteOrgChannel)
			orgProtected.GET("/channels/:id/members", orgHandler.GetOrgChannelMembers)
			orgProtected.POST("/channels/:id/members", orgHandler.AddOrgChannelMember)
			orgProtected.DELETE("/channels/:id/members/:userId", orgHandler.RemoveOrgChannelMember)
			orgProtected.GET("/fleet", orgHandler.GetFleet)
			orgProtected.POST("/broadcast", orgHandler.Broadcast)
			orgProtected.GET("/geofence/zones", geofenceHandler.ListZones)
			orgProtected.POST("/geofence/zones", geofenceHandler.CreateZone)
			orgProtected.PUT("/geofence/zones/:id", geofenceHandler.UpdateZone)
			orgProtected.DELETE("/geofence/zones/:id", geofenceHandler.DeleteZone)
			orgProtected.GET("/geofence/alerts", geofenceHandler.ListAlerts)
			orgProtected.GET("/trips", tripHandler.ListTrips)
			orgProtected.POST("/trips", tripHandler.CreateTrip)
			orgProtected.GET("/reports/daily", tripHandler.DailyReport)
			orgProtected.PATCH("/trips/:id", tripHandler.UpdateTrip)
			orgProtected.POST("/trips/:id/assign", tripHandler.AssignTrip)
			orgProtected.POST("/trips/:id/auto-assign", tripHandler.AutoAssignTrip)
			orgProtected.POST("/trips/:id/accept", tripHandler.AcceptTrip)
			orgProtected.POST("/trips/:id/reject", tripHandler.RejectTrip)
			orgProtected.POST("/trips/:id/location", tripHandler.UpdateTripLocation)
			orgProtected.GET("/trips/history", tripCommsHandler.TripHistory)
			orgProtected.POST("/trips/:id/cancel", tripCommsHandler.CancelTrip)
			orgProtected.GET("/trips/:id/messages", tripCommsHandler.ListMessages)
			orgProtected.POST("/trips/:id/messages", tripCommsHandler.SendMessage)
			orgProtected.POST("/trips/:id/call/token", tripCommsHandler.DriverCallToken)
			orgProtected.GET("/fleet/map", tripCommsHandler.FleetMap)
			orgProtected.GET("/shifts", shiftHandler.ListShifts)
			orgProtected.GET("/shifts/mine", shiftHandler.GetMyShift)
			orgProtected.POST("/shifts/clock-in", shiftHandler.ClockIn)
			orgProtected.POST("/shifts/clock-out", shiftHandler.ClockOut)
		}

		// PTT Channel routes
		channels := api.Group("/channels")
		channels.Use(middleware.AuthMiddleware(jwtService))
		{
			channels.POST("", channelHandler.CreateChannel)
			channels.GET("", channelHandler.ListChannels)
			channels.GET("/mine", channelHandler.GetUserChannels)
			channels.GET("/:id", channelHandler.GetChannel)
			channels.POST("/:id/join", channelHandler.JoinChannel)
			channels.POST("/:id/leave", channelHandler.LeaveChannel)
			channels.GET("/:id/members", channelHandler.GetChannelMembers)
			channels.PATCH("/:id", channelHandler.UpdateChannel)
			channels.DELETE("/:id", channelHandler.DeleteChannelByAdmin)
			channels.GET("/:id/members/roles", channelHandler.GetMembersWithRole)
			channels.PUT("/:id/members/:userId/role", channelHandler.UpdateMemberRole)
			channels.DELETE("/:id/members/:userId", channelHandler.KickMember)
			channels.GET("/:id/invite", channelHandler.GetInviteToken)
			channels.POST("/:id/emergency", channelHandler.SendEmergencyAlert)
			channels.GET("/:id/emergency", channelHandler.GetEmergencyAlerts)
			channels.POST("/:id/messages", channelMsgHandler.SendMessage)
			channels.GET("/:id/messages", channelMsgHandler.GetMessages)
			channels.POST("/:id/messages/:msgId/reactions", channelMsgHandler.ToggleReaction)
			channels.DELETE("/:id/messages/:msgId", channelMsgHandler.DeleteMessage)
			channels.PUT("/:id/locations", channelLocHandler.UpdateLocation)
			channels.GET("/:id/locations", channelLocHandler.GetLocations)
			channels.DELETE("/:id/locations", channelLocHandler.ClearLocation)
			channels.GET("/:id/locations/trail", channelLocHandler.GetTrail)
			channels.DELETE("/:id/locations/trail", channelLocHandler.ClearTrail)
			channels.GET("/:id/ptt-history", pttRecordingHandler.GetHistory)
			channels.POST("/:id/ptt-history", pttRecordingHandler.SaveRecording)
			channels.POST("/:id/ptt-history/:recordingId/transcribe", pttRecordingHandler.RequestTranscription)
		}

		// PTT user status + invite join
		pttRoutes := api.Group("/ptt")
		pttRoutes.Use(middleware.AuthMiddleware(jwtService))
		pttRoutes.POST("/status", channelHandler.UpdateStatus)
		pttRoutes.POST("/join/:token", channelHandler.JoinByInvite)
	}

	// Static file serving (upload route is inside /api/files group above)
	router.GET("/files/:filename", fileHandler.ServeFile)

	// Start server - bind to 0.0.0.0 to allow external connections (phones on same WiFi)
	bindAddr := "0.0.0.0:" + cfg.Server.Port
	log.Printf("Server starting on %s", bindAddr)
	if err := router.Run(bindAddr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
