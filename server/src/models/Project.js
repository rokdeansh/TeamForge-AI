import mongoose from 'mongoose';
const schema = new mongoose.Schema({ workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true }, name: { type: String, required: true, trim: true, maxlength: 140 }, description: { type: String, default: '', maxlength: 4000 }, status: { type: String, enum: ['Planning', 'In Progress', 'On Hold', 'Completed'], default: 'Planning' }, creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], startDate: Date, deadline: Date }, { timestamps: true });
schema.index({ workspace: 1, status: 1 });
export const Project = mongoose.models.Project || mongoose.model('Project', schema);
