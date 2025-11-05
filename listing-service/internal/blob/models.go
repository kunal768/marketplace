package blob

type CREDENTIAL string

type AzureBlobCredentials struct {
	AccountName   CREDENTIAL
	AccountKey    CREDENTIAL
	ContainerName CREDENTIAL
}

type UploadSASResponse struct {
	SASURL             string
	PermanentPublicURL string
	BlobName           string
}
