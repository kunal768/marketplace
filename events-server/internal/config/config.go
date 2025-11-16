package config

import (
	"log"
	"os"
	"strconv"
)

type Config struct {
	Port                string
	OrchestratorBaseURL string
	RedisAddr           string
	RedisPassword       string
	RedisDB             int
	PresenceTTLSeconds  int
	SkipAuth            bool
	RabbitMQURL         string
	RabbitMQQueueName   string
}

func getenv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("Required environment variable %s is not set", key)
	}
	return v
}

func getenvInt(key string) int {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("Required environment variable %s is not set", key)
	}
	i, err := strconv.Atoi(v)
	if err != nil {
		log.Fatalf("Environment variable %s must be a valid integer, got: %s", key, v)
	}
	return i
}

func getenvBool(key string) bool {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("Required environment variable %s is not set", key)
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		log.Fatalf("Environment variable %s must be a valid boolean, got: %s", key, v)
	}
	return b
}

// getenvOptional returns the environment variable value, allowing empty strings
func getenvOptional(key string) string {
	return os.Getenv(key)
}

func Load() Config {
	return Config{
		Port:                getenv("PORT"),
		OrchestratorBaseURL: getenv("ORCH_BASE_URL"),
		RedisAddr:           getenv("REDIS_ADDR"),
		RedisPassword:       getenvOptional("REDIS_PASSWORD"), // Optional: empty password is valid for Redis
		RedisDB:             getenvInt("REDIS_DB"),
		PresenceTTLSeconds:  getenvInt("PRESENCE_TTL_SECONDS"),
		RabbitMQURL:         getenv("RABBITMQ_URL"),
		RabbitMQQueueName:   getenv("RABBITMQ_QUEUE_NAME"),
	}
}
