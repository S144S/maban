# Family plants

Plants are an independent modular-monolith domain in `backend/app/plants`, owning
the `plants` PostgreSQL schema. Its public HTTP interface is
`/api/families/{family_id}/plants`; other modules must not import its ORM objects.
It consumes only `families.public.Access` and `users.public` identity/directory.
No generic task engine, financial mutations or SMS/email/push delivery is involved.

## Run and verify locally

Follow the backend/frontend READMEs for initial PostgreSQL, Python 3.14 and Node
setup. From `backend`, run `uv sync --python 3.14 --reinstall-package maban-backend`
(refreshes the editable package's dynamic version metadata), then
`uv run alembic upgrade head`. Restart the API after upgrading:
`uv run uvicorn app.main:create_app --factory --host 127.0.0.1 --port 6202 --no-proxy-headers`.
From `frontend`, run `npm ci` and `npm run dev`.

Sign up/sign in with the existing real account flow (local OTP: `12345`), create
or select a family in **خانواده**, then open **گلدون‌ها** in the bottom navigation
(`/dashboard?page=plants`). Add a plant, choose a family member if desired, set
its soil-check interval/first Persian date, and optionally enable fertilizer.
Open its details, record either soil result, and check the new date and history.
After creation, details open automatically. Use **افزودن عکس** to select an
optional image, review its preview and save it. Family members can replace it or
confirm its removal independently of the plant metadata and care history.
Invite another local test account to verify shared care and actor attribution.
Care schedules need no worker. Photos require private MinIO storage:

```powershell
# Repository root (local-only services and credentials)
docker compose up -d db minio
cd backend
# Add the MABAN_MINIO_* values below to an existing .env; do not overwrite it.
uv sync --python 3.14 --reinstall-package maban-backend
uv run alembic upgrade head
uv run python -m app.plants.storage
```

Local values (also in `backend/.env.example`):

```dotenv
MABAN_MINIO_ENDPOINT=127.0.0.1:54340
MABAN_MINIO_ACCESS_KEY=maban_local
MABAN_MINIO_SECRET_KEY=maban_minio_local_only
MABAN_MINIO_BUCKET=maban-plants
MABAN_MINIO_SECURE=false
```

Restart the API after configuration. MinIO API is bound to localhost port 54340;
its operator console is at http://127.0.0.1:54341. Data persists in the
`maban_minio` named Docker volume. The setup command creates the bucket if absent
and rejects an existing bucket policy; it never enables anonymous reads. Run it
with provisioning credentials. The ordinary API does not create buckets. If
storage is unconfigured/unavailable, photo operations return a Persian 503;
there is no database/file fallback. Financial and plant-care routes remain usable.

In production use a private bucket with anonymous access disabled, a TLS MinIO
endpoint (`MABAN_MINIO_SECURE=true`, mandatory in production) and dedicated app
credentials. Endpoint is `host[:port]`, without scheme/path. Scope the app's IAM
policy to `s3:GetBucketLocation`/`s3:ListBucket` on this dedicated bucket and
`s3:GetObject`/`s3:PutObject`/`s3:DeleteObject` on `bucket/plants/*`. Keep provisioning
permissions (`CreateBucket`, `GetBucketPolicy`) separate. Do not deploy the local
Compose credentials publicly or expose its console to ordinary users. No browser
MinIO credentials, bucket CORS or public/presigned image URLs are needed.

Checks:

```powershell
cd backend
uv run pytest -q
uv run ruff check .
uv run python scripts/check_version.py
cd ../frontend
npm test
npm run check
npm run build
```

## API and rules

- `GET /plants?offset=0`: 50 plants per page, earliest care date first, with
  `has_more`, `timezone` and date-derived `overdue`/`today`/`upcoming` statuses.
- `POST /plants`: metadata, required `soil_interval`/`soil_due`, nullable paired
  `fertilizer_interval`/`fertilizer_due`, optional member `assignee_id`, UUID
  `request_id`. All members may create, edit, delete and record care.
- `GET`, `PUT`, `DELETE /plants/{id}`: detail, full metadata/schedule replacement,
  and deletion. PUT uses the same fields as POST except `request_id`.
- `POST /plants/{id}/care`: UUID `request_id`, `action` (`watered`, `not_needed`,
  `fertilized`) and optional `note`. The server supplies actor and timestamp.
- `GET /plants/{id}/history?offset=0`: 50 events per page, newest first, with
  actor names, timezone-aware timestamps and the next date recorded at that time.
- `PUT /plants/{id}/photo`: raw image body with `Content-Type: image/jpeg`,
  `image/png` or `image/webp`; returns the updated plant including `photo_url`.
  Repeating the same upload replaces the same single photo without care events.
- `GET /plants/{id}/photo`: authenticated JPEG bytes with `Cache-Control: no-store`.
  The returned URL includes a content digest for refreshing changed images; it
  does not grant access without an authorized session. `DELETE` removes the
  image and is safe to retry. List/detail return nullable `photo_url`.

Photos have a 5 MiB input limit (also applied to streamed bodies), 20 megapixel
limit and must be static. The server validates actual format and pixels with
Pillow, applies orientation, downsizes to at most 1600 × 1600 and rebuilds a JPEG
without EXIF/GPS/profile metadata. SVG, GIF and animated images are unsupported.
Family authorization applies to reads and writes, including guessed image URLs.
Normalized files are stored in MinIO under random per-family/per-plant object
keys. PostgreSQL holds only nullable `photo_key` and `photo_digest`; there is no
image/blob column at migration head. Migration `d58764dc192a` replaces the initial
unreleased blob schema (`c47653cb0819`); no current photos need transfer. As a
guard it refuses to discard unexpected existing blobs. Downgrade likewise refuses
nonempty object references; there is no automatic transfer back into PostgreSQL.

Uploads complete before the new key is committed. Repeated identical uploads
retain one object/key and can repair a missing object. Different images get new
random keys; the old object is removed only after a successful database commit.
Database failures leave the prior committed photo untouched. Deletion first
commits removal of access to the photo, then removes its object. Storage and
PostgreSQL do not share an atomic transaction: outages or a crash can leave a
private, unreferenced object, without exposing it through the API. A failed or
ambiguous database commit never triggers blind deletion of a potentially committed
upload. Cleanup failures are logged and do not turn committed deletion into an
HTTP failure. Concurrent photo changes use the family write lock and
last-write-wins. Original files are not retained.

Schedule reconciliation periodically (for example daily) using the same database,
bucket and credentials as the API:

```powershell
uv run python -m app.plants.cleanup         # dry run: candidate count only
uv run python -m app.plants.cleanup --apply # remove unreferenced objects older than 24h
```

The command only inspects generated keys under `plants/`, takes the same family
lock as uploads/reads, rechecks the committed reference and preserves live objects.
Do not add a bucket lifecycle rule that deletes current photos by age. Back up
MinIO **and** PostgreSQL separately with coordinated retention/restore points;
a named volume or MinIO alone is not a backup. Pause cleanup while restoring
either store. Database-only backups do not contain images.

Tests substitute the narrow storage interface for deterministic failure/rollback
cases. For the real MinIO integration test, set `MABAN_TEST_MINIO_ENDPOINT`,
`MABAN_TEST_MINIO_ACCESS_KEY`, `MABAN_TEST_MINIO_SECRET_KEY` (and optional
`MABAN_TEST_MINIO_SECURE=true`) and run `uv run pytest tests/test_plant_storage.py -q`.
It creates/deletes only its own random test bucket, verifies anonymous reads are
denied, and exercises upload/retry/replacement/deletion through the authenticated
API. Without these settings that single integration test is skipped.

All routes authenticate and authorize the family before reading data. Assignees
must belong to that family. IDs from another family are inaccessible, including
when submitted under an authorized family's URL. Extra input fields are rejected.
Text is trimmed and bounded; intervals are whole integers from 1 through 365.
API due dates are ISO Gregorian calendar dates; UI inputs/displays use Persian
dates and accept Persian, Arabic and Latin digits.

Families currently have **no timezone setting**. The documented default for all
plant schedules is **Asia/Tehran**, returned by the list/detail APIs. Events use
PostgreSQL `timestamptz` and server UTC time. The next date is the **local day of
server-recorded care + interval in calendar days**, never the old due date or
elapsed 24-hour blocks. A soil check is not an instruction to water. Both soil
outcomes advance only soil; fertilizer advances only fertilizer. Recording care
early is allowed. Backdated/client-supplied completion times are not supported.
Editing a plant explicitly replaces its schedule; disabling fertilizer preserves
past events. History records the original resulting due date even after edits.

Each family has a module-owned transaction advisory lock for plant writes.
Creation retries use a stored fingerprint; care retries use a family-wide UUID
uniqueness constraint, actor/plant/action/note fingerprint and immutable receipt.
Identical concurrent retries produce one event and one schedule update; changed
payloads/actors reusing the UUID return 409. Event and due date commit atomically.
The UI retains request IDs across retries of an unchanged submitted form and
disables controls during submission. Two deliberately separate requests with
different UUIDs count as separate care events.

Deletion is soft: the plant, schedules and history become inaccessible in the UI
and API; its photo reference is cleared and the MinIO object is removed after commit.
Other rows are retained to preserve references/retry protection. No restore or
permanent purge endpoint is provided. Migration `b36542baf708` adds this schema
without modifying family/user/finance tables. Downgrade refuses to discard
nonempty plant/history data; export and explicitly clear it before rolling back.

## Current limits

Reminders appear only in the plant list/details; there are no background delivery
jobs or global notification badges. Statuses refresh on entering the page, window
focus and each minute while the page is open. Family selection stays in the
existing Families screen. No diagnosis, species database or treatment
recommendations are included. Shared metadata edits use last-write-wins, matching
existing editing flows; simultaneous edits are not merged.
