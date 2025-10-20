package config

import (
	"log"
	"os"
	"strconv"
)

type Config struct {
	RabbitMQURL       string
	RabbitMQQueueName string
	RedisAddr         string
	RedisPassword     string
	RedisDB           int
	MongoURI          string
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

func Load() Config {
	return Config{
		RabbitMQURL:       getenv("RABBITMQ_URL"),
		RabbitMQQueueName: getenv("RABBITMQ_QUEUE_NAME"),
		RedisAddr:         getenv("REDIS_ADDR"),
		RedisPassword:     getenv("REDIS_PASSWORD"),
		RedisDB:           getenvInt("REDIS_DB"),
		MongoURI:          getenv("MONGO_URI"),
	}
}
