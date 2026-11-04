import mongoose from 'mongoose';
const schema = new mongoose.Schema({ workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true }, actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, type: { type: String, enum: ['task_assigned', 'task_status_changed', 'project_updated', 'workspace_joined'], required: true }, entityType: { type: String, enum: ['task', 'project', 'workspace'], required: true }, entity: { type: mongoose.Schema.Types.ObjectId, required: true }, details: { type: mongoose.Schema.Types.Mixed, default: {} } }, { timestamps: true });
schema.index({ workspace: 1, createdAt: -1 });
export const Activity = mongoose.models.Activity || mongoose.model('Activity', schema);
