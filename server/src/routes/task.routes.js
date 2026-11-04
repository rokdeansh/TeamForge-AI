import { Router } from 'express';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { protect } from '../middleware/protect.js';
import { requireWorkspaceRole } from '../middleware/workspaceRole.js';
import { AppError } from '../utils/AppError.js';
import { WorkspaceMembership } from '../models/WorkspaceMembership.js';
import { recordActivity } from '../services/activity.service.js';
import { validate } from '../middleware/validate.js';
import { taskBulkCreateSchema, taskCreateSchema, taskUpdateSchema } from '../validators/resource.validators.js';
import { escapeRegex } from '../utils/escapeRegex.js';

const router = Router(); router.use(protect);
router.get('/', requireWorkspaceRole(), async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1), limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const filter = { workspace: req.workspaceId };
  if (req.query.projectId) filter.project = req.query.projectId;
  if (['To Do', 'In Progress', 'In Review', 'Completed'].includes(req.query.status)) filter.status = req.query.status;
  if (['Low', 'Medium', 'High'].includes(req.query.priority)) filter.priority = req.query.priority;
  if (req.query.assignee === 'self') filter.assignees = req.user.id;
  else if (req.query.assignee) filter.assignees = req.query.assignee;
  if (req.query.search) filter.title = { $regex: escapeRegex(req.query.search), $options: 'i' };
  const [items, total] = await Promise.all([Task.find(filter).select('-__v').sort({ status: 1, order: 1, updatedAt: -1 }).skip((page - 1) * limit).limit(limit).populate('assignees', 'name email').populate('project', 'name').lean(), Task.countDocuments(filter)]);
  res.json({ success: true, data: { items, page, limit, total } });
});
router.post('/bulk', requireWorkspaceRole(), validate(taskBulkCreateSchema), async (req, res) => {
  const project = await Project.findOne({ _id: req.body.projectId, workspace: req.workspaceId }).select('_id').lean();
  if (!project) throw new AppError('Project not found in this workspace', 404, 'PROJECT_NOT_FOUND');
  const tasks = await Task.insertMany(req.body.tasks.map((task, order) => ({ ...task, workspace: req.workspaceId, project: project._id, creator: req.user.id, order })));
  res.status(201).json({ success: true, data: { items: tasks } });
});
router.post('/', requireWorkspaceRole(), validate(taskCreateSchema), async (req, res) => {
  const { projectId, title } = req.body;
  if (!projectId || typeof title !== 'string' || title.trim().length < 2 || title.length > 200) throw new AppError('A project and task title are required', 400, 'VALIDATION_ERROR');
  const project = await Project.findOne({ _id: projectId, workspace: req.workspaceId }).select('_id').lean();
  if (!project) throw new AppError('Project not found in this workspace', 404, 'PROJECT_NOT_FOUND');
  const assignees = Array.isArray(req.body.assignees) ? [...new Set(req.body.assignees.map(String))] : [];
  if (assignees.length && await WorkspaceMembership.countDocuments({ workspace: req.workspaceId, user: { $in: assignees } }) !== assignees.length) throw new AppError('Every assignee must be a workspace member', 400, 'INVALID_ASSIGNEE');
  const task = await Task.create({ workspace: req.workspaceId, project: project._id, title: title.trim(), description: req.body.description || '', creator: req.user.id, assignees, priority: req.body.priority || 'Medium', status: req.body.status || 'To Do', dueDate: req.body.dueDate || undefined, order: Number.isFinite(req.body.order) ? req.body.order : 0 });
  if (assignees.length) await recordActivity({ workspace: req.workspaceId, actor: req.user.id, type: 'task_assigned', entityType: 'task', entity: task._id, recipients: assignees, details: { title: task.title } });
  res.status(201).json({ success: true, data: { task } });
});
router.patch('/:taskId', async (req, _res, next) => {
  const task = await Task.findById(req.params.taskId).select('workspace status assignees title creator').lean();
  if (!task) throw new AppError('Task not found', 404, 'NOT_FOUND');
  req.params.workspaceId = String(task.workspace); req.originalTask = task; next();
}, requireWorkspaceRole(), validate(taskUpdateSchema), async (req, res) => {
  const allowed = ['title', 'description', 'status', 'priority', 'assignees', 'dueDate', 'order'];
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  if (req.membership.role === 'member' && String(req.originalTask.creator) !== req.user.id && !req.originalTask.assignees.some(id => String(id) === req.user.id) && Object.keys(changes).some(key => !['status', 'order'].includes(key))) throw new AppError('Only the task creator or assignees can edit task details', 403, 'FORBIDDEN');
  if (changes.status && !['To Do', 'In Progress', 'In Review', 'Completed'].includes(changes.status)) throw new AppError('Invalid task status', 400, 'VALIDATION_ERROR');
  if (changes.priority && !['Low', 'Medium', 'High'].includes(changes.priority)) throw new AppError('Invalid priority', 400, 'VALIDATION_ERROR');
  if (changes.title !== undefined) { if (typeof changes.title !== 'string' || changes.title.trim().length < 2 || changes.title.length > 200) throw new AppError('Invalid task title', 400, 'VALIDATION_ERROR'); changes.title = changes.title.trim(); }
  if (changes.assignees !== undefined) {
    if (!Array.isArray(changes.assignees)) throw new AppError('Assignees must be an array', 400, 'VALIDATION_ERROR');
    changes.assignees = [...new Set(changes.assignees.map(String))];
    if (changes.assignees.length && await WorkspaceMembership.countDocuments({ workspace: req.workspaceId, user: { $in: changes.assignees } }) !== changes.assignees.length) throw new AppError('Every assignee must be a workspace member', 400, 'INVALID_ASSIGNEE');
  }
  const before = await Task.findOne({ _id: req.params.taskId, workspace: req.workspaceId }).select('status assignees title').lean();
  const task = await Task.findOneAndUpdate({ _id: req.params.taskId, workspace: req.workspaceId }, { $set: changes }, { returnDocument: 'after', runValidators: true }).populate('assignees', 'name email').lean();
  if (changes.status && before.status !== task.status) await recordActivity({ workspace: req.workspaceId, actor: req.user.id, type: 'task_status_changed', entityType: 'task', entity: task._id, recipients: task.assignees.map(a => a._id), details: { from: before.status, to: task.status, title: task.title } });
  const newlyAssigned = task.assignees.map(a => String(a._id)).filter(id => !before.assignees.some(old => String(old) === id));
  if (newlyAssigned.length) await recordActivity({ workspace: req.workspaceId, actor: req.user.id, type: 'task_assigned', entityType: 'task', entity: task._id, recipients: newlyAssigned, details: { title: task.title } });
  res.json({ success: true, data: { task } });
});
router.delete('/:taskId', async (req, _res, next) => {
  const task = await Task.findById(req.params.taskId).select('workspace creator').lean();
  if (!task) throw new AppError('Task not found', 404, 'NOT_FOUND');
  req.params.workspaceId = String(task.workspace); req.taskCreator = String(task.creator); next();
}, requireWorkspaceRole(), async (req, res) => {
  if (req.membership.role === 'member' && req.taskCreator !== req.user.id) throw new AppError('Only the task creator or a workspace admin can delete this task', 403, 'FORBIDDEN');
  await Task.deleteOne({ _id: req.params.taskId, workspace: req.workspaceId });
  res.json({ success: true, data: { deleted: true } });
});
export default router;
