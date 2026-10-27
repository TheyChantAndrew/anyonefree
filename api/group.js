// POST {name} -> create group; GET ?id= -> group + members; DELETE ?id= (host) -> delete group
const L = require('./_lib');
module.exports = async (req, res) => {
  if (!L.connected()) return L.notConnected(res);
  try {
    if (req.method === 'POST') {
      const b = await L.body(req);
      const name = L.cleanName(b.name) || 'Rift Night';
      const id = L.newId(16), hostToken = L.newId(24);
      const g = { id, name, hostHash: L.hash(hostToken), riftNights: [], createdAt: Date.now() };
      await L.pipeline([['SET', 'g:' + id, JSON.stringify(g), 'EX', L.TTL]]);
      return L.send(res, 201, { id, name, hostToken });
    }
    const id = req.query.id;
    if (!L.validId(id)) return L.send(res, 400, { error: 'bad_id' });
    const g = await L.loadGroup(id);
    if (!g) return L.send(res, 404, { error: 'not_found' });
    if (req.method === 'GET') {
      const [flat] = await L.pipeline([['HGETALL', 'g:' + id + ':m']]);
      const members = [];
      for (let i = 0; flat && i < flat.length; i += 2) { try { members.push(JSON.parse(flat[i + 1])); } catch {} }
      members.sort((a, b) => a.name.localeCompare(b.name));
      return L.send(res, 200, { id: g.id, name: g.name, riftNights: g.riftNights || [], members });
    }
    if (req.method === 'DELETE') {
      const b = await L.body(req);
      if (!L.isHost(g, b.hostToken || req.headers['x-host-token'])) return L.send(res, 403, { error: 'host_only' });
      await L.pipeline([['DEL', 'g:' + id, 'g:' + id + ':m']]);
      return L.send(res, 200, { ok: true });
    }
    L.send(res, 405, { error: 'method' });
  } catch (e) { L.send(res, 500, { error: 'server', message: e.message }); }
};
