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
