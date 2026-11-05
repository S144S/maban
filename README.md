# MaBan — مابان

Family financial management, designed mobile-first for Persian speakers.
A modular monolith in a monorepo: Python 3.14/FastAPI/SQLAlchemy/Alembic backend,
PostgreSQL database, and React/Vite/Tailwind/shadcn frontend.

User management is implemented: verified phone signup, password or OTP login,
server sessions, profile editing, password changes, logout/session revocation,
and administrator user management. Financial screens still show sample data.

## Run locally

Follow [backend setup](backend/README.md) to start PostgreSQL on port 54339 and
FastAPI on port 6202. Then follow [frontend setup](frontend/README.md) and open
http://127.0.0.1:6201. Local/develop OTP is `12345`; production requires a
configured SMS provider and HTTPS. Data persists in the local Docker volume.

## Repository

- `backend/app/users/`: user management business module.
- `backend/migrations/`: database schema migrations.
- `backend/tests/`: PostgreSQL integration/security tests.
- `frontend/src/features/`: landing, authentication/account management, dashboard.
- `styles/colors.css`: shared frontend semantic colors.
- `AGENTS.md`: architecture, design, versioning and contribution conventions.

Backend and frontend versions/changelogs are independent. No release is implied
by a development version bump. See each component README for checks, production
configuration and current limitations.
