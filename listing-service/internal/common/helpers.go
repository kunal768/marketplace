package common

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	httplib "github.com/kunal768/cmpe202/http-lib"
	"github.com/kunal768/cmpe202/listing-service/internal/platform"
)

func ParseInt(s string, def int) int {
	if s == "" {
		return def
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return v
}
func ParseInt64(s string, def int64) int64 {
	if s == "" {
		return def
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return def
	}
	return v
}

func IsValidMediaType(contentType string) bool {
	// Normalize to lowercase for case-insensitive comparison
	normalizedType := strings.ToLower(contentType)

	// List of common and safe image MIME types
	safeImageTypes := map[string]struct{}{
		"image/jpeg": {},
		"image/jpg":  {},
		"image/png":  {},
		"image/gif":  {},
		"image/webp": {},
		// Note: image/svg+xml is often omitted from direct uploads due to XSS risk
	}

	// List of common and safe video MIME types
	safeVideoTypes := map[string]struct{}{
		"video/mp4":       {},
		"video/quicktime": {}, // .mov
		"video/webm":      {},
		"video/ogg":       {},
		// If you support HLS/DASH manifest formats, they would be handled separately.
	}

	// 1. Check if the type is a safe image
	if _, ok := safeImageTypes[normalizedType]; ok {
		return true
	}

	// 2. Check if the type is a safe video
	if _, ok := safeVideoTypes[normalizedType]; ok {
		return true
	}

	return false
}

func FormatQuery(query string, args []any) string {
	formatted := query
	for i, arg := range args {
		// convert argument to string safely
		val := fmt.Sprintf("'%v'", arg)
		// replace first occurrence of $1, $2, ...
		placeholder := fmt.Sprintf("$%d", i+1)
		formatted = strings.Replace(formatted, placeholder, val, 1)
	}
	return formatted
}

func ValidateUserAndRoleAuth(w http.ResponseWriter, r *http.Request) (string, error) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		platform.Error(w, http.StatusUnauthorized, "user not authenticated")
		return "", errors.New("user not authenticated")
	}
	userRole := r.Header.Get("X-User-Role")

	if userRole == string(httplib.ADMIN) || userRole == string(httplib.USER) {
		log.Println("user is a valid type")
	} else {
		errorMsg := fmt.Sprintf("Invalid or missing user role: %s", userRole)
		log.Println(errorMsg)
		platform.Error(w, http.StatusUnauthorized, errorMsg)
		return "", errors.New(errorMsg)
	}
	return userID, nil
}
