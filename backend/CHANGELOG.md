# Backend Changelog

Notable backend changes are documented here using Keep a Changelog categories
and independent Semantic Versioning.

## [Unreleased]

Current development version: `0.12.0`. No backend release has been published.

### Added

- Added private investment and asset summary APIs with exact database aggregation over all records, recorded-price valuation and explicit unpriced counts. Gold total purchase price takes precedence over gram price; property per-square-metre price takes precedence over historical purchase totals.

- Car entry uses one combined model field; separate historical brand values remain supported.

- Property forms now record optional price per square metre separately from historical purchase totals; car purchase prices are unchanged.

- Added the personal assets module and assets schema for houses, land and cars, with typed validation, exact square-metre areas, optional whole-toman purchase prices, ownership isolation and idempotent writes. Run Alembic upgrade head; downgrade refuses to discard assets.

- Extended the pending investment-type feature with silver (grams), crypto (up to 18 decimal places), foreign currency (up to 2 decimal places), and bonds (whole units). Each has typed validation, exact derived totals, personal ownership and lossless migration guards.

- Added personal stock investments with a required symbol and whole share count, optional unit purchase price and notes. Total cost is derived exactly as a decimal string; clients cannot submit a stock total or gold fields. Existing gold records are preserved; run Alembic upgrade head.

- Added a private per-user investment fund with gold quantities precise to 0.001 grams, optional whole-toman purchase prices and notes, idempotent creation and paginated history. Isolated investments schema; run Alembic upgrade head. Family cash balances remain unchanged.

- Added account deletion with confirmation and full-access authorization. Deleted accounts disappear from active choices while historical income references and totals remain unchanged. Run Alembic upgrade head. Deleted account names stay reserved; existing income retries remain idempotent.

- Added family-scoped account renaming for full-access members, with duplicate-name protection. Income retains its recorded name snapshot and identical income retries remain valid after a rename. No migration required.

- Family-scoped money storage locations (presented as accounts in user-facing messages) with full/view permissions, idempotent creation and income attribution through a public module interface. Run Alembic upgrade head; existing income remains unassigned and legacy API clients may omit location_id.

- Added the expenses module with its own schema, family-scoped totals and history, member attribution, full/view authorization and idempotent whole-toman writes. Run Alembic upgrade head.

- Family income inbox in its own schema with whole-toman amounts, four sources, member attribution, permission checks and idempotent creation. Run Alembic upgrade head.

- Added full/view family permissions enforced on invitation management. Existing owners receive full access; existing members and invitations retain view-only access. Run Alembic upgrade head before starting the updated API.

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
