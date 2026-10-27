'use strict';
// ---------- helpers ----------
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const dowIdx = (d) => (d.getDay() + 6) % 7; // 0 = Monday
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const nice = (k) => fromKey(k).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const LS = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }, del: (k) => { try { localStorage.removeItem(k); } catch {} } };
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600); }

// Evening rule: free if Off, or Working with a same-day shift that ends by 5:30pm.
const FREE_BY = 17 * 60 + 30;
function parseShift(str) {
  const m = String(str || '').trim().toLowerCase().replace(/\s+/g, '').match(/^(\d{1,2})(?::?(\d{2}))?([ap])?m?(?:-|–|to)(\d{1,2})(?::?(\d{2}))?([ap])?m?$/);
  if (!m) return null;
  let [, h1, m1, a1, h2, m2, a2] = m; h1 = +h1; h2 = +h2; m1 = +(m1 || 0); m2 = +(m2 || 0);
  if (h1 > 24 || h2 > 24 || m1 > 59 || m2 > 59) return null;
  const conv = (h, ap) => (ap === 'p' ? (h % 12) + 12 : ap === 'a' ? h % 12 : h);
  let e = conv(h2, a2) * 60 + m2, s;
  if (a1) s = conv(h1, a1) * 60 + m1;
  else if (a2) { s = conv(h1, a2) * 60 + m1; if (s >= e) s = conv(h1, a2 === 'p' ? 'a' : 'p') * 60 + m1; }
  else { s = h1 * 60 + m1; if (e <= s && h2 <= 12) e += 720; }
  if (e === 0) e = 1440;
  if (s >= 1440 || e > 1440 || s === e) return null;
  return { start: s, end: e };
}
const fmtT = (m) => { m %= 1440; const h = Math.floor(m / 60), mm = m % 60, ap = h < 12 ? 'a' : 'p'; return `${h % 12 || 12}${mm ? ':' + pad(mm) : ''}${ap}`; };
const fmtShift = (d) => (d && Number.isInteger(d.start) ? `${fmtT(d.start)}-${fmtT(d.end)}` : '');
function dayFor(m, k) { return (m.overrides && m.overrides[k]) || (m.weekly && m.weekly[dowIdx(fromKey(k))]) || null; }
function evening(d) {
  if (!d) return 'unknown';
  if (d.s === 'off') return 'free';
  if (d.s === 'maybe') return 'maybe';
  if (Number.isInteger(d.start) && d.start < d.end && d.end <= FREE_BY) return 'free';
  return 'busy';
}

// ---------- state ----------
const S = { gid: null, group: null, me: null, host: null, gMonth: null, mMonth: null, sel: null, ovSel: null, dirty: false, storage: true };
const today = () => keyOf(new Date());

async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json' }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let j = {}; try { j = await r.json(); } catch {}
  if (r.status === 503 && j.error === 'storage_not_connected') { setStorage(false); throw new Error('Storage not connected yet'); }
  if (!r.ok) { const e = new Error(j.error || 'Request failed'); e.status = r.status; throw e; }
  return j;
}
function setStorage(ok) { S.storage = ok; $('storage').hidden = ok; $('createBtn').disabled = !ok; }

// ---------- routing ----------
function show(view) { for (const v of ['home', 'group', 'missing']) $(v).hidden = v !== view; }
function route() {
  const m = location.pathname.match(/^\/g\/([A-Za-z0-9_-]{16,40})\/?$/);
  if (m) openGroup(m[1]); else { show('home'); renderRecent(); }
}
function recent() { try { return JSON.parse(LS.get('rn:groups') || '[]'); } catch { return []; } }
function remember(id, name) { const r = recent().filter((g) => g.id !== id); r.unshift({ id, name }); LS.set('rn:groups', JSON.stringify(r.slice(0, 8))); }
function renderRecent() {
  const r = recent(); $('recent').hidden = !r.length;
  $('recentList').innerHTML = r.map((g) => `<a class="btn" href="/g/${esc(g.id)}">${esc(g.name)}</a>`).join('');
}

// ---------- create ----------
$('createForm').onsubmit = async (e) => {
  e.preventDefault(); if (!S.storage) return;
  const btn = $('createBtn'); btn.disabled = true;
  try {
    const g = await api('/api/group', { method: 'POST', body: { name: $('gname').value } });
    LS.set('rn:host:' + g.id, g.hostToken); remember(g.id, g.name);
    history.pushState(null, '', '/g/' + g.id); route();
    toast('Group created. Share the link with your crew!');
  } catch (err) { toast(err.message); } finally { btn.disabled = !S.storage; }
};

// ---------- group ----------
async function openGroup(id) {
  S.gid = id; S.host = LS.get('rn:host:' + id); S.me = LS.get('rn:name:' + id);
  const now = new Date(); S.gMonth = S.gMonth || new Date(now.getFullYear(), now.getMonth(), 1); S.mMonth = S.mMonth || new Date(S.gMonth);
  show('group');
  try { await load(); } catch (e) {
    if (e.status === 404) { show('missing'); return; }
    $('gName').textContent = 'Anyone Free?'; $('friends').textContent = e.message;
  }
}
async function load() {
  const g = await api('/api/group?id=' + encodeURIComponent(S.gid));
  if (S.dirty) return; // don't clobber unsaved edits
  S.group = g; remember(g.id, g.name); render();
}
const meObj = () => { if (!S.group || !S.me) return null; const lo = S.me.toLowerCase(); return S.group.members.find((m) => m.name.toLowerCase() === lo) || null; };
function myMember() { let m = meObj(); if (!m) { m = { name: S.me, weekly: {}, overrides: {} }; S.group.members.push(m); } return m; }

function render() {
  const g = S.group; document.title = g.name + ' – Anyone Free?';
  $('gName').textContent = g.name; $('hostTag').hidden = !S.host;
  const up = (g.riftNights || []).filter((k) => k >= today());
  $('nextPlan').hidden = !up.length;
  if (up.length) $('nextPlan').innerHTML = `★ Planned: ${up.map(nice).map(esc).join(', ')}`;
  $('who').hidden = !!S.me;
  $('whoList').innerHTML = g.members.map((m) => `<button class="btn" data-name="${esc(m.name)}">${esc(m.name)}</button>`).join('');
  $('friends').textContent = g.members.length ? `${g.members.length} friend${g.members.length > 1 ? 's' : ''}: ${g.members.map((m) => m.name).join(', ')}` : 'No one has added a schedule yet. Share the link!';
  renderGroupCal(); renderDay(); renderBest(); renderMine();
}
function counts(k) {
  const c = { free: [], maybe: [], busy: [], unknown: [] };
  for (const m of S.group.members) c[evening(dayFor(m, k))].push(m.name);
  return c;
}
function monthCells(first) {
  const out = [], lead = dowIdx(first), n = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  for (let i = 0; i < lead; i++) out.push(null);
  for (let d = 1; d <= n; d++) out.push(keyOf(new Date(first.getFullYear(), first.getMonth(), d)));
  return out;
}
function renderGroupCal() {
  const f = S.gMonth, total = S.group.members.length, t = today(), rn = new Set(S.group.riftNights || []);
  $('gMonth').textContent = `${MONTHS[f.getMonth()]} ${f.getFullYear()}`;
  $('gGrid').innerHTML = monthCells(f).map((k) => {
    if (!k) return '<span class="cell empty"></span>';
    const c = counts(k), r = total ? c.free.length / total : 0, past = k < t;
    const bg = c.free.length ? `background:hsl(170 45% ${Math.round(88 - r * 54)}%)` : '';
    const cls = ['cell', past && 'past', k === t && 'today', k === S.sel && 'sel', rn.has(k) && 'planday', r > 0.5 && 'dark'].filter(Boolean).join(' ');
    const lbl = `${nice(k)}: ${c.free.length} free, ${c.maybe.length} maybe${rn.has(k) ? ', planned' : ''}`;
    return `<button class="${cls}" style="${bg}" data-gday="${k}" aria-label="${esc(lbl)}">${+k.slice(8)}${total ? `<small>${c.free.length}${c.maybe.length ? '+' + c.maybe.length : ''}</small>` : ''}</button>`;
  }).join('');
}
function renderDay() {
  const el = $('day'), k = S.sel; el.hidden = !k; if (!k) return;
  const c = counts(k), isPlan = (S.group.riftNights || []).includes(k);
  const sec = (title, names, cls) => names.length ? `<h3>${title} (${names.length})</h3><div class="names ${cls}">${names.map((n) => `<span>${esc(n)}</span>`).join('')}</div>` : '';
  el.innerHTML = `<div class="mehead"><h2>${esc(nice(k))}${isPlan ? ' · ★ Planned' : ''}</h2><button class="link" id="closeDay">close</button></div><div class="daylist">
   ${sec('Free', c.free, 'free')}${sec('Maybe', c.maybe, 'maybe')}${sec('Busy', c.busy, '')}${sec('No info', c.unknown, '')}
   ${!S.group.members.length ? '<p class="hint">No schedules yet.</p>' : ''}</div>
   ${S.host && k >= today() ? `<div class="row"><button class="btn ${isPlan ? '' : 'primary'}" id="planBtn" style="flex:1">${isPlan ? 'Remove plan' : '★ Plan it here'}</button></div>` : ''}`;
}
function renderBest() {
  const list = [], d = new Date();
  for (let i = 0; i < 60; i++) { const k = keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + i)); const c = counts(k); if (c.free.length) list.push({ k, f: c.free.length, m: c.maybe.length }); }
  list.sort((a, b) => b.f - a.f || b.m - a.m || (a.k < b.k ? -1 : 1));
  const rn = new Set(S.group.riftNights || []);
  $('best').innerHTML = list.slice(0, 5).map((x) => `<li><button class="btn" data-best="${x.k}"><b>${rn.has(x.k) ? '★ ' : ''}${esc(nice(x.k))}</b><span class="rk">${x.f} free${x.m ? ` · ${x.m} maybe` : ''}</span></button></li>`).join('')
    || '<li class="hint">Add schedules to see the best nights in the next 60 days.</li>';
}

// ---------- my schedule ----------
const CYCLE = [null, 'work', 'off', 'maybe'];
const LABEL = { work: 'Working', off: 'Off', maybe: 'Maybe' };
function renderMine() {
  const has = !!S.me; $('mineCard').hidden = !has; if (!has) return;
  $('meName').textContent = S.me;
  const m = meObj() || { weekly: {}, overrides: {} };
  if (!document.activeElement || !document.activeElement.classList.contains('wt')) {
    $('weekly').innerHTML = DAYS.map((d, i) => { const w = m.weekly[i]; const s = w ? w.s : '';
      return `<div class="wrow"><span class="d">${d}</span><button class="st ${s}" data-wk="${i}">${s ? LABEL[s] : 'Not set'}</button>${s === 'work' ? `<input class="wt" data-wt="${i}" placeholder="9a-5p" value="${esc(fmtShift(w))}" aria-label="${d} shift">` : '<span></span>'}</div>`; }).join('');
  }
  const f = S.mMonth, t = today();
  $('mMonth').textContent = `${MONTHS[f.getMonth()]} ${f.getFullYear()}`;
  $('mGrid').innerHTML = monthCells(f).map((k) => {
    if (!k) return '<span class="cell empty"></span>';
    const d = dayFor(m, k), ov = !!m.overrides[k];
    const cls = ['cell', d && d.s, ov && 'ov', k < t && 'past', k === t && 'today', k === S.ovSel && 'sel'].filter(Boolean).join(' ');
    return `<button class="${cls}" data-mday="${k}" aria-label="${esc(nice(k) + ': ' + (d ? LABEL[d.s] : 'not set') + (ov ? ' (one-off)' : ''))}">${+k.slice(8)}${d && d.s === 'work' && Number.isInteger(d.start) ? `<small>${fmtT(d.end)}</small>` : ''}</button>`;
  }).join('');
  const o = S.ovSel && m.overrides[S.ovSel];
  $('ovShift').hidden = !(o && o.s === 'work');
  if (o && o.s === 'work') { $('ovLabel').textContent = nice(S.ovSel) + ' shift'; if (document.activeElement !== $('ovTime')) $('ovTime').value = fmtShift(o); }
}
let saveT;
function scheduleSave() {
  S.dirty = true; $('saved').textContent = 'Saving…'; clearTimeout(saveT);
  saveT = setTimeout(async () => {
    const m = myMember();
    try { await api('/api/member?id=' + encodeURIComponent(S.gid), { method: 'PUT', body: m }); S.dirty = false; $('saved').textContent = 'Saved ✓'; await load(); }
    catch (e) { S.dirty = false; $('saved').textContent = 'Not saved: ' + e.message; }
  }, 600);
}
function applyShift(target, input) {
  const v = input.value.trim();
  if (!v) { delete target.start; delete target.end; input.classList.remove('bad'); return true; }
  const p = parseShift(v); if (!p) { input.classList.add('bad'); return false; }
  input.classList.remove('bad'); target.start = p.start; target.end = p.end; return true;
}

// ---------- events ----------
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button,a'); if (!b) return;
  if (b.dataset.name) { setMe(b.dataset.name); return; }
  if (b.dataset.nav) { const [w, d] = b.dataset.nav.split(':'); const k = w === 'g' ? 'gMonth' : 'mMonth'; S[k] = new Date(S[k].getFullYear(), S[k].getMonth() + +d, 1); render(); return; }
  if (b.dataset.gday) { S.sel = S.sel === b.dataset.gday ? null : b.dataset.gday; renderGroupCal(); renderDay(); if (S.sel && innerWidth < 900) $('day').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
  if (b.dataset.best) { S.sel = b.dataset.best; const d = fromKey(S.sel); S.gMonth = new Date(d.getFullYear(), d.getMonth(), 1); renderGroupCal(); renderDay(); $('day').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (b.id === 'closeDay') { S.sel = null; renderGroupCal(); renderDay(); return; }
  if (b.dataset.wk !== undefined) { const m = myMember(), i = b.dataset.wk, cur = m.weekly[i] ? m.weekly[i].s : null; const nx = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
    if (nx) m.weekly[i] = { ...(m.weekly[i] || {}), s: nx }; else delete m.weekly[i];
    if (nx !== 'work' && m.weekly[i]) { delete m.weekly[i].start; delete m.weekly[i].end; }
    renderMine(); renderGroupCal(); renderBest(); scheduleSave(); return; }
  if (b.dataset.mday) { const m = myMember(), k = b.dataset.mday, cur = m.overrides[k] ? m.overrides[k].s : null; const nx = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
    if (nx) m.overrides[k] = { s: nx }; else delete m.overrides[k]; S.ovSel = k;
    renderMine(); renderGroupCal(); renderBest(); scheduleSave(); return; }
  if (b.id === 'planBtn') { const on = !(S.group.riftNights || []).includes(S.sel);
    try { const r = await api('/api/riftnight?id=' + encodeURIComponent(S.gid), { method: 'POST', body: { date: S.sel, on, hostToken: S.host } }); S.group.riftNights = r.riftNights; render(); toast(on ? '★ Planned!' : 'Plan removed'); } catch (err) { toast(err.message); } return; }
  if (b.id === 'shareBtn') { const url = (location.hostname.endsWith('.vercel.app') ? 'https://anyonefree.vercel.app' : location.origin) + '/g/' + S.gid;
    try { if (navigator.share && matchMedia('(pointer:coarse)').matches) await navigator.share({ title: S.group ? S.group.name : 'Anyone Free?', text: 'Anyone free? Add your days off so we can pick a night.', url }); else { await navigator.clipboard.writeText(url); toast('Link copied'); } } catch { prompt('Copy this link:', url); } return; }
  if (b.id === 'changeMe') { S.me = null; LS.del('rn:name:' + S.gid); render(); $('who').scrollIntoView({ block: 'center' }); return; }
  if (b.id === 'removeMe') { if (!confirm(`Remove ${S.me}'s schedule from this group?`)) return;
    try { await api('/api/member?id=' + encodeURIComponent(S.gid), { method: 'DELETE', body: { name: S.me } }); LS.del('rn:name:' + S.gid); S.me = null; await load(); toast('Removed'); } catch (err) { toast(err.message); } return; }
});
document.addEventListener('change', (e) => {
  const i = e.target;
  if (i.dataset.wt !== undefined) { const m = myMember(); if (applyShift(m.weekly[i.dataset.wt], i)) { renderGroupCal(); renderBest(); scheduleSave(); } }
  if (i.id === 'ovTime' && S.ovSel) { const m = myMember(); if (m.overrides[S.ovSel] && applyShift(m.overrides[S.ovSel], i)) { renderMine(); renderGroupCal(); renderBest(); scheduleSave(); } }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('.wt,#ovTime')) e.target.blur(); });
function setMe(name) { name = String(name).trim().slice(0, 40); if (!name) return; S.me = name; LS.set('rn:name:' + S.gid, name); render(); setTab('mine'); }
$('whoForm').onsubmit = (e) => { e.preventDefault(); setMe($('whoName').value); };
function setTab(t) { const mine = t === 'mine'; $('tGroup').setAttribute('aria-selected', !mine); $('tMine').setAttribute('aria-selected', mine); $('pGroup').classList.toggle('tabhide', mine); $('pMine').classList.toggle('tabhide', !mine); }
$('tGroup').onclick = () => setTab('group'); $('tMine').onclick = () => setTab('mine');
window.addEventListener('popstate', route);
setInterval(() => { if (S.gid && !$('group').hidden && document.visibilityState === 'visible' && !S.dirty) load().catch(() => {}); }, 20000);

// ---------- boot ----------
setTab('group');
fetch('/api/health').then((r) => r.json()).then((j) => setStorage(!!j.storage)).catch(() => setStorage(false));
route();
