package analytics

// OverviewStats represents the main dashboard overview statistics
type OverviewStats struct {
	TotalUsers    int `json:"total_users"`
	TotalListings int `json:"total_listings"`
	OpenFlags     int `json:"open_flags"`
	TotalFlags    int `json:"total_flags"`
}

// ListingsByStatus represents listings grouped by status
type ListingsByStatus struct {
	Status string `json:"status"`
	Count  int    `json:"count"`
}

// ListingsByCategory represents listings grouped by category
type ListingsByCategory struct {
	Category string `json:"category"`
	Count    int    `json:"count"`
}

// FlagsByStatus represents flags grouped by status
type FlagsByStatus struct {
	Status string `json:"status"`
	Count  int    `json:"count"`
}

// FlagsByReason represents flags grouped by reason
type FlagsByReason struct {
	Reason string `json:"reason"`
	Count  int    `json:"count"`
}

// AnalyticsResponse contains all analytics data
type AnalyticsResponse struct {
	Overview           OverviewStats        `json:"overview"`
	ListingsByStatus   []ListingsByStatus   `json:"listings_by_status"`
	ListingsByCategory []ListingsByCategory `json:"listings_by_category"`
	FlagsByStatus      []FlagsByStatus      `json:"flags_by_status"`
	FlagsByReason      []FlagsByReason      `json:"flags_by_reason"`
}
