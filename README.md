<p><img src="public/logo.svg" alt="Anyone Free?" height="48"></p>

**Anyone Free?** is a no-signup friend availability calendar. Create a group, share the unguessable link, and everyone picks a name (remembered on their device) and taps in their weekly work pattern plus one-off dates. The group view shows a heatmap of who's free each evening and a ranked list of the best nights.

Live: https://anyonefree.vercel.app

- **Evening rule:** a friend is *free* if Off, or Working a same-day shift that ends by 5:30pm. Maybe counts as a tiebreaker.
- **Host:** the group creator's browser keeps a host token (localStorage) and can mark dates with "★ Plan it here", shown to everyone as "Planned: <date>".
- **Storage:** a dedicated Turso (libSQL) database via `@libsql/client`. Reads only `RIFT_TURSO_DATABASE_URL` + `RIFT_TURSO_AUTH_TOKEN` (never plain `TURSO_*`). Until both exist the site shows "Storage not connected yet". Tables (`rn_groups`, `rn_members`) are created with `CREATE TABLE IF NOT EXISTS` on first use. Groups idle for ~13 months (400 days, by `updated_at`) are pruned on access. `/api/health` returns `{storage:true}` only when both vars exist and `SELECT 1` succeeds.

## Layout
- `public/` static app (`index.html`, `app.js`, `app.css`, `favicon.svg`, `logo.svg`, `og.png`); `/g/:id` rewrites to `index.html`.
- `api/health.js`, `api/group.js` (create/get/delete), `api/member.js` (upsert/remove schedule), `api/riftnight.js` (host only: toggle a planned date).

Some internal names (`rift_nights` column, `/api/riftnight` route, `RIFT_TURSO_*` env vars, `rn:*` localStorage keys, the repo name) predate the rename and are kept so existing groups and links keep working. An earlier store-finder app lives in git history at tag `store-finder-v1`.
