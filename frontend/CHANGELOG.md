# Frontend Changelog

Notable frontend changes are documented here using Keep a Changelog categories
and independent Semantic Versioning.

## [Unreleased]

Current development version: `0.6.6`. No frontend release has been published.

### Changed

- Aligned family management with the dashboard theme: shared account avatar,
  consistent spacing, pastel empty/member/invitation cards, and capsule actions.

- Moved dashboard family access into the shared four-item bottom navigation,
  keeping navigation available on the family page with its own active indicator.

- Aligned the account page with the dashboard’s mobile layout, shared avatar,
  pastel section cards, capsule actions, a circular accessible back button,
  and clearer device session details.

- Replaced the dashboard account text shortcut with a scalable chipmunk avatar,
  retaining an accessible account label, keyboard focus, and a 48px touch target.

- Added a sliding active capsule to the dashboard bottom navigation, with RTL
  positioning and immediate selection updates when reduced motion is preferred.

- Moved login and signup OTP entry into an accessible bottom sheet, preserving
  the phone form, five-digit auto-submit, resend cooldown, and inline recovery.
  Removed the authentication step indicator and focus the profile form after
  successful signup verification.
- Removed the general design-preview notice beneath authentication forms and
  shortened the login button label, and removed the password-recovery link from
  login, where one-time-code entry is already offered.

- Applied the approved monochrome brand treatment throughout the site, with
  a white footer variant, a squirrel favicon, and matching browser theme color.
  Rebuilt the squirrel as smooth vector paths and rendered the wordmark with
  native Persian typography, replacing the low-resolution filtered logo crops.
- Simplified the login header by removing its separate back-to-home link and
  centering the logo and wordmark.

- Restyled all landing, authentication, dashboard, budget, transaction, and
  bottom-sheet surfaces with a shared pastel rose/lime/peach palette, bold
  Persian typography, capsule controls, and original scalable line artwork.
  Preserved mobile-first RTL layouts and existing preview interactions.

- Present shared dialogs as bottom sheets with rounded top corners, internal
  scrolling, safe-area spacing, and reduced-motion-aware slide transitions.

- Unified landing and demo copy with MaBan's friendly, conversational Persian
  voice, keeping product limitations and privacy information explicit.
- Added restrained decorative emoji, one-time section entrances, button feedback,
  and budget progress transitions, with reduced-motion support and visible content
  when animation observers are unavailable.

### Fixed

- Removed unnecessary text underlines from selected login-method and transaction-type toggle buttons.

- Require server-side account verification before entering the dashboard;
  unknown or inactive phone numbers cannot sign in with development OTPs.

- Prevented hero artwork from enlarging beyond its source resolution on wide
  screens while retaining the full-width hero layout.
- Used the larger reference logo for the closing banner instead of enlarging
  the small header mark, preserving its proportions and original design.

### Added

- Added mobile-first family creation, member lists, invitation creation/copy/revocation
  in bottom sheets, and explicit invitation acceptance. Preserve invitation context
  through login/signup using URL fragments, without open redirects.
- Added family entry points from dashboard and account settings.

- Added a Persian mobile-first dashboard at `/dashboard`, with monthly financial
  summaries, amount privacy controls, transaction creation and filtering, and
  editable category budgets. Sample data stays in memory and resets on reload.
  Dashboard access now requires an authenticated session; financial data remains
  a clearly labeled sample rather than personal persisted transactions.

- Connected phone signup, password/OTP login and password recovery to the
  FastAPI backend. Five-digit OTP auto-submit, Persian/Arabic digits, busy states,
  errors and the login bottom sheet work with server-owned verification.
- Added account profile editing, password changes, current/other session
  management and logout. Added admin-only paginated user search, role changes
  and activation/suspension, with server authorization on every operation.
- Added authenticated page guards and same-origin API integration; updated
  landing privacy/FAQ copy to describe actual account persistence.

- Established the independent frontend version baseline in `VERSION`.
- Added a Persian, RTL, mobile-first landing page matching the supplied visual
  reference, with a full-width responsive hero and closing call to action,
  original phone/brand artwork, financial cards, audience sections,
  responsive navigation, and accessible introduction, FAQ, and information dialogs.
- Added an interactive sample budget with expense updates and reset; demo data
  stays in memory and does not connect to a bank or a backend.
- Initialized React, Vite, TypeScript, Tailwind CSS, and shadcn/ui; integrated
  central light-theme colors, sidebar/chart aliases, Persian fonts, keyboard
  focus, reduced-motion support, and accessible demo feedback.
- Added build/type checks, version-metadata validation, and local setup instructions.
