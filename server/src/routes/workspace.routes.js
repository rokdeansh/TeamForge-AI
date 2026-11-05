import { Router } from 'express';
import { Workspace } from '../models/Workspace.js';
import { WorkspaceMembership } from '../models/WorkspaceMembership.js';
import { AppError } from '../utils/AppError.js';
import { protect } from '../middleware/protect.js';
import { requireWorkspaceRole } from '../middleware/workspaceRole.js';
import { randomBytes, createHash } from 'node:crypto';
import { Invitation } from '../models/Invitation.js';
import { Activity } from '../models/Activity.js';
import { Notification } from '../models/Notification.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { Note } from '../models/Note.js';
import { Message } from '../models/Message.js';
import { validate } from '../middleware/validate.js';
import { workspaceCreateSchema, workspaceUpdateSchema, invitationSchema, acceptInvitationSchema } from '../validators/resource.validators.js';

const router = Router(); router.use(protect);
router.get('/', async (req, res) => {
  const memberships = await WorkspaceMembership.find({ user: req.user.id }).select('workspace role').lean();
  const workspaces = await Workspace.find({ _id: { $in: memberships.map(m => m.workspace) } }).sort({ updatedAt: -1 }).lean();
  const roles = new Map(memberships.map(m => [String(m.workspace), m.role]));
  res.json({ success: true, data: { items: workspaces.map(w => ({ ...w, role: roles.get(String(w._id)) })), page: 1, limit: 50, total: workspaces.length } });
});
router.post('/', validate(workspaceCreateSchema), async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  if (name.length < 2 || name.length > 100 || description.length > 1000) throw new AppError('Workspace name must be 2 to 100 characters', 400, 'VALIDATION_ERROR');
  const workspace = await Workspace.create({ name, description, createdBy: req.user.id });
  try { await WorkspaceMembership.create({ workspace: workspace._id, user: req.user.id, role: 'owner' }); }
  catch (error) { await Workspace.deleteOne({ _id: workspace._id }); throw error; }
  res.status(201).json({ success: true, data: { workspace: { ...workspace.toObject(), role: 'owner' } } });
});
router.get('/:workspaceId/members', requireWorkspaceRole(), async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1), limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const filter = { workspace: req.workspaceId };
  const [items, total] = await Promise.all([WorkspaceMembership.find(filter).sort({ joinedAt: 1 }).skip((page - 1) * limit).limit(limit).populate('user', 'name email').lean(), WorkspaceMembership.countDocuments(filter)]);
  res.json({ success: true, data: { items, page, limit, total } });
});
router.patch('/:workspaceId', requireWorkspaceRole('owner', 'admin'), validate(workspaceUpdateSchema), async (req, res) => {
  const changes = {};
  if (typeof req.body.name === 'string' && req.body.name.trim().length >= 2 && req.body.name.length <= 100) changes.name = req.body.name.trim();
  if (typeof req.body.description === 'string' && req.body.description.length <= 1000) changes.description = req.body.description.trim();
  if (!Object.keys(changes).length) throw new AppError('No valid workspace changes provided', 400, 'VALIDATION_ERROR');
  const workspace = await Workspace.findByIdAndUpdate(req.workspaceId, { $set: changes }, { returnDocument: 'after', runValidators: true }).lean();
  res.json({ success: true, data: { workspace } });
});
router.delete('/:workspaceId', requireWorkspaceRole('owner'), async (req, res) => {
  const workspaceId = req.workspaceId;
  await Promise.all([
    Task.deleteMany({ workspace: workspaceId }),
    Project.deleteMany({ workspace: workspaceId }),
    Note.deleteMany({ workspace: workspaceId }),
    Message.deleteMany({ workspace: workspaceId }),
    WorkspaceMembership.deleteMany({ workspace: workspaceId }),
    Invitation.deleteMany({ workspace: workspaceId }),
    Activity.deleteMany({ workspace: workspaceId }),
    Notification.deleteMany({ workspace: workspaceId })
  ]);
  await Workspace.deleteOne({ _id: workspaceId });
  res.json({ success: true, data: { deleted: true } });
});
router.post('/:workspaceId/invitations', requireWorkspaceRole('owner', 'admin'), validate(invitationSchema), async (req, res) => {
  const role = req.body.role === 'admin' && req.membership.role === 'owner' ? 'admin' : 'member';
  const days = Math.min(30, Math.max(1, Number.parseInt(req.body.expiresInDays, 10) || 7));
  const maxUses = Math.min(50, Math.max(1, Number.parseInt(req.body.maxUses, 10) || 1));
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const invite = await Invitation.create({ workspace: req.workspaceId, tokenHash, role, maxUses, expiresAt: new Date(Date.now() + days * 86400000), createdBy: req.user.id });
  const inviteUrl = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/join?token=${token}`;
  res.status(201).json({ success: true, data: { invitation: { id: invite.id, role, maxUses, expiresAt: invite.expiresAt, inviteUrl } } });
});
router.post('/invitations/accept', validate(acceptInvitationSchema), async (req, res) => {
  const token = typeof req.body.token === 'string' ? req.body.token : '';
  if (token.length < 30 || token.length > 200) throw new AppError('Invitation token is invalid', 400, 'INVALID_INVITATION');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const invite = await Invitation.findOneAndUpdate({ tokenHash, expiresAt: { $gt: new Date() }, $expr: { $lt: ['$usedCount', '$maxUses'] } }, { $inc: { usedCount: 1 } }, { returnDocument: 'after' }).lean();
  if (!invite) throw new AppError('Invitation is expired, used, or invalid', 410, 'INVITATION_UNAVAILABLE');
  try { await WorkspaceMembership.create({ workspace: invite.workspace, user: req.user.id, role: invite.role }); }
  catch (error) { await Invitation.updateOne({ _id: invite._id }, { $inc: { usedCount: -1 } }); if (error?.code === 11000) throw new AppError('You are already a workspace member', 409, 'ALREADY_MEMBER'); throw error; }
  const workspace = await Workspace.findById(invite.workspace).lean();
  await Promise.all([
    Activity.create({ workspace: invite.workspace, actor: invite.createdBy, type: 'workspace_joined', entityType: 'workspace', entity: invite.workspace }),
    Notification.create({ recipient: req.user.id, workspace: invite.workspace, actor: invite.createdBy, type: 'workspace_joined', entityType: 'workspace', entity: invite.workspace })
  ]);
  res.status(200).json({ success: true, data: { workspace, role: invite.role } });
});
router.patch('/:workspaceId/members/:userId/role', requireWorkspaceRole('owner', 'admin'), async (req, res) => {
  if (!['admin', 'member'].includes(req.body.role) || (req.body.role === 'admin' && req.membership.role !== 'owner')) throw new AppError('Only an owner can assign the admin role', 403, 'FORBIDDEN');
  const member = await WorkspaceMembership.findOneAndUpdate({ workspace: req.workspaceId, user: req.params.userId, role: { $ne: 'owner' } }, { $set: { role: req.body.role } }, { returnDocument: 'after' }).populate('user', 'name email').lean();
  if (!member) throw new AppError('Member not found or cannot change the owner role', 404, 'MEMBER_NOT_FOUND');
  res.json({ success: true, data: { membership: member } });
});
router.delete('/:workspaceId/members/:userId', requireWorkspaceRole('owner', 'admin'), async (req, res) => {
  const query = { workspace: req.workspaceId, user: req.params.userId, role: { $ne: 'owner' } };
  if (req.membership.role === 'admin') query.role = 'member';
  const result = await WorkspaceMembership.deleteOne(query);
  if (!result.deletedCount) throw new AppError('Member not found or cannot be removed by this role', 404, 'MEMBER_NOT_FOUND');
  res.json({ success: true, data: { removed: true } });
});
router.post('/:workspaceId/transfer-owner', requireWorkspaceRole('owner'), async (req, res) => {
  const userId = String(req.body.userId || '');
  if (!userId || userId === req.user.id) throw new AppError('Choose another workspace member as the new owner', 400, 'VALIDATION_ERROR');
  const successor = await WorkspaceMembership.findOne({ workspace: req.workspaceId, user: userId, role: { $ne: 'owner' } }).lean();
  if (!successor) throw new AppError('New owner must already be a workspace member', 404, 'MEMBER_NOT_FOUND');
  const previousOwner = await WorkspaceMembership.findOneAndUpdate({ workspace: req.workspaceId, user: req.user.id, role: 'owner' }, { $set: { role: 'admin' } }, { returnDocument: 'after' });
  if (!previousOwner) throw new AppError('Workspace ownership has already changed', 409, 'OWNER_CHANGED');
  try {
    const newOwner = await WorkspaceMembership.findOneAndUpdate({ workspace: req.workspaceId, user: userId, role: successor.role }, { $set: { role: 'owner' } }, { returnDocument: 'after' }).lean();
    if (!newOwner) throw new Error('Ownership transfer could not be committed');
  } catch (error) {
    await WorkspaceMembership.updateOne({ workspace: req.workspaceId, user: req.user.id, role: 'admin' }, { $set: { role: 'owner' } });
    throw error;
  }
  res.json({ success: true, data: { transferred: true, previousOwnerRole: previousOwner.role } });
});
router.get('/:workspaceId/activity', requireWorkspaceRole(), async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1), limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const [items, total] = await Promise.all([Activity.find({ workspace: req.workspaceId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('actor', 'name').lean(), Activity.countDocuments({ workspace: req.workspaceId })]);
  res.json({ success: true, data: { items, page, limit, total } });
});
export default router;
