import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { parseId } from '../middleware/validate';
import * as offerService from '../services/offer';

export const offerRouter = Router();

// On the offer, not the product: the id names the thread, so both sides send the same request (T-66).
offerRouter.post('/api/offers/:id/accept', authenticate, parseId, async (req, res) => {
  res.status(200).json(await offerService.acceptOffer(req.user, req.id));
});
