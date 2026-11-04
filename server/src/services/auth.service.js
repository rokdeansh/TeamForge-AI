import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

const safeUser = user => ({ id: String(user._id ?? user.id), name: user.name, email: user.email, themePreference: user.themePreference, createdAt: user.createdAt });
const tokenFor = user => jwt.sign({ sub: String(user._id ?? user.id) }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN, issuer: 'teamforge-ai' });

export async function register({ name, email, password }) {
  try {
    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) });
    return { user: safeUser(user), token: tokenFor(user) };
  } catch (error) {
    if (error?.code === 11000) throw new AppError('An account with this email already exists', 409, 'EMAIL_IN_USE');
    throw error;
  }
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
