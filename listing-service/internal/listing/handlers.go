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
	userID, err := common.ValidateUserAndRoleAuth(w, r)
	if err != nil {
		return
	}

	var p models.CreateParams
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		platform.Error(w, http.StatusBadRequest, "invalid json")
		return
	}
	if p.Title == "" || p.Price <= 0 || p.Category == "" {
		platform.Error(w, http.StatusBadRequest, "title, price, category required")
		return
	}

	l, err := h.S.Create(r.Context(), userID, p)
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

	userID, err := common.ValidateUserAndRoleAuth(w, r)
	if err != nil {
		return
	}

	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var p models.UpdateParams
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		platform.Error(w, http.StatusBadRequest, "invalid json")
		return
	}

	log.Println("SQL update try from updatehandler")
	l, err := h.S.Update(r.Context(), id, userID, p)
	if err != nil {
		platform.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	log.Println("SQL update passed from updatehandler")
	platform.JSON(w, http.StatusOK, l)
}

func (h *Handlers) DeleteHandler(w http.ResponseWriter, r *http.Request) {
	// User Auth
	userID, err := common.ValidateUserAndRoleAuth(w, r)
	if err != nil {
		return
	}

	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if r.URL.Query().Get("hard") == "true" {
		if err := h.S.Delete(r.Context(), id, userID); err != nil {
			platform.Error(w, 500, err.Error())
			log.Println("Big pooopie delete")
			return
		}
	} else {
		if err := h.S.Archive(r.Context(), id, userID); err != nil {
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
	userID, err := common.ValidateUserAndRoleAuth(w, r)
	if err != nil {
		return
	}

	l, err := h.S.GetUserLists(r.Context(), userID)

	if err != nil {
		platform.Error(w, http.StatusNotFound, "not found")
		return
	}

	platform.JSON(w, http.StatusOK, l)
}

func (h *Handlers) AddMediaURLHandler(w http.ResponseWriter, r *http.Request) {
	// User Auth
	userID, err := common.ValidateUserAndRoleAuth(w, r)
	if err != nil {
		return
	}

	// Parse listing ID from URL parameter
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		platform.Error(w, http.StatusBadRequest, "invalid listing ID")
		return
	}

	// Decode JSON body
	var p models.AddMediaParams
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		platform.Error(w, http.StatusBadRequest, "invalid json")
		return
	}

	// Validate array is not empty
	if len(p.MediaUrls) == 0 {
		platform.Error(w, http.StatusBadRequest, "media_urls array cannot be empty")
		return
	}

	// Call repository method to add media URLs
	err = h.S.AddMediaUrls(r.Context(), id, userID, p.MediaUrls)
	if err != nil {
		// Check error type to return appropriate status code
		if err.Error() == "listing not found" {
			platform.Error(w, http.StatusNotFound, "listing not found")
			return
		}
		if err.Error() == "listing does not belong to user" {
			platform.Error(w, http.StatusForbidden, "listing does not belong to user")
			return
		}
		if err.Error() == "no URLs provided" || err.Error() == "no valid URLs provided" {
			platform.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		platform.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	platform.JSON(w, http.StatusOK, map[string]interface{}{
		"message": "Media URLs added successfully",
		"count":   len(p.MediaUrls),
	})
}

func (h *Handlers) UploadUserMedia(w http.ResponseWriter, r *http.Request) {
	// We allow 5 files * 20MB each + some overhead for form data
	ctx := r.Context()
	userID, err := common.ValidateUserAndRoleAuth(w, r)
	if err != nil {
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, (models.MaxFilesToProcess*models.MaxFileUploadSize)+(1<<20)) // Total max size

	// 2. Parse the multipart form data
	// The number here (20MB) is the max amount of memory to use for storing
	// the whole request body; excess will be stored in temporary disk files.
	err = r.ParseMultipartForm(models.MaxFileUploadSize)
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
		uniqueBlobName := fmt.Sprintf("%s-%s", userID, safeFileName)

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
