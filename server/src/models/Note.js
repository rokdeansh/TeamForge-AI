import mongoose from 'mongoose';
const schema = new mongoose.Schema({ workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true }, project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null }, author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, title: { type: String, required: true, trim: true, maxlength: 200 }, content: { type: String, default: '', maxlength: 30000 } }, { timestamps: true });
schema.index({ workspace: 1, project: 1 }); schema.index({ title: 'text', content: 'text' });
export const Note = mongoose.models.Note || mongoose.model('Note', schema);
