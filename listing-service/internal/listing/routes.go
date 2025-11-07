package listing

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	httplib "github.com/kunal768/cmpe202/http-lib"
)

func Routes(h *Handlers) *chi.Mux {
	r := chi.NewRouter()

	var (
		decode = httplib.JSONRequestDecoder
		reqID  = httplib.EnforceXRequestID
		userID = httplib.EnforceXUserID
		roleID = httplib.EnforceXRoleID
	)

	userRoleProtected := func(next http.Handler) http.Handler {
		return reqID(roleID(userID(decode(next))))
	}

	routeProtected := func(next http.Handler) http.Handler {
		return reqID(decode(next))
	}

	// 1. Routes requiring only RequestID and Decoder
	r.Group(func(r chi.Router) {
		r.Use(routeProtected)
		r.Post("/chatsearch", h.ChatSearchHandler)
		r.Get("/", h.ListHandler)
		r.Get("/{id}", h.GetHandler)
	})

	// 2. Routes requiring full protection
	r.Group(func(r chi.Router) {
		r.Use(userRoleProtected)
		r.Get("/user-lists/", h.GetUserListsHandler)
		r.Post("/create", h.CreateHandler)
		r.Patch("/update/{id}", h.UpdateHandler)
		r.Delete("/delete/{id}", h.DeleteHandler)
		r.Post("/add-media-url/{id}", h.AddMediaURLHandler)
		r.Post("/upload", h.UploadUserMedia)
	})

	return r
}
