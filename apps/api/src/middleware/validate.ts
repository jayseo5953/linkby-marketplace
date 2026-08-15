// Parsed once at the boundary, so routes and services downstream trust the resulting types.
import { idParamsSchema } from '@linkby/shared';
import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

export function validate(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    req.body = schema.parse(req.body);
    next();
  };
}

// Not written back to `req.params`, which Express types as strings off the path literal.
export const parseId: RequestHandler = (req, _res, next) => {
  req.id = idParamsSchema.parse(req.params).id;
  next();
};
