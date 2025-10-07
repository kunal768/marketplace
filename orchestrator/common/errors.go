package common

import (
	"errors"
	"fmt"
)

// Predefined sentinel errors for common flows
var (
	ErrUserNotFound       = errors.New("user not found")
	ErrUserAlreadyExists  = errors.New("user already exists")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrTokenExpired       = errors.New("token expired")
	ErrTokenInvalid       = errors.New("token invalid")
	ErrValidation         = errors.New("validation error")
	ErrBadRequest         = errors.New("bad request")
	ErrConflict           = errors.New("conflict")
)

// status codes
const (
	StatusOK                  = 200
	StatusCreated             = 201
	StatusBadRequest          = 400
	StatusUnauthorized        = 401
	StatusForbidden           = 403
	StatusNotFound            = 404
	StatusConflict            = 409
	StatusUnprocessableEntity = 422
	StatusInternalServerError = 500
)

// AppError is a structured application error with an HTTP mapping
type AppError struct {
	Code       string // machine-friendly error code, e.g. USER_NOT_FOUND
	Message    string // human-friendly description
	HTTPStatus int    // mapped HTTP status code
	Err        error  // underlying cause (optional)
}

func (e *AppError) Error() string {
	if e == nil {
		return "<nil>"
	}
	if e.Err != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Err)
	}
	return e.Message
}

func (e *AppError) Unwrap() error { return e.Err }

// NewAppError creates a new AppError
func NewAppError(code string, httpStatus int, msg string, err error) *AppError {
	return &AppError{Code: code, Message: msg, HTTPStatus: httpStatus, Err: err}
}

// Convenience constructors for common errors
func ErrUserNotFoundApp(err error) *AppError {
	return NewAppError("USER_NOT_FOUND", StatusNotFound, "User not found", coalesce(err, ErrUserNotFound))
}

func ErrUserExistsApp(err error) *AppError {
	return NewAppError("USER_ALREADY_EXISTS", StatusConflict, "User already exists", coalesce(err, ErrUserAlreadyExists))
}

func ErrInvalidCredsApp(err error) *AppError {
	return NewAppError("INVALID_CREDENTIALS", StatusUnauthorized, "Invalid email or password", coalesce(err, ErrInvalidCredentials))
}

func ErrTokenExpiredApp(err error) *AppError {
	return NewAppError("TOKEN_EXPIRED", StatusUnauthorized, "Token expired", coalesce(err, ErrTokenExpired))
}

func ErrTokenInvalidApp(err error) *AppError {
	return NewAppError("TOKEN_INVALID", StatusUnauthorized, "Token invalid", coalesce(err, ErrTokenInvalid))
}

func ErrValidationApp(message string, err error) *AppError {
	if message == "" {
		message = "Validation error"
	}
	return NewAppError("VALIDATION_ERROR", StatusBadRequest, message, coalesce(err, ErrValidation))
}

func ErrBadRequestApp(message string, err error) *AppError {
	if message == "" {
		message = "Bad request"
	}
	return NewAppError("BAD_REQUEST", StatusBadRequest, message, coalesce(err, ErrBadRequest))
}

func ErrInternalApp(err error) *AppError {
	return NewAppError("INTERNAL_SERVER_ERROR", StatusInternalServerError, "Internal server error", err)
}

// coalesce returns the first non-nil error
func coalesce(primary error, fallback error) error {
	if primary != nil {
		return primary
	}
	return fallback
}

// MapToHTTPStatus attempts to map any error to an HTTP status code. If the
// error is an AppError, its HTTPStatus is returned. Otherwise we try to map
// known sentinel errors; if no mapping exists, 500 is returned.
func MapToHTTPStatus(err error) int {
	if err == nil {
		return StatusOK
	}
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.HTTPStatus
	}
	// Map known errors
	switch {
	case errors.Is(err, ErrUserNotFound):
		return StatusNotFound
	case errors.Is(err, ErrUserAlreadyExists):
		return StatusConflict
	case errors.Is(err, ErrInvalidCredentials):
		return StatusUnauthorized
	case errors.Is(err, ErrTokenExpired), errors.Is(err, ErrTokenInvalid):
		return StatusUnauthorized
	default:
		return StatusInternalServerError
	}
}
