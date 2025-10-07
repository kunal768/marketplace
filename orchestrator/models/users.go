package models

import "time"

type UserRole int

const (
	ADMIN UserRole = 0 // admin
	USER  UserRole = 1 // buyer, seller both are same roles
)

type Contact struct {
	Email string
	Phone string
}

// User contains all user details except authentication credentials
type User struct {
	UserId    string    `json:"user_id" db:"user_id"`
	UserName  string    `json:"user_name" db:"user_name"`
	Email     string    `json:"email" db:"email"`
	Role      UserRole  `json:"role" db:"role"`
	Contact   Contact   `json:"contact" db:"contact"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// UserAuth contains static authentication details (password)
type UserAuth struct {
	UserId    string    `json:"user_id" db:"user_id"`
	Password  string    `json:"-" db:"password"` // Hidden from JSON responses
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// UserLoginAuth contains current login session details (tokens)
type UserLoginAuth struct {
	UserId       string    `json:"user_id" db:"user_id"`
	AccessToken  string    `json:"-" db:"access_token"`  // Hidden from JSON responses
	RefreshToken string    `json:"-" db:"refresh_token"` // Hidden from JSON responses
	ExpiresAt    time.Time `json:"expires_at" db:"expires_at"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}
