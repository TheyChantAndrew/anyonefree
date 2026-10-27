# Rift Night

Friend availability calendar for scheduling Rift Night (a Riftbound TCG tourney). No accounts: create a group, share the unguessable link, each friend picks a name (remembered on their device) and enters their weekly work pattern plus one-off dates.

- **Evening rule:** a friend is *free* if Off, or Working a same-day shift that ends by 5:30pm. Maybe counts as a tiebreaker.
- **Host:** the group creator's browser keeps a host token (localStorage) and can mark dates as Rift Night.
- **Storage:** a dedicated Turso (libSQL) database via `@libsql/client`. Reads only `RIFT_TURSO_DATABASE_URL` + `RIFT_TURSO_AUTH_TOKEN` (never plain `TURSO_*`). Until both exist the site shows "Storage not connected yet". Tables (`rn_groups`, `rn_members`) are created with `CREATE TABLE IF NOT EXISTS` on first use. Groups idle for ~13 months (400 days, by `updated_at`) are pruned on access. `/api/health` returns `{storage:true}` only when both vars exist and `SELECT 1` succeeds.

## Layout
- `public/` static app (`index.html`, `app.js`, `app.css`); `/g/:id` rewrites to `index.html`.
- `api/health.js`, `api/group.js` (create/get/delete), `api/member.js` (upsert/remove schedule), `api/riftnight.js` (host only).

The retired Riftbound store finder lives in git history at tag `store-finder-v1`.
