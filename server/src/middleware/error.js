import multer from 'multer';
import { ZodError } from 'zod';

export function apiNotFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

const UPLOAD_MESSAGES = {
  LIMIT_FILE_SIZE: 'Each image must be 5 MB or smaller',
  LIMIT_FILE_COUNT: 'You can upload at most 6 images',
  LIMIT_UNEXPECTED_FILE: 'You can upload at most 6 images',
};

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    const fields = {};
    for (const issue of err.issues) fields[issue.path.join('.')] ??= issue.message;
    return res.status(400).json({ error: Object.values(fields)[0] || 'Invalid input', fields });
  }
  if (err instanceof multer.MulterError) return res.status(400).json({ error: UPLOAD_MESSAGES[err.code] || 'Upload failed' });
  if (err.name === 'ValidationError') return res.status(400).json({ error: Object.values(err.errors)[0].message });
  if (err.code === 11000) return res.status(409).json({ error: 'That already exists' });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
}
