// Shared helpers: Turso (libSQL) via @libsql/client.
// Reads ONLY RIFT_TURSO_DATABASE_URL and RIFT_TURSO_AUTH_TOKEN (set on the riftbound-heist
// Vercel project). Deliberately never reads plain TURSO_* vars.
const crypto = require('crypto');
const DB_URL = process.env.RIFT_TURSO_DATABASE_URL;
const DB_TOKEN = process.env.RIFT_TURSO_AUTH_TOKEN;
const TTL_MS = 1000 * 60 * 60 * 24 * 400; // groups expire ~13 months after last write

// Both vars are required ("storage not connected" until they exist). A local file: URL is
// allowed for development only, where any non-empty token value satisfies the check.
const connected = () => !!(DB_URL && DB_TOKEN);

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS rn_groups (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    host_hash   TEXT NOT NULL,
    rift_nights TEXT NOT NULL DEFAULT '[]',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS rn_groups_updated_at ON rn_groups(updated_at)`,
  `CREATE TABLE IF NOT EXISTS rn_members (
    group_id   TEXT NOT NULL,
    name_key   TEXT NOT NULL,
    data       TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (group_id, name_key)
  )`,
];
let client = null, ready = null;
function db() {
  if (!client) {
    const { createClient } = require('@libsql/client');
    const opts = { url: DB_URL };
    if (!DB_URL.startsWith('file:')) opts.authToken = DB_TOKEN;
    client = createClient(opts);
  }
  return client;
}
// Lazily create tables on first use (once per warm instance).
async function getDb() {
  const c = db();
  if (!ready) ready = c.batch(SCHEMA, 'write').catch((e) => { ready = null; throw e; });
  await ready;
  return c;
}
let lastPrune = 0;
// Delete groups (and their members) idle longer than TTL. Runs at most every 10 min per instance.
async function prune(c, force) {
  const now = Date.now();
  if (!force && now - lastPrune < 10 * 60 * 1000) return;
  lastPrune = now;
  const cutoff = now - TTL_MS;
  await c.batch([
    { sql: 'DELETE FROM rn_members WHERE group_id IN (SELECT id FROM rn_groups WHERE updated_at < ?)', args: [cutoff] },
    { sql: 'DELETE FROM rn_groups WHERE updated_at < ?', args: [cutoff] },
  ], 'write');
}
const send = (res, code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };
const notConnected = (res) => send(res, 503, { error: 'storage_not_connected', message: 'Storage not connected yet.' });
const newId = (n) => crypto.randomBytes(n).toString('base64url');
const hash = (s) => crypto.createHash('sha256').update(String(s || '')).digest('hex');
const validId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{16,40}$/.test(id);
const validDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const cleanName = (n) => String(n || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40);
async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}
// Load a group; expired groups are pruned and treated as missing.
async function loadGroup(c, id) {
  await prune(c);
  const r = await c.execute({ sql: 'SELECT id, name, host_hash, rift_nights, created_at, updated_at FROM rn_groups WHERE id = ?', args: [id] });
  const row = r.rows[0];
  if (!row) return null;
  if (Number(row.updated_at) < Date.now() - TTL_MS) {
    await deleteGroup(c, id);
    return null;
  }
  let riftNights = [];
  try { riftNights = JSON.parse(row.rift_nights) || []; } catch {}
  return { id: row.id, name: row.name, hostHash: row.host_hash, riftNights, createdAt: Number(row.created_at) };
}
const deleteGroup = (c, id) => c.batch([
  { sql: 'DELETE FROM rn_members WHERE group_id = ?', args: [id] },
  { sql: 'DELETE FROM rn_groups WHERE id = ?', args: [id] },
], 'write');
const touch = (id) => ({ sql: 'UPDATE rn_groups SET updated_at = ? WHERE id = ?', args: [Date.now(), id] });
const isHost = (g, token) => !!token && g.hostHash === hash(token);

// Validate a schedule entry {s:'work'|'off'|'maybe', start?, end?} (minutes after midnight)
function cleanDay(d) {
  if (!d || !['work', 'off', 'maybe'].includes(d.s)) return null;
  const o = { s: d.s };
  if (d.s === 'work' && Number.isInteger(d.start) && Number.isInteger(d.end) && d.start >= 0 && d.start < 1440 && d.end > 0 && d.end <= 1440) { o.start = d.start; o.end = d.end; }
  return o;
}
function cleanMember(m) {
  const name = cleanName(m && m.name);
  if (!name) return null;
  const weekly = {};
  for (let i = 0; i < 7; i++) { const d = cleanDay(m.weekly && m.weekly[i]); if (d) weekly[i] = d; }
  const overrides = {};
  const keys = Object.keys((m && m.overrides) || {}).filter(validDate).sort().slice(-400);
  for (const k of keys) { const d = cleanDay(m.overrides[k]); if (d) overrides[k] = d; }
  return { name, weekly, overrides, updatedAt: Date.now() };
}
module.exports = { connected, getDb, prune, send, notConnected, newId, hash, validId, validDate, cleanName, body, loadGroup, deleteGroup, isHost, touch, cleanMember, TTL_MS };
