import { createProductRequestSchema } from '@linkby/shared';
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { uploadImages } from '../middleware/upload';
import { validate } from '../middleware/validate';
import * as productService from '../services/product';

export const productRouter = Router();

// `authenticate` precedes the parser so an unauthenticated request is refused before 25MB is read,
// and `validate` follows it because req.body does not exist until multipart has been parsed.
productRouter.post(
  '/api/products',
  authenticate,
  uploadImages,
  validate(createProductRequestSchema),
  async (req, res) => {
    const images = Array.isArray(req.files) ? req.files : [];
    const product = await productService.createProduct(req.user, req.body, images);
    res.status(201).json(product);
  },
);
