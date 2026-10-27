// PUT ?id= {name, weekly, overrides} -> upsert schedule; DELETE ?id= {name} -> remove a friend
const L = require('./_lib');
module.exports = async (req, res) => {
  if (!L.connected()) return L.notConnected(res);
  try {
    const id = req.query.id;
    if (!L.validId(id)) return L.send(res, 400, { error: 'bad_id' });
    const g = await L.loadGroup(id);
    if (!g) return L.send(res, 404, { error: 'not_found' });
    const b = await L.body(req);
    if (req.method === 'PUT') {
      const m = L.cleanMember(b);
      if (!m) return L.send(res, 400, { error: 'name_required' });
      const [n] = await L.pipeline([['HLEN', 'g:' + id + ':m']]);
      if (n >= 60) { const [ex] = await L.pipeline([['HEXISTS', 'g:' + id + ':m', m.name.toLowerCase()]]); if (!ex) return L.send(res, 400, { error: 'group_full' }); }
      await L.pipeline([['HSET', 'g:' + id + ':m', m.name.toLowerCase(), JSON.stringify(m)], ...L.touch(id)]);
      return L.send(res, 200, m);
    }
    if (req.method === 'DELETE') {
      const name = L.cleanName(b.name);
      if (!name) return L.send(res, 400, { error: 'name_required' });
      await L.pipeline([['HDEL', 'g:' + id + ':m', name.toLowerCase()]]);
      return L.send(res, 200, { ok: true });
    }
    L.send(res, 405, { error: 'method' });
  } catch (e) { L.send(res, 500, { error: 'server', message: e.message }); }
};
