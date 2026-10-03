# ClientFlow

A full-stack agency operations workspace built with Node.js, SQLite, and browser-native JavaScript. Manage client relationships, deliverables, team workloads, time, and invoice status through one responsive dashboard.

**Portfolio demonstration, built with AI assistance.** All seeded clients, invoices, and activity are fictional. This is a single-workspace prototype, not an accounting system or a production SaaS product.

## Run locally

Install Node.js 24 or later. No third-party packages or package installation are required.

```bash
npm start
```

Open http://localhost:3000. A SQLite database is created in `data/clientflow.db` on the first run and retained across restarts.

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@clientflow.local | DemoPass123! |
| Member | member@clientflow.local | DemoPass123! |

Demo credentials are intentionally public. Run this version locally; replace account provisioning and demo credentials before any public deployment.

## Workflows

- Overview calculates project totals, completed tasks, paid invoice revenue, and tracked hours from database records.
- Admins create clients, projects, and draft invoices.
- Both roles create tasks, assign a teammate, filter the board, and move tasks between todo, doing, and done.
- Team members log positive time durations against tasks. Ownership comes from the session, not user input.
- Invoices advance from draft to sent to paid; skipped and reversed transitions return HTTP 409. “Sent” records a status only; this app does not send emails or process payments.
- Successful mutations generate an activity entry.
- Searches filter project names, task titles, or client names/companies in their respective views.

## Architecture

`server.js` owns HTTP routing, session authentication, validation, authorization, database access, and demo seeding. `public/app.js` implements UI rendering, navigation, forms, and API calls; `public/style.css` implements the responsive design. `test/api.test.js` exercises the live HTTP API against an isolated database.

The server uses Node's built-in `node:sqlite` API, prepared statements, foreign keys, integer cents for currency, salted scrypt password hashes, random expiring session tokens, HttpOnly SameSite cookies, a login attempt limit, origin validation, a 16 KB request-body limit, and a restricted static-file allowlist. Browser strings are HTML-escaped, and a Content Security Policy disallows inline scripts.

All authenticated users share one workspace. Roles protect billing and client/project creation; tasks and timesheets are shared team resources. This is not tenant isolation or per-project authorization.

## API

| Method | Route | Access / behavior |
| --- | --- | --- |
| POST | `/api/login` | Email and password; session cookie |
| POST | `/api/logout` | Revoke current session |
| GET | `/api/workspace` | Authenticated workspace snapshot |
| POST | `/api/clients` | Admin; name, email, company |
| POST | `/api/projects` | Admin; name, client_id, budget in cents, deadline |
| POST | `/api/tasks` | Team; project_id, title, assignee |
| PATCH | `/api/tasks/:id` | Team; status |
| POST | `/api/time` | Team; task_id, minutes, note |
| POST | `/api/invoices` | Admin; project_id, amount in cents, due |
| PATCH | `/api/invoices/:id` | Admin; next status |

Dates use `YYYY-MM-DD`. SQLite activity timestamps use UTC. The UI displays invoice amounts in USD. The API returns 400 for invalid fields, 401 for missing credentials, 403 for insufficient permissions, 404 for missing records, and 409 for invalid invoice transitions.

## Validation

```bash
npm run check
npm test
```

Tests cover authentication, logout, role restrictions, password-hash exclusion, persistence within requests, audit records, foreign keys, date validation, task updates, time ownership, invoice transitions, origin rejection, and SQL injection input.

Manual walkthrough: sign in as admin, add a client, create a project for that client, create a task, move it to doing, log time, create an invoice, mark it sent then paid, and verify the overview updates. Sign out and sign in as member to verify restricted controls.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | 3000 | HTTP listening port |
| `DB_PATH` | data/clientflow.db | SQLite database path |
| `SEED_DEMO` | enabled | Set to `0` to disable demo seeding |
| `COOKIE_SECURE` | disabled | Set to `1` for HTTPS-only cookies |

Disabling seed creates no users; production account provisioning is not implemented. A reverse proxy must preserve the public Host header for origin validation. Use TLS, secure cookies, a trusted proxy configuration, persistent database backups, and proper account management before deployment.

## Deliberate limits and next steps

This version has no registration/password reset, client portal, real email or payment integrations, file uploads, recurring invoices, tax calculations, pagination, editing of all record fields, or project archival UI. A sent/paid flag is not proof of delivery/payment. The in-memory login throttle is for a single process and is not a distributed abuse defense. Audit entries and mutations are separate statements, so hard failures can leave a mutation without an activity entry. Large workspaces would need paginated endpoints and transactional services.

Good extensions to implement independently: transactional audit writes, project-level permissions, optimistic concurrency, CSV exports, Playwright accessibility tests, and a React/TypeScript frontend. Study the code and make your own changes before describing independent authorship in interviews.

## GitHub

The source includes `.gitignore`, CI checks and this README. After extracting the ZIP:

```bash
git init
git add .
git commit -m "Build ClientFlow agency workspace"
```

Create the desired repository and connect its remote when ready. Never commit the `data` directory or real client data.
