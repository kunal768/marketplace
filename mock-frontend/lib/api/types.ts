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

