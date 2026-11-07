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
Invite another local test account to verify shared care and actor attribution.
No additional environment settings or worker process are needed for plants.

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
and API; rows are retained to preserve references/retry protection. No restore or
permanent purge endpoint is provided. Migration `b36542baf708` adds this schema
without modifying family/user/finance tables. Downgrade refuses to discard
nonempty plant/history data; export and explicitly clear it before rolling back.

## Current limits

Reminders appear only in the plant list/details; there are no background delivery
jobs or global notification badges. Statuses refresh on entering the page, window
focus and each minute while the page is open. Family selection stays in the
existing Families screen. No photos, diagnosis, species database or treatment
recommendations are included. Shared metadata edits use last-write-wins, matching
existing editing flows; simultaneous edits are not merged.
