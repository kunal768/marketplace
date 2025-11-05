package listing

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	httplib "github.com/kunal768/cmpe202/http-lib"
	"github.com/kunal768/cmpe202/listing-service/internal/blob"
	"github.com/kunal768/cmpe202/listing-service/internal/common"
	"github.com/kunal768/cmpe202/listing-service/internal/gemini"
	"github.com/kunal768/cmpe202/listing-service/internal/models"
	"github.com/kunal768/cmpe202/listing-service/internal/platform"
)

type Handlers struct {
	AI      *gemini.Client
	S       *Store
	BlobSvc blob.BlobService
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
		Limit:  common.ParseInt(q.Get("limit"), 20),
		Offset: common.ParseInt(q.Get("offset"), 0),
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
		v := common.ParseInt64(s, 0)
		f.MinPrice = &v
	}
	if s := q.Get("max_price"); s != "" {
		v := common.ParseInt64(s, 0)
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

func (h *Handlers) UploadUserMedia(w http.ResponseWriter, r *http.Request) {
	// We allow 5 files * 20MB each + some overhead for form data
	ctx := r.Context()
	userId, ok := r.Context().Value(httplib.ContextKey("userId")).(string)
	if !ok {
		platform.Error(w, http.StatusNotFound, "UpdateHandler: user not listed")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, (models.MaxFilesToProcess*models.MaxFileUploadSize)+(1<<20)) // Total max size

	// 2. Parse the multipart form data
	// The number here (20MB) is the max amount of memory to use for storing
	// the whole request body; excess will be stored in temporary disk files.
	err := r.ParseMultipartForm(models.MaxFileUploadSize)
	if err != nil {
		if err.Error() == "http: request body too large" {
			http.Error(w, "Request body exceeds total size limit.", http.StatusRequestEntityTooLarge)
			return
		}
		http.Error(w, fmt.Sprintf("Error parsing form: %v", err), http.StatusBadRequest)
		return
	}

	// 3. Get the map of all files uploaded under the name "media"
	files := r.MultipartForm.File["media"]
	if len(files) == 0 {
		http.Error(w, "No files uploaded under the key 'media'", http.StatusBadRequest)
		return
	}

	if len(files) > models.MaxFilesToProcess {
		http.Error(w, fmt.Sprintf("Too many files uploaded. Max allowed: %d.", models.MaxFilesToProcess), http.StatusBadRequest)
		return
	}

	var sasResponses []blob.UploadSASResponse

	// 3. Loop through each uploaded file's metadata to generate a secure SAS URL
	for i, fileHeader := range files {
		fmt.Printf("Validating file %d: %s (%d bytes)\n", i+1, fileHeader.Filename, fileHeader.Size)

		// a. Check file size and validity based on metadata
		if fileHeader.Size == 0 || fileHeader.Size > models.MaxFileUploadSize {
			fmt.Printf("File %s skipped: invalid size.\n", fileHeader.Filename)
			continue
		}

		contentType := fileHeader.Header.Get("Content-Type")
		if !common.IsValidMediaType(contentType) {
			fmt.Printf("File %s skipped: invalid media type %s.\n", fileHeader.Filename, contentType)
			continue
		}

		// b. Determine the unique, final destination name (blobName)
		safeFileName := strings.ReplaceAll(filepath.Base(fileHeader.Filename), " ", "_")
		// NOTE: In a real app, include a user/listing ID here for security and organization.
		uniqueBlobName := fmt.Sprintf("%s-%s", userId, safeFileName)

		// c. Generate the secure SAS URL
		sasResponse, err := h.BlobSvc.GenerateUploadSAS(ctx, uniqueBlobName)
		if err != nil {
			fmt.Printf("Error generating SAS for %s: %v\n", fileHeader.Filename, err)
			http.Error(w, "Error generating SAS link.", http.StatusInternalServerError)
			return
		}

		// d. Collect the generated SAS URL and Permanent URL
		sasResponses = append(sasResponses, sasResponse)
	}

	// 4. Send response with the list of SAS URLs
	if len(sasResponses) > 0 {
		// Return the list of links for the client to perform parallel uploads
		platform.JSON(w, http.StatusOK, map[string]interface{}{
			"message": "SAS URLs generated. Client must now upload files directly.",
			"uploads": sasResponses,
		})
	} else {
		platform.Error(w, http.StatusBadRequest, "No valid file metadata was processed.")
	}
}
