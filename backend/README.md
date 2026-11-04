# MaBan backend

Python 3.14+, FastAPI, SQLAlchemy, Alembic and PostgreSQL. The `users` business
module owns its tables in the `users` PostgreSQL schema, rules and HTTP routes.
Future modules consume `app.users.public.CurrentUser`, an immutable identity
containing only `id` and `role`; never import user persistence models across
module boundaries. See [architecture](ARCHITECTURE.md) for enforced boundaries. Application version is derived from `VERSION` at packaging.

## Run locally (PowerShell)

From the repository root:

```powershell
docker compose up -d db
cd backend
Copy-Item .env.example .env # first setup only; preserve existing configuration
uv sync --python 3.14
uv run alembic upgrade head
uv run uvicorn app.main:create_app --factory --host 127.0.0.1 --port 6202 --no-proxy-headers
```

In another terminal: `cd frontend; npm ci; npm run dev`. Visit
http://127.0.0.1:6201. Vite proxies `/api` to port 6202 so browser requests and
cookies are same-origin. PostgreSQL is bound only to `127.0.0.1:54339` and uses
a named Docker volume. `.env.example` credentials are local-only.

Register a new phone at `/signup`, enter `12345`, then supply first name,
last name and an 8–128-character password. Existing users sign in with a
password or OTP. Both create a real server session and lead to `/dashboard`.
An unknown/inactive phone can never sign in. Login OTP requests reject unknown/inactive accounts before issuing a challenge,
so the UI stays on the phone form. Signup/recovery issuance keeps uniform responses.

`/account` manages names, passwords and active sessions. Phone numbers remain
immutable verified account identifiers. Password changes/reset invalidate all
sessions. `/forgot-password` remains available for OTP-based password reset,
but the login screen does not advertise it. Home now shows the selected family’s persisted income minus expenses and provides
real income/expense entry sheets. Management defines family money storage locations for income attribution. The transaction tab remains a labeled
preview and do not affect the persisted balance. Run migrations before startup.

## Administration

Register and verify the intended administrator, then run the operator command:

```powershell
uv run python -m app.cli make-admin 09xxxxxxxxx
```

Sign in again, then open `/admin/users` or the link in account settings. Admins
can search users, paginate, activate/suspend accounts and assign user/admin
roles. Access changes revoke the target's sessions. Admins cannot change their
own role/status, preventing removal of the final active admin through the API.
No default administrator or password is seeded. Suspended accounts retain their
profile for reactivation; permanent deletion and phone-number replacement are
not exposed as account actions.

## Production configuration

- Use `MABAN_ENVIRONMENT=production` (the safe default), a dedicated PostgreSQL
  database, a random `MABAN_SECRET_KEY` of at least 32 characters, HTTPS-only
  `MABAN_ALLOWED_ORIGINS`, and `MABAN_COOKIE_SECURE=true`.
- Set `MABAN_SMS_API_KEY` and `MABAN_SMS_TEMPLATE` for an approved Kavenegar
  verification template accepting `token`. The server generates five random
  digits and sends them only for eligible requests. No production fixed code
  exists. Real provider delivery needs valid operator credentials and was not
  exercised by the automated suite (the provider interface is substituted).
- Serve the frontend and `/api` under the same HTTPS origin. Route `/api` to
  Uvicorn, and other frontend paths to `index.html`. Do not serve protected
  financial data as static frontend assets when that future module is added.
- Trust only your reverse proxy when enabling proxy headers. Without a trusted
  forwarded peer address, IP limits apply to the proxy as a whole. Add edge
  request/body limits and TLS; do not expose Uvicorn directly to the Internet.
- Run migrations before startup. Schedule `uv run python -m app.cli cleanup`
  periodically to delete expired sessions, rate buckets and OTP proofs. Back up
  PostgreSQL according to the deployment's retention policy.
- Never use local/develop configuration on a public deployment. Changing the
  secret invalidates existing sessions/codes/proofs and resets rate keys.

## Security behavior

Passwords use Argon2id. Sessions and proofs contain 256-bit random secrets;
only HMAC-SHA256 digests are persisted. Sessions expire after seven days and
are revocable in the database. Cookies are HttpOnly, SameSite=Lax, Path=/ and
Secure in production; tokens are never stored in browser local storage.

Every mutation requires an allowed `Origin` and `X-Maban-Request: 1`; no
cross-origin CORS access is enabled. API responses use `Cache-Control: no-store`.
OTP verification expires in 120 seconds with at most five guesses. Issuance has
a 30-second phone cooldown, five requests per phone/15 minutes and 30 per
peer IP/15 minutes. Password attempts allow ten per phone/15 minutes and 40
per peer IP/15 minutes. Verification allows 60 per IP/15 minutes. Successful
password attempts also count. Signup/reset proofs expire after five minutes,
are bound to their purpose, and can be consumed only once. PostgreSQL advisory
locks serialize counters, code issuance/consumption and account changes across
workers. OTP requests, codes, proofs and passwords are not logged.

## Tests and checks

```powershell
docker exec maban-db-1 createdb -U maban maban_test # once
uv run pytest -q
uv run ruff check app tests migrations
uv run alembic check
uv run python scripts/check_version.py
```

Tests require a dedicated database ending in `_test`; override the default with
`MABAN_TEST_DATABASE_URL`. The test database role needs CREATEDB. Each test creates a uniquely named
`maban_<uuid>_test` database, runs real migrations with fixed module schemas,
then drops only that generated database (also after failures). Tests cover unknown/inactive login, duplicate and concurrent
signup, expiry, replay, purpose binding, rate limits, session ownership/revocation,
CSRF, profile validation, administration and production OTP isolation.

API documentation: http://127.0.0.1:6202/docs. Browser clients use `/api/auth/*`,
`/api/users/me`, `/api/users/me/password`, `/api/users/me/sessions` and
`/api/admin/users`. Unsafe requests made by command-line clients also need the
same Origin/custom headers and should keep the returned session cookie private.

## Upgrade existing local installations

Stop the backend, run `uv run alembic upgrade head`, then restart it. Revision
`7b31e920af01` moves the four existing user tables from `public` into `users`
using transactional `ALTER TABLE ... SET SCHEMA`; it preserves rows, IDs,
password hashes, sessions, indexes and constraints. It does not rebuild tables.
The migration fails if a `users` schema already exists, requiring operator
inspection rather than silently adopting unrelated objects. It requires schema
creation/table ownership privileges. `public.alembic_version` stays central.
Downgrade to `54574e5efd16` moves the tables back; deploy the matching old code
when downgrading. Operator SQL must use schema-qualified table names.

## Families

Visit `/families` after signing in to create a family and invite a spouse, child
or friend. Each account may create one family and can also accept invitations
to other families. Only the creator manages invitation links; relationship labels
do not grant administrative privileges. Links are single-use, expire in seven
days, and can be revoked. Share each link privately with its intended recipient.
The link survives login/signup, and joining always requires explicit acceptance.

Endpoints: `GET/POST /api/families`, `GET /api/families/{id}`, owner-only
`GET/POST /api/families/{id}/invitations`,
`DELETE /api/families/{id}/invitations/{invite_id}`, and authenticated
`POST /api/families/invitations/preview` or `/accept` with `{ "token": "..." }`.
Run migrations before startup; revision `f897737fa02e` creates the `families`
schema and its three tables without changing existing user data. Downgrading
this feature migration removes family data, so back it up before a rollback.

## Money storage locations

GET/POST `/api/families/{family_id}/money-locations` lists/creates family-owned
locations (for example a bank, cash or a gift card). Creation accepts a trimmed
`name` (1–80 characters) and UUID `request_id`, requires full access and rejects
duplicate family names. Identical retries return the original location.
Income forms require a location; POST income accepts `location_id` and validates
it against the same family. Responses include `location_id` and the recorded
`location_name`. Existing entries remain unassigned; legacy API clients may
omit the field. Locations do not change amounts, currency or balance calculations.
Run `alembic upgrade head` before starting the updated API.

PATCH `/api/families/{family_id}/money-locations/{location_id}` renames an account
using `{ "name": "..." }`. Full access is required; duplicate names return 409,
invalid names 422, and missing/foreign accounts 404. The ID remains unchanged.
Previous income retains its original name snapshot; future income uses the new
name. This update does not require a database migration.

DELETE `/api/families/{family_id}/money-locations/{location_id}` requires full
access and returns 204 (including retries). It archives the account, retaining
its ID/name and all income links. Active lists and new income exclude archived
accounts. Names stay reserved. Run `alembic upgrade head` before restarting.
Downgrading the archive migration restores archived accounts to active status.


### Personal investments

The investments module owns `investments.entries`. Authenticated users can POST and GET
`/api/investments`; ownership is derived exclusively from the current session. Family
membership does not grant access to these personal records. Gold quantities use exact
NUMERIC(10,3) grams (0.001–1,000,000); optional unit and total purchase prices are independent,
positive whole-toman amounts up to 1,000,000,000,000. No price is inferred automatically.
Creation is idempotent per user/request UUID; history is paginated with `offset` (50 per page).
Investments do not change income, expenses or family cash balances. Apply `alembic upgrade head`
before running the new API. Downgrading this migration removes all investment records.


Stock investments use `kind: "stock"`, `symbol` (trimmed, 1–40 characters) and
`shares` (whole count, 1–1,000,000,000). Optional `unit_price_toman` and description
follow the gold rules. Stock input rejects `grams` and `total_price_toman`.
Responses include `symbol`, `shares` and `calculated_total_toman`: an exact decimal
string of shares × unit price, or null when no price was supplied. Stock records
store no total price; gold fields and behavior remain unchanged. The stock migration
preserves existing entries and refuses downgrade while stock records exist, avoiding
silent data loss. Ownership remains personal, with no effect on family balances.


Additional personal investment types: `silver` requires `grams` (same precision as gold).
`crypto` requires `symbol` and decimal-string `quantity` (up to 18 decimal places);
`currency` requires currency name/code in `symbol` and decimal-string `quantity` (up to 2 decimals).
`bond` requires instrument name/code in `symbol` and strict integer `quantity`.
Quantities are positive and capped at 1,000,000,000, except silver's 1,000,000 grams.
Optional unit prices remain whole tomans. These types reject input total prices;
`calculated_total_toman` is derived with exact decimal arithmetic when a unit price exists.
No market-price lookup, interest accrual or currency conversion is performed.
Apply Alembic head; downgrade refuses to discard any of the new investment types.


### Personal asset fund

The assets module owns `assets.entries`, with authenticated POST/GET `/api/assets`.
Its only domain dependency is the users public authentication interface. Records belong
to the current user; family members have no implicit access. Houses and land require
`title` (1–80), `location` (1–200), and exact `area_sqm` (0.01–1,000,000,000, up to 2 decimals).
Cars require a combined `model` (1–80); legacy `brand` is optional, `year_calendar` (solar or gregorian), and integer
`manufacture_year` (1200–1500 solar or 1886–2100 Gregorian). Optional purchase prices
are positive whole tomans up to 1,000,000,000,000; notes are limited to 500 characters.
Each request requires a UUID for per-user idempotency; mixed-type fields are rejected.
GET supports offset pagination (50 entries). No family balance or investment record
is modified. Apply Alembic head; downgrade refuses to remove a nonempty assets table.

Property forms use optional `price_per_sqm_toman` (positive whole tomans, up to 1,000,000,000,000). Historical `purchase_price_toman` totals retain their meaning and remain supported; cars cannot submit a per-square-metre price. Apply Alembic head.


### Fund summaries

The general fund remains family income minus expenses. Personal GET `/api/investments/summary`
and `/api/assets/summary` aggregate all current-user records in their owning module using
exact PostgreSQL NUMERIC arithmetic. Responses contain decimal-string `total_toman`, `count`,
`unpriced_count` and `valuation_basis: recorded_purchase_prices`. Unknown prices are excluded,
not treated as a known zero. Gold uses a supplied total first, otherwise grams × unit price;
other investments use quantity × unit price. Property uses area × per-square-metre price first,
otherwise its historical purchase total; cars use their purchase total. These are recorded
purchase values, not live market valuations. Empty totals are zero. No migration is required.
