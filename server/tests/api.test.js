import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Workspace } from '../src/models/Workspace.js';
import { WorkspaceMembership } from '../src/models/WorkspaceMembership.js';
import { Project } from '../src/models/Project.js';
import { Task } from '../src/models/Task.js';
import { Invitation } from '../src/models/Invitation.js';

const origin = 'http://localhost:5173';
let mongo;
beforeAll(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongo.stop(); });
beforeEach(async () => { await Promise.all([User.deleteMany({}), Workspace.deleteMany({}), WorkspaceMembership.deleteMany({}), Project.deleteMany({}), Task.deleteMany({}), Invitation.deleteMany({})]); });

async function register(name, email) {
  const response = await request(app).post('/api/v1/auth/register').set('Origin', origin).send({ name, email, password: 'test-password-42' });
  expect(response.status).toBe(201);
  return { user: response.body.data.user, cookie: response.headers['set-cookie'][0].split(';')[0] };
}

describe('authentication and workspace APIs', () => {
  it('registers, logs in, protects profile, and never returns password hashes', async () => {
    const { user, cookie } = await register('Ada Lovelace', 'ada@example.com');
    expect(user.passwordHash).toBeUndefined();
    const profile = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(profile.status).toBe(200);
    const login = await request(app).post('/api/v1/auth/login').set('Origin', origin).send({ email: 'ADA@example.com', password: 'test-password-42' });
    expect(login.status).toBe(200);
    const badLogin = await request(app).post('/api/v1/auth/login').set('Origin', origin).send({ email: 'ada@example.com', password: 'wrong-password' });
    expect(badLogin.status).toBe(401);
  });

  it('rejects duplicate users, invalid data, unauthenticated access, and untrusted origins', async () => {
    const body = { name: 'Ada Lovelace', email: 'ada@example.com', password: 'test-password-42' };
    await request(app).post('/api/v1/auth/register').set('Origin', origin).send(body);
    const duplicate = await request(app).post('/api/v1/auth/register').set('Origin', origin).send(body);
    expect(duplicate.status).toBe(409);
    const invalid = await request(app).post('/api/v1/auth/register').set('Origin', origin).send({ ...body, email: 'bad' });
    expect(invalid.status).toBe(400);
    expect((await request(app).get('/api/v1/workspaces')).status).toBe(401);
    const csrf = await request(app).post('/api/v1/auth/login').set('Origin', 'https://attacker.invalid').send({ email: body.email, password: body.password });
    expect(csrf.status).toBe(403);
  });

  it('creates a workspace owner and restricts private project and task data to members', async () => {
    const owner = await register('Ada Lovelace', 'ada@example.com');
    const outsider = await register('Grace Hopper', 'grace@example.com');
    const createdWorkspace = await request(app).post('/api/v1/workspaces').set('Cookie', owner.cookie).set('Origin', origin).send({ name: 'Research team' });
    expect(createdWorkspace.status).toBe(201);
    const workspaceId = createdWorkspace.body.data.workspace._id;
    expect(createdWorkspace.body.data.workspace.role).toBe('owner');
    const project = await request(app).post('/api/v1/projects').set('Cookie', owner.cookie).set('Origin', origin).send({ workspaceId, name: 'Prototype' });
    expect(project.status).toBe(201);
    const projectId = project.body.data.project._id;
    const task = await request(app).post('/api/v1/tasks').set('Cookie', owner.cookie).set('Origin', origin).send({ workspaceId, projectId, title: 'Map requirements' });
    expect(task.status).toBe(201);
    const denied = await request(app).get(`/api/v1/projects/${projectId}`).set('Cookie', outsider.cookie);
    expect(denied.status).toBe(403);
    expect(await Task.countDocuments({ project: projectId })).toBe(1);
  });

  it('stores only an invite token hash and lets the invited account join once', async () => {
    const owner = await register('Ada Lovelace', 'ada@example.com');
    const invited = await register('Grace Hopper', 'grace@example.com');
    const workspace = await request(app).post('/api/v1/workspaces').set('Cookie', owner.cookie).set('Origin', origin).send({ name: 'Research team' });
    const workspaceId = workspace.body.data.workspace._id;
    const created = await request(app).post(`/api/v1/workspaces/${workspaceId}/invitations`).set('Cookie', owner.cookie).set('Origin', origin).send({ role: 'member', expiresInDays: 7, maxUses: 1 });
    expect(created.status).toBe(201);
    const token = new URL(created.body.data.invitation.inviteUrl).searchParams.get('token');
    const storedInvite = await Invitation.findOne({ workspace: workspaceId }).lean();
    expect(storedInvite.tokenHash).not.toBe(token);
    const accepted = await request(app).post('/api/v1/workspaces/invitations/accept').set('Cookie', invited.cookie).set('Origin', origin).send({ token });
    expect(accepted.status).toBe(200);
    const reused = await request(app).post('/api/v1/workspaces/invitations/accept').set('Cookie', invited.cookie).set('Origin', origin).send({ token });
    expect(reused.status).toBe(410);
    const transfer = await request(app).post(`/api/v1/workspaces/${workspaceId}/transfer-owner`).set('Cookie', owner.cookie).set('Origin', origin).send({ userId: invited.user.id });
    expect(transfer.status).toBe(200);
    expect(await WorkspaceMembership.countDocuments({ workspace: workspaceId, role: 'owner' })).toBe(1);
  });
});
