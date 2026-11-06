# TeamForge AI

TeamForge AI is a collaborative workspace for projects, tasks, shared notes, real-time chat, and AI-assisted planning. The web client is React + Vite; the API is Express 5 with MongoDB/Mongoose.

## Requirements

- Node.js 20.19+ (Node 24 LTS recommended)
- MongoDB 7+ locally, or a MongoDB Atlas connection string
- An OpenAI-compatible chat-completions endpoint and API key for the AI planner (optional; other app features work without it)

## Local development

### API

```powershell
cd server
npm install
Copy-Item .env.example .env
npm run dev
```

Set `MONGODB_URI` in `server/.env` to your local database or Atlas URI. The API runs on port 5000 by default.

### Web client

In a second terminal:

```powershell
cd client
npm install
Copy-Item .env.example .env
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`. The client talks to `VITE_API_URL` and opens Socket.IO at `VITE_SOCKET_URL`.

## Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `NODE_ENV` | Runtime mode | `development` |
| `PORT` | API port | `5000` |
| `MONGODB_URI` | MongoDB connection string | local `teamforge_ai` database |
| `CLIENT_ORIGIN` | Allowed browser origin for CORS and CSRF checks | `http://localhost:5173` |
| `JWT_SECRET` | Cookie session signing secret | development-only value; set a random 32+ character value in production |
| `JWT_EXPIRES_IN` | Session lifetime | `7d` |
| `COOKIE_SAME_SITE` | Session cookie policy (`lax`, `strict`, or `none`) | `lax` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID for Gmail API email sending | unset |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | unset |
| `GOOGLE_REFRESH_TOKEN` | Offline OAuth refresh token with `gmail.send` access | unset |
| `GOOGLE_SENDER_EMAIL` | Gmail address that authorized the refresh token | unset |
| `AI_API_URL` | Full chat-completions endpoint URL | unset |
| `AI_API_KEY` | Server-side provider key | unset |
| `AI_MODEL` | Model name understood by the configured endpoint | unset |
| `VITE_API_URL` | Client API base URL including `/api/v1` | `http://localhost:5000/api/v1` |
| `VITE_SOCKET_URL` | Client Socket.IO origin | `http://localhost:5000` |

For separate frontend and backend sites in production, use HTTPS, set `COOKIE_SAME_SITE=none`, and keep the cookie `Secure` setting enabled by production mode. Never put AI keys in `client/.env` or any `VITE_` variable.

Registration email uses the Gmail API over HTTPS. In Google Cloud Console, create a project, enable the Gmail API, configure the OAuth consent screen, and create a Web application OAuth client. Add `https://developers.google.com/oauthplayground` as an authorized redirect URI. In [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/), enable **Use your own OAuth credentials**, enter that client ID and secret, request only `https://www.googleapis.com/auth/gmail.send`, authorize the same Gmail account you want to send from, and exchange the authorization code for tokens. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, and `GOOGLE_SENDER_EMAIL` in `server/.env` locally and in the Render service environment in production. Keep these credentials server-side; never put them in a `VITE_` variable or commit them. Google OAuth apps left in external Testing mode issue refresh tokens that expire after 7 days, so follow Google's publishing and verification requirements for a persistent production setup.

## Implemented API

All REST endpoints are under `/api/v1`; responses use `{ success, data }` or `{ success: false, error }`.

- `GET /health`
- Auth: registration email-code verification, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `PATCH /auth/me`
- Workspaces: list/create/update, member list and role changes, member removal, invitation creation and acceptance, ownership transfer, and activity feed
- Projects: create/list/read/update/delete; list supports workspace, status, search, page, and limit filters
- Tasks: create/list/update/delete; list supports workspace, project, assignee, status, priority, search, page, and limit filters
- Notes: create/list/read/update/delete and text search
- Chat: paginated `GET /messages`; Socket.IO events `workspace:join`, `message:send`, and `message:new`
- AI: `POST /ai/plan`, `/ai/breakdown`, `/ai/summarize`, and `/ai/ask`; output is schema-checked and suggestions are not saved automatically
- Dashboard: `GET /dashboard`; Notifications: list, mark one read, and mark all read

The detailed method, access, and request table is in [docs/API.md](docs/API.md).
The model relationship diagram and permission notes are in [docs/architecture.md](docs/architecture.md).

Private endpoints check the authenticated user and workspace membership on the server. Workspace invites store only a SHA-256 token hash and are expiry/use limited.

## Tests and checks

```powershell
cd server
npm test
```

The backend tests use `mongodb-memory-server`; client component tests run with `cd client; npm test`. For a production bundle check:

```powershell
cd client
npm run build
```

## Deployment configuration

Deploy `client/` as the Vercel project root and `server/` as the Render/Railway service root. Configure a MongoDB Atlas database and set the backend environment values: `NODE_ENV=production`, `MONGODB_URI`, a random `JWT_SECRET` of at least 32 characters, `CLIENT_ORIGIN` to the exact HTTPS Vercel origin, `COOKIE_SAME_SITE=none`, and `AI_API_URL`/`AI_API_KEY`/`AI_MODEL` if AI is enabled. Production mode sets the session cookie's `Secure` flag. In Vercel, set `VITE_API_URL` to the backend URL plus `/api/v1` and `VITE_SOCKET_URL` to the backend origin. Configure health checks against `/api/v1/health`.

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, and `GOOGLE_SENDER_EMAIL` in the backend deployment environment or registration emails will be unavailable. The sender email must be the same Gmail account used to authorize the refresh token.

## Current limitations

- Workspace invites use copyable links; email delivery is not implemented.
- The AI transport expects an OpenAI-compatible chat-completions endpoint. It can be swapped in `server/src/services/ai/provider.js`.
- AI supports plan drafting, task breakdown, project Q&A, and discussion summaries. It needs a configured provider; the discussion summary currently uses recent workspace messages because chat is workspace-scoped.
- Profile avatar/password change, notification preferences, chat history pagination controls, task reorder precision, ownership transfer UI, and a full accessibility audit need further work.
- Collaboration is workspace-scoped; project-specific chat rooms and live note collaboration are not implemented.
