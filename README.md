# Wellnest Nutrition CRM

Offline-first Android CRM for a single nutrition practitioner — clients, programs, payments, supplements, consultation notes, reminders, reports, and Telegram-backed backup — with no server, no login, and no account setup. Everything runs from local IndexedDB inside a Capacitor-wrapped WebView.

For the full feature spec, data model, and non-functional requirements, see [`PROJECT_SPEC.md`](../PROJECT_SPEC.md) (one level up, alongside `ARCHITECTURE.md`). This README is a shorter developer-facing entry point.

## What it does

- **Clients** — profiles, search, status filters (Lead/Active/Completed/Dropped).
- **Programs** — multiple/concurrent programs per client, auto-computed duration and progress, Renew/Complete actions.
- **Payments (Ledger)** — per-program fee/discount, auto-calculated Paid/Pending from an append-only payment history, Receipt/Invoice PDFs.
- **Supplements** — per-client regimens with Complete/Discontinue actions; an omitted end date reads as "Ongoing."
- **Consultation Notes** — unlimited chronological log of vitals (weight, auto-calculated BMI, body fat, waist, BP) and clinical notes.
- **Dashboard** — client counts, today's follow-ups, programs ending soon, payment stats.
- **Reports** — Revenue/Collections/Pending totals, a 6-month collections trend, CSV/PDF export.
- **Reminders** — unified Followups/Payments/Program Ending/Supplement Ending list, with Android local notifications.
- **Backup & Restore** — manual (file or Telegram) and automatic daily Telegram backup, schema-versioned validation, a backup audit log, and a factory reset.
- **Settings** — clinic info, theme (light/dark), Telegram configuration, backup schedule.

## Tech stack

Vanilla HTML/CSS/JavaScript (ES modules, no framework, no bundler) + IndexedDB, wrapped for Android via [Capacitor](https://capacitorjs.com/). See `PROJECT_SPEC.md` §3 for the full rationale and `ARCHITECTURE.md` for the layering (`ui/ → state/ → domain/ → data/ | platform/ | services/`, all under `src/`).

## Running it during development

No build step. Open `src/index.html` directly in a browser, or serve the folder with any static file server:

```
npx serve src
```

IndexedDB and all core CRM logic work fully in a plain browser — only the Capacitor-bridged pieces (Local Notifications, Background Runner) degrade to safe no-ops outside the native shell, so most development doesn't need the Android build at all.

## Building the Android app

See [`BUILD.md`](./BUILD.md) for the full one-time setup, debug build, release signing, and release build steps (`npm install` → `npx cap sync android` → Android Studio / Gradle). None of this can be run without Node, a JDK, and the Android SDK on your machine.

## Testing

There's no bundled test suite in `src/` (no test framework dependency, keeping the app's own footprint minimal). The project is instead verified functionally against the real `domain/`/`data/` modules using Node + [`fake-indexeddb`](https://github.com/dumbmatter/fake-indexeddb), covering CRUD, search, payments, programs, supplements, reports, backup/restore, Telegram (mocked network), and the notifications adapter's no-op degradation path. See `PROJECT_SPEC.md` §8.7 for what's covered.

## Project layout

```
wellnest-crm/
├── android/          # Capacitor-generated native Android project
├── src/
│   ├── core/         # App-wide plumbing: router, event bus, date/collection helpers, debounce
│   ├── data/          # IndexedDB access — the only layer allowed to open a transaction
│   ├── domain/        # Business rules + orchestration, one folder per feature
│   ├── platform/      # Capacitor bridge adapters (notifications, Telegram, background runner)
│   ├── services/      # Generic utilities (CSV/PDF/file export)
│   ├── state/         # In-memory store + pub/sub actions the UI calls into
│   ├── styles/        # Design tokens + shared structural CSS
│   └── ui/            # Screens and panels — render from state only
├── capacitor.config.json
├── package.json
└── BUILD.md
```

## Documentation index

- [`PROJECT_SPEC.md`](../PROJECT_SPEC.md) — full feature spec, IndexedDB schema, backup/restore design, Android packaging, and the running log of audit/optimization passes.
- [`ARCHITECTURE.md`](../ARCHITECTURE.md) — layering and design principles.
- [`BUILD.md`](./BUILD.md) — Android build, signing, and release steps.
- [`CHANGELOG.md`](./CHANGELOG.md) — what shipped, by pass.
