import mongoose from 'mongoose';
const schema = new mongoose.Schema({ workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true }, user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' }, joinedAt: { type: Date, default: Date.now } }, { timestamps: true });
schema.index({ workspace: 1, user: 1 }, { unique: true });
schema.index({ user: 1 });
schema.index({ workspace: 1, role: 1 }, { unique: true, partialFilterExpression: { role: 'owner' } });
export const WorkspaceMembership = mongoose.models.WorkspaceMembership || mongoose.model('WorkspaceMembership', schema);
