package listings

import (
	"time"

	"github.com/google/uuid"
)

// Category and Status types matching listing-service
type Category string
type Status string

const (
	CatTextbook     Category = "TEXTBOOK"
	CatGadget       Category = "GADGET"
	CatEssential    Category = "ESSENTIAL"
	CatNonEssential Category = "NON-ESSENTIAL"
	CatOther        Category = "OTHER"
	CatTest         Category = "TEST"

	StAvailable Status = "AVAILABLE"
	StPending   Status = "PENDING"
	StSold      Status = "SOLD"
	StArchived  Status = "ARCHIVED"
	StReported  Status = "REPORTED"
)

// Listing represents a listing item
type Listing struct {
	ID          int64     `json:"id"`
	Title       string    `json:"title"`
	Description *string   `json:"description,omitempty"`
	Price       int64     `json:"price"`
	Category    Category  `json:"category"`
	UserID      uuid.UUID `json:"user_id"`
	Status      Status    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
}

// CreateListingRequest for creating a new listing
type CreateListingRequest struct {
	Title       string   `json:"title"`
	Description *string  `json:"description,omitempty"`
	Price       int64    `json:"price"`
	Category    Category `json:"category"`
}

// CreateListingResponse returns the created listing
type CreateListingResponse struct {
	*Listing
}

// FetchAllListingsRequest for filtering listings
type FetchAllListingsRequest struct {
	Limit    *int      `json:"limit,omitempty"`
	Offset   *int      `json:"offset,omitempty"`
	Sort     *string   `json:"sort,omitempty"`
	Keywords *string   `json:"keywords,omitempty"`
	Category *Category `json:"category,omitempty"`
	Status   *Status   `json:"status,omitempty"`
	MinPrice *int64    `json:"min_price,omitempty"`
	MaxPrice *int64    `json:"max_price,omitempty"`
}

// FetchAllListingsResponse returns a list of listings with count
type FetchAllListingsResponse struct {
	Items []Listing `json:"items"`
	Count int       `json:"count"`
}

// FetchListingRequest for getting a single listing
type FetchListingRequest struct {
	ID int64 `json:"id"`
}

// FetchListingResponse returns a single listing
type FetchListingResponse struct {
	*Listing
}

// FetchUserListingsResponse returns user's listings
type FetchUserListingsResponse struct {
	Listings []Listing `json:"listings"`
}

// UpdateListingRequest for updating a listing
type UpdateListingRequest struct {
	ID          int64     `json:"id"`
	Title       *string   `json:"title,omitempty"`
	Description *string   `json:"description,omitempty"`
	Price       *int64    `json:"price,omitempty"`
	Category    *Category `json:"category,omitempty"`
	Status      *Status   `json:"status,omitempty"`
}

// UpdateListingResponse returns the updated listing
type UpdateListingResponse struct {
	*Listing
}

// DeleteListingRequest for deleting a listing
type DeleteListingRequest struct {
	ID   int64 `json:"id"`
	Hard *bool `json:"hard,omitempty"`
}

// DeleteListingResponse returns deletion status
type DeleteListingResponse struct {
	Status string `json:"status"`
}

// UploadMediaRequest for uploading media files
type UploadMediaRequest struct {
	Files []FileData `json:"files"`
}

// FileData represents file information and data for upload
type FileData struct {
	FileName    string `json:"file_name"`
	FileSize    int64  `json:"file_size"`
	ContentType string `json:"content_type,omitempty"`
	Data        []byte `json:"data"` // File content as bytes
}

// UploadSASResponse represents a SAS URL response from blob service
type UploadSASResponse struct {
	SASURL             string `json:"sas_url"`
	PermanentPublicURL string `json:"permanent_public_url"`
	BlobName           string `json:"blob_name"`
}

// UploadMediaResponse returns SAS URLs for file uploads
type UploadMediaResponse struct {
	Message string              `json:"message"`
	Uploads []UploadSASResponse `json:"uploads"`
}

// AddMediaURLRequest for adding media URLs to a listing
type AddMediaURLRequest struct {
	ID        int64    `json:"id"`
	MediaUrls []string `json:"media_urls"`
}

// AddMediaURLResponse returns success message
type AddMediaURLResponse struct {
	Message string `json:"message"`
	Count   int    `json:"count"`
}

// ChatSearchRequest for AI-powered search
type ChatSearchRequest struct {
	Query string `json:"query"`
}

// ChatSearchResponse returns search results
type ChatSearchResponse struct {
	Listings []Listing `json:"listings"`
}
