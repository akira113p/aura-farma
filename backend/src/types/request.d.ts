import 'express';

declare module 'express' {
  interface Request {
    /** ID único da requisição (gerado ou propagado via X-Request-Id). */
    requestId?: string;
  }
}
