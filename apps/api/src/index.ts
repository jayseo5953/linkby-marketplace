import { app } from './app';
import { config } from './config';
import { logger } from './lib/logger';

app.listen(config.API_PORT, () => {
  logger.info({ port: config.API_PORT }, 'api listening');
});
