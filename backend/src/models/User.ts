import { Schema, model, type HydratedDocument } from 'mongoose';

/**
 * User account.
 *
 * - `username` is the display handle; `usernameLower` enforces case-insensitive
 *   uniqueness via a unique index.
 * - `email` is stored lowercased and unique (needed for Google linking + future
 *   e-mail 2FA).
 * - `passwordHash` is null for Google-only accounts.
 * - `passwordHash` / `usernameLower` / `googleId` are stripped from JSON output
 *   so they never reach the client.
 */
export interface IUser {
  username: string;
  usernameLower: string;
  pharmacyName: string;
  email: string;
  passwordHash: string | null;
  googleId: string | null;
  authProviders: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type UserDoc = HydratedDocument<IUser>;

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, trim: true, minlength: 3, maxlength: 30 },
    usernameLower: { type: String, required: true, unique: true },
    pharmacyName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: null },
    googleId: { type: String, default: null, index: true, sparse: true },
    authProviders: { type: [String], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = ret._id != null ? String(ret._id) : undefined;
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.usernameLower;
        delete ret.googleId;
        return ret;
      },
    },
  },
);

export interface SafeUser {
  id: string;
  username: string;
  pharmacyName: string;
  email: string;
  authProviders: string[];
}

/** The exact, minimal shape we send to the client (never includes the hash). */
export function toSafeUser(user: UserDoc): SafeUser {
  return {
    id: user._id.toString(),
    username: user.username,
    pharmacyName: user.pharmacyName,
    email: user.email,
    authProviders: user.authProviders,
  };
}

export const User = model<IUser>('User', userSchema);
