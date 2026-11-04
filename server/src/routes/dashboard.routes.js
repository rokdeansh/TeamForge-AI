import { Router } from 'express';
import { WorkspaceMembership } from '../models/WorkspaceMembership.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { protect } from '../middleware/protect.js';
import { Activity } from '../models/Activity.js';

const router = Router(); router.use(protect);
router.get('/', async (req, res) => {
  const memberships = await WorkspaceMembership.find({ user: req.user.id }).select('workspace').lean();
  const workspaceIds = memberships.map(m => m.workspace);
  const [workspaceCount, projectStatus, taskStatus, dueSoon, recentProjects, completedByDay, overdueCount, recentActivity] = await Promise.all([
    WorkspaceMembership.countDocuments({ user: req.user.id }),
    Project.aggregate([{ $match: { workspace: { $in: workspaceIds } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Task.aggregate([{ $match: { workspace: { $in: workspaceIds } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Task.find({ workspace: { $in: workspaceIds }, assignees: req.user.id, status: { $ne: 'Completed' }, dueDate: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 86400000) } }).select('title status dueDate project').sort({ dueDate: 1 }).limit(10).lean(),
    Project.find({ workspace: { $in: workspaceIds } }).select('name status updatedAt deadline workspace').sort({ updatedAt: -1 }).limit(5).lean(),
    Task.aggregate([{ $match: { workspace: { $in: workspaceIds }, status: 'Completed', updatedAt: { $gte: new Date(Date.now() - 30 * 86400000) } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Task.countDocuments({ workspace: { $in: workspaceIds }, assignees: req.user.id, status: { $ne: 'Completed' }, dueDate: { $lt: new Date() } }),
    Activity.find({ workspace: { $in: workspaceIds } }).sort({ createdAt: -1 }).limit(8).populate('actor', 'name').lean()
  ]);
  res.json({ success: true, data: { workspaceCount, projectStatus, taskStatus, dueSoon, recentProjects, completedByDay, overdueCount, recentActivity } });
});
export default router;
