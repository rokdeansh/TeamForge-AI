# TeamForge API v1

Base URL: `http://localhost:5000/api/v1`. Private endpoints use the `teamforge_session` HttpOnly cookie. Browser state-changing requests must send the configured `Origin` or `Referer`. All lists accept `page` and `limit` (capped at 100) unless noted.

Successful responses use `{ "success": true, "data": ... }`; errors use `{ "success": false, "error": { "message": "...", "code": "...", "details": [] } }`.

## Health and auth

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | Public | API and database readiness |
| POST | `/auth/register` | Public, rate limited | Create account and session |
| POST | `/auth/login` | Public, rate limited | Start session |
| POST | `/auth/logout` | Public | Clear session cookie |
| GET | `/auth/me` | Session | Read profile |
| PATCH | `/auth/me` | Session | Update name/theme |

Registration body: `{ "name", "email", "password" }`. Login body: `{ "email", "password" }`.

## Workspaces

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/workspaces` | Session | List the caller's workspaces |
| POST | `/workspaces` | Session | Create workspace; caller becomes owner |
| PATCH | `/workspaces/:workspaceId` | Owner/admin | Update name/description |
| GET | `/workspaces/:workspaceId/members` | Workspace member | Paginated member list |
| PATCH | `/workspaces/:workspaceId/members/:userId/role` | Owner/admin | Change role; only owner grants admin |
| DELETE | `/workspaces/:workspaceId/members/:userId` | Owner/admin | Remove a member |
| POST | `/workspaces/:workspaceId/transfer-owner` | Owner | Transfer ownership to a member |
| POST | `/workspaces/:workspaceId/invitations` | Owner/admin | Create expiring, limited-use invite link |
| POST | `/workspaces/invitations/accept` | Session | Accept invite token |
| GET | `/workspaces/:workspaceId/activity` | Workspace member | Paginated activity feed |

## Projects, tasks, and notes

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/projects` | Workspace member | List; filters `workspaceId`, `status`, `search` |
| POST | `/projects` | Owner/admin | Create project |
| GET | `/projects/:projectId` | Workspace member | Read project |
| PATCH/DELETE | `/projects/:projectId` | Owner/admin | Update or delete project |
| GET/POST | `/tasks` | Workspace member | List/create; filters `workspaceId`, `projectId`, `assignee`, `status`, `priority`, `search` |
| POST | `/tasks/bulk` | Workspace member | Create explicitly approved AI plan tasks |
| PATCH | `/tasks/:taskId` | Workspace member | Update task; non-creators/non-assignees may move status/order only |
| DELETE | `/tasks/:taskId` | Owner/admin or creator | Delete task |
| GET/POST | `/notes` | Workspace member | Paginated list and create; supports text search |
| GET/PATCH/DELETE | `/notes/:noteId` | Workspace member/read; owner/admin/delete | Read, update, or delete note |

Project statuses: `Planning`, `In Progress`, `On Hold`, `Completed`. Task statuses: `To Do`, `In Progress`, `In Review`, `Completed`. Task priorities: `Low`, `Medium`, `High`.

## Chat, dashboard, notifications, and AI

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/messages?workspaceId=...` | Workspace member | Paginated workspace chat history |
| Socket.IO | `workspace:join` | Cookie + membership | Join an authorized workspace room |
| Socket.IO | `message:send` | Joined member | Validate and persist plain-text message |
| Socket.IO | `message:new` | Room members | Receive persisted message |
| GET | `/dashboard?workspaceId=...` | Session | Aggregated workspace metrics and recent data |
| GET | `/notifications` | Session | Paginated notifications and unread count |
| PATCH | `/notifications/:notificationId/read` | Recipient | Mark one notification read |
| POST | `/notifications/read-all` | Session | Mark caller's notifications read |
| POST | `/ai/plan` | Workspace member, rate limited | Generate Zod-validated plan preview |
| POST | `/ai/breakdown` | Workspace member, rate limited | Generate Zod-validated task subtasks |
| POST | `/ai/summarize` | Workspace member, rate limited | Summarize authorized project context and workspace discussion |
| POST | `/ai/ask` | Workspace member, rate limited | Ask using authorized project data |

AI request bodies include `workspaceId`; project operations include `projectId`. Plan and summary suggestions are not persisted unless the user explicitly chooses task creation.
