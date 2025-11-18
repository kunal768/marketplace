import type { ListingMedia } from "@/lib/api/types"

// In-memory cache for media URLs keyed by listing ID
const mediaCache = new Map<number, ListingMedia[]>()

/**
 * Get cached media URLs for a listing
 * @param listingId - Listing ID
 * @returns Cached media URLs or null if not cached
 */
export function getCachedMedia(listingId: number): ListingMedia[] | null {
  return mediaCache.get(listingId) || null
}

/**
 * Set cached media URLs for a listing
 * @param listingId - Listing ID
 * @param media - Array of media URLs
 */
export function setCachedMedia(listingId: number, media: ListingMedia[]): void {
  mediaCache.set(listingId, media)
}

/**
 * Invalidate cache for a listing (remove from cache)
 * @param listingId - Listing ID
 */
export function invalidateMediaCache(listingId: number): void {
  mediaCache.delete(listingId)
}

/**
 * Clear all media cache
 */
export function clearMediaCache(): void {
  mediaCache.clear()
}

