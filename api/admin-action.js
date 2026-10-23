const { getDb, json, body, method, verifyAdmin, applyBan, endMatch, setUserOffline } = require('../lib/server');
module.exports = async (req, res) => {
  if (!method(req, res, 'POST')) return;
  try {
    if (!await verifyAdmin(req)) return json(res, 401, { error: 'جلسة المشرف انتهت. سجّل الدخول مجددًا.' });
    const db = getDb(), data = body(req), action = String(data.action || '');
    if (action === 'end-chat') {
      await endMatch(db, String(data.matchId || ''));
      return json(res, 200, { ok: true });
    }
    if (action === 'ban-user') {
      const uid = String(data.uid || '');
      if (!uid) return json(res, 400, { error: 'المستخدم غير محدد.' });
      const pSnap = await db.ref(`presence/${uid}`).get(), p = pSnap.val();
      if (!p || !p.ipHash) return json(res, 404, { error: 'تعذر العثور على بيانات الحظر لهذا المستخدم.' });
      const ban = await applyBan(db, p.ipHash, String(data.reason || 'حظر يدوي من المشرف'), uid);
      await endMatch(db, String(data.matchId || p.activeMatchId || ''));
      await db.ref(`waiting/${uid}`).remove();
      await setUserOffline(db, uid);
      return json(res, 200, { ok: true, strikeCount: ban.strikeCount, bannedUntil: ban.bannedUntil });
    }
    if (action === 'unban') {
      const ipHash = String(data.ipHash || '');
      if (!/^[a-f0-9]{64}$/.test(ipHash)) return json(res, 400, { error: 'معرّف الحظر غير صالح.' });
      const ref = db.ref(`bans/${ipHash}`), snap = await ref.get(), ban = snap.val();
      if (!ban) return json(res, 404, { error: 'الحظر غير موجود.' });
      await ref.update({ active: false, bannedUntil: 0, updatedAt: Date.now(), unbannedByAdmin: true });
      return json(res, 200, { ok: true });
    }
    if (action === 'resolve-report') {
      const reportId = String(data.reportId || '');
      if (!reportId) return json(res, 400, { error: 'البلاغ غير محدد.' });
      const ref = db.ref(`reports/${reportId}`), snap = await ref.get();
      if (!snap.exists()) return json(res, 404, { error: 'البلاغ غير موجود.' });
      await ref.update({ resolved: true, resolvedAt: Date.now() });
      return json(res, 200, { ok: true });
    }
    if (action === 'delete-report') {
      const reportId = String(data.reportId || '');
      if (!reportId) return json(res, 400, { error: 'البلاغ غير محدد.' });
      await db.ref(`reports/${reportId}`).remove();
      return json(res, 200, { ok: true });
    }
    return json(res, 400, { error: 'إجراء غير معروف.' });
  } catch (e) { return json(res, 500, { error: e.message || 'تعذر تنفيذ الإجراء.' }); }
};
