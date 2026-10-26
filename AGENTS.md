# MaBan — Project Guidelines

## Project Overview

MaBan (مابان) is a web application for family financial management.

## Technology Stack

### Backend

- **Python 3.14 or later** — minimum supported Python version.
- **FastAPI** — backend web framework and API layer.
- **SQLAlchemy** — ORM and database access layer.
- **Alembic** — database schema migrations.

### Database

- **PostgreSQL** — relational database.

### Frontend

- **React** — user interface library.
- **Vite** — development server and build tool.
- **shadcn/ui** — UI components.
- **Tailwind CSS** — utility-based styling.

## UI Design System

Use [Material Design 3](https://m3.material.io/) as the design reference for MaBan's user interface. Its principles should guide visual hierarchy, component appearance, interaction patterns, and responsive behavior while supporting MaBan's identity and mobile-first approach.

- **Implementation:** Build UI components with React, shadcn/ui, and Tailwind CSS, adapting their styling and behavior to Material Design 3 guidance. This design reference does not require adopting an additional component library.
- **Design tokens:** Define shared semantic tokens for colors, typography, shapes, spacing, elevation, and motion. Apply them consistently through the theme and reusable components.
- **Components and states:** Follow Material Design 3 guidance for navigation, buttons, fields, cards, dialogs, and feedback. Provide clear focus, pressed, selected, disabled, and error states where applicable.
- **Accessibility and adaptation:** Maintain readable contrast, visible keyboard focus, accessible labels, and reduced-motion support. Adapt patterns to the web and screen size while preserving the mobile-first requirements below.

### Color System

The central color source is `styles/colors.css`. The default theme is light. The visual direction is calm, modern, clean, and trustworthy, using deep teal, navy, and mostly neutral surfaces. Preserve the current logo without recoloring or redesigning it.

- **Brand roles:** Use teal for primary actions, navy for identity and serious emphasis, aqua sparingly for graphics and charts, and optional gold sparingly for goals or premium features. Aqua must not replace the primary button color; gold is separate from the interactive `accent` token.
- **Surfaces and text:** Keep most surfaces neutral. Use `background` for the page, `card` and `popover` for their surfaces, and their matching foreground tokens for text. Use `muted` for subtle surfaces and `muted-foreground` for supporting copy. Main amounts use `foreground`, not gold.
- **Interactions:** Primary buttons use `primary` and `primary-foreground`, with explicit `primary-hover` and `primary-active` states. Secondary buttons use the secondary tokens. Use `accent` and `accent-foreground` for subtle hover/selection, `ring` for visible keyboard focus, and disabled tokens for disabled controls. Avoid opacity changes that undermine contrast. Destructive actions use the destructive tokens and their hover variant.
- **Borders:** Use `border` for subtle separators and card outlines. Use `input` for control boundaries; the subtle border token is not sufficient as the only visual identifier of a control.
- **Statuses:** Use success, warning, error, and info tokens for text/icons on their corresponding `*-bg` surfaces. Include clear text or icons; color alone must not convey meaning. Ordinary expenses are not errors and must not all be red. Keep brand and status semantics separate.
- **Navigation and privacy:** Active navigation requires a non-color indicator alongside color and a subtle background. Private/shared information also requires a label or icon.
- **Charts and notifications:** Use the central chart and sidebar aliases and semantic status colors for notifications. Keep category colors consistent across pages and provide chart labels and values. Aqua and gold are graphical accents, not approved text colors on white; use foreground-colored labels and non-color cues.
- **Visual restraint:** Do not add intense colored surfaces, decorative gradients, neon glow, or colored shadows.
- **Integration:** No frontend or theme configuration exists yet. When creating the frontend, import the central stylesheet and map its tokens into the installed Tailwind/shadcn theme, including sidebar and chart tokens. Use semantic utilities in components; do not scatter HEX literals, inline colors, or new fixed-color classes. These variables contain complete CSS colors: do not wrap them in `hsl()`. Convert correctly if the eventual theme requires HSL or OKLCH.
- **Dark mode:** No dark mode currently exists. Do not introduce a theme switch as part of this color change.
- **Quality checks:** Check actual foreground/background combinations at a minimum 4.5:1 for normal text and 3:1 for control boundaries that are the sole identifier. Assess focus against adjacent surfaces, including actual opacity, hover, selected, disabled, and error states. Verify rendered pages on mobile and desktop and run existing project checks when an application is available.

## Mobile-First Design

MaBan must follow a mobile-first approach across all pages, components, and user flows. Design and implement the small-screen experience first, then progressively enhance it for tablets and desktops.

- **Responsive foundations:** Use Tailwind CSS's unprefixed utilities for the mobile layout and breakpoint variants for larger screens. Choose breakpoints based on content needs rather than specific devices.
- **Content and layout:** Prioritize essential financial information and primary actions on small screens. Keep text readable, spacing consistent, and layouts usable without page-level horizontal scrolling or zooming.
- **Touch interactions:** Provide touch targets of at least 44 × 44 CSS pixels with sufficient separation. Every action must be accessible without hover, and keyboard interaction must remain supported.
- **Navigation and forms:** Keep navigation clear and primary actions easy to reach. Use appropriate input types, support autofill where relevant, and ensure forms and validation messages remain usable when the on-screen keyboard is open.
- **Financial data:** Adapt tables, charts, and summaries for narrow screens while preserving important information. When a data table requires horizontal scrolling, contain scrolling within the table region.
- **Larger screens:** Use additional space to improve information hierarchy and layout while preserving the capabilities available on mobile.
- **Verification:** Check key user flows at narrow mobile, tablet, and desktop widths. Verify overflow, touch usability, text resizing, and portrait and landscape layouts before considering UI work complete.

## Persian Language, RTL, and Typography

MaBan is designed for Persian-speaking users. Persian is the primary UI language, and the entire application must use a right-to-left layout.

- **Document direction:** Set `lang="fa"` and `dir="rtl"` on the root HTML element. Ensure dialogs, popovers, menus, and other portaled components also respect RTL direction.
- **Layout and navigation:** Use logical CSS properties and Tailwind start/end utilities for alignment, spacing, and positioning. Keep DOM, reading, and keyboard focus order coherent. Mirror directional icons where appropriate; preserve logos and non-directional symbols.
- **Persian copy:** Write user-facing labels, navigation, validation messages, empty states, and feedback in natural, consistent Persian.
- **Mixed-direction content:** Isolate Latin text, email addresses, identifiers, and other LTR content with `bdi` or explicit local direction as needed. Verify amounts, negative signs, and currency labels display in the correct order.
- **Number presentation:** Format displayed numbers consistently for Persian users. Keep numeric values structured in application data and accept both Persian and Latin digits in numeric inputs.
- **Font roles:** Use `bakh` (Yekan Bakh FaNum) for body text, forms, buttons, and financial data; use `pinar` (Pinar FD) for headings and prominent titles. Apply these roles through shared typography tokens with a `sans-serif` fallback, including native form controls.
- **Font loading:** Use the supplied font sources below in the global stylesheet's base layer. Prefer WOFF2 with WOFF fallback where supplied, and use `font-display: swap`. Use the declared weights rather than relying on synthesized weights.
- **Verification:** Check Persian glyph shaping, mixed-direction content, financial values, and all interactive overlays in RTL on mobile and desktop. Ensure the interface remains usable while fonts load.

### Font Definitions

```css
@layer base {
    @font-face {
        font-family: pinar;
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: url('https://cdn3.direct.ir/fonts/pinar/woff2/Pinar-FD-Regular.woff2') format('woff2');
    }

    @font-face {
        font-family: pinar;
        font-style: normal;
        font-weight: 500;
        font-display: swap;
        src: url('https://cdn3.direct.ir/fonts/pinar/woff2/Pinar-FD-Medium.woff2') format('woff2');
    }

    @font-face {
        font-family: pinar;
        font-style: normal;
        font-weight: 600;
        font-display: swap;
        src: url('https://cdn3.direct.ir/fonts/pinar/woff2/Pinar-FD-SemiBold.woff2') format('woff2');
    }

    @font-face {
        font-family: pinar;
        font-style: normal;
        font-weight: 700;
        font-display: swap;
        src: url('https://cdn3.direct.ir/fonts/pinar/woff2/Pinar-FD-Bold.woff2') format('woff2');
    }

    @font-face {
        font-family: pinar;
        font-style: normal;
        font-weight: 800;
        font-display: swap;
        src: url('https://cdn3.direct.ir/fonts/pinar/woff2/Pinar-FD-ExtraBold.woff2') format('woff2');
    }

    @font-face {
        font-family: bakh;
        font-style: normal;
        font-weight: 300;
        font-display: swap;
        src: url('https://cdn3.direct.ir/fonts/yekan-bakh/woff2/YekanBakhFaNum-Light.woff2') format('woff2'),
            url('https://cdn3.direct.ir/fonts/yekan-bakh/woff/YekanBakhFaNum-Light.woff') format('woff');
    }

    @font-face {
        font-family: bakh;
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: url('https://cdn3.direct.ir/fonts/yekan-bakh/woff2/YekanBakhFaNum-Regular.woff2') format('woff2'),
            url('https://cdn3.direct.ir/fonts/yekan-bakh/woff/YekanBakhFaNum-Regular.woff') format('woff');
    }

    @font-face {
        font-family: bakh;
        font-style: normal;
        font-weight: 600;
        font-display: swap;
        src: url('https://cdn3.direct.ir/fonts/yekan-bakh/woff2/YekanBakhFaNum-SemiBold.woff2') format('woff2'),
            url('https://cdn3.direct.ir/fonts/yekan-bakh/woff/YekanBakhFaNum-SemiBold.woff') format('woff');
    }

    @font-face {
        font-family: bakh;
        font-style: normal;
        font-weight: 700;
        font-display: swap;
        src: url('https://cdn3.direct.ir/fonts/yekan-bakh/woff2/YekanBakhFaNum-Bold.woff2') format('woff2'),
            url('https://cdn3.direct.ir/fonts/yekan-bakh/woff/YekanBakhFaNum-Bold.woff') format('woff');
    }

    @font-face {
        font-family: bakh;
        font-style: normal;
        font-weight: 800;
        font-display: swap;
        src: url('https://cdn3.direct.ir/fonts/yekan-bakh/woff2/YekanBakhFaNum-ExtraBold.woff2') format('woff2'),
            url('https://cdn3.direct.ir/fonts/yekan-bakh/woff/YekanBakhFaNum-ExtraBold.woff') format('woff');
    }

}
```

## Code Design Principles

Follow SOLID principles throughout the backend and frontend, applying them appropriately to classes, modules, services, hooks, and components.

- **Single Responsibility:** Give each unit one cohesive responsibility and a clear reason to change. Separate business rules from transport, persistence, and presentation concerns.
- **Open/Closed:** Support expected extensions through composition and stable contracts, minimizing changes to established behavior.
- **Liskov Substitution:** Ensure implementations can replace their abstractions without breaking the promised behavior, inputs, outputs, or error semantics.
- **Interface Segregation:** Prefer small, focused interfaces and component contracts. Consumers should not depend on capabilities they do not use.
- **Dependency Inversion:** Keep business logic dependent on abstractions rather than infrastructure details. Supply concrete dependencies at application boundaries, using dependency injection where appropriate.

Apply these principles pragmatically: prefer clear, simple designs and introduce abstractions when they serve a concrete need. Do not add unnecessary inheritance, layers, or speculative extension points.

## Git Conventions

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) using the format `<type>[optional scope][!]: <description>`.

- Use meaningful types such as `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`, `perf`, and `style`. Reserve `style` for formatting-only changes that do not affect behavior.
- Write concise English descriptions in the imperative mood, without a trailing period. Use a scope when it adds useful context, such as `feat(budget): add monthly spending limits`.
- Mark breaking changes with `!` before the colon or a `BREAKING CHANGE:` footer, and explain the impact and required migration.
- Keep each commit focused on one logical change. Use the body to explain motivation or non-obvious decisions, and run relevant checks before committing.

### Branch Naming

Use `<type>/<short-description>` for new working branches, such as `feat/family-budgets`, `fix/transaction-validation`, or `chore/infra`. This is the project's preferred branch naming convention.

- Use lowercase English letters, digits, and hyphens in the description; keep names concise and descriptive.
- Choose a type that reflects the work, using the same vocabulary as commit types. Include an issue identifier when useful, such as `fix/123-budget-total`.
- Keep each branch focused on a coherent task and create it from the appropriate integration or release branch for that task.
