import { createOfferRequestSchema, createProductRequestSchema } from '@linkby/shared';
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { uploadImages } from '../middleware/upload';
import { parseId, validate } from '../middleware/validate';
import * as offerService from '../services/offer';
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

productRouter.get('/api/products', authenticate, async (_req, res) => {
  res.status(200).json(await productService.listProducts());
});

productRouter.get('/api/products/:id', authenticate, parseId, async (req, res) => {
  res.status(200).json(await productService.getProduct(req.user, req.id));
});

// A purchase is an event, not a field edit — PATCH would invite a client to name the outcome (T-55).
productRouter.post(
  '/api/products/:id/purchase',
  authenticate,
  parseId,
  async (req, res) => {
    res.status(200).json(await productService.purchaseProduct(req.user, req.id));
  },
);

// Opening a thread and countering are one endpoint: to the caller it is the same act, and which
// one it turns out to be depends on state they cannot see (T-58).
productRouter.post(
  '/api/products/:id/offers',
  authenticate,
  parseId,
  validate(createOfferRequestSchema),
  async (req, res) => {
    res.status(201).json(await offerService.createOffer(req.user, req.id, req.body));
  },
);
