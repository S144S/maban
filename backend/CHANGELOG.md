# Backend Changelog

Notable backend changes are documented here using Keep a Changelog categories
and independent Semantic Versioning.

## [Unreleased]

Current development version: `2.1.0`. No backend release has been published.

### Added

- Accept beauty (`sparkles`), loan (`hand-coins`) and internet (`wifi`) icons when creating or editing expense categories; preserve existing icon identifiers.

- Connected signup/login/recovery OTP and separately configured reminder patterns to IranPayamak through a shared PostgreSQL job queue and independent SMS worker. Challenge/job and reminder occurrence/job writes are atomic; OTP jobs have priority, encrypted short-lived payloads, expiry and supersession checks. Concurrent claims are serialized and interrupted sends become unknown without automatic retries. Daily/weekly Tehran and monthly Persian-calendar recurrence skip historical backlogs; UI-facing reminder delivery status and next occurrence are exposed. Run Alembic upgrade head and supervise `python -m app.sms_worker`; reminders require separate enablement.

- Added IranPayamak pattern delivery for OTP and a reusable pattern transport, preserving development OTP behavior. Delivery uses bounded responses, no redirects/retries, and sanitized errors.

- Added private investment/asset history and report endpoints with exact decimal valuations, Tehran daily boundaries and separate price/holding effects. Mutations record atomic owner-serialized snapshots; migration seeds existing holdings at deployment time without fabricating earlier history. Run Alembic upgrade head.

- Added authorized family income/expense reports with Tehran date boundaries, exact full-period totals, equal-length previous-period comparisons, daily series, category/source breakdowns and paginated records. Existing list APIs remain unchanged.

- Added private per-instrument current unit rates with exact holding aggregation, timestamps, clearing and explicit missing-rate counts. Added owner-scoped property rates per square metre and whole-vehicle prices, with a separate current asset valuation endpoint. Historical purchase summaries remain unchanged. Run Alembic upgrade head.

- Added optional reminder recurrence preferences (`none`, `daily`, `weekly`, `monthly`) to create, edit and list APIs. Existing reminders default to none; legacy edits preserve the setting and creation retries remain compatible. Run Alembic upgrade head. Delivery requires the separately enabled SMS worker.

- Added personal reminder CRUD with timezone-aware due dates, optional whole-toman amounts, private session ownership, pagination and idempotent creation. The new reminders schema requires Alembic upgrade head. Reminders do not change balances.

- Added owner-managed recurring monthly expense-category limits in whole tomans, including Other. Null means unlimited; members can read limits. Limits do not block expenses or send alerts. Run Alembic upgrade head; existing categories remain unlimited.

- Every family has a protected default Other category; deleting a custom category atomically reassigns its expenses to Other without changing totals. Expense retries remain safe after category edits/deletion.

- Added family expense categories owned by the expenses module: owners create, edit and delete named categories with validated Lucide icon identifiers (existing categories default to tag), members list/use them, and expenses retain category IDs and name snapshots. Legacy classifications remain valid; run Alembic upgrade head.

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
- Added fixed `12345` OTPs restricted to explicit local/develop/test environments.
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

- BREAKING: IranPayamak is now the only production SMS provider. Replace previous provider credentials with an IranPayamak API key and pattern code in `MABAN_SMS_API_KEY` and `MABAN_SMS_TEMPLATE`, and configure the required `MABAN_SMS_LINE_NUMBER`. The OTP pattern must accept `code`. OTP request success now confirms job creation, not provider acceptance; delivery failures are asynchronous. Apply Alembic head and run the shared SMS worker even when reminders are disabled. Existing verification and resend response fields remain compatible.

- BREAKING: Removed invitation/member access fields and database tiers. All members can record income/expenses and manage invitations; only family owners can create, rename or delete accounts. Clients must stop sending/reading access, deploy the matching frontend, and run Alembic upgrade head. Existing memberships and invitation tokens are preserved; downgrade restores view defaults except owners, not historical tiers.

- Enforce users-module boundaries with an immutable public identity contract,
  explicit startup/CLI/migration interfaces, and architecture tests. Move HTTP
  persistence operations into the users application service.
- Move all user-owned tables from `public` into the `users` PostgreSQL schema
  with a reversible, data-preserving migration. HTTP contracts stay unchanged;
  run Alembic upgrade before starting the updated application. Direct operator
  SQL must qualify user tables with `users.` instead of `public.`.
