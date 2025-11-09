/**
 * JWT utility functions for token management
 * Following PWA best practices for JWT handling
 */

interface JWTPayload {
  exp?: number
  iat?: number
  userId?: string
  [key: string]: any
}

/**
 * Decodes a JWT token without verification (client-side only)
 * Used to check expiration before making requests
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    const payload = parts[1]
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded) as JWTPayload
  } catch (error) {
    console.error('[JWT] Failed to decode token:', error)
    return null
  }
}

/**
 * Checks if a JWT token is expired
 * Returns true if token is expired or will expire within bufferSeconds
 */
export function isTokenExpired(token: string, bufferSeconds: number = 300): boolean {
  const payload = decodeJWT(token)
  if (!payload || !payload.exp) {
    // If we can't decode or no exp claim, consider it expired for safety
    return true
  }

  const expirationTime = payload.exp * 1000 // Convert to milliseconds
  const currentTime = Date.now()
  const bufferTime = bufferSeconds * 1000

  // Token is expired if current time + buffer >= expiration time
  return currentTime + bufferTime >= expirationTime
}

/**
 * Gets the expiration time of a JWT token in milliseconds
 * Returns null if token cannot be decoded or has no exp claim
 */
export function getTokenExpiration(token: string): number | null {
  const payload = decodeJWT(token)
  if (!payload || !payload.exp) {
    return null
  }
  return payload.exp * 1000 // Convert to milliseconds
}

/**
 * Gets the current user ID from the JWT token stored in localStorage
 */
export function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const token = localStorage.getItem('mock-frontend-loginToken')
  if (!token) {
    return null
  }

  const payload = decodeJWT(token)
  return payload?.userId || null
}

