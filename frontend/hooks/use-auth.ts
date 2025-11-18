import { useState, useCallback, useEffect, useRef } from 'react'
import { orchestratorApi, refreshAccessToken, setTokenUpdateCallback } from '@/lib/api/orchestrator'
import { isTokenExpired } from '@/lib/utils/jwt'
import type { User, LoginResponse, SignupResponse } from '@/lib/api/types'

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
}

const STORAGE_KEYS = {
  USER: 'frontend-user',
  USER_ID: 'frontend-userId',
  TOKEN: 'frontend-loginToken',
  REFRESH_TOKEN: 'frontend-refreshToken',
}

export function useAuth() {
  // Always start with unauthenticated state to avoid hydration mismatch
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
  })
  const [isHydrated, setIsHydrated] = useState(false)
  const refreshInProgressRef = useRef(false)

  // Set up token update callback for automatic token refresh
  useEffect(() => {
    setTokenUpdateCallback((newToken: string, newRefreshToken: string) => {
      // Update localStorage
      localStorage.setItem(STORAGE_KEYS.TOKEN, newToken)
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken)
      
      // Update state
      setAuthState(prev => ({
        ...prev,
        token: newToken,
        refreshToken: newRefreshToken,
      }))
      
      console.log('[useAuth] Tokens refreshed and updated')
    })
  }, [])

  // Hydrate from localStorage only on client after mount
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const userStr = localStorage.getItem(STORAGE_KEYS.USER)
    const userId = localStorage.getItem(STORAGE_KEYS.USER_ID)
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)

    // Ensure we have all required fields: userId, token, and user object
    if (token && userId && userStr) {
      try {
        // Check if token is expired before hydrating
        if (isTokenExpired(token, 0)) {
          console.debug('[useAuth] Token expired, clearing credentials')
          // Clear expired tokens
          localStorage.removeItem(STORAGE_KEYS.USER)
          localStorage.removeItem(STORAGE_KEYS.USER_ID)
          localStorage.removeItem(STORAGE_KEYS.TOKEN)
          localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
          setIsHydrated(true)
          return
        }
        
        const user = JSON.parse(userStr)
        // Verify userId matches (API returns user_id, not id)
        if (user.user_id !== userId) {
          console.warn('User ID mismatch, using stored userId')
          user.user_id = userId
        }
        setAuthState({
          user,
          token,
          refreshToken,
          isAuthenticated: true,
        })
        console.log('[useAuth] Hydrated from localStorage:', { userId, hasToken: !!token })
      } catch (error) {
        console.error('Failed to parse user from localStorage:', error)
        // Clear invalid data
        localStorage.removeItem(STORAGE_KEYS.USER)
        localStorage.removeItem(STORAGE_KEYS.USER_ID)
        localStorage.removeItem(STORAGE_KEYS.TOKEN)
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
      }
    } else {
      console.log('[useAuth] No stored credentials found:', { hasUser: !!userStr, hasUserId: !!userId, hasToken: !!token })
    }
    setIsHydrated(true)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response: LoginResponse = await orchestratorApi.login({ email, password })
      const newState = {
        user: response.user,
        token: response.token,
        refreshToken: response.refresh_token,
        isAuthenticated: true,
      }
      setAuthState(newState)
      // Store all required fields explicitly
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user))
      localStorage.setItem(STORAGE_KEYS.USER_ID, response.user.user_id)
      localStorage.setItem(STORAGE_KEYS.TOKEN, response.token)
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refresh_token)
      console.log('[useAuth] Stored credentials after login:', { userId: response.user.user_id, hasToken: !!response.token })
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Login failed' }
    }
  }, [])

  const signup = useCallback(async (userName: string, email: string, password: string) => {
    try {
      const response: SignupResponse = await orchestratorApi.signup({
        user_name: userName,
        email,
        password
      })
      const newState = {
        user: response.user,
        token: response.token,
        refreshToken: response.refresh_token,
        isAuthenticated: true,
      }
      setAuthState(newState)
      // Store all required fields explicitly
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user))
      localStorage.setItem(STORAGE_KEYS.USER_ID, response.user.user_id)
      localStorage.setItem(STORAGE_KEYS.TOKEN, response.token)
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refresh_token)
      console.log('[useAuth] Stored credentials after signup:', { userId: response.user.user_id, hasToken: !!response.token })
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Signup failed' }
    }
  }, [])

  const getRefreshedToken = useCallback(async (): Promise<string | null> => {
    if (refreshInProgressRef.current) {
      // Wait for ongoing refresh
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!refreshInProgressRef.current) {
            clearInterval(checkInterval)
            const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
            resolve(token)
          }
        }, 100)
      })
    }

    const currentRefreshToken = authState.refreshToken || localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)
    if (!currentRefreshToken) {
      console.error('[useAuth] No refresh token available')
      return null
    }

    refreshInProgressRef.current = true
    try {
      const newToken = await refreshAccessToken(currentRefreshToken, (newToken, newRefreshToken) => {
        // Update localStorage
        localStorage.setItem(STORAGE_KEYS.TOKEN, newToken)
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken)
        
        // Update state
        setAuthState(prev => ({
          ...prev,
          token: newToken,
          refreshToken: newRefreshToken,
        }))
      })

      return newToken
    } catch (error) {
      console.error('[useAuth] Token refresh failed:', error)
      // If refresh token is expired, logout user
      logout()
      return null
    } finally {
      refreshInProgressRef.current = false
    }
  }, [authState.refreshToken])

  const logout = useCallback(() => {
    // Import dynamically to avoid circular dependency
    import('@/lib/websocket/manager').then(({ disconnectGlobalWebSocket }) => {
      disconnectGlobalWebSocket()
    }).catch(() => {
      // Ignore if module not available
    })
    
    setAuthState({ user: null, token: null, refreshToken: null, isAuthenticated: false })
    localStorage.removeItem(STORAGE_KEYS.USER)
    localStorage.removeItem(STORAGE_KEYS.USER_ID)
    localStorage.removeItem(STORAGE_KEYS.TOKEN)
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
  }, [])

  // Helper to check if token is expired
  const isTokenExpiredHelper = useCallback((token: string | null): boolean => {
    if (!token) return true
    return isTokenExpired(token, 300) // 5 minute buffer
  }, [])

  return {
    ...authState,
    isHydrated,
    login,
    signup,
    logout,
    getRefreshedToken,
    isTokenExpired: isTokenExpiredHelper,
  }
}

