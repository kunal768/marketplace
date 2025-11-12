# orchestrator/Dockerfile
FROM golang:1.23 AS builder

# Use a single consistent root
WORKDIR /app

# Copy minimal files first for caching
COPY http-lib/go.mod http-lib/go.sum ./http-lib/
COPY orchestrator/go.mod orchestrator/go.mod 
RUN cd orchestrator && go mod download

# Copy source code
COPY orchestrator/ ./orchestrator/
COPY http-lib/ ./http-lib/

WORKDIR /app/orchestrator

RUN go mod tidy

# Build
RUN go build -o /out/orchestrator ./cmd

# (optional) slim runtime stage
FROM gcr.io/distroless/base-debian12
COPY --from=builder /out/orchestrator /bin/orchestrator
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/bin/orchestrator"]
