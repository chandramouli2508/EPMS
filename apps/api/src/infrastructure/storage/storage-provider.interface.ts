// apps/api/src/infrastructure/storage/storage-provider.interface.ts

/**
 * Strategy interface for file storage.
 * Phase 0: interface only — no implementation.
 *
 * When storage is added, one concrete implementation (e.g., S3StorageProvider)
 * will implement this interface. Business modules call StorageProvider and
 * never know which provider is active.
 */
export interface UploadUrlResult {
  uploadUrl: string;
  storageKey: string;
  expiresAt: Date;
}

export interface DownloadUrlResult {
  downloadUrl: string;
  expiresAt: Date;
}

export interface StorageProvider {
  /**
   * Generate a pre-signed URL for a direct client-to-storage PUT upload.
   */
  generateUploadUrl(key: string, mimeType: string, sizeBytes?: number): Promise<UploadUrlResult>;

  /**
   * Generate a short-lived pre-signed URL for a GET download.
   * The storage bucket must NOT be publicly accessible.
   */
  generateDownloadUrl(key: string, expirySeconds?: number): Promise<DownloadUrlResult>;

  /**
   * Delete an object from storage.
   */
  delete(key: string): Promise<void>;
}
