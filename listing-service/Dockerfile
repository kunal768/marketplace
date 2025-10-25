# ---------- Stage 1: Build ----------
FROM golang:1.22 AS builder

# Set working directory inside the container
WORKDIR /app

# Copy go.mod and go.sum first (to cache deps)
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the rest of the code
COPY . .

# Build the Go binary (static, smaller)
RUN CGO_ENABLED=0 GOOS=linux go build -o listing-service ./cmd/api

# ---------- Stage 2: Run ----------
FROM alpine:latest

# Create working directory
WORKDIR /app

# Copy the compiled binary from the builder stage
COPY --from=builder /app/listing-service .

# Expose the service port
EXPOSE 8080

# Run the binary
CMD ["./listing-service"]
