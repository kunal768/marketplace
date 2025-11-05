package listing

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	httplib "github.com/kunal768/cmpe202/http-lib"
)

func Routes(h *Handlers, dbPool *pgxpool.Pool) *chi.Mux {
	r := chi.NewRouter()

	role := httplib.RoleInjectionMiddleWare(dbPool)

	protected := func(h http.Handler) http.Handler {
		return httplib.AuthMiddleWare(
			role(
				httplib.JSONRequestDecoder(h),
			),
		)
	}

	r.With(protected).Post("/", h.CreateHandler)
	r.Post("/chatsearch", h.ChatSearchHandler)
	r.Get("/", h.ListHandler)
	r.Get("/{id}", h.GetHandler)
	r.Get("/user/{user_id}", h.GetUserListsHandler)
	r.With(protected).Patch("/{id}", h.UpdateHandler)
	r.With(protected).Delete("/{id}", h.DeleteHandler)
	r.With(protected).Post("/{id}/media", h.AddMediaHandler)
	r.With(protected).Post("/upload", h.UploadUserMedia)
	return r
}
