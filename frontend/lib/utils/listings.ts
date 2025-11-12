/**
 * Listing utility functions for formatting and mapping data
 */

// Backend category values (matching backend exactly)
export type BackendCategory = "TEXTBOOK" | "GADGET" | "ESSENTIAL" | "NON-ESSENTIAL" | "OTHER" | "TEST"

// Frontend display category names
export type DisplayCategory = "Textbooks" | "Electronics" | "Furniture" | "Non-Essential" | "Other"

// Category mapping from backend to frontend display
const CATEGORY_TO_DISPLAY: Record<BackendCategory, DisplayCategory> = {
  TEXTBOOK: "Textbooks",
  GADGET: "Electronics",
  ESSENTIAL: "Furniture",
  "NON-ESSENTIAL": "Non-Essential",
  OTHER: "Other",
  TEST: "Other", // Hide TEST category from users, map to Other
}

// Reverse mapping from frontend display to backend
const DISPLAY_TO_CATEGORY: Record<DisplayCategory, BackendCategory> = {
  Textbooks: "TEXTBOOK",
  Electronics: "GADGET",
  Furniture: "ESSENTIAL",
  "Non-Essential": "NON-ESSENTIAL",
  Other: "OTHER",
}

/**
 * Converts price from cents to dollars
 * @param priceInCents - Price in cents
 * @returns Formatted price string (e.g., "$45.00")
 */
export function formatPrice(priceInCents: number): string {
  if (!priceInCents || priceInCents === 0) {
    return "$0.00"
  }
  return `$${(priceInCents / 100).toFixed(2)}`
}

/**
 * Formats a date string to a readable format
 * @param dateString - ISO date string
 * @returns Formatted date string (e.g., "Jan 15, 2024, 2:30 PM")
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return dateString
  }
}

/**
 * Formats a date string to a relative time string (e.g., "2 hours ago")
 * @param dateString - ISO date string
 * @returns Relative time string
 */
export function formatTimeAgo(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) {
      return "just now"
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60)
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? "s" : ""} ago`
    }

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`
    }

    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) {
      return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`
    }

    const diffInWeeks = Math.floor(diffInDays / 7)
    if (diffInWeeks < 4) {
      return `${diffInWeeks} week${diffInWeeks > 1 ? "s" : ""} ago`
    }

    const diffInMonths = Math.floor(diffInDays / 30)
    if (diffInMonths < 12) {
      return `${diffInMonths} month${diffInMonths > 1 ? "s" : ""} ago`
    }

    const diffInYears = Math.floor(diffInDays / 365)
    return `${diffInYears} year${diffInYears > 1 ? "s" : ""} ago`
  } catch {
    return dateString
  }
}

/**
 * Maps backend category to frontend display name
 * @param category - Backend category value
 * @returns Display category name
 */
export function mapCategoryToDisplay(category: string): DisplayCategory {
  return CATEGORY_TO_DISPLAY[category as BackendCategory] || "Other"
}

/**
 * Maps frontend display category name to backend category value
 * @param displayName - Frontend display category name
 * @returns Backend category value
 */
export function mapDisplayToCategory(displayName: string): BackendCategory {
  return DISPLAY_TO_CATEGORY[displayName as DisplayCategory] || "OTHER"
}

/**
 * Gets all available display categories (excluding TEST category)
 * @returns Array of display category names
 */
export function getDisplayCategories(): DisplayCategory[] {
  return ["Textbooks", "Electronics", "Furniture", "Non-Essential", "Other"]
}

/**
 * Gets all available backend categories (excluding TEST)
 * @returns Array of backend category values
 */
export function getBackendCategories(): BackendCategory[] {
  return ["TEXTBOOK", "GADGET", "ESSENTIAL", "NON-ESSENTIAL", "OTHER"]
}

// Backend status values
export type BackendStatus = "AVAILABLE" | "PENDING" | "SOLD" | "ARCHIVED" | "REPORTED"

// Frontend display status names
export type DisplayStatus = "Available" | "Pending" | "Sold" | "Archived" | "Reported" | "All"

// Status mapping from backend to frontend display
const STATUS_TO_DISPLAY: Record<BackendStatus, DisplayStatus> = {
  AVAILABLE: "Available",
  PENDING: "Pending",
  SOLD: "Sold",
  ARCHIVED: "Archived",
  REPORTED: "Reported",
}

// Reverse mapping from frontend display to backend
const DISPLAY_TO_STATUS: Record<DisplayStatus, BackendStatus | null> = {
  Available: "AVAILABLE",
  Pending: "PENDING",
  Sold: "SOLD",
  Archived: "ARCHIVED",
  Reported: "REPORTED",
  All: null, // "All" means no status filter
}

/**
 * Maps backend status to frontend display name
 * @param status - Backend status value
 * @returns Display status name
 */
export function mapStatusToDisplay(status: string): DisplayStatus {
  return STATUS_TO_DISPLAY[status as BackendStatus] || status
}

/**
 * Maps frontend display status name to backend status value
 * @param displayName - Frontend display status name
 * @returns Backend status value or null for "All"
 */
export function mapDisplayToStatus(displayName: string): BackendStatus | null {
  return DISPLAY_TO_STATUS[displayName as DisplayStatus] ?? null
}

/**
 * Gets all available display statuses
 * @returns Array of display status names
 */
export function getDisplayStatuses(): DisplayStatus[] {
  return ["All", "Available", "Pending", "Sold", "Archived", "Reported"]
}

/**
 * Converts dollars to cents for API requests
 * @param dollars - Price in dollars
 * @returns Price in cents
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

/**
 * Converts cents to dollars for display
 * @param cents - Price in cents
 * @returns Price in dollars
 */
export function centsToDollars(cents: number): number {
  return cents / 100
}

/**
 * Maps frontend sort option to backend sort parameter
 * @param sortOption - Frontend sort option ("recent", "price-low", "price-high")
 * @returns Backend sort parameter (empty string for default, "price_asc", or "price_desc")
 */
export function mapSortToBackend(sortOption: string): string {
  switch (sortOption) {
    case "recent":
      return "" // Empty means default (created_at DESC)
    case "price-low":
      return "price_asc"
    case "price-high":
      return "price_desc"
    default:
      return "" // Default to recent (created_at DESC)
  }
}

/**
 * Gets all available sort options
 * @returns Array of sort option objects with label and value
 */
export function getSortOptions(): Array<{ label: string; value: string }> {
  return [
    { label: "Most Recent", value: "recent" },
    { label: "Price: Low to High", value: "price-low" },
    { label: "Price: High to Low", value: "price-high" },
  ]
}

