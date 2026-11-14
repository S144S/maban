# Backend Changelog

Notable backend changes are documented here using Keep a Changelog categories
and independent Semantic Versioning.

## [Unreleased]

Current development version: `5.2.0`. No pending changes.

## [5.2.0] - 2026-11-14

### Added

- Allow reminder authors to select additional members of the paying family using optional `recipient_user_ids`. Send one separately billed SMS per recipient, including the author, with independent reservations/refunds, membership and active-account checks at scheduling/dispatch, and aggregate delivery status that never hides partial failure. Reminder lists and notes remain private. Existing clients preserve selections on update. Migration `e8da512fc940` attributes historical attempts to their authors and retains delivery history.

- Grant each new registration a one-time 5,000-toman gift, credited atomically to the first family the user creates or joins. Serialize claims across families, retain a separate immutable `signup_gift` ledger entry, and preserve eligibility until membership succeeds. Existing registrations are not backfilled. Run migration `d7c8412eab30`; downgrade refuses to discard gift entitlements.

- Added shared prepaid family wallets, paginated immutable ledger/payment history, idempotent Zarinpal top-ups and server-verified callbacks with exact toman/rial conversion. Reminder SMS reserves the calculated multipart tariff before dispatch; insufficient funds skip the occurrence, rejected/cancelled sends refund once and uncertain sends retain the reservation for reconciliation. OTP remains free; no withdrawal, transfer or manual-credit API exists. Migrate through `ce965430eb12` and configure payments/tariff before enabling reminder delivery; see `docs/wallets.md`.

- Add the optional `status=all` shopping-item view with combined pagination, retaining existing pending/purchased filters and counts. List-index reads also accept pending/purchased status, filtering before pagination; empty lists remain pending and completed lists require all live items to be purchased.

- Added named family shopping lists with atomic multi-item creation, per-list counts, durable batch retries, item quantities/notes, pending/purchased filters and counts, paginated reads, reversible purchase marking, version-checked edits/deletion and durable idempotent creation. All endpoints require authenticated family membership. Purchase confirmation accepts an optional total in toman and expense category; supplying an amount atomically records one expense through the expenses public interface, attributed to the confirming member and defaulting to Other. Whole-list checkout completes every live item across pages and optionally records one total expense, using a list snapshot and durable receipts to reject stale edits and duplicate charges. Lists with existing item/list expenses can still complete without a new total. Undo/deletion preserves expenses and rechecking cannot charge twice. Migration `c31ea8507b42` groups existing items into a default list and preserves expense links; legacy item endpoints remain compatible. Run migrations through `e8a1d6342fc9` before deploying frontend 1.6.0; downgrade refuses to discard existing shopping data or expense links.

- Added authenticated, paginated `/api/reminders/upcoming` for occurrences within the inclusive next 24 hours. Calculates recurring dates in Tehran independently of SMS availability; excludes past one-time and deleted reminders and other users.

- Added fortnightly reminder recurrence (`fortnightly`), retaining Tehran wall-clock time every 14 days and skipping missed occurrences without duplicate delivery. Run migration `d2ea71b93508` before deploying; downgrade requires explicitly changing any fortnightly reminders first.

- Added optional personal reminder notes (up to 2,000 characters), persisted by migration `c1df3920ab72`. Legacy edits preserve notes and stored amounts; retries remain compatible. Notes are not included in SMS.

- Added optional family/plant references to personal reminders via the Plants public authorization interface. Migration `a8ba970f425d` preserves existing reminders; omitted reference fields preserve links and legacy retry fingerprints. Linked reminders remain private and survive plant deletion; downgrade refuses to discard links.

- Added soil replacement, repotting and examination care events with migration `f7a986fe314c`; preserved legacy no-water-needed history and retries.

- Added one optional private photo per family plant with authenticated read, replacement and deletion. JPEG, PNG and WebP uploads are bounded to 5 MiB/20 megapixels, normalized to static JPEG and stripped of metadata. Files use a private MinIO bucket; PostgreSQL stores object keys only. Configure MABAN_MINIO_* and initialize the bucket; run Alembic upgrade head (refuses unexpected legacy blobs). Upload/commit failure recovery preserves current photos; a reconciliation command removes abandoned objects after a 24-hour grace period. Local Compose includes persistent MinIO storage; back up it and PostgreSQL separately.

- Added family-owned plants, member assignment, immutable manual care history and atomic idempotent care recording. All family members may collaborate; data is isolated by family. Event times display in the documented Asia/Tehran default. Run Alembic upgrade head; no notification worker or delivery settings are required.

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

### Changed

- **Breaking:** Move prepaid wallets from users to families at `/api/families/{family_id}/wallet`; members share balance, top-ups and ledger history. Retain the authenticated top-up initiator and verify callbacks against the stored family. Reminders remain private and require an explicit `sms_family_id` before billing shared funds; check membership again at scheduling and dispatch. Migration `ce965430eb12` archives original personal ledgers and requires explicit attribution of existing financial accounts; see `docs/wallets.md`. Deploy API, worker and frontend together.

- **Breaking:** Replace the flat `sms_price_toman` wallet response with `sms_persian_part_toman` (500) and `sms_english_part_toman` (750). Bill each reminder from its complete rendered pattern using UTF-16 part counts and the supplied multipart overhead algorithm. Replace `MABAN_SMS_PRICE_TOMAN` with the exact approved `MABAN_SMS_REMINDER_BODY` before enabling delivery; update wallet clients and deploy API/worker/frontend together. Queue the priced pattern/attributes snapshot; legacy jobs without a snapshot skip and refund their original reservation. Existing ledger amounts remain unchanged; this pricing rule itself needs no additional database migration.

- BREAKING: IranPayamak is now the only production SMS provider. Replace previous provider credentials with an IranPayamak API key and pattern code in `MABAN_SMS_API_KEY` and `MABAN_SMS_TEMPLATE`, and configure the required `MABAN_SMS_LINE_NUMBER`. The OTP pattern must accept `code`. OTP request success now confirms job creation, not provider acceptance; delivery failures are asynchronous. Apply Alembic head and run the shared SMS worker even when reminders are disabled. Existing verification and resend response fields remain compatible.

- BREAKING: Removed invitation/member access fields and database tiers. All members can record income/expenses and manage invitations; only family owners can create, rename or delete accounts. Clients must stop sending/reading access, deploy the matching frontend, and run Alembic upgrade head. Existing memberships and invitation tokens are preserved; downgrade restores view defaults except owners, not historical tiers.

- Enforce users-module boundaries with an immutable public identity contract,
  explicit startup/CLI/migration interfaces, and architecture tests. Move HTTP
  persistence operations into the users application service.
- Move all user-owned tables from `public` into the `users` PostgreSQL schema
  with a reversible, data-preserving migration. HTTP contracts stay unchanged;
  run Alembic upgrade before starting the updated application. Direct operator
  SQL must qualify user tables with `users.` instead of `public.`.

### Removed

- **Breaking:** Removed plant schedule inputs/outputs and care `next_due`; all care actions now log independently without calculating reminders. Migration `e69875ed203b` drops scheduling columns while preserving plant metadata, photo references and performed care. Back up before upgrade, deploy with the matching frontend and reopen pending forms; rollback requires restoring the backup. Plant lists now order newest first.

### Fixed

- Display family members by their complete given name in member lists, income attribution and plant care history; keep stored surnames and profile editing unchanged.

- Reject OTP login requests for unknown/inactive accounts before creating a
  challenge, keeping the user on the phone form instead of opening the OTP sheet.

- Clarified rejected OTP verification messages with actionable login/signup
  guidance, including the requirement for an active registered account.

### Security

- Hash passwords with Argon2id; store only keyed digests of session/OTP/proof
  secrets. Use HttpOnly SameSite cookies, production Secure cookies, strict
  Origin/custom-header checks, server-side expiry, cooldown and rate limits.
- Reject unknown/inactive accounts, replayed or expired proofs/codes, role
  escalation and cross-user session access. Password changes and suspension
  revoke sessions. Serialize verification and registration to prevent races.
- Fail production startup without secure origins/cookies, private secrets and
  SMS configuration; never return passwords or provider secrets in errors.
