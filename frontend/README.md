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
