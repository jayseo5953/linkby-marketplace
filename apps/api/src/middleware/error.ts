import { MAX_IMAGES, MAX_IMAGE_BYTES } from '@linkby/shared';
import type { ErrorRequestHandler } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

// Multer's own messages name the mechanism ('Unexpected field'), not the rule the caller broke.
const UPLOAD_MESSAGES: Record<string, string> = {
  LIMIT_FILE_SIZE: `Each image must be ${MAX_IMAGE_BYTES / 1024 / 1024}MB or smaller`,
  LIMIT_UNEXPECTED_FILE: `At most ${MAX_IMAGES} images are allowed`,
};

// Express identifies error middleware by arity, so the fourth parameter has to stay declared.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  if (err instanceof MulterError) {
    res.status(400).json({
      error: { code: err.code, message: UPLOAD_MESSAGES[err.code] ?? err.message },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request is invalid',
        details: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  // An unintended error's message may carry a query, a path or a credential — logs only.
  logger.error({ err }, 'unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
};
