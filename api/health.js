// {storage:true} only when both RIFT_TURSO_* vars exist AND SELECT 1 succeeds.
const { connected, getDb, send } = require('./_lib');
module.exports = async (req, res) => {
  if (!connected()) return send(res, 200, { storage: false });
  try {
    const c = await getDb();
    await c.execute('SELECT 1');
    send(res, 200, { storage: true });
  } catch (e) {
    send(res, 200, { storage: false, error: 'Database query failed: ' + String((e && (e.code || e.message)) || e).slice(0, 160) });
  }
};
