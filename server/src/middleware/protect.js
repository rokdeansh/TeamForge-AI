import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { AUTH_COOKIE } from '../utils/authCookies.js';
import { AppError } from '../utils/AppError.js';

export async function protect(req, _res, next) {
  try {
    const token = req.cookies?.[AUTH_COOKIE];
    if (!token) throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
    const payload = jwt.verify(token, env.JWT_SECRET, { issuer: 'teamforge-ai' });
    const user = await User.findById(payload.sub).select('_id name email themePreference createdAt').lean();
    if (!user) throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
    req.user = { id: String(user._id), name: user.name, email: user.email, themePreference: user.themePreference, createdAt: user.createdAt };
    next();
  } catch (error) { next(error); }
}
