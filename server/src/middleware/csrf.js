import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const safe = new Set(['GET', 'HEAD', 'OPTIONS']);
export function verifyRequestOrigin(req, _res, next) {
  if (safe.has(req.method)) return next();
  const value = req.get('origin') || req.get('referer');
  if (!value) return next(new AppError('Origin or Referer is required', 403, 'CSRF_ORIGIN_REQUIRED'));
  try {
    if (new URL(value).origin !== new URL(env.CLIENT_ORIGIN).origin) return next(new AppError('Request origin is not allowed', 403, 'CSRF_ORIGIN_DENIED'));
  } catch { return next(new AppError('Request origin is invalid', 403, 'CSRF_ORIGIN_INVALID')); }
  next();
}
