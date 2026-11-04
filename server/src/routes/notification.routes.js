import { Router } from 'express';
import { protect } from '../middleware/protect.js';
import { Notification } from '../models/Notification.js';

const router = Router(); router.use(protect);
router.get('/', async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1), limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const filter = { recipient: req.user.id };
  const [items, total, unreadCount] = await Promise.all([Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('actor', 'name').lean(), Notification.countDocuments(filter), Notification.countDocuments({ ...filter, read: false })]);
  res.json({ success: true, data: { items, page, limit, total, unreadCount } });
});
router.patch('/:notificationId/read', async (req, res) => {
  const notification = await Notification.findOneAndUpdate({ _id: req.params.notificationId, recipient: req.user.id }, { $set: { read: true } }, { returnDocument: 'after' }).lean();
  if (!notification) return res.status(404).json({ success: false, error: { message: 'Notification not found', code: 'NOT_FOUND' } });
  res.json({ success: true, data: { notification } });
});
router.post('/read-all', async (req, res) => {
  const result = await Notification.updateMany({ recipient: req.user.id, read: false }, { $set: { read: true } });
  res.json({ success: true, data: { updatedCount: result.modifiedCount } });
});
export default router;
