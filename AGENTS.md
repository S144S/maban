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

## Mobile-First Design

MaBan must follow a mobile-first approach across all pages, components, and user flows. Design and implement the small-screen experience first, then progressively enhance it for tablets and desktops.

- **Responsive foundations:** Use Tailwind CSS's unprefixed utilities for the mobile layout and breakpoint variants for larger screens. Choose breakpoints based on content needs rather than specific devices.
- **Content and layout:** Prioritize essential financial information and primary actions on small screens. Keep text readable, spacing consistent, and layouts usable without page-level horizontal scrolling or zooming.
- **Touch interactions:** Provide touch targets of at least 44 × 44 CSS pixels with sufficient separation. Every action must be accessible without hover, and keyboard interaction must remain supported.
- **Navigation and forms:** Keep navigation clear and primary actions easy to reach. Use appropriate input types, support autofill where relevant, and ensure forms and validation messages remain usable when the on-screen keyboard is open.
- **Financial data:** Adapt tables, charts, and summaries for narrow screens while preserving important information. When a data table requires horizontal scrolling, contain scrolling within the table region.
- **Larger screens:** Use additional space to improve information hierarchy and layout while preserving the capabilities available on mobile.
- **Verification:** Check key user flows at narrow mobile, tablet, and desktop widths. Verify overflow, touch usability, text resizing, and portrait and landscape layouts before considering UI work complete.

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
