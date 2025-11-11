export interface User {
  user_id: string // API returns user_id (snake_case), not id
  user_name: string
  email: string
  contact?: {
    Email: string
  }
  role?: string
  created_at: string
  updated_at?: string
}

export interface SignupRequest {
  user_name: string
  email: string
  password: string
}

export interface SignupResponse {
  message: string
  token: string
  user: User
  refresh_token: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  message: string
  token: string
  user: User
  refresh_token: string
}

export interface RefreshTokenRequest {
  refresh_token: string
}

export interface RefreshTokenResponse {
  message: string
  access_token: string
  refresh_token: string
  user: User
}

export interface ErrorResponse {
  error: string
  message: string
}

export interface Listing {
  id: number
  title: string
  description?: string
  price: number
  category: string
  user_id: string
  status: string
  created_at: string
}

export type FlagReason = "SPAM" | "SCAM" | "INAPPROPRIATE" | "MISLEADING" | "OTHER"
export type FlagStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED"

export interface FlaggedListing {
  flag_id: number
  listing_id: number
  reporter_user_id?: string
  reason: FlagReason
  details?: string
  status: FlagStatus
  reviewer_user_id?: string
  resolution_notes?: string
  flag_created_at: string
  flag_updated_at: string
  flag_resolved_at?: string
  listing: Listing
}

export interface FetchFlaggedListingsResponse {
  flagged_listings: FlaggedListing[]
  count: number
}

