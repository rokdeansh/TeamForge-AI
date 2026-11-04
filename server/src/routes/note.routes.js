import { Router } from 'express';
import { Note } from '../models/Note.js';
import { protect } from '../middleware/protect.js';
import { requireWorkspaceRole } from '../middleware/workspaceRole.js';
import { AppError } from '../utils/AppError.js';
import { validate } from '../middleware/validate.js';
import { noteCreateSchema, noteUpdateSchema } from '../validators/resource.validators.js';

const router = Router(); router.use(protect);
router.get('/', requireWorkspaceRole(), async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1), limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const filter = { workspace: req.workspaceId };
  if (req.query.projectId) filter.project = req.query.projectId;
  if (req.query.search) filter.$text = { $search: String(req.query.search).slice(0, 100) };
  const [items, total] = await Promise.all([Note.find(filter).select('workspace project author title updatedAt createdAt').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Note.countDocuments(filter)]);
  res.json({ success: true, data: { items, page, limit, total } });
});
router.post('/', requireWorkspaceRole(), validate(noteCreateSchema), async (req, res) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  if (title.length < 1 || title.length > 200 || (req.body.content || '').length > 30000) throw new AppError('Invalid note title or content', 400, 'VALIDATION_ERROR');
  const note = await Note.create({ workspace: req.workspaceId, project: req.body.projectId || null, author: req.user.id, title, content: req.body.content || '' });
  res.status(201).json({ success: true, data: { note } });
});
router.get('/:noteId', async (req, _res, next) => {
  const note = await Note.findById(req.params.noteId).select('workspace').lean();
  if (!note) throw new AppError('Note not found', 404, 'NOT_FOUND');
  req.params.workspaceId = String(note.workspace); next();
}, requireWorkspaceRole(), async (req, res) => {
  const note = await Note.findOne({ _id: req.params.noteId, workspace: req.workspaceId }).populate('author', 'name').lean();
  res.json({ success: true, data: { note } });
});
router.patch('/:noteId', async (req, _res, next) => {
  const note = await Note.findById(req.params.noteId).select('workspace').lean();
  if (!note) throw new AppError('Note not found', 404, 'NOT_FOUND');
  req.params.workspaceId = String(note.workspace); next();
}, requireWorkspaceRole(), async (req, res) => {
  const changes = {};
  if (typeof req.body.title === 'string' && req.body.title.trim().length > 0 && req.body.title.length <= 200) changes.title = req.body.title.trim();
  if (typeof req.body.content === 'string' && req.body.content.length <= 30000) changes.content = req.body.content;
  if (!Object.keys(changes).length) throw new AppError('No valid note changes provided', 400, 'VALIDATION_ERROR');
  const note = await Note.findOneAndUpdate({ _id: req.params.noteId, workspace: req.workspaceId }, { $set: changes }, { returnDocument: 'after', runValidators: true }).lean();
  res.json({ success: true, data: { note } });
});
router.delete('/:noteId', async (req, _res, next) => {
  const note = await Note.findById(req.params.noteId).select('workspace').lean();
  if (!note) throw new AppError('Note not found', 404, 'NOT_FOUND');
  req.params.workspaceId = String(note.workspace); next();
}, requireWorkspaceRole('owner', 'admin'), async (req, res) => {
  await Note.deleteOne({ _id: req.params.noteId, workspace: req.workspaceId });
  res.json({ success: true, data: { deleted: true } });
});
export default router;
