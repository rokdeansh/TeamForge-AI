import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  themePreference: { type: String, enum: ['light', 'dark', 'system'], default: 'system' }
}, { timestamps: true, toJSON: { transform(_doc, ret) { delete ret.passwordHash; delete ret.__v; return ret; } } });
schema.methods.comparePassword = function comparePassword(password) { return bcrypt.compare(password, this.passwordHash); };
export const User = mongoose.models.User || mongoose.model('User', schema);
