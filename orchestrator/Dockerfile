# orchestrator/Dockerfile
FROM golang:1.23 AS build

# Use a single consistent root
WORKDIR /app

# Copy both modules (full dirs) BEFORE go mod download so the local replace path exists
# IMPORTANT: build context must be the repo root in docker compose
COPY orchestrator/ ./orchestrator/
COPY http-lib/     ./http-lib/
COPY orchestrator/.env ./orchestrator/.env

# Now run mod download from inside orchestrator
WORKDIR /app/orchestrator
RUN go mod download

# Build
RUN go build -o /bin/orchestrator ./cmd

# (optional) slim runtime stage
FROM gcr.io/distroless/base-debian12
COPY --from=build /bin/orchestrator /orchestrator
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/orchestrator"]
