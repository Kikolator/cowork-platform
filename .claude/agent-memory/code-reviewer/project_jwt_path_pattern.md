---
name: JWT space_id path inconsistency
description: RLS policies use two different JWT accessors for space_id - raw (auth.jwt() ->> 'space_id') and correct (current_space_id() which reads from app_metadata). New migrations must use current_space_id().
type: project
---

The codebase stores space_id in JWT app_metadata, so the correct accessor is `current_space_id()` (which reads `auth.jwt() -> 'app_metadata' ->> 'space_id'`). However, many older migrations (00001-00016) and at least one new migration (20260321171654_space_access_config.sql) use the raw `(auth.jwt() ->> 'space_id')::uuid` which reads from the JWT root and will never match.

**Why:** Migration 20260320181450 explicitly fixed this for import_jobs, documenting the bug. But the same bug was reintroduced in the later space_access_config migration.

**How to apply:** Always use `current_space_id()` in new RLS policies. Flag any use of `(auth.jwt() ->> 'space_id')` as a bug.
