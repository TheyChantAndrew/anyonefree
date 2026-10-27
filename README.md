# Rift Night

Friend availability calendar for scheduling Rift Night (a Riftbound TCG tourney). No accounts: create a group, share the unguessable link, each friend picks a name (remembered on their device) and enters their weekly work pattern plus one-off dates.

- **Evening rule:** a friend is *free* if Off, or Working a same-day shift that ends by 5:30pm. Maybe counts as a tiebreaker.
- **Host:** the group creator's browser keeps a host token (localStorage) and can mark dates as Rift Night.
- **Storage:** Upstash Redis over REST (no npm deps). Reads `KV_REST_API_URL` + `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`). Without them the site shows "Storage not connected yet". Groups expire ~13 months after the last write.

## Layout
- `public/` static app (`index.html`, `app.js`, `app.css`); `/g/:id` rewrites to `index.html`.
- `api/health.js`, `api/group.js` (create/get/delete), `api/member.js` (upsert/remove schedule), `api/riftnight.js` (host only).

The retired Riftbound store finder lives in git history at tag `store-finder-v1`.
