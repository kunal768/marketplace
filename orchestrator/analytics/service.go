package analytics

import "context"

type Service interface {
	GetAnalytics(ctx context.Context) (*AnalyticsResponse, error)
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{
		repo: repo,
	}
}

func (s *service) GetAnalytics(ctx context.Context) (*AnalyticsResponse, error) {
	// Fetch all analytics data in parallel
	totalUsers, err := s.repo.GetTotalUsers(ctx)
	if err != nil {
		return nil, err
	}

	totalListings, err := s.repo.GetTotalListings(ctx)
	if err != nil {
		return nil, err
	}

	openFlags, err := s.repo.GetOpenFlags(ctx)
	if err != nil {
		return nil, err
	}

	totalFlags, err := s.repo.GetTotalFlags(ctx)
	if err != nil {
		return nil, err
	}

	listingsByStatus, err := s.repo.GetListingsByStatus(ctx)
	if err != nil {
		return nil, err
	}

	listingsByCategory, err := s.repo.GetListingsByCategory(ctx)
	if err != nil {
		return nil, err
	}

	flagsByStatus, err := s.repo.GetFlagsByStatus(ctx)
	if err != nil {
		return nil, err
	}

	flagsByReason, err := s.repo.GetFlagsByReason(ctx)
	if err != nil {
		return nil, err
	}

	// Ensure all slices are non-nil (empty slices instead of nil)
	if listingsByStatus == nil {
		listingsByStatus = []ListingsByStatus{}
	}
	if listingsByCategory == nil {
		listingsByCategory = []ListingsByCategory{}
	}
	if flagsByStatus == nil {
		flagsByStatus = []FlagsByStatus{}
	}
	if flagsByReason == nil {
		flagsByReason = []FlagsByReason{}
	}

	return &AnalyticsResponse{
		Overview: OverviewStats{
			TotalUsers:    totalUsers,
			TotalListings: totalListings,
			OpenFlags:     openFlags,
			TotalFlags:    totalFlags,
		},
		ListingsByStatus:   listingsByStatus,
		ListingsByCategory: listingsByCategory,
		FlagsByStatus:      flagsByStatus,
		FlagsByReason:      flagsByReason,
	}, nil
}
