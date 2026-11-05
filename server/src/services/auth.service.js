import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { User } from '../models/User.js';
import { RegistrationOtp } from '../models/RegistrationOtp.js';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';
import { sendRegistrationOtp } from './mail.service.js';

const safeUser = user => ({ id: String(user._id ?? user.id), name: user.name, email: user.email, themePreference: user.themePreference, createdAt: user.createdAt });
const tokenFor = user => jwt.sign({ sub: String(user._id ?? user.id) }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN, issuer: 'teamforge-ai' });

const registrationCodeHash = (email, code) => createHmac('sha256', env.JWT_SECRET).update(`${email}:${code}`).digest('hex');
const newRegistrationCode = () => randomInt(0, 10000).toString().padStart(4, '0');
const matchesRegistrationCode = (storedHash, email, code) => {
  const stored = Buffer.from(storedHash, 'hex');
  const candidate = Buffer.from(registrationCodeHash(email, code), 'hex');
  return stored.length === candidate.length && timingSafeEqual(stored, candidate);
};

export async function beginRegistration({ name, email, password }) {
  if (await User.exists({ email })) throw new AppError('An account with this email already exists', 409, 'EMAIL_IN_USE');
  const now = new Date();
  const passwordHash = await bcrypt.hash(password, 12);
  const code = newRegistrationCode();
  const codeHash = registrationCodeHash(email, code);
  const pending = await RegistrationOtp.findOne({ email });
  if (pending && pending.expiresAt > now) {
    if (pending.resendCount >= 4) throw new AppError('You have requested too many codes. Start registration again later.', 429, 'OTP_RESEND_LIMIT');
    if (now.getTime() - pending.lastSentAt.getTime() < 60 * 1000) throw new AppError('Wait a minute before requesting another code.', 429, 'OTP_RESEND_WAIT');
    pending.name = name;
    pending.passwordHash = passwordHash;
    pending.codeHash = codeHash;
    pending.lastSentAt = now;
    pending.resendCount += 1;
    pending.expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    await pending.save();
  } else {
    if (pending) await RegistrationOtp.deleteOne({ _id: pending._id });
    try {
      await RegistrationOtp.create({ name, email, passwordHash, codeHash, attempts: 0, resendCount: 0, lastSentAt: now, expiresAt: new Date(now.getTime() + 10 * 60 * 1000) });
    } catch (error) {
      if (error?.code === 11000) throw new AppError('Registration is already in progress for this email. Check your inbox for the code.', 409, 'REGISTRATION_PENDING');
      throw error;
    }
  }
  try {
    await sendRegistrationOtp(email, code);
  } catch (error) {
    await RegistrationOtp.deleteOne({ email, codeHash });
    throw error;
  }
  return { email };
}

export async function verifyRegistration({ email, code }) {
  const challenge = await RegistrationOtp.findOne({ email }).lean();
  if (!challenge || challenge.expiresAt <= new Date()) {
    if (challenge) await RegistrationOtp.deleteOne({ _id: challenge._id });
    throw new AppError('The verification code is invalid or expired. Request a new code.', 400, 'OTP_INVALID');
  }
  if (challenge.attempts >= 5) {
    await RegistrationOtp.deleteOne({ _id: challenge._id });
    throw new AppError('Too many incorrect codes. Start registration again.', 429, 'OTP_ATTEMPTS_EXCEEDED');
  }
  if (!matchesRegistrationCode(challenge.codeHash, email, code)) {
    const updated = await RegistrationOtp.findOneAndUpdate(
      { _id: challenge._id, codeHash: challenge.codeHash, attempts: { $lt: 5 } },
      { $inc: { attempts: 1 } },
      { returnDocument: 'after' }
    ).lean();
    if (updated?.attempts >= 5) {
      await RegistrationOtp.deleteOne({ _id: challenge._id, attempts: { $gte: 5 } });
      throw new AppError('Too many incorrect codes. Start registration again.', 429, 'OTP_ATTEMPTS_EXCEEDED');
    }
    throw new AppError('The verification code is incorrect.', 400, 'OTP_INCORRECT');
  }
  const consumed = await RegistrationOtp.deleteOne({ _id: challenge._id, codeHash: challenge.codeHash, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } });
  if (!consumed.deletedCount) throw new AppError('The verification code is invalid or expired. Request a new code.', 400, 'OTP_INVALID');
  try {
    const user = await User.create({ name: challenge.name, email, passwordHash: challenge.passwordHash });
    return { user: safeUser(user), token: tokenFor(user) };
  } catch (error) {
    if (error?.code === 11000) throw new AppError('An account with this email already exists', 409, 'EMAIL_IN_USE');
    throw error;
  }
}

export async function resendRegistrationOtp({ email }) {
  const challenge = await RegistrationOtp.findOne({ email });
  if (!challenge || challenge.expiresAt <= new Date()) {
    if (challenge) await RegistrationOtp.deleteOne({ _id: challenge._id });
    throw new AppError('Registration has expired. Start again to receive a new code.', 400, 'REGISTRATION_EXPIRED');
  }
  if (challenge.resendCount >= 4) throw new AppError('You have requested too many codes. Start registration again later.', 429, 'OTP_RESEND_LIMIT');
  const now = new Date();
  if (now.getTime() - challenge.lastSentAt.getTime() < 60 * 1000) throw new AppError('Wait a minute before requesting another code.', 429, 'OTP_RESEND_WAIT');
  const code = newRegistrationCode();
  challenge.codeHash = registrationCodeHash(email, code);
  challenge.lastSentAt = now;
  challenge.resendCount += 1;
  challenge.expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  await challenge.save();
  try {
    await sendRegistrationOtp(email, code);
  } catch (error) {
    await RegistrationOtp.deleteOne({ _id: challenge._id, codeHash: challenge.codeHash });
    throw error;
  }
  return { email };
}
export async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await user.comparePassword(password))) throw new AppError('Email or password is incorrect', 401, 'INVALID_CREDENTIALS');
  return { user: safeUser(user), token: tokenFor(user) };
}
export async function getProfile(id) {
  const user = await User.findById(id).lean();
  if (!user) throw new AppError('User account was not found', 404, 'USER_NOT_FOUND');
  return safeUser(user);
}
export async function updateProfile(id, changes) {
  const user = await User.findByIdAndUpdate(id, { $set: changes }, { returnDocument: 'after', runValidators: true }).lean();
  if (!user) throw new AppError('User account was not found', 404, 'USER_NOT_FOUND');
  return safeUser(user);
}
