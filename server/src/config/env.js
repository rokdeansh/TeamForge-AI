import dotenv from 'dotenv';

dotenv.config();

const allowedEnvironments = new Set(['development', 'test', 'production']);
const nodeEnv = process.env.NODE_ENV || 'development';
if (!allowedEnvironments.has(nodeEnv)) throw new Error('NODE_ENV must be development, test, or production');

const port = Number(process.env.PORT || 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535');

const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
try { new URL(clientOrigin); } catch { throw new Error('CLIENT_ORIGIN must be a valid URL'); }
const cookieSameSite = process.env.COOKIE_SAME_SITE || 'lax';
if (!['lax', 'strict', 'none'].includes(cookieSameSite)) throw new Error('COOKIE_SAME_SITE must be lax, strict, or none');
const jwtSecret = process.env.JWT_SECRET || 'local-development-secret-change-this-value-32chars';
if (nodeEnv === 'production' && (!process.env.JWT_SECRET || jwtSecret.length < 32)) throw new Error('Set JWT_SECRET to a random value of at least 32 characters in production');
if (nodeEnv === 'production' && cookieSameSite === 'none' && process.env.COOKIE_SECURE === 'false') throw new Error('SameSite=None cookies require Secure');

export const env = {
  NODE_ENV: nodeEnv,
  PORT: port,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/teamforge_ai',
  CLIENT_ORIGIN: clientOrigin,
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  COOKIE_SAME_SITE: cookieSameSite,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN || '',
  GOOGLE_SENDER_EMAIL: process.env.GOOGLE_SENDER_EMAIL || '',
  AI_API_URL: process.env.AI_API_URL || '',
  AI_API_KEY: process.env.AI_API_KEY || '',
  AI_MODEL: process.env.AI_MODEL || ''
};
