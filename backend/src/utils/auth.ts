// backend/src/utils/auth.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../env';

export async function hashPassword(plain: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export async function comparePassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export function signToken(payload: object) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken<T = any>(token: string): T {
  return jwt.verify(token, env.JWT_SECRET) as T;
}