import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config.js';

export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(import.meta.dirname, '../../uploads');

// Trust the file's bytes, not the client-supplied MIME type or name.
export function sniffImageType(b) {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}

export async function saveImage(buffer, ext) {
  if (config.cloudinaryUrl) {
    const result = await new Promise((resolve, reject) =>
      cloudinary.uploader
        .upload_stream({ folder: 'academic-marketplace', resource_type: 'image' }, (err, res) => (err ? reject(err) : resolve(res)))
        .end(buffer),
    );
    return { url: result.secure_url, publicId: result.public_id };
  }
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${crypto.randomUUID()}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), buffer);
  return { url: `/uploads/${name}`, publicId: name };
}

export async function deleteImage({ publicId }) {
  if (config.cloudinaryUrl) return cloudinary.uploader.destroy(publicId);
  await fs.rm(path.join(UPLOAD_DIR, path.basename(publicId)), { force: true });
}
