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
	ID          int64     `json:"id"`
	Title       string    `json:"title"`
	Description *string   `json:"description,omitempty"`
	Price       int64     `json:"price"`
	Category    Category  `json:"category"`
	UserID      uuid.UUID `json:"user_id"`
	Status      Status    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
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

// Flag reason and status types
type FlagReason string
type FlagStatus string

const (
	FlagReasonSpam          FlagReason = "SPAM"
	FlagReasonScam          FlagReason = "SCAM"
	FlagReasonInappropriate FlagReason = "INAPPROPRIATE"
	FlagReasonMisleading    FlagReason = "MISLEADING"
	FlagReasonOther         FlagReason = "OTHER"

	FlagStatusOpen        FlagStatus = "OPEN"
	FlagStatusUnderReview FlagStatus = "UNDER_REVIEW"
	FlagStatusResolved    FlagStatus = "RESOLVED"
	FlagStatusDismissed   FlagStatus = "DISMISSED"
)

// CreateFlagParams represents the parameters for creating a flag
type CreateFlagParams struct {
	ListingID int64      `json:"listing_id"`
	Reason    FlagReason `json:"reason"`
	Details   *string    `json:"details,omitempty"`
}

// UpdateFlagParams represents the parameters for updating a flagged listing
type UpdateFlagParams struct {
	Status          FlagStatus `json:"status"`
	ResolutionNotes *string    `json:"resolution_notes,omitempty"`
}

// FlaggedListing represents a flagged listing with both flag and listing information
type FlaggedListing struct {
	// Flag information
	FlagID          int64      `json:"flag_id" db:"flag_id"`
	ListingID       int64      `json:"listing_id" db:"listing_id"`
	ReporterUserID  *uuid.UUID `json:"reporter_user_id,omitempty" db:"reporter_user_id"`
	Reason          FlagReason `json:"reason" db:"reason"`
	Details         *string    `json:"details,omitempty" db:"details"`
	Status          FlagStatus `json:"status" db:"status"`
	ReviewerUserID  *uuid.UUID `json:"reviewer_user_id,omitempty" db:"reviewer_user_id"`
	ResolutionNotes *string    `json:"resolution_notes,omitempty" db:"resolution_notes"`
	FlagCreatedAt   time.Time  `json:"flag_created_at" db:"flag_created_at"`
	FlagUpdatedAt   time.Time  `json:"flag_updated_at" db:"flag_updated_at"`
	FlagResolvedAt  *time.Time `json:"flag_resolved_at,omitempty" db:"flag_resolved_at"`

	// Listing information
	Listing Listing `json:"listing"`
}
