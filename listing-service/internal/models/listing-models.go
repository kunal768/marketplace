package models

import (
	"time"

	"github.com/google/uuid"
)

type Category string
type Status string
type MediaUrl string

const MaxFileUploadSize = 20 << 20 // 20 MB limit per media upload
const MaxFilesToProcess = 5        // max files user can uplaod at a time

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

var AllCategories = []Category{
	CatTextbook,
	CatGadget,
	CatEssential,
	CatNonEssential,
	CatOther,
}

var AllStatuses = []Status{
	StAvailable,
	StPending,
	StSold,
	StArchived,
	StReported,
}

type Listing struct {
	ID          int64      `json:"id"`
	Title       string     `json:"title"`
	Description *string    `json:"description,omitempty"`
	Price       int64      `json:"price"`
	Category    Category   `json:"category"`
	UserID      uuid.UUID  `json:"user_id"`
	Status      Status     `json:"status"`
	CreatedAt   time.Time  `json:"created_at"`
}

type CreateParams struct {
	Title       string   `json:"title"`
	Description *string  `json:"description,omitempty"`
	Price       int64    `json:"price"`
	Category    Category `json:"category"`
}

type UpdateParams struct {
	Title       *string   `json:"title,omitempty"`
	Description *string   `json:"description,omitempty"`
	Price       *int64    `json:"price,omitempty"`
	Category    *Category `json:"category,omitempty"`
	Status      *Status   `json:"status,omitempty"`
}

type AddMediaParams struct {
	MediaUrls []string `json:"media_urls"`
}

type ListFilters struct {
	Keywords []string  `json:"keywords,omitempty"`
	Category *Category `json:"category,omitempty"`
	Status   *Status   `json:"status,omitempty"`
	MinPrice *int64    `json:"min_price,omitempty"`
	MaxPrice *int64    `json:"max_price,omitempty"`
	Limit    int
	Offset   int
	Sort     string // "created_at_desc", "price_asc", "price_desc"
}

type FileMetadata struct {
	FileName string `json:"file_name"`
	FileSize int64  `json:"file_size"` // Size in bytes
	// You could also include ContentType here if you trust the client to provide it
}
