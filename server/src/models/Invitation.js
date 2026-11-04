import mongoose from 'mongoose';
const schema = new mongoose.Schema({ workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true }, tokenHash: { type: String, required: true, unique: true }, role: { type: String, enum: ['admin', 'member'], default: 'member' }, expiresAt: { type: Date, required: true }, maxUses: { type: Number, default: 1, min: 1, max: 50 }, usedCount: { type: Number, default: 0, min: 0 }, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } }, { timestamps: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const Invitation = mongoose.models.Invitation || mongoose.model('Invitation', schema);
