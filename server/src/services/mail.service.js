import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

let transporter;
function gmailTransport() {
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
    throw new AppError('Email verification is not configured. Ask the site administrator to configure Gmail.', 503, 'EMAIL_NOT_CONFIGURED');
  }
  transporter ??= nodemailer.createTransport({
    service: 'gmail',
    auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD.replace(/\s/g, '') }
  });
  return transporter;
}

export async function sendRegistrationOtp(email, code) {
  try {
    await gmailTransport().sendMail({
      from: `TeamForge AI <${env.GMAIL_USER}>`,
      to: email,
      subject: 'Your TeamForge AI verification code',
      text: `Your TeamForge AI registration code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('We could not send the verification email. Check the Gmail configuration and try again.', 503, 'EMAIL_SEND_FAILED');
  }
}
