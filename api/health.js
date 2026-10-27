const { connected, pipeline, send } = require('./_lib');
module.exports = async (req, res) => {
  if (!connected()) return send(res, 200, { storage: false });
  try { await pipeline([['PING']]); send(res, 200, { storage: true }); }
  catch (e) { send(res, 200, { storage: false, error: 'storage unreachable' }); }
};
