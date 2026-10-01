export interface DetectedImage {
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'image/avif';
  extension: 'jpg' | 'png' | 'webp' | 'gif' | 'avif';
}

/**
 * Identifies an image by its magic bytes – the client-supplied MIME type and file name
 * are never trusted. SVG is deliberately not accepted (it can carry scripts).
 */
export function detectImageType(buffer: Buffer): DetectedImage | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: 'image/jpeg', extension: 'jpg' };
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', extension: 'png' };
  }
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { mime: 'image/webp', extension: 'webp' };
  }
  if (buffer.toString('ascii', 0, 4) === 'GIF8') return { mime: 'image/gif', extension: 'gif' };
  if (buffer.toString('ascii', 4, 8) === 'ftyp' && /^avi[fs]$/.test(buffer.toString('ascii', 8, 12))) {
    return { mime: 'image/avif', extension: 'avif' };
  }
  return null;
}
