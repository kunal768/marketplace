# orchestrator/Dockerfile
FROM golang:1.23 AS build

# Use a single consistent root
WORKDIR /app

# Copy minimal files first for caching
COPY go.work ./
COPY http-lib/go.mod http-lib/go.mod
COPY listing-service/go.mod listing-service/go.mod
COPY orchestrator/go.mod orchestrator/go.mod 
RUN go work sync && cd listing-service && go mod download

# Copy source code
COPY http-lib/ http-lib/
COPY orchestrator/ orchestrator/

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
