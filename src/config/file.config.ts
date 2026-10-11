/**
 * File-storage configuration (env-driven).
 * - dir:         storage root directory for uploaded blobs (relative or absolute).
 * - maxSize:     max accepted upload size in bytes.
 * - allowedMime: allowed content types; empty list means "allow any".
 */
export const configFile = () => ({
  file: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760'), // 10 MB
    allowedMime: (process.env.UPLOAD_ALLOWED_MIME || '')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean),
  },
});
