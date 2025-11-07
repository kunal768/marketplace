package httplib

type ContextKey string

type UserRole string

const (
	ADMIN UserRole = "0" // admin
	USER  UserRole = "1" // buyer, seller both are same roles
)
