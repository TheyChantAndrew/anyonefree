// POST {name} -> create group; GET ?id= -> group + members; DELETE ?id= (host) -> delete group
const L = require('./_lib');
module.exports = async (req, res) => {
  if (!L.connected()) return L.notConnected(res);
  try {
    const c = await L.getDb();
    if (req.method === 'POST') {
      const b = await L.body(req);
      const name = L.cleanName(b.name) || 'Our group';
      const id = L.newId(16), hostToken = L.newId(24), now = Date.now();
      await L.prune(c);
      await c.execute({ sql: "INSERT INTO rn_groups (id, name, host_hash, rift_nights, created_at, updated_at) VALUES (?, ?, ?, '[]', ?, ?)", args: [id, name, L.hash(hostToken), now, now] });
      return L.send(res, 201, { id, name, hostToken });
    }
    const id = req.query.id;
    if (!L.validId(id)) return L.send(res, 400, { error: 'bad_id' });
    const g = await L.loadGroup(c, id);
    if (!g) return L.send(res, 404, { error: 'not_found' });
    if (req.method === 'GET') {
      const r = await c.execute({ sql: 'SELECT data FROM rn_members WHERE group_id = ?', args: [id] });
      const members = [];
      for (const row of r.rows) { try { members.push(JSON.parse(row.data)); } catch {} }
      members.sort((a, b) => a.name.localeCompare(b.name));
      return L.send(res, 200, { id: g.id, name: g.name, riftNights: g.riftNights, members });
    }
    if (req.method === 'DELETE') {
      const b = await L.body(req);
      if (!L.isHost(g, b.hostToken || req.headers['x-host-token'])) return L.send(res, 403, { error: 'host_only' });
      await L.deleteGroup(c, id);
      return L.send(res, 200, { ok: true });
    }
    L.send(res, 405, { error: 'method' });
  } catch (e) { L.send(res, 500, { error: 'server', message: e.message }); }
};
