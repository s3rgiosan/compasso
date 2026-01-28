import crypto from 'crypto';

/** Generate SHA-256 hash of file buffer */
export function generateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
