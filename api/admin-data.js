const { getDb, json, method, verifyAdmin } = require('../lib/server');
module.exports = async (req, res) => {
  if (!method(req, res, 'GET')) return;
  try {
    if (!await verifyAdmin(req)) return json(res, 401, { error: 'جلسة المشرف انتهت. سجّل الدخول مجددًا.' });
    const db = getDb();
    const [presenceSnap, matchesSnap, bansSnap, reportsSnap] = await Promise.all([
      db.ref('presence').get(), db.ref('matches').get(), db.ref('bans').get(), db.ref('reports').get()
    ]);
    const presence = presenceSnap.val() || {}, matchesRaw = matchesSnap.val() || {}, bansRaw = bansSnap.val() || {}, reportsRaw = reportsSnap.val() || {};
    const now = Date.now();
    const activeUsers = Object.values(presence).filter(p => p && p.online !== false && now - Number(p.lastSeen || 0) < 40000).length;
    const activeChats = Object.entries(matchesRaw).map(([id, m]) => {
      const messages = Object.entries((m && m.messages) || {}).map(([messageId, msg]) => ({ id: messageId, ...msg })).sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0)).slice(-60);
      const users = {};
      for (const uid of Object.keys((m && m.participants) || {})) {
        const p = presence[uid] || {};
        users[uid] = { alias: (m.users && m.users[uid] && m.users[uid].alias) || p.alias || `Guest-${uid.slice(0,4)}`, countryCode: (m.users && m.users[uid] && m.users[uid].countryCode) || p.countryCode || 'XX', lastSeen: p.lastSeen || 0 };
      }
      return { id, createdAt: m.createdAt || 0, users, messages };
    });
    const bans = Object.entries(bansRaw).map(([ipHash, ban]) => ({ ipHash, ...ban })).sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0)).slice(0,500);
    const reports = Object.entries(reportsRaw).map(([id, report]) => ({ id, ...report })).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)).slice(0,300);
    return json(res, 200, { ok: true, now, activeUsers, activeChats, bans, reports, recentUsers: Object.entries(presence).filter(([,p])=>p && now-Number(p.lastSeen||0)<24*60*60*1000).length });
  } catch (e) { return json(res, 500, { error: e.message || 'تعذر تحميل لوحة المشرف.' }); }
};
