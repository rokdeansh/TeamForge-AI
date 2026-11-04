import { Router } from 'express';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { protect } from '../middleware/protect.js';
import { requireWorkspaceRole } from '../middleware/workspaceRole.js';
import { AppError } from '../utils/AppError.js';
import { recordActivity } from '../services/activity.service.js';
import { validate } from '../middleware/validate.js';
import { projectCreateSchema, projectUpdateSchema } from '../validators/resource.validators.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { WorkspaceMembership } from '../models/WorkspaceMembership.js';

const router = Router(); router.use(protect);
router.get('/', requireWorkspaceRole(), async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1), limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const filter = { workspace: req.workspaceId };
  if (['Planning', 'In Progress', 'On Hold', 'Completed'].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.search) filter.name = { $regex: escapeRegex(req.query.search), $options: 'i' };
  const [items, total] = await Promise.all([Project.find(filter).select('workspace name description status creator members startDate deadline createdAt updatedAt').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Project.countDocuments(filter)]);
  const progress = await Task.aggregate([{ $match: { workspace: req.workspaceId, project: { $in: items.map(item => item._id) } } }, { $group: { _id: '$project', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } } } }]);
  const progressByProject = new Map(progress.map(item => [String(item._id), { taskTotal: item.total, completedTasks: item.completed }]));
  res.json({ success: true, data: { items: items.map(item => ({ ...item, ...(progressByProject.get(String(item._id)) || { taskTotal: 0, completedTasks: 0 }) })), page, limit, total } });
});
router.post('/', requireWorkspaceRole('owner', 'admin'), validate(projectCreateSchema), async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (name.length < 2 || name.length > 140) throw new AppError('Project name must be 2 to 140 characters', 400, 'VALIDATION_ERROR');
  const project = await Project.create({ workspace: req.workspaceId, name, description: req.body.description || '', creator: req.user.id, members: [req.user.id], deadline: req.body.deadline ? new Date(req.body.deadline) : undefined });
  res.status(201).json({ success: true, data: { project } });
});
router.get('/:projectId', async (req, _res, next) => {
  const project = await Project.findById(req.params.projectId).select('workspace').lean();
  if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');
  req.params.workspaceId = String(project.workspace); next();
}, requireWorkspaceRole(), async (req, res) => {
  const [project, taskCounts] = await Promise.all([
    Project.findOne({ _id: req.params.projectId, workspace: req.workspaceId }).populate('members', 'name email').lean(),
    Task.aggregate([{ $match: { project: req.params.projectId, workspace: req.workspaceId } }, { $group: { _id: '$status', count: { $sum: 1 } } }])
  ]);
  res.json({ success: true, data: { project, taskCounts } });
});
router.patch('/:projectId', async (req, _res, next) => {
  const project = await Project.findById(req.params.projectId).select('workspace').lean();
  if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');
  req.params.workspaceId = String(project.workspace); next();
}, requireWorkspaceRole(), async (req, res) => {
  const fields = ['name', 'description', 'status', 'deadline'];
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => fields.includes(key)));
  if (changes.status && !['Planning', 'In Progress', 'On Hold', 'Completed'].includes(changes.status)) throw new AppError('Invalid project status', 400, 'VALIDATION_ERROR');
  if (changes.name !== undefined && (typeof changes.name !== 'string' || changes.name.trim().length < 2 || changes.name.length > 140)) throw new AppError('Invalid project name', 400, 'VALIDATION_ERROR');
  if (changes.name) changes.name = changes.name.trim();
  const project = await Project.findOneAndUpdate({ _id: req.params.projectId, workspace: req.workspaceId }, { $set: changes }, { returnDocument: 'after', runValidators: true }).lean();
  const members = await WorkspaceMembership.find({ workspace: req.workspaceId }).select('user').lean();
  await recordActivity({ workspace: req.workspaceId, actor: req.user.id, type: 'project_updated', entityType: 'project', entity: project._id, recipients: members.map(member => member.user), details: { fields: Object.keys(changes) } });
  res.json({ success: true, data: { project } });
});
router.delete('/:projectId', async (req, _res, next) => {
  const project = await Project.findById(req.params.projectId).select('workspace').lean();
  if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');
  req.params.workspaceId = String(project.workspace); next();
}, requireWorkspaceRole('owner', 'admin'), async (req, res) => {
  await Task.deleteMany({ project: req.params.projectId, workspace: req.workspaceId });
  await Project.deleteOne({ _id: req.params.projectId, workspace: req.workspaceId });
  res.json({ success: true, data: { deleted: true } });
});
export default router;
