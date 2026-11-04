import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AUTH_COOKIE } from '../utils/authCookies.js';
import { User } from '../models/User.js';
import { WorkspaceMembership } from '../models/WorkspaceMembership.js';
import { Message } from '../models/Message.js';

export function configureSockets(io) {
  io.use(async (socket, next) => {
    try {
      if (socket.handshake.headers.origin !== env.CLIENT_ORIGIN) return next(new Error('Origin is not allowed'));
      const cookieHeader = socket.handshake.headers.cookie || '';
      const cookieValue = cookieHeader.split(';').map(s => s.trim()).find(s => s.startsWith(`${AUTH_COOKIE}=`))?.slice(AUTH_COOKIE.length + 1);
      if (!cookieValue) return next(new Error('Authentication required'));
      const claims = jwt.verify(decodeURIComponent(cookieValue), env.JWT_SECRET, { issuer: 'teamforge-ai' });
      const user = await User.findById(claims.sub).select('_id name').lean();
      if (!user) return next(new Error('Authentication required'));
      socket.data.user = { id: String(user._id), name: user.name };
      next();
    } catch { next(new Error('Authentication required')); }
  });
  io.on('connection', socket => {
    socket.data.workspaces = new Set();
    socket.on('workspace:join', async (workspaceId, ack = () => {}) => {
      try {
        const member = await WorkspaceMembership.exists({ workspace: workspaceId, user: socket.data.user.id });
        if (!member) return ack({ success: false, error: 'Workspace access denied' });
        const room = `workspace:${workspaceId}`;
        await socket.join(room); socket.data.workspaces.add(String(workspaceId));
        ack({ success: true });
      } catch { ack({ success: false, error: 'Could not join workspace' }); }
    });
    socket.on('message:send', async (payload, ack = () => {}) => {
      try {
        const workspaceId = String(payload?.workspaceId || '');
        const content = typeof payload?.content === 'string' ? payload.content.trim() : '';
        if (!socket.data.workspaces.has(workspaceId) || !await WorkspaceMembership.exists({ workspace: workspaceId, user: socket.data.user.id })) return ack({ success: false, error: 'Workspace access denied' });
        if (!content || content.length > 4000) return ack({ success: false, error: 'Message must be 1 to 4000 characters' });
        const message = await Message.create({ workspace: workspaceId, sender: socket.data.user.id, content });
        const data = { id: String(message._id), workspace: workspaceId, sender: socket.data.user, content, createdAt: message.createdAt };
        io.to(`workspace:${workspaceId}`).emit('message:new', data);
        ack({ success: true, data });
      } catch { ack({ success: false, error: 'Message could not be sent' }); }
    });
    socket.on('disconnect', () => { socket.data.workspaces.clear(); });
  });
}
