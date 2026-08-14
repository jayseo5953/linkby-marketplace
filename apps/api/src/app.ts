import cors from 'cors';
import express from 'express';
import { config } from './config';
import { healthRouter } from './routes/health';

export const app = express();

app.use(cors({ origin: config.CORS_ORIGIN }));
app.use(express.json());
app.use(healthRouter);
