# Changelog

All notable changes to Wellnest Nutrition CRM, by build pass. This project doesn't yet have a published release history, so entries below are grouped by what was actually built/changed rather than by shipped version tags.

## [1.0.0] — 2026-07-16 (production release candidate)

### Added
- Client management: CRUD, search (name/phone/email), status filters.
- Programs: multiple/concurrent per client, auto-computed duration/progress/effective status, Renew/Complete.
- Payment ledger: per-program fee/discount, auto-calculated paid/pending, append-only payment history, Receipt/Invoice PDFs.
- Supplements: per-client regimens, Complete/Discontinue, "Ongoing" vs. day-count duration.
- Consultation notes: unlimited chronological vitals + clinical notes log, auto-calculated BMI.
- Dashboard: client counts, today's follow-ups, programs ending soon, payment stats.
- Reports: Revenue/Collections/Pending totals, 6-month collections trend, CSV/PDF export.
- Reminders: unified Followups/Payments/Program Ending/Supplement Ending list, Android local notifications.
- Backup & Restore: manual (file/Telegram) and automatic daily Telegram backup, schema-versioned validation, backup audit log, factory reset.
- Settings: clinic info, light/dark theme, Telegram configuration, backup schedule.
- Android packaging: Capacitor scaffold, permissions, adaptive icon + splash screen, WorkManager-backed background reliability check (`@capacitor/background-runner`).
- Material-Design-inspired UI pass: elevation/motion design tokens, shared loading/error/empty-state components, fade-in transitions, dark mode, accessibility (focus rings, `aria-live`, `aria-label`s, `prefers-reduced-motion`).

### Changed (production optimization pass)
- **Architecture/dead code**: removed domain and state-layer functions that were built but never wired to any UI (`programService.updateProgram`/`deleteProgram`, `supplementService.updateSupplement`/`deleteSupplement`, the corresponding orphaned state actions, and an unused `core/router.js` export) — zero observable behavior change, since nothing invoked them.
- **UI performance**: the Clients search input is now debounced (250ms) instead of querying IndexedDB on every keystroke; both the Clients list and Consultation Notes log now use windowed "Load more" rendering (`ui/shared/pagination.js`) instead of building every row's DOM at once, per `PROJECT_SPEC.md` §8.2's original (previously unmet) pagination/virtualization requirement.
- **APK size**: release builds now enable R8 code shrinking and resource shrinking (`minifyEnabled true`, `shrinkResources true` in `android/app/build.gradle`), with explicit ProGuard keep rules for Capacitor's bridge/plugin classes as a safety net (`android/app/proguard-rules.pro`).
- **Documentation**: added this changelog, a top-level `README.md`, and a release checklist in `BUILD.md`.

### Verified
- 106 functional assertions (Node + `fake-indexeddb`, driving the real `domain`/`data` modules) covering CRUD, search, payments, programs, supplements, reports, backup/restore, Telegram (mocked network), and the notifications adapter's no-op degradation path — see `PROJECT_SPEC.md` §8.7.
- All source files re-verified to parse cleanly after the dead-code removal.
