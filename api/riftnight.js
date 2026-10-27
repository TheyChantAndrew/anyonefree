// POST ?id= {date, on, hostToken} -> host marks/unmarks a date as the planned event (route name kept for compatibility)
const L = require('./_lib');
module.exports = async (req, res) => {
  if (!L.connected()) return L.notConnected(res);
  if (req.method !== 'POST') return L.send(res, 405, { error: 'method' });
  try {
    const id = req.query.id;
    if (!L.validId(id)) return L.send(res, 400, { error: 'bad_id' });
    const c = await L.getDb();
    const g = await L.loadGroup(c, id);
    if (!g) return L.send(res, 404, { error: 'not_found' });
    const b = await L.body(req);
    if (!L.isHost(g, b.hostToken)) return L.send(res, 403, { error: 'host_only' });
    if (!L.validDate(b.date)) return L.send(res, 400, { error: 'bad_date' });
    const set = new Set(g.riftNights);
    b.on ? set.add(b.date) : set.delete(b.date);
    const riftNights = [...set].sort().slice(-50);
    await c.execute({ sql: 'UPDATE rn_groups SET rift_nights = ?, updated_at = ? WHERE id = ?', args: [JSON.stringify(riftNights), Date.now(), id] });
    L.send(res, 200, { riftNights });
  } catch (e) { L.send(res, 500, { error: 'server', message: e.message }); }
};
