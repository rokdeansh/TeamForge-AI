import { createServer } from 'node:http';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Server as SocketServer } from 'socket.io';
import { io as socketClient } from 'socket.io-client';
import { env } from '../src/config/env.js';
import { configureSockets } from '../src/sockets/index.js';
import { User } from '../src/models/User.js';
import { Workspace } from '../src/models/Workspace.js';
import { WorkspaceMembership } from '../src/models/WorkspaceMembership.js';
import { Message } from '../src/models/Message.js';

const origin = 'http://localhost:5173';
let mongo, httpServer, io, user, workspace, token, baseUrl;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri());
  user = await User.create({ name: 'Socket User', email: 'socket@example.com', passwordHash: 'already-hashed-placeholder' });
  workspace = await Workspace.create({ name: 'Socket workspace', createdBy: user.id });
  await WorkspaceMembership.create({ workspace: workspace.id, user: user.id, role: 'owner' });
  token = jwt.sign({ sub: user.id }, env.JWT_SECRET, { issuer: 'teamforge-ai', expiresIn: '10m' });
  httpServer = createServer(); io = new SocketServer(httpServer, { cors: { origin, credentials: true } }); configureSockets(io);
  await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});
afterAll(async () => { await new Promise(resolve => io.close(resolve)); await mongoose.disconnect(); await mongo.stop(); });

describe('Socket.IO workspace authorization', () => {
  it('authenticates cookies, checks workspace membership before joining, and persists allowed messages', async () => {
    const client = socketClient(baseUrl, { transports: ['websocket'], reconnection: false, extraHeaders: { Cookie: `teamforge_session=${token}`, Origin: origin } });
    await new Promise((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); });
    const secondUser = await User.create({ name: 'Second member', email: 'second-socket@example.com', passwordHash: 'already-hashed-placeholder' });
    await WorkspaceMembership.create({ workspace: workspace.id, user: secondUser.id, role: 'member' });
    const secondToken = jwt.sign({ sub: secondUser.id }, env.JWT_SECRET, { issuer: 'teamforge-ai', expiresIn: '10m' });
    const secondClient = socketClient(baseUrl, { transports: ['websocket'], reconnection: false, extraHeaders: { Cookie: `teamforge_session=${secondToken}`, Origin: origin } });
    await new Promise((resolve, reject) => { secondClient.once('connect', resolve); secondClient.once('connect_error', reject); });
    const deniedJoin = await new Promise(resolve => client.emit('workspace:join', '507f1f77bcf86cd799439011', resolve));
    expect(deniedJoin.success).toBe(false);
    const joined = await new Promise(resolve => client.emit('workspace:join', String(workspace.id), resolve));
    expect(joined.success).toBe(true);
    const secondJoined = await new Promise(resolve => secondClient.emit('workspace:join', String(workspace.id), resolve));
    expect(secondJoined.success).toBe(true);
    const received = new Promise(resolve => secondClient.once('message:new', resolve));
    const acknowledgement = await new Promise(resolve => client.emit('message:send', { workspaceId: String(workspace.id), content: 'Hello team' }, resolve));
    expect(acknowledgement.success).toBe(true);
    await expect(received).resolves.toMatchObject({ content: 'Hello team', workspace: String(workspace.id), sender: { id: String(user.id) } });
    expect(await Message.countDocuments({ workspace: workspace.id, sender: user.id, content: 'Hello team' })).toBe(1);
    client.disconnect(); secondClient.disconnect();
  });

  it('rejects a socket handshake without the session cookie', async () => {
    const client = socketClient(baseUrl, { transports: ['websocket'], reconnection: false, extraHeaders: { Origin: origin } });
    const error = await new Promise(resolve => client.once('connect_error', resolve));
    expect(error.message).toContain('Authentication required');
    client.disconnect();
  });
});
