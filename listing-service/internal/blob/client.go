package blob

import (
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
)

func GetServiceClientTokenCredential(accountURL string) (*azblob.Client, error) {
	// Create a new service client with token credential
	credential, err := azidentity.NewDefaultAzureCredential(nil)
	if err != nil {
		return &azblob.Client{}, err
	}

	client, err := azblob.NewClient(accountURL, credential, nil)
	if err != nil {
		return &azblob.Client{}, err
	}

	return client, nil
}


