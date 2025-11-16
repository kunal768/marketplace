package listing

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	httplib "github.com/kunal768/cmpe202/http-lib"
)

func Routes(h *Handlers, orchReqId string) *chi.Mux {
	r := chi.NewRouter()

	reqIDMiddleware := httplib.EnforceXRequestID(orchReqId)

	r.Use(reqIDMiddleware)

	var (
		decode = httplib.JSONRequestDecoder
		userID = httplib.EnforceXUserID
		roleID = httplib.EnforceXRoleID
	)

	userRoleProtected := func(next http.Handler) http.Handler {
		return roleID(userID(decode(next)))
	}

	routeProtected := func(next http.Handler) http.Handler {
		return decode(next)
	}

	r.Group(func(r chi.Router) {
		r.Use(routeProtected)
		r.Post("/chatsearch", h.ChatSearchHandler)
		r.Get("/", h.ListHandler)
		r.Get("/{id}", h.GetHandler)
	})

	r.Group(func(r chi.Router) {
		r.Use(userRoleProtected)
		// Specific routes should come before parameterized routes
		r.Get("/flagged", h.GetFlaggedListingsHandler)
		r.Patch("/flag/{flag_id}", h.UpdateFlagListingHandler)
		r.Delete("/flag/{flag_id}", h.DeleteFlagListingHandler)
		r.Get("/by-user-id", h.GetListingsByUserIDHandler)
		r.Get("/user-lists/", h.GetUserListsHandler)
		r.Post("/create", h.CreateHandler)
		r.Post("/upload", h.UploadUserMedia)
		r.Post("/flag/{id}", h.FlagListingHandler)
		r.Patch("/update/{id}", h.UpdateHandler)
		r.Delete("/delete/{id}", h.DeleteHandler)
		r.Post("/add-media-url/{id}", h.AddMediaURLHandler)
	})

	return r
}
