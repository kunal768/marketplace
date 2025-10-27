package listing

import "github.com/go-chi/chi/v5"

func Routes(h *Handlers) *chi.Mux {
	r := chi.NewRouter()
	r.Post("/", h.Create)
	r.Post("/chatsearch", h.ChatSearch)
	r.Get("/", h.List)
	r.Get("/{id}", h.Get)
	r.Patch("/{id}", h.Update)
	r.Delete("/{id}", h.Delete)
	return r
}
