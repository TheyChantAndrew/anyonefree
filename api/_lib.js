// Shared helpers: Upstash Redis over REST (no npm deps). Works as soon as the
// Vercel Marketplace Upstash integration adds KV_REST_API_URL/KV_REST_API_TOKEN
// (or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN) to this project.
const crypto = require('crypto');
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL = 60 * 60 * 24 * 400; // groups expire ~13 months after last write

const connected = () => !!(URL_ && TOKEN);
async function pipeline(cmds) {
  const r = await fetch(URL_.replace(/\/$/, '') + '/pipeline', {
    method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error('storage error ' + r.status);
  const out = await r.json();
  for (const x of out) if (x.error) throw new Error('storage error: ' + x.error);
  return out.map((x) => x.result);
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
async function loadGroup(id) {
  const [g] = await pipeline([['GET', 'g:' + id]]);
  return g ? JSON.parse(g) : null;
}
const isHost = (g, token) => !!token && g.hostHash === hash(token);
const touch = (id) => [['EXPIRE', 'g:' + id, TTL], ['EXPIRE', 'g:' + id + ':m', TTL]];

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
module.exports = { connected, pipeline, send, notConnected, newId, hash, validId, validDate, cleanName, body, loadGroup, isHost, touch, cleanMember, TTL };
