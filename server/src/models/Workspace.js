import mongoose from 'mongoose';
const schema = new mongoose.Schema({ name: { type: String, required: true, trim: true, maxlength: 100 }, description: { type: String, default: '', maxlength: 1000 }, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } }, { timestamps: true });
export const Workspace = mongoose.models.Workspace || mongoose.model('Workspace', schema);
