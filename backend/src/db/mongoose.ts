import mongoose from 'mongoose';
import { env } from '../config/env';

export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri);
  console.log('[db] conectado ao MongoDB');
}

/** Fecha a conexão do Mongoose (usado no graceful shutdown). */
export async function disconnectDb(): Promise<void> {
  await mongoose.connection.close();
}
