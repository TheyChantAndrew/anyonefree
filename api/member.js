// PUT ?id= {name, weekly, overrides} -> upsert schedule; DELETE ?id= {name} -> remove a friend
const L = require('./_lib');
module.exports = async (req, res) => {
  if (!L.connected()) return L.notConnected(res);
  try {
    const id = req.query.id;
    if (!L.validId(id)) return L.send(res, 400, { error: 'bad_id' });
    const c = await L.getDb();
    const g = await L.loadGroup(c, id);
    if (!g) return L.send(res, 404, { error: 'not_found' });
    const b = await L.body(req);
    if (req.method === 'PUT') {
      const m = L.cleanMember(b);
      if (!m) return L.send(res, 400, { error: 'name_required' });
      const key = m.name.toLowerCase();
      const r = await c.execute({ sql: 'SELECT COUNT(*) AS n, SUM(name_key = ?) AS ex FROM rn_members WHERE group_id = ?', args: [key, id] });
      if (Number(r.rows[0].n) >= 60 && !Number(r.rows[0].ex)) return L.send(res, 400, { error: 'group_full' });
      await c.batch([
        { sql: 'INSERT INTO rn_members (group_id, name_key, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(group_id, name_key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at', args: [id, key, JSON.stringify(m), m.updatedAt] },
        L.touch(id),
      ], 'write');
      return L.send(res, 200, m);
    }
    if (req.method === 'DELETE') {
      const name = L.cleanName(b.name);
      if (!name) return L.send(res, 400, { error: 'name_required' });
      await c.batch([{ sql: 'DELETE FROM rn_members WHERE group_id = ? AND name_key = ?', args: [id, name.toLowerCase()] }, L.touch(id)], 'write');
      return L.send(res, 200, { ok: true });
    }
    L.send(res, 405, { error: 'method' });
  } catch (e) { L.send(res, 500, { error: 'server', message: e.message }); }
};
