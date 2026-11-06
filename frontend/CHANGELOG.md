# Frontend Changelog

Notable frontend changes are documented here using Keep a Changelog categories
and independent Semantic Versioning.

## [Unreleased]

Current development version: `0.26.1`. No frontend release has been published.

### Changed

- Replaced report-type buttons with equal-width underlined RTL tabs, keyboard navigation and labeled panels while preserving the selected date range.

- Removed the report footer explanation about family cash flow and personal assets.

- Renamed the report ledger to «تراکنش ها» and made it a keyboard-accessible disclosure, collapsed initially, with count-free income/expense tabs and five transactions per page with previous/next navigation.

- Simplified the cash-flow chart to follow the report date filter directly, removing its separate interval-details selector and readout.

- Refined report income/expense summaries into readable responsive rows with inline currency, percentage badges with up/down arrows and a dash for unchanged values labeled against the previous equivalent period, without an extra comparison-details section, preserving the shared application width. Percentage badges use pastel green for income growth or expense decline, pastel red for the inverse, and neutral colors for unchanged or unavailable comparisons. Nonzero totals with a zero comparison baseline display a compact unavailable-percentage placeholder.

- Shortened the Reports page heading and browser title to «گزارش», renamed the summary heading to «خلاصهٔ», removed its record count, and added playful cash-flow copy with a gently wistful message when expenses exceed income.

- Replaced the long Management page with expandable account/category cards: open content in place, keep only one card expanded, and preserve family selection with keyboard-accessible controls.

- Reduced the balance label, icon and currency label sizes and sized amounts against available space to keep currency alongside large mobile balances.

- Format all toman amount inputs with live three-digit separators, preserving Persian/Arabic/Latin digits, cursor editing and existing numeric API payloads.

- Simplified the expense sheet: removed the title input and replaced the category dropdown with wrapping icon-and-label radio buttons, selected color/border states, a shorter category label and keyboard support. Other is selected by default; new entries use a default title while preserving the API contract and historical titles.

### Added

- Added an online-only installable web app manifest, Persian app identity, standalone dashboard launch, and PNG installation icons using the existing brand artwork, including iOS home-screen metadata. No service worker or offline financial data cache is introduced.

- Show reminder SMS availability, provider acceptance, uncertain/skipped delivery and the next scheduled occurrence; update form copy for Tehran scheduling and Persian monthly recurrence. Requires backend 2.0.0 and separately enabled delivery.

- Added separate personal investment/asset reports with date filters, exact valuations, price-versus-holding attribution, missing-history states and accessible daily trends; reports use three compact selectors within the shared mobile shell.

- Replaced the sample Transactions destination with a real-data Reports page: Persian date filters, cash-flow summaries, previous-period comparisons, accessible trend charts and daily tables, category/source rankings, paginated records and daily CSV export. Reports retain the shared 480px mobile-first application shell and single-column sections on larger screens, with a title-only header and inline start/end labels for custom date inputs. Active family selection is shared across Home, Reports and Management, persists per user for the browser session, and can only be changed on the Families page. Management never falls back to another owned family. Legacy transactions links open Reports. Requires backend 1.5.0.

- Log the build-derived client version in the browser console and show the live backend version in the profile menu, with a small non-interactive «نسخهٔ:» label and graceful unavailable state.

- Added a compact Management price list with inline label-and-toman inputs that save on blur or Enter, clear when emptied, and show per-row saving/errors without a separate dialog for investments, per-square-metre house/land rates identified by location, and whole-car prices identified by vehicle. Both personal funds use current manual rates, with explicit missing-rate counts and historical purchase prices preserved. Metal rates apply per gram across the recorded metal holdings. Requires backend 1.4.0.

- Added a recurrence selector using the shared RTL design-system Select, with no-repeat, daily, weekly and monthly options, persisted across editing and shown in the list. SMS scheduling requires backend 2.0.0 and its separately enabled worker.

- Added an expandable personal reminders card for every signed-in user, including users without an owned family. Create, edit and delete reminders with Persian dates, Tehran time and optional amounts; keep the card concise without introductory privacy/delivery banners. Includes a reusable RTL Persian calendar with month/year selection, today shortcut, manual input, leap-year validation and keyboard navigation.

- Added a Management settings icon alongside category edit/delete actions, opening a bottom sheet to set, edit or remove each category’s recurring monthly spending limit, including Other, with Persian-digit input and clear no-alert/no-blocking semantics.

- Every family has a protected default Other category; deleting a custom category atomically reassigns its expenses to Other without changing totals. Expense retries remain safe after category edits/deletion.

- Added an owner-only expense-category section in Management with a bottom-sheet creation/editing forms and deletion confirmation and a soft peach header distinct from accounts. An icon-only, keyboard-accessible Lucide picker with compact 18px icons and screen-reader labels stores the chosen icon and displays it in Management and the expense selector. The expense modal loads the selected family’s saved categories with loading, retry and empty states instead of fixed options.

- Added a three-way home card selector for the everyday family fund, personal investment fund and personal asset fund. Shows recorded-price values, unpriced/empty states, retry controls and refreshed summaries after saving.

- Car entry uses one combined model field and defaults to the solar calendar without a calendar selector; separate historical brand values remain supported.

- Property forms now record optional price per square metre separately from historical purchase totals; car purchase prices are unchanged.

- Connected the assets action to a bottom sheet for houses, land and cars. Collects property title/location/area or vehicle brand/model/year in the solar calendar, optional purchase price and notes, Persian digit support and save feedback.

- Extended investment selection with silver, crypto, currency and bonds, with type-specific labels, identifiers and quantities. Unit purchase price and notes are optional; only the existing gold form exposes a total-price input. Currency selection offers USD, EUR, CNY and IQD with Persian labels.

- Added gold/stock selection in the investment sheet. Stock entries request symbol, whole share count, optional per-share price in tomans and notes, without a total-price input.

- Replaced the investment placeholder with a personal gold entry bottom sheet, supporting Persian/Arabic digits, decimal grams, optional purchase prices and notes, validation, save feedback and retry protection. Purchase price labels use per-gram and total wording with toman examples; dot-separated thousands are accepted.

- Added account deletion with confirmation and full-access authorization. Deleted accounts disappear from active choices while historical income references and totals remain unchanged. The delete action is hidden for view-only members.

- Added accessible account edit actions and a prefilled bottom sheet to rename family accounts, with validation and save feedback.

- Added investment and asset buttons to the single-row mobile home actions using stable action classes so dialog triggers retain their styling, with icons above readable 12px wrapping labels and distinct muted theme colors, with bottom sheets explicitly indicating these sections are not yet available.

- Management page for family accounts (banks, cash and gift cards) and required “Deposit to” selection in income forms, including empty, loading, error and read-only states. Match Management to the family screen with a rounded account card, shared-color overview, consistent account rows and an actionable empty state. Keep the deposit field visible while loading or when no accounts exist, with guidance to add an account in Management.

- Connected the simplified home balance and income/expense sheets to persisted family records, with family selection, permissions, loading/error states and idempotent writes. Redesigned the compact balance card without a footer divider or explanatory caption, with a neutral surface, a wallet emblem, readable family heading and prominent amounts that wrap on narrow screens. Income and expense actions use receiving-coins and payment-card icons. Existing income entries contribute to the balance; the transaction tab remains an explicitly labeled preview.

- Added an accessible RTL account menu to dashboard and family headers with profile navigation and quick sign-out, including pending and error feedback. Align the menu inward from the header avatar and keep page scrolling unlocked to prevent fixed bottom navigation from shifting.

- Family income inbox with toman totals, paginated history and a bottom-sheet form for full-access members.

- Added full/view access selection on family invitations and permission labels on members and invitation previews.

### Fixed

- Prevent long user names and access-edit buttons from widening admin user cards and causing horizontal page scrolling on small screens.

- Reduced the home fund selector height from 52px to 44px while preserving accessible touch targets, unified the card heading as balance across all three funds, and removed the shared/personal scope subtitles and empty-fund message from the home card. Tightened card padding and spacing; vertically centered the icon, balance title and adjacent amount in one compact row.

- Redrew the family empty-state illustration with complete chipmunk characters, simpler facial details and a balanced family composition.

- Removed the white circular background and border from family invitation delete buttons while preserving their touch targets and interaction feedback.

- Replaced native dropdown menus across the app with shared RTL select controls, styled options, selected indicators and keyboard navigation.

- Prevented full-page reloads when switching between family and dashboard tabs;
  preserve the floating navigation, in-memory views, and browser back/forward.

### Changed

- Removed access selectors and badges. Every family member can record income/expenses and manage invitations; Management shows only families created by the current user. Requires backend 1.0.0.

- Renamed the bottom navigation budget item to Management with a settings icon, preserving its existing destination.

- Simplified family cards by removing count/privacy badges, using an accessible trash icon for invitation revocation, and adding a scalable squirrel-family empty-state illustration.

- Updated the family page heading and welcome copy with decorative smile and heart emoji, removed the redundant invitation guidance card, and replaced the family dropdown with a visible list of owned and joined families, including the current selection. Combined each family selector and its member details into one card to avoid repeating the family heading. Removed the income inbox from the family page to keep it focused on family management.

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
