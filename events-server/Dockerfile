# ---------- Build ----------
FROM golang:1.23 AS builder
WORKDIR /app

# Copy minimal files first for caching
COPY http-lib/go.mod http-lib/go.sum ./http-lib/
COPY events-server/go.mod events-server/go.sum ./events-server/
RUN cd events-server && go mod download

# Copy source code
COPY events-server/ ./events-server/
COPY http-lib/ ./http-lib/

# Placed since the code explictly calls for an .env file or log.fatal
COPY events-server/.env ./events-server/.env

WORKDIR /app/events-server

RUN go mod tidy

# 3) Build
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/events-server ./cmd


# ---------- Runtime ----------
FROM gcr.io/distroless/static-debian12
COPY --from=builder /out/events-server /bin/events-server

COPY .env ./.env

EXPOSE 8001
ENV PORT=":8001"
ENTRYPOINT ["/bin/events-server"]
