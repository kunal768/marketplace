# ---------- Stage 1: Build ----------
FROM golang:1.23 AS builder
WORKDIR /app

# Copy minimal files first for caching
COPY http-lib/go.mod http-lib/go.sum ./http-lib/
COPY listing-service/go.mod listing-service/go.sum ./listing-service/
RUN cd listing-service && go mod download

# Copy source code
COPY listing-service/ ./listing-service/
COPY http-lib/ ./http-lib/

WORKDIR /app/listing-service

RUN go mod tidy

# Build from cmd/api
ENV CGO_ENABLED=0
RUN mkdir -p /out && go build -o /out/listing-service ./cmd

# ---------- Stage 2: Runtime ----------
FROM gcr.io/distroless/static-debian12
COPY --from=builder /out/listing-service /bin/listing-service
EXPOSE 8081
ENTRYPOINT ["/bin/listing-service"]
