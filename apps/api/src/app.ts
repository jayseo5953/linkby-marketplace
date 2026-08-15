import cors from 'cors';
import express from 'express';
import { config } from './config';
import { errorHandler } from './middleware/error';
import { authRouter } from './routes/auth';
import { healthRouter } from './routes/health';
import { offerRouter } from './routes/offers';
import { productRouter } from './routes/products';

export const app = express();

app.use(cors({ origin: config.CORS_ORIGIN }));
app.use(express.json());
app.use(healthRouter);
app.use(authRouter);
app.use(productRouter);
app.use(offerRouter);

// Must stay last to capture errors from preceding middleware.
app.use(errorHandler);
