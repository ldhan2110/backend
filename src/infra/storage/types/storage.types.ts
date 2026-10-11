/** A file persisted to storage, addressed by its content hash. */
export interface StoredFile {
  relPath: string;
  size: number;
  extension: string;
}
