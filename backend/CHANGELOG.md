# Backend Changelog

Notable backend changes are documented here using Keep a Changelog categories
and independent Semantic Versioning.

## [Unreleased]

Current development version: `0.3.2`. No backend release has been published.

### Fixed

- Reject OTP login requests for unknown/inactive accounts before creating a
  challenge, keeping the user on the phone form instead of opening the OTP sheet.

- Clarified rejected OTP verification messages with actionable login/signup
  guidance, including the requirement for an active registered account.

### Added

- Added a families module in its own PostgreSQL schema: one owned family per user,
  membership lists, single-use seven-day invitation links with spouse/child/friend
  relationships, explicit acceptance and owner-only revocation. Invitation tokens
  are stored only as digests; authorization and concurrency are enforced server-side.
- Added a bounded public users-directory contract returning immutable name-only
  profiles, with no cross-module ORM access or foreign keys.

- Introduced a Python 3.14 FastAPI modular monolith with a users module,
  PostgreSQL persistence, SQLAlchemy models and versioned Alembic migration.
- Added phone verification, registration with name/password, password and OTP
  login, password recovery, profile editing, logout and session revocation.
- Added admin-only user search/pagination, role and active-status management,
  plus local operator commands to bootstrap an admin and clean expired records.
- Added Kavenegar verification-template delivery for production and fixed
  `12345` OTPs restricted to explicit local/develop/test environments.
- Added integration tests using isolated PostgreSQL databases and real migrations.

### Security

- Hash passwords with Argon2id; store only keyed digests of session/OTP/proof
  secrets. Use HttpOnly SameSite cookies, production Secure cookies, strict
  Origin/custom-header checks, server-side expiry, cooldown and rate limits.
- Reject unknown/inactive accounts, replayed or expired proofs/codes, role
  escalation and cross-user session access. Password changes and suspension
  revoke sessions. Serialize verification and registration to prevent races.
- Fail production startup without secure origins/cookies, private secrets and
  SMS configuration; never return passwords or provider secrets in errors.

### Changed

- Enforce users-module boundaries with an immutable public identity contract,
  explicit startup/CLI/migration interfaces, and architecture tests. Move HTTP
  persistence operations into the users application service.
- Move all user-owned tables from `public` into the `users` PostgreSQL schema
  with a reversible, data-preserving migration. HTTP contracts stay unchanged;
  run Alembic upgrade before starting the updated application. Direct operator
  SQL must qualify user tables with `users.` instead of `public.`.
