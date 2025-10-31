# ---------- Stage 1: Build ----------
FROM golang:1.23 AS builder
WORKDIR /app

# Copy minimal files first for caching
COPY go.work ./
COPY http-lib/go.mod http-lib/go.mod
COPY listing-service/go.mod listing-service/go.mod
COPY orchestrator/go.mod orchestrator/go.mod 
RUN go work sync && cd listing-service && go mod download

# Copy source code
COPY http-lib/ http-lib/
COPY listing-service/ listing-service/

# Build from cmd/api
ENV CGO_ENABLED=0
RUN mkdir -p /out && go build -o /out/listing-service ./listing-service/cmd/api

# ---------- Stage 2: Runtime ----------
FROM gcr.io/distroless/static-debian12
COPY --from=builder /out/listing-service /bin/listing-service
EXPOSE 8080
ENTRYPOINT ["/bin/listing-service"]
