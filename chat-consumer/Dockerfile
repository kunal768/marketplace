# ---------- build stage ----------
FROM golang:1.23 AS builder
WORKDIR /app

COPY chat-consumer/go.mod chat-consumer/go.sum ./
RUN go mod download

COPY chat-consumer/ ./

RUN go mod tidy

RUN CGO_ENABLED=0 GOOS=linux go build -o /out/chat-consumer ./cmd

# ---------- runtime stage ----------
FROM gcr.io/distroless/static-debian12
COPY --from=builder /out/chat-consumer /bin/chat-consumer

COPY .env ./.env
ENTRYPOINT ["/bin/chat-consumer"]
