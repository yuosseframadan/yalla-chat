const { getDb, json, body, method, getIpHash, makeAdminSession, setAdminCookie, safeEqual } = require('../lib/server');
module.exports = async (req, res) => {
  if (!method(req, res, 'POST')) return;
  try {
    const configured = process.env.ADMIN_PASSWORD;
    if (!configured) return json(res, 503, { error: 'لم يتم إعداد كلمة مرور المشرف في إعدادات Vercel بعد.' });
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret || secret.length < 24) return json(res, 503, { error: 'إعدادات جلسة المشرف غير مكتملة في Vercel.' });
    const db = getDb();
    const ipHash = getIpHash(req);
    const attemptRef = db.ref(`adminSecurity/loginAttempts/${ipHash}`);
    const attemptSnap = await attemptRef.get();
    const attempt = attemptSnap.val() || { count: 0, since: Date.now() };
    const now = Date.now();
    if (now - Number(attempt.since || 0) > 15 * 60 * 1000) { attempt.count = 0; attempt.since = now; }
    if (Number(attempt.lockedUntil || 0) > now) return json(res, 429, { error: 'محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.' });
    const supplied = String(body(req).password || '');
    if (!safeEqual(supplied, configured)) {
      attempt.count = Number(attempt.count || 0) + 1;
      if (attempt.count >= 7) { attempt.lockedUntil = now + 15 * 60 * 1000; attempt.count = 0; attempt.since = now; }
      await attemptRef.set(attempt);
      return json(res, 401, { error: 'بيانات الدخول غير صحيحة.' });
    }
    await attemptRef.remove();
    setAdminCookie(res, makeAdminSession());
    return json(res, 200, { ok: true });
  } catch (e) { return json(res, 500, { error: e.message || 'تعذر تسجيل دخول المشرف.' }); }
};
