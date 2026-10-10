package middleware

import (
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
)

const banCacheTTL = 30 * time.Second

type banEntry struct {
	banned bool
	at     time.Time
}

var (
	banLookupMu sync.RWMutex
	banLookup   func(uuid.UUID) (bool, error)
	banCache    sync.Map
)

// SetBanLookup installs the function AuthMiddleware uses to reject suspended accounts.
func SetBanLookup(fn func(uuid.UUID) (bool, error)) {
	banLookupMu.Lock()
	banLookup = fn
	banLookupMu.Unlock()
}

// InvalidateBan makes the next request for this user re-read the suspension flag.
func InvalidateBan(userID uuid.UUID) {
	banCache.Delete(userID)
}

func isBanned(userID uuid.UUID) bool {
	banLookupMu.RLock()
	fn := banLookup
	banLookupMu.RUnlock()
	if fn == nil {
		return false
	}
	if v, ok := banCache.Load(userID); ok {
		e := v.(banEntry)
		if time.Since(e.at) < banCacheTTL {
			return e.banned
		}
	}
	banned, err := fn(userID)
	if err != nil {
		// A database outage already fails the request downstream; don't lock everyone out here.
		log.Printf("ban lookup failed for %s: %v", userID, err)
		return false
	}
	banCache.Store(userID, banEntry{banned: banned, at: time.Now()})
	return banned
}
