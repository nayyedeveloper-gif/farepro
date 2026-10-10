package handlers

import (
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"telegram-clone/internal/auth"
	"telegram-clone/internal/models"
	"telegram-clone/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	demoSubdomain      = "demo"
	demoUsernamePrefix = "farepro-demo-"
	defaultDemoPass    = "Demo@2026"
)

// DemoAccount is a public, sandboxed login shown on the sign-in pages.
type DemoAccount struct {
	Key         string `json:"key"`
	Label       string `json:"label"`
	Description string `json:"description"`
	Kind        string `json:"kind"` // personal | stand
	Role        string `json:"role,omitempty"`
	Phone       string `json:"phone"`
	Password    string `json:"password"`
	Subdomain   string `json:"subdomain,omitempty"`

	firstName string
	lastName  string
}

type DemoHandler struct {
	enabled    bool
	password   string
	accounts   []DemoAccount
	userRepo   *repository.UserRepository
	orgRepo    *repository.OrganizationRepository
	driverRepo *repository.DriverRepository
	orgHandler *OrganizationHandler

	mu      sync.RWMutex
	userIDs map[uuid.UUID]bool
}

func NewDemoHandler(
	userRepo *repository.UserRepository,
	orgRepo *repository.OrganizationRepository,
	driverRepo *repository.DriverRepository,
	orgHandler *OrganizationHandler,
) *DemoHandler {
	pass := strings.TrimSpace(os.Getenv("DEMO_PASSWORD"))
	if len(pass) < 6 {
		pass = defaultDemoPass
	}
	h := &DemoHandler{
		enabled:    strings.EqualFold(strings.TrimSpace(os.Getenv("DEMO_MODE")), "true"),
		password:   pass,
		userRepo:   userRepo,
		orgRepo:    orgRepo,
		driverRepo: driverRepo,
		orgHandler: orgHandler,
		userIDs:    map[uuid.UUID]bool{},
	}
	h.accounts = []DemoAccount{
		{Key: "owner", Label: "Stand owner (admin)", Description: "Owner portal, dispatch, wallets, zones",
			Kind: "stand", Role: "owner", Phone: "09000000101", Subdomain: demoSubdomain, firstName: "Demo", lastName: "Owner"},
		{Key: "driver", Label: "Driver", Description: "Jobs, offers, wallet top-up",
			Kind: "stand", Role: "driver", Phone: "09000000201", Subdomain: demoSubdomain, firstName: "Demo", lastName: "Driver"},
		{Key: "personal1", Label: "Personal account 1", Description: "Chat, calls, PTT",
			Kind: "personal", Phone: "09000000301", firstName: "Demo", lastName: "Aung"},
		{Key: "personal2", Label: "Personal account 2", Description: "Chat with account 1",
			Kind: "personal", Phone: "09000000302", firstName: "Demo", lastName: "Hla"},
	}
	for i := range h.accounts {
		h.accounts[i].Password = pass
	}
	return h
}

func (h *DemoHandler) Enabled() bool { return h.enabled }

// Seed creates the demo stand and accounts and resets their passwords. It only
// manages users it created itself (username prefix), never real accounts that
// happen to share a demo phone number.
func (h *DemoHandler) Seed() {
	if !h.enabled {
		return
	}
	hash, err := auth.HashPassword(h.password)
	if err != nil {
		log.Printf("demo: hash password: %v", err)
		return
	}

	org, _ := h.orgRepo.GetBySubdomain(demoSubdomain)
	if org == nil {
		owner := h.accounts[0]
		created, ownerUser, _, err := h.orgHandler.CreateStand(models.CreateOrganizationRequest{
			Name:       "FarePro Demo Stand",
			Subdomain:  demoSubdomain,
			OwnerName:  demoUsernamePrefix + owner.Key,
			OwnerPhone: owner.Phone,
			Password:   h.password,
			Industry:   "transportation",
		}, "pro", 20)
		if err != nil {
			log.Printf("demo: create stand: %v", err)
			return
		}
		org = created
		ownerUser.FirstName, ownerUser.LastName = owner.firstName, owner.lastName
		_ = h.userRepo.Update(ownerUser)

		info := "KBZPay: 09000000101 (FarePro Demo)\nWavePay: 09000000101"
		enabled := true
		_, _ = h.orgRepo.UpdateFareSettings(org.ID, models.UpdateFareSettingsRequest{
			WalletPaymentInfo: &info,
			BookingEnabled:    &enabled,
		})
	}

	ids := map[uuid.UUID]bool{}
	personalIDs := []uuid.UUID{}
	for _, acc := range h.accounts {
		user := h.ensureUser(acc, hash)
		if user == nil {
			continue
		}
		ids[user.ID] = true
		switch acc.Kind {
		case "personal":
			personalIDs = append(personalIDs, user.ID)
		case "stand":
			role, _ := h.orgRepo.GetUserOrgRole(user.ID, org.ID)
			if role == "" {
				if err := h.orgRepo.AddUserToOrg(user.ID, org.ID, acc.Role); err != nil {
					log.Printf("demo: add %s to stand: %v", acc.Key, err)
					continue
				}
				if acc.Role == "driver" && h.driverRepo != nil {
					_ = h.driverRepo.EnsureProfileAndWallet(org.ID, user.ID)
					_, _ = h.driverRepo.AdjustWallet(org.ID, user.ID, user.ID, 10000, "credit", "Demo starting balance")
				}
			}
		}
	}
	if len(personalIDs) == 2 {
		_ = h.userRepo.AddContact(personalIDs[0], personalIDs[1])
		_ = h.userRepo.AddContact(personalIDs[1], personalIDs[0])
	}

	h.mu.Lock()
	h.userIDs = ids
	h.mu.Unlock()
	log.Printf("demo: %d demo accounts ready on stand %q", len(ids), demoSubdomain)
}

func (h *DemoHandler) ensureUser(acc DemoAccount, hash string) *models.User {
	username := demoUsernamePrefix + acc.Key
	user, _ := h.userRepo.GetByPhone(acc.Phone)
	if user == nil {
		user = &models.User{
			ID:           uuid.New(),
			Username:     username,
			Phone:        acc.Phone,
			PasswordHash: hash,
			FirstName:    acc.firstName,
			LastName:     acc.lastName,
		}
		if err := h.userRepo.Create(user); err != nil {
			log.Printf("demo: create %s: %v", acc.Key, err)
			return nil
		}
		return user
	}
	if !strings.HasPrefix(user.Username, demoUsernamePrefix) {
		log.Printf("demo: phone %s belongs to a real account, skipping %s", acc.Phone, acc.Key)
		return nil
	}
	if err := h.userRepo.SetPasswordHash(user.ID, hash); err != nil {
		log.Printf("demo: reset password for %s: %v", acc.Key, err)
	}
	return user
}

func (h *DemoHandler) IsDemoUser(id uuid.UUID) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.userIDs[id]
}

// Accounts lists demo logins for the sign-in pages.
func (h *DemoHandler) Accounts(c *gin.Context) {
	if !h.enabled {
		c.JSON(http.StatusNotFound, gin.H{"error": "Demo mode is off"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"accounts": h.accounts})
}

// Guard blocks account and membership changes for shared demo users so one
// visitor cannot lock others out or pull real users into the demo stand.
func (h *DemoHandler) Guard(c *gin.Context) {
	if v, ok := c.Get("userID"); ok {
		if id, ok := v.(uuid.UUID); ok && h.IsDemoUser(id) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "This action is disabled for demo accounts"})
			return
		}
	}
	c.Next()
}
