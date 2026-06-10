import mongoose from 'mongoose';
import { env } from '../config/env';
import { logger } from '../lib/logger';

export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri);
  logger.info('db.connected', { host: mongoose.connection.host, name: mongoose.connection.name });
}
