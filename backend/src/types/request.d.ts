import 'express';

declare module 'express' {
  interface Request {
    /** Id único da request (do header X-Request-Id ou gerado); ecoado na resposta. */
    id?: string;
  }
}
