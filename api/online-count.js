const { getDb, json, method, endMatch } = require('../lib/server');
module.exports = async (req, res) => {
  if (!method(req, res, 'GET')) return;
  try {
    const db = getDb(), now = Date.now();
    // Keep the public counter cheap: the common path reads only one small value.
    const cleanupRef = db.ref('system/lastCleanupAt');
    const cleanupTx = await cleanupRef.transaction(current => Number(current || 0) < now - 60000 ? now : current, undefined, false);
    const shouldCleanup = !!(cleanupTx.committed && Number(cleanupTx.snapshot.val()) === now);
    if (shouldCleanup) {
      const [presenceSnap, matchesSnap, waitingSnap, reportsSnap, bansSnap] = await Promise.all([
        db.ref('presence').get(), db.ref('matches').get(), db.ref('waiting').get(), db.ref('reports').get(), db.ref('bans').get()
      ]);
      const presence = presenceSnap.val() || {}, matches = matchesSnap.val() || {}, waiting = waitingSnap.val() || {}, reports = reportsSnap.val() || {}, bans = bansSnap.val() || {};
      const updates = {};
      for (const [uid, p] of Object.entries(presence)) {
        if (!p) continue;
        if (now - Number(p.lastSeen || 0) > 24 * 60 * 60 * 1000) updates[`presence/${uid}`] = null;
        else if (p.online !== false && now - Number(p.lastSeen || 0) > 40000) updates[`presence/${uid}/online`] = false;
      }
      for (const [uid, q] of Object.entries(waiting)) {
        if (!q || now - Number(q.since || 0) > 60000) updates[`waiting/${uid}`] = null;
      }
      for (const [id, report] of Object.entries(reports)) {
        const age = now - Number((report && report.createdAt) || 0);
        if ((report && report.resolved && age > 7 * 24 * 60 * 60 * 1000) || age > 30 * 24 * 60 * 60 * 1000) updates[`reports/${id}`] = null;
      }
      for (const [hash, ban] of Object.entries(bans)) {
        const old = now - Number((ban && ban.updatedAt) || 0) > 180 * 24 * 60 * 60 * 1000;
        const expired = Number((ban && ban.bannedUntil) || 0) < now;
        if (ban && old && (!ban.active || expired)) updates[`bans/${hash}`] = null;
      }
      const activeCount = Object.values(presence).filter(p => p && p.online !== false && now - Number(p.lastSeen || 0) < 40000).length;
      updates['system/onlineCount'] = activeCount;
      if (Object.keys(updates).length) await db.ref().update(updates);
      const staleMatches = [];
      for (const [id, match] of Object.entries(matches)) {
        const uids = Object.keys((match && match.participants) || {});
        const stale = uids.some(uid => !presence[uid] || presence[uid].online === false || now - Number(presence[uid].lastSeen || 0) > 65000);
        if (stale) staleMatches.push(id);
      }
      await Promise.all(staleMatches.map(id => endMatch(db, id)));
      return json(res, 200, { count: activeCount, at: now });
    }
    const countSnap = await db.ref('system/onlineCount').get();
    return json(res, 200, { count: Number(countSnap.val() || 0), at: now });
  } catch (e) { return json(res, 200, { count: 0, warning: e.message || 'count unavailable' }); }
};
