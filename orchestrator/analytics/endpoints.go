package analytics

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	httplib "github.com/kunal768/cmpe202/http-lib"
)

type Endpoints struct {
	service Service
}

func NewEndpoints(service Service) *Endpoints {
	return &Endpoints{
		service: service,
	}
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// checkAdminRole checks if the current user is an admin
func checkAdminRole(r *http.Request) (bool, string) {
	userRole, ok := r.Context().Value(httplib.ContextKey("userRole")).(string)
	if !ok || userRole != "0" {
		return false, userRole
	}
	return true, userRole
}

// GetAnalyticsHandler handles getting analytics data (admin only)
func (e *Endpoints) GetAnalyticsHandler(w http.ResponseWriter, r *http.Request) {
	// Check if user is admin
	isAdmin, _ := checkAdminRole(r)
	if !isAdmin {
		httplib.WriteJSON(w, http.StatusForbidden, ErrorResponse{
			Error:   "Forbidden",
			Message: "Admin access required",
		})
		return
	}

	// Call service
	response, err := e.service.GetAnalytics(r.Context())
	if err != nil {
		httplib.WriteJSON(w, http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to fetch analytics",
			Message: err.Error(),
		})
		return
	}

	httplib.WriteJSON(w, http.StatusOK, response)
}

// RegisterRoutes registers all analytics routes with proper middleware
func (e *Endpoints) RegisterRoutes(mux *http.ServeMux, dbPool *pgxpool.Pool) {
	// Admin-only route: requires auth + role injection
	protected := func(h http.Handler) http.Handler {
		return httplib.AuthMiddleWare(
			httplib.RoleInjectionMiddleWare(dbPool)(
				httplib.JSONRequestDecoder(h),
			),
		)
	}

	mux.Handle("GET /api/analytics", protected(http.HandlerFunc(e.GetAnalyticsHandler)))
}
