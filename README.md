# Gym Tracker

Direct-access workout tracker at https://cryptclaw.github.io/gym-tracker/.

## Workout plan update (7 October 2026)

- Day A: incline dumbbell bench press replaces chest press.
- Day B: leg press replaces bodyweight squat; dumbbell curls remain.
- Day C: narrow-grip lat pulldown and machine row replace the previous variants.
- Existing set/rep targets stay the same. New exercises require an entered load; old loads are not copied between different exercises.
- Drafts migrate to V3 by matching exercise names. The original V2 draft remains on the device and completed history is unchanged.

## Saving and recovery

- Drafts are saved on every input and survive changing workout days and reloading.
- Each exercise has a recovery countdown (default 90 seconds, adjustable in 30-second steps from 30 seconds to 15 minutes), start/pause and reset. Deadlines and paused time survive reload and day changes. Completion produces a short sound when browser audio is available; closed/suspended mobile browsers cannot guarantee an audible alarm.
- Each exercise has a completion checkbox and each day shows completed/total exercises. Checkboxes stay in the local draft and reset when that workout is saved or its draft is cleared.
- **Salva allenamento** stores the completed workout locally and synchronizes automatically. The visible status distinguishes pending device-only records from confirmed cloud records. Confirmation requires reading back the same workout, not merely a successful write response.
- Failed requests leave the workout pending across reload. Synchronization retries on reconnect, returning to the app and every 15 seconds while open. A save made during another request triggers a follow-up sync; stable IDs prevent duplicate retries.
- App installations and browsers have separate storage until linked once. Under **App, browser e copie di sicurezza**, copy the private personal link from one opening and paste it into **Collega app o browser** in the other. The entire source cloud archive, local history and destination archive are merged and verified before switching the connection. A failed connection preserves the original archive identity.
- Cloud storage uses a random 256-bit recovery key, generated on the device. There is no login. Treat the code and JSON backup as private credentials. A public URL alone cannot recover a private history.
- The Edge Function hashes the recovery key and restricts every query to that hash. Database tables have RLS and no anonymous or authenticated access. The browser has no database admin key.
- Workouts are append-only with stable IDs. Retries and restoring backups merge without duplicating sessions or deleting existing records.
- Legacy `gymTrackerV1` history is migrated with deterministic IDs. Its original contents are also retained locally as `gymTrackerOriginalBackupV2`.
- Export includes the recovery key, history and drafts. Import adds completed history to the current archive and never silently switches to the exported recovery key. Before import or linking, the last five safety snapshots are retained locally. **Recupera archivio precedente** restores the latest pre-import/link connection while retaining all current workouts; it does not delete already synchronized records. Drafts remain local.
- History, archive identity and synchronization acknowledgments are committed together on the device. A local storage failure leaves entered workout data in the draft. Cross-tab changes are merged before writing; an in-flight request cannot switch back to an obsolete archive.
- Offline app files are cached after the first successful online visit. New releases activate after old app tabs close.

## Tests and deployment

Pinned tools are in `package.json` and `pnpm-lock.yaml`. Run `pnpm install --frozen-lockfile`, `pnpm test`, and `pnpm test:browser`. Browser tests use isolated data and a mock cloud; they do not alter real user history. Coverage includes read-back acknowledgment, durable pending retries, concurrent saves, local storage failure, pairing two archives, non-destructive import/recovery, plan migration and offline app upgrades.

The Pages workflow publishes only after syntax, data and browser tests pass. The repository Pages source must be **GitHub Actions**, rather than direct branch publication. Only public app files are included in the deployment artifact.

## Database deployment

The dedicated `gym-tracker` project is in Cryptclaw's Org on its Free plan (quoted recurring project cost: 0/month). Live write/read, duplicate retry, cross-vault isolation and input rejection checks passed. The original finance project is unchanged.

The security advisor reports two informational `rls_enabled_no_policy` notices. This is intentional: browser roles have no table privileges or policies, so access is denied. Only the capability-checking Edge Function can read/insert. SQL verification confirms RLS on both tables, no `anon`/`authenticated` SELECT privileges, and no service-role UPDATE/DELETE privileges. See https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy .

Apply `database/schema.sql` to a dedicated Supabase project. Deploy `database/function.ts` with `core.js` at the relative import path, as function `gym-sync`, with platform JWT verification disabled: authentication is the 256-bit capability in `X-Gym-Key`, checked by the function. Only the SHA-256 hash is stored in the database. Configure its public URL in `config.js`.

The service-role credential exists only in the Edge Function environment. No read, edit or delete endpoint without the matching recovery key is exposed. This is capability-based authentication, not a public shared database.

## Limits

The automatic remote copy protects against device loss after sync. Database disaster recovery depends on the selected Supabase plan; do not assume paid point-in-time backups are enabled. Keep occasional private JSON exports for an independent copy. Drafts currently stay on the device; only completed workouts sync. Losing both the device and the recovery code/export prevents recovery. RLS isolation and live write/read checks must be verified when connecting a new database.
