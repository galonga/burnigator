# 1. JSON files for core data; database only for event auth and pinboard

Status: accepted (documented retroactively)

## Context

The core product (map, categories, POIs, programme, timelines, configuration) must run on ordinary shared PHP hosting. Event authentication and the pinboard need records that change concurrently (sessions, order hashes, posts, rate limits).

## Decision

Map, programme and configuration live in JSON files (`data/map.json`, `data/accounts.json`, `data/stats.json`, `data/history.json`, `data/snapshots/`) and uploads in the filesystem. Event authentication and the pinboard use MariaDB/MySQL through PDO and are optional. The database may be added, changed or removed later. Concurrent JSON saves are guarded by file locks and revision checks.

## Consequences

- The core map and timetable work with no database.
- Backups and snapshots of the core data are plain files; a full backup does not include the database, which must be backed up separately.
- Data is served by `api.php` from files; `data/` must never be web-accessible.
- Two storage systems to operate when the pinboard is enabled.
- Rationale beyond "core works without a database" is not stated in the repo; the choice of JSON over e.g. SQLite is not explained. (Uncertain.)
