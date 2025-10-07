package httplib

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kunal768/cmpe202/http-lib/clients"
	"github.com/sirupsen/logrus"
)

/*
	1. jwt authenticator & userId filling middleware
	3. http-encoder decoder
*/

func AuthMiddleWare(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tokenString := r.Header.Get("Authorization")
		if tokenString == "" {
			WriteJSON(w, http.StatusUnauthorized, map[string]string{
				"error":   "Authorization header required",
				"message": "Please provide a valid access token",
			})
			return
		}
		tokenString = strings.Replace(tokenString, "Bearer ", "", 1)

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return []byte(os.Getenv("JWT_TOKEN_SECRET")), nil
		})

		if err != nil {
			WriteJSON(w, http.StatusUnauthorized, map[string]string{
				"error":   "Invalid token",
				"message": "Please provide a valid access token",
			})
			return
		}

		if !token.Valid {
			WriteJSON(w, http.StatusUnauthorized, map[string]string{
				"error":   "Invalid token",
				"message": "Please provide a valid access token",
			})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			WriteJSON(w, http.StatusUnauthorized, map[string]string{
				"error":   "Invalid token claims",
				"message": "Please provide a valid access token",
			})
			return
		}

		// Check token type
		tokenType, ok := claims["type"].(string)
		if !ok || tokenType != "access" {
			WriteJSON(w, http.StatusUnauthorized, map[string]string{
				"error":   "Invalid token type",
				"message": "Please provide a valid access token",
			})
			return
		}

		userID, ok := claims["userId"].(string)
		if !ok {
			WriteJSON(w, http.StatusUnauthorized, map[string]string{
				"error":   "User ID not found in token",
				"message": "Please provide a valid access token",
			})
			return
		}

		ctx := context.WithValue(r.Context(), ContextKey("userId"), userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func RoleInjectionMiddleWare(dbPool *pgxpool.Pool) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			userId, ok := ctx.Value(ContextKey("userId")).(string)
			if ok && userId != "" {
				role, err := clients.FetchUserRole(ctx, dbPool, userId)
				if err == nil {
					ctx = context.WithValue(ctx, ContextKey("userRole"), role)
				} else {
					// Proceed without role if not found; do not error out
					logrus.WithError(err).WithField("userId", userId).Debug("role fetch failed; continuing without role")
				}
			}
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func JSONRequestDecoder(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Do not strictly enforce Content-Type; just pass through
		next.ServeHTTP(w, r)
	})
}

func WriteJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
	// Structured log of response
	logrus.WithFields(logrus.Fields{
		"status": status,
		"path":   w.Header().Get("X-Request-Path"),
	}).Info("response sent")
}

// GenerateJWT generates a JWT access token for the user
func GenerateJWT(userID string) (string, error) {
	// Create the Claims
	claims := jwt.MapClaims{
		"userId": userID,
		"exp":    time.Now().Add(time.Hour * 1).Unix(), // Access token expires in 1 hour
		"iat":    time.Now().Unix(),
		"type":   "access",
	}

	// Create token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// Sign token with secret
	tokenString, err := token.SignedString([]byte(os.Getenv("JWT_TOKEN_SECRET")))
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

// GenerateRefreshToken generates a refresh token for the user
func GenerateRefreshToken(userID string) (string, error) {
	// Create the Claims
	claims := jwt.MapClaims{
		"userId": userID,
		"exp":    time.Now().Add(time.Hour * 24 * 7).Unix(), // Refresh token expires in 7 days
		"iat":    time.Now().Unix(),
		"type":   "refresh",
	}

	// Create token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// Sign token with secret
	tokenString, err := token.SignedString([]byte(os.Getenv("JWT_REFRESH_SECRET")))
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

// ValidateRefreshToken validates a refresh token and returns the user ID
func ValidateRefreshToken(tokenString string) (string, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(os.Getenv("JWT_REFRESH_SECRET")), nil
	})

	if err != nil {
		return "", err
	}

	if !token.Valid {
		return "", fmt.Errorf("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", fmt.Errorf("invalid claims")
	}

	// Check token type
	tokenType, ok := claims["type"].(string)
	if !ok || tokenType != "refresh" {
		return "", fmt.Errorf("invalid token type")
	}

	userID, ok := claims["userId"].(string)
	if !ok {
		return "", fmt.Errorf("user ID not found in token")
	}

	return userID, nil
}
