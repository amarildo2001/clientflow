# ClientFlow — Agency Operations Workspace

## Project summary

ClientFlow is a full-stack portfolio application for small agencies and freelance teams. It brings clients, projects, tasks, time entries, and invoice status into one shared workspace. The project connects web development, digital agency operations, and project management.

## The problem it addresses

Small teams often track work in several disconnected places. A client list may live in a spreadsheet, tasks in a separate board, and billing status in email. ClientFlow links those records so users can see the relationship between a client, a project, its tasks, logged work, and invoices.

## Implemented capabilities

| Area | Behavior |
| --- | --- |
| Dashboard | Calculates active projects, completed tasks, paid invoice totals, and logged hours |
| Clients | Admins create contacts and companies; users search the directory |
| Projects | Admins create projects with a client, budget, and deadline; cards show task completion |
| Tasks | Team members create and assign tasks, filter by project, and change status |
| Time | Users log minutes and work notes against tasks; entries belong to the signed-in user |
| Invoices | Admins create draft invoices and advance them to sent, then paid |
| Access | Admin/member roles restrict client, project, and billing mutations |
| Activity | Successful changes produce entries in a shared activity feed |

Invoice status is recorded manually. The app does not send invoices, collect payments, or calculate taxes.

## Technology and architecture

The backend uses Node.js 24, the built-in HTTP server, and SQLite through `node:sqlite`. The frontend uses native JavaScript, HTML, and CSS. There are no third-party runtime dependencies.

The browser calls JSON endpoints. The server validates requests, checks sessions and roles, and uses prepared SQL statements. SQLite stores users, sessions, clients, projects, tasks, time entries, invoices, and activity. Money is stored as integer cents. Relational foreign keys connect each project to a client and each task or invoice to its project.

## Technical decisions demonstrated

- Session authentication with random tokens, expiry, and HttpOnly cookies.
- Salted scrypt password hashing and constant-time hash comparison.
- Server-side role checks rather than relying on hidden UI controls.
- Input checks for record references, dates, positive durations, and monetary values.
- A defined invoice transition rule that rejects skipped and reversed states.
- Prepared statements, escaped browser output, restricted static paths, and a Content Security Policy.
- Responsive navigation, searchable views, native dialogs, and accessible form labels.
- Persistent database records, automated API tests, and GitHub Actions configuration.

## Validation and evidence

The 12 automated API tests passed locally. They cover authentication, logout, role permissions, exclusion of password hashes, client persistence and audit entries, foreign keys, date validation, task status updates, time ownership, invoice transitions, cross-origin rejection, and SQL injection input. JavaScript syntax checks also passed.

Visual browser QA has not been completed. The inline conversation preview uses temporary browser-side data; the downloadable application uses the real SQLite backend.

## Scope and limitations

ClientFlow is a single-workspace portfolio prototype with synthetic demo data and public demo credentials. It is not a production-ready SaaS product. Account registration and recovery, tenant isolation, payment integrations, email delivery, uploads, and full record editing are not implemented. Activity logging and mutations are separate database statements rather than one transaction.

## Authorship and portfolio presentation

Prepared for Amarildo Prendi with AI assistance. Describe it as an AI-assisted portfolio project and be ready to explain the code, tradeoffs, and changes you make yourself. It is a demonstration application, not completed client work.

Suggested portfolio description:

> ClientFlow is a full-stack agency workspace built with Node.js, SQLite, and JavaScript. It connects client records, projects, task assignments, time tracking, and invoice status, with role-based access and automated API tests. Built as an AI-assisted portfolio project using fictional data.

## Run and explore

Use Node.js 24 or later, then run `npm start` and open `http://localhost:3000`. See `README.md` for credentials, API routes, configuration, and the manual walkthrough. Run `npm test` for the API suite and `npm run check` for syntax checks.
