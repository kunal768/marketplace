import type {
  SignupRequest,
  SignupResponse,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  ErrorResponse,
  User,
  FetchFlaggedListingsResponse,
  FlagStatus,
  FetchAllListingsRequest,
  FetchAllListingsResponse,
  Listing,
  FlagListingRequest,
  FlagListingResponse,
  FlagReason,
} from "./types"
import { isTokenExpired } from "@/lib/utils/jwt"

const ORCHESTRATOR_URL = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || "http://localhost:8080"

// Token refresh state management
let refreshPromise: Promise<string | null> | null = null
let refreshCallbacks: Array<{ resolve: (token: string | null) => void; reject: (error: Error) => void }> = []

/**
 * Refreshes the access token using the refresh token
 * Implements request queuing to prevent multiple simultaneous refresh calls
 */
async function refreshAccessToken(
  refreshToken: string,
  onTokenUpdate?: (newToken: string, newRefreshToken: string) => void,
): Promise<string | null> {
  // If refresh is already in progress, queue this request
  if (refreshPromise) {
    return new Promise((resolve, reject) => {
      refreshCallbacks.push({ resolve, reject })
    })
  }

  // Start refresh process
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${ORCHESTRATOR_URL}/api/users/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })

      if (!response.ok) {
        const error: ErrorResponse = await response.json().catch(() => ({
          error: "Unknown error",
          message: `HTTP ${response.status}: ${response.statusText}`,
        }))
        throw new Error(error.message || error.error || "Token refresh failed")
      }

      const data: RefreshTokenResponse = await response.json()

      // Update tokens in callback (for useAuth hook to update localStorage)
      if (onTokenUpdate) {
        onTokenUpdate(data.access_token, data.refresh_token)
      }

      // Resolve all queued requests
      const token = data.access_token
      refreshCallbacks.forEach((cb) => cb.resolve(token))
      refreshCallbacks = []

      return token
    } catch (error) {
      // Reject all queued requests
      const err = error instanceof Error ? error : new Error("Token refresh failed")
      refreshCallbacks.forEach((cb) => cb.reject(err))
      refreshCallbacks = []
      throw err
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

/**
 * Handles HTTP response with automatic token refresh on 401
 */
async function handleResponse<T>(
  response: Response,
  refreshToken: string | null,
  onTokenUpdate?: (newToken: string, newRefreshToken: string) => void,
  retryRequest?: () => Promise<Response>,
): Promise<T> {
  if (!response.ok) {
    // If 401 and we have a refresh token, try to refresh
    if (response.status === 401 && refreshToken) {
      try {
        const newToken = await refreshAccessToken(refreshToken, onTokenUpdate)
        if (newToken && retryRequest) {
          // Retry the original request with new token
          const retryResponse = await retryRequest()
          if (retryResponse.ok) {
            const text = await retryResponse.text()
            if (!text) {
              throw new Error("Empty response from server")
            }
            try {
              return JSON.parse(text) as T
            } catch (parseError) {
              throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`)
            }
          }
        }
      } catch (refreshError) {
        // Refresh failed, throw original error
        console.error("[API] Token refresh failed:", refreshError)
      }
    }

    // Try to parse error response, but handle empty or invalid JSON gracefully
    let error: ErrorResponse
    try {
      const text = await response.text()
      if (text) {
        try {
          error = JSON.parse(text)
        } catch {
          error = {
            error: "Parse Error",
            message: `HTTP ${response.status}: ${response.statusText}. Response: ${text.substring(0, 100)}`,
          }
        }
      } else {
        error = {
          error: "Unknown error",
          message: `HTTP ${response.status}: ${response.statusText}`,
        }
      }
    } catch {
      error = {
        error: "Unknown error",
        message: `HTTP ${response.status}: ${response.statusText}`,
      }
    }
    throw new Error(error.message || error.error || "Request failed")
  }
  
  // Parse successful response
  const text = await response.text()
  if (!text) {
    throw new Error("Empty response from server")
  }
  try {
    return JSON.parse(text) as T
  } catch (parseError) {
    throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`)
  }
}

// Export refresh function for use in hooks
export { refreshAccessToken }

// Token update callback storage (set by useAuth)
let tokenUpdateCallback: ((newToken: string, newRefreshToken: string) => void) | null = null

export function setTokenUpdateCallback(callback: (newToken: string, newRefreshToken: string) => void) {
  tokenUpdateCallback = callback
}

/**
 * Gets the current token from localStorage (for use in API calls)
 * Checks expiration and refreshes if needed
 */
async function getValidToken(refreshToken: string | null): Promise<string | null> {
  if (typeof window === "undefined") {
    return null
  }

  const token = localStorage.getItem("frontend-loginToken")
  if (!token) {
    return null
  }

  // Check if token is expired or expiring soon (5 minute buffer)
  if (isTokenExpired(token, 300)) {
    if (refreshToken) {
      try {
        const newToken = await refreshAccessToken(refreshToken, tokenUpdateCallback || undefined)
        return newToken
      } catch (error) {
        console.error("[API] Failed to refresh expired token:", error)
        return null
      }
    }
    return null
  }

  return token
}

export const orchestratorApi = {
  async signup(data: SignupRequest): Promise<SignupResponse> {
    const response = await fetch(`${ORCHESTRATOR_URL}/api/users/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
    return handleResponse<SignupResponse>(response, null)
  },

  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await fetch(`${ORCHESTRATOR_URL}/api/users/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
    return handleResponse<LoginResponse>(response, null)
  },

  async refreshToken(data: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    const response = await fetch(`${ORCHESTRATOR_URL}/api/users/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
    return handleResponse<RefreshTokenResponse>(response, null)
  },

  async getConversations(token: string, refreshToken: string | null): Promise<{ conversations: any[]; total: number }> {
    const validToken = (await getValidToken(refreshToken)) || token

    const makeRequest = () =>
      fetch(`${ORCHESTRATOR_URL}/api/chat/conversations`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${validToken}`,
          "Content-Type": "application/json",
        },
      })

    const response = await makeRequest()

    return handleResponse<{ conversations: any[]; total: number }>(
      response,
      refreshToken,
      tokenUpdateCallback || undefined,
      async () => {
        const newToken = await getValidToken(refreshToken)
        return fetch(`${ORCHESTRATOR_URL}/api/chat/conversations`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${newToken || validToken}`,
            "Content-Type": "application/json",
          },
        })
      },
    )
  },

  async getMessages(
    token: string,
    refreshToken: string | null,
    otherUserId: string,
  ): Promise<{ messages: any[]; count: number }> {
    const validToken = (await getValidToken(refreshToken)) || token

    const makeRequest = () =>
      fetch(`${ORCHESTRATOR_URL}/api/chat/messages/${otherUserId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${validToken}`,
          "Content-Type": "application/json",
        },
      })

    const response = await makeRequest()

    return handleResponse<{ messages: any[]; count: number }>(
      response,
      refreshToken,
      tokenUpdateCallback || undefined,
      async () => {
        const newToken = await getValidToken(refreshToken)
        return fetch(`${ORCHESTRATOR_URL}/api/chat/messages/${otherUserId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${newToken || validToken}`,
            "Content-Type": "application/json",
          },
        })
      },
    )
  },

  async getConversationsWithUndeliveredCount(token: string, refreshToken: string | null): Promise<{ count: number }> {
    const validToken = (await getValidToken(refreshToken)) || token

    const makeRequest = () =>
      fetch(`${ORCHESTRATOR_URL}/api/chat/conversations-with-undelivered-count`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${validToken}`,
          "Content-Type": "application/json",
        },
      })

    const response = await makeRequest()

    return handleResponse<{ count: number }>(response, refreshToken, tokenUpdateCallback || undefined, async () => {
      const newToken = await getValidToken(refreshToken)
      return fetch(`${ORCHESTRATOR_URL}/api/chat/conversations-with-undelivered-count`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${newToken || validToken}`,
          "Content-Type": "application/json",
        },
      })
    })
  },

  async searchUsers(token: string, refreshToken: string | null, query: string): Promise<{ users: User[]; page: number; limit: number; hasMore: boolean }> {
    const validToken = (await getValidToken(refreshToken)) || token

    const makeRequest = () =>
      fetch(`${ORCHESTRATOR_URL}/api/users/search?q=${encodeURIComponent(query)}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${validToken}`,
          "Content-Type": "application/json",
        },
      })

    const response = await makeRequest()

    return handleResponse<{ users: User[]; page: number; limit: number; hasMore: boolean }>(response, refreshToken, tokenUpdateCallback || undefined, async () => {
      const newToken = await getValidToken(refreshToken)
      return fetch(`${ORCHESTRATOR_URL}/api/users/search?q=${encodeURIComponent(query)}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${newToken || validToken}`,
          "Content-Type": "application/json",
        },
      })
    })
  },

  async getFlaggedListings(
    token: string,
    refreshToken: string | null,
    status?: FlagStatus,
  ): Promise<FetchFlaggedListingsResponse> {
    const validToken = (await getValidToken(refreshToken)) || token

    const url = status
      ? `${ORCHESTRATOR_URL}/api/listings/flagged?status=${encodeURIComponent(status)}`
      : `${ORCHESTRATOR_URL}/api/listings/flagged`

    const makeRequest = () =>
      fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${validToken}`,
          "Content-Type": "application/json",
        },
      })

    const response = await makeRequest()

    // Handle 404 specifically
    if (response.status === 404) {
      throw new Error("Flagged listings endpoint not found. Please check if the backend service is running.")
    }

    return handleResponse<FetchFlaggedListingsResponse>(
      response,
      refreshToken,
      tokenUpdateCallback || undefined,
      async () => {
        const newToken = await getValidToken(refreshToken)
        const retryResponse = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${newToken || validToken}`,
            "Content-Type": "application/json",
          },
        })
        if (retryResponse.status === 404) {
          throw new Error("Flagged listings endpoint not found. Please check if the backend service is running.")
        }
        return retryResponse
      },
    )
  },

  async getAllListings(
    token: string,
    refreshToken: string | null,
    filters?: FetchAllListingsRequest,
  ): Promise<FetchAllListingsResponse> {
    const validToken = (await getValidToken(refreshToken)) || token

    // Build query string from filters
    const params = new URLSearchParams()
    if (filters?.keywords) {
      params.set("keywords", filters.keywords)
    }
    if (filters?.category) {
      params.set("category", filters.category)
    }
    if (filters?.status) {
      params.set("status", filters.status)
    }
    if (filters?.min_price !== undefined) {
      params.set("min_price", filters.min_price.toString())
    }
    if (filters?.max_price !== undefined) {
      params.set("max_price", filters.max_price.toString())
    }
    if (filters?.limit !== undefined) {
      params.set("limit", filters.limit.toString())
    }
    if (filters?.offset !== undefined) {
      params.set("offset", filters.offset.toString())
    }
    if (filters?.sort) {
      params.set("sort", filters.sort)
    }

    const url = `${ORCHESTRATOR_URL}/api/listings${params.toString() ? `?${params.toString()}` : ""}`

    const makeRequest = () =>
      fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${validToken}`,
          "Content-Type": "application/json",
        },
      })

    const response = await makeRequest()

    return handleResponse<FetchAllListingsResponse>(
      response,
      refreshToken,
      tokenUpdateCallback || undefined,
      async () => {
        const newToken = await getValidToken(refreshToken)
        return fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${newToken || validToken}`,
            "Content-Type": "application/json",
          },
        })
      },
    )
  },

  async getListingById(token: string, refreshToken: string | null, listingId: number): Promise<Listing> {
    const validToken = (await getValidToken(refreshToken)) || token

    const url = `${ORCHESTRATOR_URL}/api/listings/${listingId}`

    const makeRequest = () =>
      fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${validToken}`,
          "Content-Type": "application/json",
        },
      })

    const response = await makeRequest()

    // Handle 404 specifically for listing not found
    if (response.status === 404) {
      throw new Error("Listing not found")
    }

    // Response format is Listing (embedded field flattens in JSON)
    return handleResponse<Listing>(
      response,
      refreshToken,
      tokenUpdateCallback || undefined,
      async () => {
        const newToken = await getValidToken(refreshToken)
        const retryResponse = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${newToken || validToken}`,
            "Content-Type": "application/json",
          },
        })
        if (retryResponse.status === 404) {
          throw new Error("Listing not found")
        }
        return retryResponse
      },
    )
  },

  /**
   * Flag a listing
   * @param token - Access token
   * @param refreshToken - Refresh token
   * @param listingId - Listing ID to flag
   * @param reason - Flag reason
   * @param details - Optional details
   * @param tokenUpdateCallback - Optional callback for token updates
   * @returns Flagged listing response
   */
  async flagListing(
    token: string,
    refreshToken: string,
    listingId: number,
    reason: FlagReason,
    details?: string,
    tokenUpdateCallback?: (newToken: string, newRefreshToken: string) => void,
  ): Promise<FlagListingResponse> {
    const validToken = isTokenExpired(token) ? await getValidToken(refreshToken) : token
    if (!validToken) {
      throw new Error("Authentication required")
    }

    const url = `${ORCHESTRATOR_URL}/api/listings/flag/${listingId}`
    const body: FlagListingRequest = {
      listing_id: listingId,
      reason,
      details,
    }

    const makeRequest = () =>
      fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${validToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

    const response = await makeRequest()

    if (response.status === 401) {
      // Token expired, refresh and retry
      const newToken = await getValidToken(refreshToken)
      if (!newToken) {
        throw new Error("Authentication failed")
      }
      const retryResponse = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${newToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })
      return handleResponse<FlagListingResponse>(
        retryResponse,
        refreshToken,
        tokenUpdateCallback || undefined,
        async () => {
          const retryToken = await getValidToken(refreshToken)
          return fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${retryToken || newToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          })
        },
      )
    }

    return handleResponse<FlagListingResponse>(
      response,
      refreshToken,
      tokenUpdateCallback || undefined,
      async () => {
        const newToken = await getValidToken(refreshToken)
        return fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${newToken || validToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        })
      },
    )
  },
}
