import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB(uri = env.MONGODB_URI) {
  await mongoose.connect(uri);
  return mongoose.connection;
}
