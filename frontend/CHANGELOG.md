# Frontend Changelog

Notable frontend changes are documented here using Keep a Changelog categories
and independent Semantic Versioning.

## [Unreleased]

Current development version: `0.4.0`. No frontend release has been published.

### Changed

- Present shared dialogs as bottom sheets with rounded top corners, internal
  scrolling, safe-area spacing, and reduced-motion-aware slide transitions.

- Unified landing and demo copy with MaBan's friendly, conversational Persian
  voice, keeping product limitations and privacy information explicit.
- Added restrained decorative emoji, one-time section entrances, button feedback,
  and budget progress transitions, with reduced-motion support and visible content
  when animation observers are unavailable.

### Fixed

- Prevented hero artwork from enlarging beyond its source resolution on wide
  screens while retaining the full-width hero layout.
- Used the larger reference logo for the closing banner instead of enlarging
  the small header mark, preserving its proportions and original design.

### Added

- Added a Persian mobile-first dashboard at `/dashboard`, with monthly financial
  summaries, amount privacy controls, transaction creation and filtering, and
  editable category budgets. Sample data stays in memory and resets on reload.
  Local/develop login previews redirect directly to the sample dashboard after
  valid OTP verification or valid phone/nonempty password input (explicitly
  without password authentication). Signup and recovery previews retain a link.

- Added mobile-first Persian RTL login, signup, and password recovery design
  previews in a centered, full-height app shell capped at 480px on all screens,
  with phone-based signup (OTP then required first name, last name, and password), password or OTP login,
  phone-based password recovery, Persian/Arabic digit normalization, and accessible
  validation and password visibility controls. Five visible OTP slots support
  full-code paste, autofill, keyboard editing, and automatic verification when
  the fifth digit is entered. Local/develop previews use OTP
  `12345`, with expiry, retry limits, and resend cooldown; production disables
  mock verification.
  Includes direct URLs and landing-page navigation. Forms do not transmit or persist
  credentials; backend authentication remains unimplemented.

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
