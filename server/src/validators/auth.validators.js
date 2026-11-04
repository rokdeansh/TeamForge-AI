import { z } from 'zod';

const email = z.string().trim().email().max(254).transform(value => value.toLowerCase());
const password = z.string().min(10).max(72).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password is too long when encoded');
export const registerSchema = z.object({ body: z.object({ name: z.string().trim().min(2).max(80), email, password }).strict() });
export const loginSchema = z.object({ body: z.object({ email, password: z.string().min(1).max(72).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password is too long when encoded') }).strict() });
export const updateProfileSchema = z.object({ body: z.object({ name: z.string().trim().min(2).max(80).optional(), themePreference: z.enum(['light', 'dark', 'system']).optional() }).strict().refine(v => Object.keys(v).length > 0) });
