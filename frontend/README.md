# MaBan frontend

React, TypeScript, Vite, Tailwind CSS and shadcn/ui. Persian RTL, mobile-first
layouts use the shared semantic colors and Persian fonts.

## Local development

Requires Node.js 22.12+ and npm. Start PostgreSQL and the backend first using
[backend setup](../backend/README.md), then:

```powershell
cd frontend
npm ci
npm run dev
```

Open http://127.0.0.1:6201. Vite development and preview proxy `/api` to the
backend at http://127.0.0.1:6202. Both use strict ports. Production hosting must
serve `index.html` for frontend routes and proxy `/api` to FastAPI on the same
HTTPS origin. Cookies authenticate API calls; no credentials or session tokens
are persisted in local storage.

```powershell
npm run check
npm run build
npm run preview
```

`VERSION` is authoritative; synchronize package.json, package-lock.json and the
Unreleased changelog when changing versions. `npm run check` validates them.

## Installable online app (PWA)

The web manifest provides a stable app identity, Persian name, existing MaBan
artwork in 192/512px PNG icons, and standalone launch at `/dashboard`. Signed-out
users follow the existing login flow. iOS uses the supplied 180px touch icon.

Serve over HTTPS (localhost is allowed for development). In current Chrome/Edge,
use the browser's Install app action; on iOS Safari use Share → Add to Home Screen
and enable Open as Web App where offered. Browser install UI and automatic prompts
vary by platform. No custom install prompt or offline support is provided.

A production build emits `/sw.js` with a fingerprint derived from its output.
It detects new builds on startup, on returning to a visible online app, and every
visible online minute (checks are throttled to once per minute). A new worker
waits for the Persian update notice's explicit confirmation. “Later” dismisses
that worker's notice for the current page; another build or a reload can show it
again. Before activation the notice warns that unsaved edits will be lost: save
or defer first. Only the accepting tab reloads; other tabs keep their open forms.
The first installation is silent. Registration is disabled in Vite development;
use `npm run build` and `npm run preview` to test real updates between two builds.

The worker does not use Cache Storage or an offline request queue. Navigations
go directly to the network with `cache: no-store`; API and asset requests pass
through untouched, and protected API responses remain `no-store`. Loading the
app and financial operations still need an internet connection.

Serve `index.html`, `sw.js` and `manifest.webmanifest` with revalidation
(`Cache-Control: no-cache`), `/sw.js` as JavaScript, PNG icons as `image/png`,
and the manifest as `application/manifest+json`. Keep SPA fallbacks out of `/api`,
`/sw.js` and static assets. Deploy the entire build atomically and retain previous
hashed assets for existing tabs. Purge any CDN cache of the worker and HTML when
deploying. The first deployment of this mechanism needs one normal navigation or
reload to register the worker; subsequent builds can display the update notice.
Native installation and standalone launch must also be checked on target Android
and iOS devices after deployment; the embedded development browser cannot prove
OS-level installation.

## Authentication and account management

- `/signup`: mobile number, five-digit OTP, then first name, last name and
  password. Registration is persisted in PostgreSQL and opens the dashboard.
- `/login`: phone/password or phone/OTP. Login OTP opens in a bottom sheet,
  verifies automatically on digit five, retains the phone on close, and shows
  server validation/rate-limit errors. Unknown/inactive accounts cannot sign in.
- `/account`: edit names, change password, view/revoke sessions and sign out.
- `/admin/users`: administrator-only user search, pagination, role changes and
  activation/suspension. Bootstrap an admin using the documented backend CLI.
- `/forgot-password`: OTP-based password reset; retained as a direct route.
  No forgot-password link is shown on the login screen.

The backend environment, not the Vite mode, controls development OTP `12345`.
Production uses random server-generated codes sent through the configured SMS
provider. Client validation is only for usability; the backend enforces every
account, expiry, rate, ownership and authorization rule.

## Financial UI scope

`/dashboard` now requires a server session and shows the user's first name.
Its financial summaries, transactions and editable budgets still use sample
figures in React memory and reset on reload. They are not personal persisted
financial records. The landing-page budget demo remains available without
registration. Banking connections and shared family accounts are not implemented.

## Design

Colors come from `../styles/colors.css`. Font faces use the supplied CDN with
swap/fallbacks. Forms retain Persian/Arabic digit support, keyboard controls,
44px touch targets and mobile layouts. Dialogs open as bottom sheets with focus
trapping, internal scrolling and reduced-motion support.

## Family flows

`/families` supports family creation, member lists, owner-managed invitations,
and invite revocation. `/invite#token=...` requires login and explicit acceptance.
Login/signup preserve the validated token in the URL fragment; only `/families`
is an allowed non-default auth return path. Family creation and invitation forms
reuse the RTL bottom sheet and shared controls. Financial dashboard data is still
sample data; family membership is persisted by the backend.

## Family plants

See [Plants setup, API and care rules](../docs/plants.md) for migration and local
workflow instructions. Open **گلدون‌ها** after selecting a family. This feature
uses in-app reminders only and defaults daily care to Asia/Tehran.

## Household shopping

Management → «خریدهای خونه» opens the selected family’s server-backed named shopping lists
(`/dashboard?page=purchases`). Requires backend 3.4.0 and migrations through `e8a1d6342fc9`.
Add names with optional free-text quantities/notes; mark purchases, return them to
the unchecked state, edit or confirm deletion. All items appear together with
checkboxes, keeping purchased items in place. The list pages at 50 items. Refresh explicitly to see other members’ latest changes; stale edits
require reloading the list. Form values survive request failures. No offline data
store is used. Checking an item saves its purchase directly without asking for a cost.
After the final pending item is checked, refreshed list state opens the optional
whole-list total-cost/category dialog. An entered amount records one expense for the
list as the confirming member; without a category it uses Other, and without an
amount no expense is created. Linked
items show their financial status; undo confirms that the expense remains, and rechecking
cannot create another expense for the same item. The existing Management access policy
continues to show this entry to the family creator/spouse.

Create a named list and add multiple item rows before saving. Open a list card to manage its items; counts and progress reflect that list only. Existing items appear in a default list.

Inside a list, «خریدم» also opens the total-cost dialog. Confirmation completes all remaining items (including other pages) and optionally creates one expense named after the list. Category defaults to Other. Cancel preserves all previously saved checkmarks. If any current item or prior list checkout has an expense, completion is available without a new total to prevent duplicate charges; rechecking the final item does not prompt for another cost.

The shopping list index filters lists with «در انتظار خرید» and «خرید شده». Nonempty lists with all live items checked are purchased; partially purchased and empty lists remain pending. Item detail keeps both checked and unchecked items together.

Each nonempty shopping list has a direct completion action on the list index. It loads a fresh checkout snapshot, opens the optional total-cost/category dialog and returns the completed list to the purchased view after confirmation.
