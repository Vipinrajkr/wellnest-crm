// data/migrations/index.js
// Ordered registry of schema migrations applied during IndexedDB's
// onupgradeneeded. Add new version bumps here without touching db.js.

import { migrateV1 } from './v1_initial.js';
import { migrateV2 } from './v2_add_programs.js';
import { migrateV3 } from './v3_add_payments.js';
import { migrateV4 } from './v4_add_supplements.js';
import { migrateV5 } from './v5_add_consultation_notes.js';
import { migrateV6 } from './v6_add_reminder_overrides.js';
import { migrateV7 } from './v7_add_settings_and_backup_log.js';

export const DB_VERSION = 7;

const MIGRATIONS = [
  { version: 1, run: migrateV1 },
  { version: 2, run: migrateV2 },
  { version: 3, run: migrateV3 },
  { version: 4, run: migrateV4 },
  { version: 5, run: migrateV5 },
  { version: 6, run: migrateV6 },
  { version: 7, run: migrateV7 },
];

export function applyMigrations(db, oldVersion) {
  MIGRATIONS.filter((migration) => migration.version > oldVersion)
    .sort((a, b) => a.version - b.version)
    .forEach((migration) => migration.run(db));
}
