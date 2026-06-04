import 'express-session';

declare module 'express-session' {
  interface SessionData {
    /** Logged-in user's id; presence of this is what "being authenticated" means. */
    userId?: string;
  }
}
