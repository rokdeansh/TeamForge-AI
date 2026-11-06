import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function getMessageRaw(email, code) {
  const from = env.GOOGLE_SENDER_EMAIL;
  if (/[\r\n<>]/.test(from) || /[\r\n<>]/.test(email)) {
    throw new AppError('The email sender configuration is invalid.', 503, 'EMAIL_NOT_CONFIGURED');
  }

  const message = [
    `From: TeamForge AI <${from}>`,
    `To: ${email}`,
    'Subject: Your TeamForge AI verification code',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    `Your TeamForge AI registration code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`
  ].join('\r\n');

  return Buffer.from(message, 'utf8').toString('base64url');
}

export async function sendRegistrationOtp(email, code) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REFRESH_TOKEN || !env.GOOGLE_SENDER_EMAIL) {
    throw new AppError('Email verification is not configured. Set the Google OAuth credentials and Gmail sender address on the server.', 503, 'EMAIL_NOT_CONFIGURED');
  }

  try {
    const tokenResponse = await fetchWithTimeout(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: env.GOOGLE_REFRESH_TOKEN,
        grant_type: 'refresh_token'
      })
    });
    const tokenResult = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenResult.access_token) {
      logger.error('Google OAuth rejected registration email', {
        status: tokenResponse.status,
        providerCode: tokenResult.error || 'UNKNOWN'
      });
      throw new AppError('Google could not authorize email sending. Check the Google OAuth credentials and refresh token.', 503, 'EMAIL_SEND_FAILED');
    }

    const sendResponse = await fetchWithTimeout(GMAIL_SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenResult.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: getMessageRaw(email, code) })
    });
    const sendResult = await sendResponse.json().catch(() => ({}));
    if (!sendResponse.ok) {
      logger.error('Gmail API rejected registration email', {
        status: sendResponse.status,
        providerCode: sendResult.error?.status || 'UNKNOWN'
      });
      throw new AppError('Gmail could not send the verification email. Check Gmail API access and the authorized sender account.', 503, 'EMAIL_SEND_FAILED');
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Google registration email request failed', { errorName: error.name });
    throw new AppError(error.name === 'AbortError' ? 'Google email service timed out. Try again.' : 'Google email service could not be reached. Try again.', 503, 'EMAIL_SEND_FAILED');
  }
}
