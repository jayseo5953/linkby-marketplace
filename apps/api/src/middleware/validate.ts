// Parsed once at the boundary, so routes and services downstream trust the resulting types.
import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

export function validate(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    req.body = schema.parse(req.body);
    next();
  };
}
