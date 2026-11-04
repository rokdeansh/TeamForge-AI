import { env } from '../config/env.js';

export const AUTH_COOKIE = 'teamforge_session';
const baseOptions = { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: env.COOKIE_SAME_SITE, path: '/' };
export function setAuthCookie(res, token) { res.cookie(AUTH_COOKIE, token, { ...baseOptions, maxAge: 7 * 24 * 60 * 60 * 1000 }); }
export function clearAuthCookie(res) { res.clearCookie(AUTH_COOKIE, baseOptions); }
