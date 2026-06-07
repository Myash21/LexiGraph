import { BlobServiceClient, type BlockBlobClient } from '@azure/storage-blob';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER || 'lexigraph-uploads';

if (!connectionString) {
    console.warn('[Azure Storage] AZURE_STORAGE_CONNECTION_STRING is not set.');
}

const blobServiceClient = connectionString
    ? BlobServiceClient.fromConnectionString(connectionString)
    : null;

/**
 * Upload a file buffer to Azure Blob Storage.
 * Returns the blob URL for storage in PostgreSQL metadata.
 *
 * Path pattern: {userId}/{timestamp}-{filename}
 */
export const uploadToBlob = async (
    userId: string,
    filename: string,
    buffer: Buffer,
    contentType: string
): Promise<string> => {
    if (!blobServiceClient) {
        throw new Error('Azure Blob Storage is not configured.');
    }

    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Create container if it doesn't exist (idempotent)
    await containerClient.createIfNotExists();

    // Scoped blob name: userId/timestamp-filename  → natural per-user folder
    const blobName = `${userId}/${Date.now()}-${filename}`;
    const blockBlobClient: BlockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: { blobContentType: contentType },
    });

    console.log(`[Azure Storage] Uploaded blob: ${blobName}`);

    // Return the full blob URL — stored in documents.metadata.blobUrl
    return blockBlobClient.url;
};

/**
 * Delete a blob by its URL (called from the document deletion service).
 */
export const deleteBlob = async (blobUrl: string): Promise<void> => {
    if (!blobServiceClient) return;

    // Extract blob name from URL
    // URL format: https://<account>.blob.core.windows.net/<container>/<blobName>
    const url = new URL(blobUrl);
    const blobName = url.pathname.replace(`/${containerName}/`, '');

    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.getBlockBlobClient(blobName).deleteIfExists();
    console.log(`[Azure Storage] Deleted blob: ${blobName}`);
};
