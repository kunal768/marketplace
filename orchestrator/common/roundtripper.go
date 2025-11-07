package common

import (
	"net/http"
)

// defaultHeaderTransport implements the http.RoundTripper interface
type DefaultHeaderTransport struct {
	// Header is the set of headers to add to every request
	Header http.Header
	// Transport is the underlying http.RoundTripper to call after adding headers
	Transport http.RoundTripper
}

// RoundTrip executes a single HTTP transaction.
func (t *DefaultHeaderTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// Add the default headers to the request
	for key, values := range t.Header {
		for _, value := range values {
			req.Header.Add(key, value)
		}
	}
	// Use the underlying transport to execute the request
	return t.Transport.RoundTrip(req)
}
