import { WorkspaceMembership } from '../models/WorkspaceMembership.js';
import { AppError } from '../utils/AppError.js';

export function requireWorkspaceRole(...roles) {
  return async (req, _res, next) => {
    try {
      const workspaceId = req.params.workspaceId || req.params.id || req.body?.workspaceId || req.query.workspaceId;
      if (!workspaceId) throw new AppError('Workspace is required', 400, 'WORKSPACE_REQUIRED');
      const membership = await WorkspaceMembership.findOne({ workspace: workspaceId, user: req.user.id }).lean();
      if (!membership) throw new AppError('Workspace access denied', 403, 'FORBIDDEN');
      if (roles.length && !roles.includes(membership.role)) throw new AppError('Insufficient workspace role', 403, 'FORBIDDEN');
      req.workspaceId = String(membership.workspace); req.membership = membership; next();
    } catch (error) { next(error); }
  };
}
