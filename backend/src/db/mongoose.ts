import mongoose from 'mongoose';
import { env } from '../config/env';
import { queryLoggerPlugin } from './queryLogger';

// Registra o plugin de timing GLOBALMENTE, no corpo do módulo (não dentro de
// connectDb), para garantir que ele rode ANTES de qualquer model ser compilado.
// Ordem em `src/index.ts`: `import { connectDb } from './db/mongoose'` (linha 7)
// é avaliado ANTES de `./routes/auth` e `./routes/dados` (linhas 10-13), que são
// quem importam os models (`models/User`, `models/pharmacy`). Como ESM executa o
// corpo dos módulos importados em ordem de fonte, este `mongoose.plugin(...)` roda
// antes de `model(...)` ser chamado — todo schema novo herda o plugin.
mongoose.plugin(queryLoggerPlugin);

export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri);
  console.log('[db] conectado ao MongoDB');
}
