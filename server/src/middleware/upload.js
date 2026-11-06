import multer from 'multer';
import { HttpError } from '../lib/http.js';
import { sniffImageType } from '../lib/storage.js';

export const MAX_IMAGES = 6;

export const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: MAX_IMAGES, fields: 30 },
  fileFilter: (req, file, cb) =>
    ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
      ? cb(null, true)
      : cb(new HttpError(400, 'Images must be JPEG, PNG or WebP')),
}).array('images', MAX_IMAGES);

// Runs before anything is stored; returns [{ buffer, ext }].
export function checkedImages(files = []) {
  return files.map((file) => {
    const ext = sniffImageType(file.buffer);
    if (!ext) throw new HttpError(400, `${file.originalname} is not a valid JPEG, PNG or WebP image`);
    return { buffer: file.buffer, ext };
  });
}
