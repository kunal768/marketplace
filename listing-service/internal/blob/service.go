package blob

import (
	"context"
	"fmt"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/sas"
)

type svc struct {
	client *azblob.Client
	creds  AzureBlobCredentials
}

type BlobService interface {
	GenerateUploadSAS(ctx context.Context, blobName string) (UploadSASResponse, error)
}

func NewBlobService(client *azblob.Client, credentials AzureBlobCredentials) BlobService {
	return &svc{
		client: client,
		creds:  credentials,
	}
}

func (svc *svc) GenerateUploadSAS(ctx context.Context, blobName string) (UploadSASResponse, error) {

	// 1. Create a SharedKeyCredential to sign the SAS token Note Valet Key pattern
	cred, err := azblob.NewSharedKeyCredential(string(svc.creds.AccountName), string(svc.creds.AccountKey))
	if err != nil {
		return UploadSASResponse{}, fmt.Errorf("failed to create shared key credential: %w", err)
	}

	// 2. Define the SAS signature values (parameters)
	permissions := sas.BlobPermissions{
		Add:   true,
		Read:  true,
		Write: true,
	}

	sasQueryParams, err := sas.BlobSignatureValues{
		Protocol:      sas.ProtocolHTTPS,                    // Users MUST use HTTPS (not HTTP)
		ExpiryTime:    time.Now().UTC().Add(12 * time.Hour), // 12-hours before expiration
		ContainerName: string(svc.creds.ContainerName),
		BlobName:      blobName,

		// To produce a container SAS (as opposed to a blob SAS), assign to Permissions using
		// ContainerSASPermissions and make sure the BlobName field is "" (the default).
		Permissions: permissions.String(),
	}.SignWithSharedKey(cred)

	if err != nil {
		return UploadSASResponse{}, fmt.Errorf("failed to generate SAS query parameters: %w", err)
	}

	// 3. Construct the final SAS URL
	accountURL := fmt.Sprintf("https://%s.blob.core.windows.net", svc.creds.AccountName)
	blobURL := fmt.Sprintf("%s/%s/%s", accountURL, svc.creds.ContainerName, blobName)

	// Append the signed query string to the blob's URI
	sasURL := fmt.Sprintf("%s?%s", blobURL, sasQueryParams.Encode())

	// 4. Construct the permanent public URL
	permanentPublicURL := blobURL

	return UploadSASResponse{
		SASURL:             sasURL,
		PermanentPublicURL: permanentPublicURL,
		BlobName:           blobName,
	}, nil
}
