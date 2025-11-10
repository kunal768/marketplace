import type {
  SignupRequest,
  SignupResponse,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  ErrorResponse,
} from './types'
import { isTokenExpired } from '@/lib/utils/jwt'

const ORCHESTRATOR_URL = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || 'http://localhost:8080'

// Token refresh state management
let refreshPromise: Promise<string | null> | null = null
let refreshCallbacks: Array<{ resolve: (token: string | null) => void; reject: (error: Error) => void }> = []

/**
 * Refreshes the access token using the refresh token
 * Implements request queuing to prevent multiple simultaneous refresh calls
 */
async function refreshAccessToken(
  refreshToken: string,
  onTokenUpdate?: (newToken: string, newRefreshToken: string) => void
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
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })

      if (!response.ok) {
        const error: ErrorResponse = await response.json().catch(() => ({
          error: 'Unknown error',
          message: `HTTP ${response.status}: ${response.statusText}`,
        }))
        throw new Error(error.message || error.error || 'Token refresh failed')
      }

      const data: RefreshTokenResponse = await response.json()
      
      // Update tokens in callback (for useAuth hook to update localStorage)
      if (onTokenUpdate) {
        onTokenUpdate(data.access_token, data.refresh_token)
      }

      // Resolve all queued requests
      const token = data.access_token
      refreshCallbacks.forEach(cb => cb.resolve(token))
      refreshCallbacks = []

      return token
    } catch (error) {
      // Reject all queued requests
      const err = error instanceof Error ? error : new Error('Token refresh failed')
      refreshCallbacks.forEach(cb => cb.reject(err))
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
  retryRequest?: () => Promise<Response>
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
            return retryResponse.json()
          }
        }
      } catch (refreshError) {
        // Refresh failed, throw original error
        console.error('[API] Token refresh failed:', refreshError)
      }
    }

    const error: ErrorResponse = await response.json().catch(() => ({
      error: 'Unknown error',
      message: `HTTP ${response.status}: ${response.statusText}`,
    }))
    throw new Error(error.message || error.error || 'Request failed')
  }
  return response.json()
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
  if (typeof window === 'undefined') {
    return null
  }

  const token = localStorage.getItem('frontend-loginToken')
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
        console.error('[API] Failed to refresh expired token:', error)
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
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    return handleResponse<SignupResponse>(response, null)
  },

  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await fetch(`${ORCHESTRATOR_URL}/api/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    return handleResponse<LoginResponse>(response, null)
  },

  async refreshToken(data: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    const response = await fetch(`${ORCHESTRATOR_URL}/api/users/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    return handleResponse<RefreshTokenResponse>(response, null)
  },
}

