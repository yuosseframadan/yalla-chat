const { getDb, json, body, method, getIpHash, getCountry, verifyUser, checkBan, applyBan, endMatch, containsBlockedLanguage, activeMatchFor, adjustOnlineCount, setUserOffline } = require('../lib/server');

async function touchPresence(db, uid, req, ipHash) {
  const presenceRef = db.ref(`presence/${uid}`);
  const countryCode = getCountry(req);
  const now = Date.now();
  let shouldIncrement = false;
  const tx = await presenceRef.transaction(oldValue => {
    const old = oldValue || {};
    shouldIncrement = !oldValue || old.online === false;
    return {
      ...old,
      uid,
      ipHash,
      countryCode,
      alias: old.alias || `Guest-${uid.slice(0, 4).toUpperCase()}`,
      online: true,
      lastSeen: now,
      activeMatchId: old.activeMatchId || null,
      lastMessageAt: Number(old.lastMessageAt || 0),
      lastStartAt: Number(old.lastStartAt || 0)
    };
  }, undefined, false);
  if (tx.committed && shouldIncrement) await adjustOnlineCount(db, 1);
  return (tx.snapshot && tx.snapshot.val()) || {};
}
async function ensureAllowed(db, ipHash, uid) {
  const ban = await checkBan(db, ipHash);
  if (ban.banned) {
    const presence = await db.ref(`presence/${uid}`).get();
    const p = presence.val() || {};
    if (p.activeMatchId) await endMatch(db, p.activeMatchId);
    await db.ref(`waiting/${uid}`).remove();
    await setUserOffline(db, uid);
    const minutes = Math.max(1, Math.ceil((ban.bannedUntil - Date.now()) / 60000));
    throw Object.assign(new Error(`تم حظرك مؤقتًا بسبب مخالفة قواعد المجتمع. الوقت المتبقي تقريبًا ${minutes} دقيقة.`), { status: 403, bannedUntil: ban.bannedUntil });
  }
}
async function startMatching(db, uid) {
  const now = Date.now();
  const presenceRef = db.ref(`presence/${uid}`);
  const pSnap = await presenceRef.get();
  const me = pSnap.val() || {};
  if (now - Number(me.lastStartAt || 0) < 150) throw Object.assign(new Error('استنى لحظة قبل ما تبدأ محادثة جديدة.'), { status: 429 });
  await presenceRef.update({ lastStartAt: now });
  if (me.activeMatchId) {
    const existing = await db.ref(`matches/${me.activeMatchId}`).get();
    if (existing.exists()) return { status: 'matched', matchId: me.activeMatchId };
    await presenceRef.child('activeMatchId').remove();
  }
  const waitingRef = db.ref('waiting');
  const ownQueueSnap = await waitingRef.child(uid).get();
  const ownQueue = ownQueueSnap.val();
  if (ownQueue && ownQueue.status === 'matched' && ownQueue.matchId) {
    const queuedMatch = await db.ref(`matches/${ownQueue.matchId}`).get();
    if (queuedMatch.exists()) return { status: 'matched', matchId: ownQueue.matchId };
    await waitingRef.child(uid).remove();
  }
  const existingQueue = await waitingRef.get();
  const queue = existingQueue.val() || {};
  const blocked = new Set();
  const candidateIds = Object.entries(queue).filter(([other, entry]) => other !== uid && entry && entry.status === 'waiting' && now - Number(entry.since || 0) < 45000).map(([other]) => other);
  await Promise.all(candidateIds.map(async other => {
    const [p, q] = await Promise.all([db.ref(`presence/${other}`).get(), db.ref(`waiting/${other}`).get()]);
    const pv = p.val(), qv = q.val();
    if (!pv || pv.online === false || now - Number(pv.lastSeen || 0) > 40000 || !qv || qv.status !== 'waiting') { blocked.add(other); return; }
    const b = await checkBan(db, pv.ipHash || '');
    if (b.banned) blocked.add(other);
  }));
  const matchId = db.ref('matches').push().key;
  let pairedUid = null;
  const tx = await waitingRef.transaction(current => {
    pairedUid = null;
    current = current || {};
    const own = current[uid];
    if (own && own.status === 'matched' && own.matchId) return current;
    const candidate = Object.entries(current).find(([other, entry]) => other !== uid && !blocked.has(other) && entry && entry.status === 'waiting' && now - Number(entry.since || 0) < 45000);
    if (candidate) {
      pairedUid = candidate[0];
      current[uid] = { status: 'matched', matchId, since: now };
      current[pairedUid] = { status: 'matched', matchId, since: now };
    } else {
      current[uid] = { status: 'waiting', since: own && own.status === 'waiting' ? Number(own.since || now) : now };
    }
    return current;
  }, undefined, false);
  const myEntry = tx.snapshot && tx.snapshot.child(uid).val();
  if (myEntry && myEntry.status === 'matched' && myEntry.matchId) {
    const found = await db.ref(`matches/${myEntry.matchId}`).get();
    if (found.exists()) return { status: 'matched', matchId: myEntry.matchId };
    if (pairedUid && myEntry.matchId === matchId) {
      const [meSnap, peerSnap] = await Promise.all([db.ref(`presence/${uid}`).get(), db.ref(`presence/${pairedUid}`).get()]);
      const meNow = meSnap.val() || me, peer = peerSnap.val() || {};
      const match = {
        participants: { [uid]: true, [pairedUid]: true },
        users: {
          [uid]: { alias: meNow.alias || `Guest-${uid.slice(0,4).toUpperCase()}`, countryCode: meNow.countryCode || 'XX' },
          [pairedUid]: { alias: peer.alias || `Guest-${pairedUid.slice(0,4).toUpperCase()}`, countryCode: peer.countryCode || 'XX' }
        },
        createdAt: now,
        messages: {}
      };
      await db.ref(`matches/${matchId}`).set(match);
      const updates = {};
      updates[`presence/${uid}/activeMatchId`] = matchId;
      updates[`presence/${pairedUid}/activeMatchId`] = matchId;
      updates[`presence/${uid}/online`] = true;
      updates[`presence/${pairedUid}/online`] = true;
      await db.ref().update(updates);
      return { status: 'matched', matchId };
    }
    return { status: 'waiting' };
  }
  return { status: 'waiting' };
}

module.exports = async (req, res) => {
  if (!method(req, res, 'POST')) return;
  try {
    const db = getDb(), data = body(req), action = String(data.action || '');
    const user = await verifyUser(req), uid = user.uid;
    const ipHash = getIpHash(req);
    await ensureAllowed(db, ipHash, uid);
    if (action === 'heartbeat') {
      await touchPresence(db, uid, req, ipHash);
      return json(res, 200, { ok: true, countryCode: getCountry(req) });
    }
    if (action === 'status') {
      const pSnap = await db.ref(`presence/${uid}`).get(), p = pSnap.val() || {};
      const qSnap = await db.ref(`waiting/${uid}`).get(), q = qSnap.val() || {};
      const matchId = p.activeMatchId || (q.status === 'matched' ? q.matchId : null);
      if (matchId) {
        const matchSnap = await db.ref(`matches/${matchId}`).get();
        if (matchSnap.exists()) return json(res, 200, { status: 'matched', matchId });
        await db.ref(`presence/${uid}/activeMatchId`).remove();
        await db.ref(`waiting/${uid}`).remove();
        return json(res, 200, { status: 'idle' });
      }
      if (q.status === 'waiting') return json(res, 200, { status: 'waiting' });
      return json(res, 200, { status: 'idle' });
    }
    if (action === 'start') {
      await touchPresence(db, uid, req, ipHash);
      const result = await startMatching(db, uid);
      return json(res, 200, result);
    }
    if (action === 'next' || action === 'leave') {
      const pSnap = await db.ref(`presence/${uid}`).get(), p = pSnap.val() || {};
      const matchId = String(data.matchId || p.activeMatchId || '');
      if (matchId) await endMatch(db, matchId);
      await db.ref(`waiting/${uid}`).remove();
      if (action === 'leave') {
        await setUserOffline(db, uid);
        return json(res, 200, { ok: true, status: 'idle' });
      }
      await touchPresence(db, uid, req, ipHash);
      return json(res, 200, await startMatching(db, uid));
    }
    if (action === 'send') {
      const text = String(data.text || '').trim();
      if (!text) return json(res, 400, { error: 'اكتب رسالة الأول.' });
      if (text.length > 1000) return json(res, 400, { error: 'الرسالة أطول من الحد المسموح.' });
      const { matchId, match, presence } = await activeMatchFor(db, uid, String(data.matchId || ''));
      if (!matchId || !match) return json(res, 409, { error: 'المحادثة انتهت. ابدأ محادثة جديدة.' });
      if (containsBlockedLanguage(text)) {
        const ban = await applyBan(db, ipHash, 'استخدام ألفاظ مسيئة', uid);
        await endMatch(db, matchId);
        await setUserOffline(db, uid);
        return json(res, 403, { error: `تم حظرك ${[6,12,24,72,168][Math.min(ban.strikeCount-1,4)]} ساعة بسبب استخدام ألفاظ مسيئة.`, bannedUntil: ban.bannedUntil });
      }
      const last = Number((presence || {}).lastMessageAt || 0), now = Date.now();
      if (now - last < 350) return json(res, 429, { error: 'استنى لحظة قبل ما تبعت رسالة تانية.' });
      const msgRef = db.ref(`matches/${matchId}/messages`).push();
      await msgRef.set({ senderUid: uid, text, createdAt: now });
      await db.ref(`presence/${uid}`).update({ lastMessageAt: now, lastSeen: now, online: true });
      return json(res, 200, { ok: true, messageId: msgRef.key, createdAt: now });
    }
    if (action === 'report') {
      const { matchId, match } = await activeMatchFor(db, uid, String(data.matchId || ''));
      if (!matchId || !match) return json(res, 409, { error: 'المحادثة انتهت بالفعل.' });
      const targetUid = Object.keys(match.participants || {}).find(id => id !== uid);
      const evidence = Object.entries(match.messages || {}).map(([id, m]) => ({ id, ...m })).sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0)).slice(-15);
      const reportRef = db.ref('reports').push();
      await reportRef.set({ reporterUid: uid, targetUid: targetUid || '', matchId, reason: String(data.reason || 'سلوك غير مناسب').slice(0, 200), createdAt: Date.now(), resolved: false, evidence });
      return json(res, 200, { ok: true });
    }
    return json(res, 400, { error: 'طلب غير معروف.' });
  } catch (e) {
    return json(res, Number(e.status || 500), { error: e.message || 'حدث خطأ غير متوقع.' });
  }
};
