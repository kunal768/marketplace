package platform

import (
	"net/http"
	"strconv"
)

func UserIDFromHeader(r *http.Request) (int64, bool) {
	s := r.Header.Get("X-User-ID")
	if s == "" {
		return 0, false
	}
	id, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0, false
	}
	return id, true
}
