package listing

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	httplib "github.com/kunal768/cmpe202/http-lib"
	"github.com/your-org/listing-service/internal/gemini"
	"github.com/your-org/listing-service/internal/models"
	"github.com/your-org/listing-service/internal/platform"
)

type Handlers struct {
	AI *gemini.Client
	S  *Store
}

func (h *Handlers) CreateHandler(w http.ResponseWriter, r *http.Request) {
	// User Auth
	// Get user ID from context (set by AuthMiddleware)
	userTokenID, ok := r.Context().Value(httplib.ContextKey("userId")).(string)
	if !ok {
		platform.Error(w, http.StatusNotFound, "UpdateHandler: user not listed")
		return
	}

	userRole, _ := r.Context().Value(httplib.ContextKey("userRole")).(int)

	if userRole == 1 {
		log.Println("user is indeed an admin! Not gonna do anything about it yet.")
	}

	//End user auth

	var p models.CreateParams
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		platform.Error(w, http.StatusBadRequest, "invalid json")
		return
	}
	if p.Title == "" || p.Price <= 0 || p.Category == "" {
		platform.Error(w, http.StatusBadRequest, "title, price, category required")
		return
	}

	l, err := h.S.Create(r.Context(), userTokenID, p)
	if err != nil {
		platform.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	platform.JSON(w, http.StatusCreated, l)
}

func (h *Handlers) GetHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	l, err := h.S.Get(r.Context(), id)
	if err != nil {
		platform.Error(w, http.StatusNotFound, "not found")
		return
	}
	platform.JSON(w, http.StatusOK, l)
}

func (h *Handlers) ListHandler(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := models.ListFilters{
		Limit:  parseInt(q.Get("limit"), 20),
		Offset: parseInt(q.Get("offset"), 0),
		Sort:   q.Get("sort"),
	}
	if s := q.Get("keywords"); s != "" {
		f.Keywords = strings.Fields(s)
	}
	if s := q.Get("category"); s != "" {
		c := models.Category(s)
		f.Category = &c
	}
	if s := q.Get("status"); s != "" {
		st := models.Status(s)
		f.Status = &st
	}
	if s := q.Get("min_price"); s != "" {
		v := parseInt64(s, 0)
		f.MinPrice = &v
	}
	if s := q.Get("max_price"); s != "" {
		v := parseInt64(s, 0)
		f.MaxPrice = &v
	}

	items, err := h.S.List(r.Context(), &f)
	if err != nil {
		platform.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	platform.JSON(w, http.StatusOK, map[string]any{"items": items, "count": len(items)})
}

func (h *Handlers) UpdateHandler(w http.ResponseWriter, r *http.Request) {
	// User Auth
	// Get user ID from context (set by AuthMiddleware)
	userTokenID, ok := r.Context().Value(httplib.ContextKey("userId")).(string)
	if !ok {
		platform.Error(w, http.StatusNotFound, "UpdateHandler: user not listed")
		return
	}

	userRole, _ := r.Context().Value(httplib.ContextKey("userRole")).(int)

	if userRole == 1 {
		log.Println("user is indeed an admin! Not gonna do anything about it yet.")
	}
	log.Println("Auth finished for updatehandler: ", userTokenID)
	//End user auth

	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var p models.UpdateParams
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		platform.Error(w, http.StatusBadRequest, "invalid json")
		return
	}

	log.Println("SQL update try from updatehandler")
	l, err := h.S.Update(r.Context(), id, userTokenID, p)
	if err != nil {
		platform.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	log.Println("SQL update passed from updatehandler")
	platform.JSON(w, http.StatusOK, l)
}

func (h *Handlers) DeleteHandler(w http.ResponseWriter, r *http.Request) {
	// User Auth
	// Get user ID from context (set by AuthMiddleware)
	userTokenID, ok := r.Context().Value(httplib.ContextKey("userId")).(string)
	if !ok {
		platform.Error(w, http.StatusNotFound, "UpdateHandler: user not listed")
		return
	}

	userRole, _ := r.Context().Value(httplib.ContextKey("userRole")).(int)

	if userRole == 1 {
		log.Println("user is indeed an admin! Not gonna do anything about it yet.")
	}

	//End user auth

	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if r.URL.Query().Get("hard") == "true" {
		if err := h.S.Delete(r.Context(), id, userTokenID); err != nil {
			platform.Error(w, 500, err.Error())
			log.Println("Big pooopie delete")
			return
		}
	} else {
		if err := h.S.Archive(r.Context(), id, userTokenID); err != nil {
			platform.Error(w, 500, err.Error())
			return
		}
	}
	platform.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handlers) ChatSearchHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Query string `json:"query"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.Query == "" {
		http.Error(w, "Query cannot be empty", http.StatusBadRequest)
		return
	}

	log.Printf("Received search query: %s", req.Query)

	searchParams, err := h.AI.GetSearchParams(r.Context(), req.Query)
	if err != nil {
		log.Printf("ERROR getting search params from AI: %v", err)
		http.Error(w, "Failed to understand query", http.StatusInternalServerError)
		return
	}

	listings, err := h.S.List(r.Context(), searchParams)
	if err != nil {
		log.Printf("ERROR finding listings in database: %v", err)
		http.Error(w, "Failed to retrieve listings", http.StatusInternalServerError)
		return
	}

	log.Printf("Found %d listings for query '%s'", len(listings), req.Query)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(listings)
}

func (h *Handlers) GetUserListsHandler(w http.ResponseWriter, r *http.Request) {
	user_id := chi.URLParam(r, "user_id")
	l, err := h.S.GetUserLists(r.Context(), user_id)
	if err != nil {
		platform.Error(w, http.StatusNotFound, "not found")
		return
	}
	platform.JSON(w, http.StatusOK, l)
}

func parseInt(s string, def int) int {
	if s == "" {
		return def
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return v
}
func parseInt64(s string, def int64) int64 {
	if s == "" {
		return def
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return def
	}
	return v
}
