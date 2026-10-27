# MaBan frontend

Persian RTL landing page built with React, TypeScript, Vite, Tailwind CSS 4,
and shadcn/ui buttons and dialogs adapted to MaBan's semantic theme.

## Local development

Requires Node.js 22.12+ and npm.

```powershell
cd frontend
npm ci
npm run dev
```

Open http://127.0.0.1:6201. Development and preview use this fixed port and fail
if it is occupied instead of silently choosing another port. Port 6202 is reserved
for the future backend; no backend application exists yet. Port 6000 is avoided
because browsers block it.

```powershell
npm run check
npm run build
npm run preview
```

`VERSION` is authoritative; synchronize package.json, package-lock.json and the
Unreleased changelog when changing versions. `npm run check` checks consistency.

## Scope

The sample purchase button updates the remaining balance, spending, and grocery
budget. Reset restores the sample. Changes live only in React memory and are
cleared on reload. Authentication, persistence, bank connections and family
accounts are not implemented. The FAQ makes this limitation explicit.

Colors come from ../styles/colors.css. Global font faces use the supplied CDN
with swap and sans-serif fallbacks. The layout follows the supplied landing-page
reference. The original reference image in public/assets is framed with CSS to
show only its phone artwork and existing brand marks; copy, cards, navigation,
and controls are native HTML. Replace these framed assets with standalone brand
exports when available. The budget demo opens in a dialog from the start buttons.

## Authentication design previews

Open `/login`, `/signup`, or `/forgot-password`. Forms validate locally and
explain that authentication is unavailable; they never submit, store credentials,
or simulate successful authentication. Login and signup are linked from the
landing navigation. Production hosting must serve index.html for these paths.

### Phone authentication preview

Signup: Iranian mobile number (09 + nine digits), OTP, then required first name,
last name, and password. Login
offers password or OTP. Recovery uses phone + OTP before a new password.
Persian and Arabic digits are accepted. No credentials or sessions are persisted.

`npm run dev` and `vite build --mode develop` enable the fixed development OTP
`12345`. Normal production builds disable mock OTP requests and verification.
The preview expires codes after 2 minutes, allows 5 verification attempts, and
has a 30-second resend cooldown. These client-side limits are UX simulations,
not security controls. A backend must implement real verification, SMS, password
hashing, rate limiting, and sessions before authentication can be enabled.
