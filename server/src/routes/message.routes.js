import { Router } from 'express';
import { Message } from '../models/Message.js';
import { protect } from '../middleware/protect.js';
import { requireWorkspaceRole } from '../middleware/workspaceRole.js';

const router = Router(); router.use(protect);
router.get('/', requireWorkspaceRole(), async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1), limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const [items, total] = await Promise.all([Message.find({ workspace: req.workspaceId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('sender', 'name').lean(), Message.countDocuments({ workspace: req.workspaceId })]);
  res.json({ success: true, data: { items: items.reverse(), page, limit, total } });
});
export default router;
