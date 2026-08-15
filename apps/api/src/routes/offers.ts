import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { parseId } from '../middleware/validate';
import * as offerService from '../services/offer';

export const offerRouter = Router();

// On the offer rather than the product: the id names the thread and the product on its own, so
// seller and buyer send identical requests and no body is needed (T-66).
offerRouter.post('/api/offers/:id/accept', authenticate, parseId, async (req, res) => {
  res.status(200).json(await offerService.acceptOffer(req.user, req.id));
});
