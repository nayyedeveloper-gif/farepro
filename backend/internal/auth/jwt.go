package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Claims struct {
	UserID   uuid.UUID  `json:"user_id"`
	Username string     `json:"username"`
	OrgID    *uuid.UUID `json:"org_id,omitempty"`
	OrgRole  string     `json:"org_role,omitempty"`
	jwt.RegisteredClaims
}

type JWTService struct {
	secretKey []byte
	expiry    time.Duration
}

func NewJWTService(secret string, expiry string) (*JWTService, error) {
	if secret == "" {
		return nil, errors.New("JWT secret cannot be empty")
	}

	duration, err := time.ParseDuration(expiry)
	if err != nil {
		return nil, err
	}

	return &JWTService{
		secretKey: []byte(secret),
		expiry:    duration,
	}, nil
}

func (s *JWTService) GenerateToken(userID uuid.UUID, username string) (string, error) {
	claims := Claims{
		UserID:   userID,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.expiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.secretKey)
}

func (s *JWTService) GenerateOrgToken(userID uuid.UUID, username string, orgID uuid.UUID, orgRole string) (string, error) {
	claims := Claims{
		UserID:   userID,
		Username: username,
		OrgID:    &orgID,
		OrgRole:  orgRole,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.expiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.secretKey)
}

func (s *JWTService) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("invalid signing method")
		}
		return s.secretKey, nil
	})

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}
