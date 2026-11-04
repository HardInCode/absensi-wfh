import { resolve } from 'path';

export const UPLOAD_DIR = resolve(process.cwd(), 'uploads');

export const MAX_PHOTO_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB

export const ALLOWED_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

