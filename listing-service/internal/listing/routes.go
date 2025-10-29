package listing

import "github.com/go-chi/chi/v5"

func Routes(h *Handlers) *chi.Mux {
	r := chi.NewRouter()
	r.Post("/", h.CreateHandler)
	r.Post("/chatsearch", h.ChatSearchHandler)
	r.Get("/", h.ListHandler)
	r.Get("/{id}", h.GetHandler)
	r.Patch("/{id}", h.UpdateHandler)
	r.Delete("/{id}", h.DeleteHandler)
	return r
}
