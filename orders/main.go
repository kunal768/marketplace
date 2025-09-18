package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	http.HandleFunc("/orders", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "This is the Orders Service")
	})

	fmt.Println("Orders service starting on port 8081...")
	log.Fatal(http.ListenAndServe(":8081", nil))
}