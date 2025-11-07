package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"
	"github.com/kunal768/cmpe202/listing-service/internal/blob"
	"github.com/kunal768/cmpe202/listing-service/internal/gemini"
	"github.com/kunal768/cmpe202/listing-service/internal/listing"
	"github.com/kunal768/cmpe202/listing-service/internal/platform"
)

func main() {
	_ = godotenv.Load()
	ctx := context.Background()

	pool := platform.MustPGPool(ctx) // panic fast if DB is wrong
	defer pool.Close()

	// Repo Database Interface Layer being passed to the handler layer
	store := &listing.Store{P: pool}

	// --- Gemini AI Client ---
	aiClient := gemini.NewClient()
	blobClient, err := blob.GetServiceClientTokenCredential(os.Getenv("AZURE_ACCOUNT_URL"))
	blobService := blob.NewBlobService(
		blobClient,
		blob.AzureBlobCredentials{
			AccountName:   blob.CREDENTIAL(os.Getenv("AZURE_ACCOUNTNAME")),
			AccountKey:    blob.CREDENTIAL(os.Getenv("AZURE_ACCOUNTKEY")),
			ContainerName: blob.CREDENTIAL(os.Getenv("AZURE_CONTAINERNAME")),
		},
	)
	if err != nil {
		fmt.Println("error : ", err.Error())
		panic(err)
	}

	handlers := &listing.Handlers{S: store, AI: aiClient, BlobSvc: blobService}

	r := chi.NewRouter()
	r.Use(middleware.Logger) // <-- built-in logger

	r.Mount("/listings", listing.Routes(handlers))

	log.Println("listening on", getenv("LISTING_PORT", "8080"))

	addr := ":" + getenv("LISTING_PORT", "8080")
	srv := &http.Server{
		Addr:    addr,
		Handler: r,
	}

	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		panic(err)
	}

}

func getenv(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
