const { json, method, clearAdminCookie } = require('../lib/server');
module.exports = async (req, res) => { if (!method(req, res, 'POST')) return; clearAdminCookie(res); return json(res, 200, { ok: true }); };
