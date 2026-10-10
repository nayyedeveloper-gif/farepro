package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	JWT      JWTConfig
	LiveKit  LiveKitConfig
	Redis    RedisConfig
	VAPID    VAPIDConfig
}

type VAPIDConfig struct {
	PublicKey  string
	PrivateKey string
	Subject    string
}

type ServerConfig struct {
	Port    string
	GinMode string
	BaseURL string
}

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

type JWTConfig struct {
	Secret     string
	Expiration string
}

type LiveKitConfig struct {
	URL       string
	APIKey    string
	APISecret string
}

type RedisConfig struct {
	Host     string
	Password string
	DB       int
}

func Load() (*Config, error) {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		// .env file is optional in production
	}

	db, _ := strconv.Atoi(os.Getenv("REDIS_DB"))

	return &Config{
		Server: ServerConfig{
			Port:    getEnv("PORT", "8080"),
			GinMode: getEnv("GIN_MODE", "debug"),
			BaseURL: getEnv("BASE_URL", "http://localhost:8080"),
		},
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", ""),
			DBName:   getEnv("DB_NAME", "teamwork"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		JWT: JWTConfig{
			Secret:     getEnv("JWT_SECRET", "change_this_secret"),
			Expiration: getEnv("JWT_EXPIRATION", "168h"),
		},
		LiveKit: LiveKitConfig{
			URL:       getEnv("LIVEKIT_URL", "http://localhost:7880"),
			APIKey:    getEnv("LIVEKIT_API_KEY", "devkey"),
			APISecret: getEnv("LIVEKIT_API_SECRET", "secret"),
		},
		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost:6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       db,
		},
		VAPID: VAPIDConfig{
			PublicKey:  getEnv("VAPID_PUBLIC_KEY", ""),
			PrivateKey: getEnv("VAPID_PRIVATE_KEY", ""),
			Subject:    getEnv("VAPID_SUBJECT", "mailto:admin@teamwork.local"),
		},
	}, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
