import mongoose from 'mongoose';
const schema = new mongoose.Schema({ workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true }, sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, content: { type: String, required: true, trim: true, maxlength: 4000 } }, { timestamps: true });
schema.index({ workspace: 1, createdAt: -1 });
export const Message = mongoose.models.Message || mongoose.model('Message', schema);
