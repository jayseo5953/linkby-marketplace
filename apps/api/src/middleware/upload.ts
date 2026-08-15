import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES } from '@linkby/shared';
import multer from 'multer';
import { BadRequestError } from '../lib/errors';

/**
 * Memory storage because every file goes straight to object storage — nothing is ever meant to
 * land on the API's disk, and an aborted upload then leaves nothing to clean up.
 */
export const uploadImages = multer({
  storage: multer.memoryStorage(),
  // Size and count are enforced inside the parser, before a handler runs, so an oversize upload
  // is refused mid-stream rather than buffered and rejected (T-47).
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(new BadRequestError(`Unsupported image type ${file.mimetype}`, 'UNSUPPORTED_IMAGE_TYPE'));
      return;
    }
    cb(null, true);
  },
}).array('images', MAX_IMAGES);
