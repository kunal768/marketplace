package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	http.HandleFunc("/payments", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "This is the Payments Service")
	})

	fmt.Println("Payments service starting on port 8082...")
	log.Fatal(http.ListenAndServe(":8082", nil))
}
