const crypto = require('node:crypto');
const admin = require('firebase-admin');

let appInstance;
function getDb() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured in Vercel.');
  if (!appInstance) {
    let serviceAccount;
    try { serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON); }
    catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.'); }
    if (serviceAccount.private_key) serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    appInstance = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://yalla-chat-286b2-default-rtdb.europe-west1.firebasedatabase.app'
    }, 'yalla-chat-server');
  }
  return admin.database(appInstance);
}
function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}
function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch {} }
  return {};
}
function method(req, res, expected) {
  if (req.method !== expected) { json(res, 405, { error: 'Method not allowed.' }); return false; }
  return true;
}
function getIp(req) {
  const raw = req.headers['x-real-ip'] || req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '';
  return String(raw).split(',')[0].trim().slice(0, 100) || 'unknown';
}
function getIpHash(req) {
  const secret = process.env.IP_HASH_SECRET;
  if (!secret || secret.length < 24) throw new Error('IP_HASH_SECRET must be set to a random secret of at least 24 characters.');
  return crypto.createHmac('sha256', secret).update(getIp(req)).digest('hex');
}
function getCountry(req) {
  const code = String(req.headers['x-vercel-ip-country'] || 'XX').toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : 'XX';
}
async function verifyUser(req) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw Object.assign(new Error('Guest session missing. Refresh the page and try again.'), { status: 401 });
  try { getDb(); return await admin.auth(admin.app('yalla-chat-server')).verifyIdToken(match[1]); }
  catch { throw Object.assign(new Error('Guest session expired. Refresh the page and try again.'), { status: 401 }); }
}
async function verifyAdmin(req) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 24) return false;
  const cookies = String(req.headers.cookie || '').split(';').map(s => s.trim());
  const raw = cookies.find(s => s.startsWith('yc_admin_session='));
  if (!raw) return false;
  let token;
  try { token = decodeURIComponent(raw.slice('yc_admin_session='.length)); } catch { return false; }
  const dot = token.lastIndexOf('.');
  if (dot < 1) return false;
  const payload = token.slice(0, dot), signature = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) return false;
  try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); return data.exp > Date.now() && data.role === 'admin'; }
  catch { return false; }
}
function safeEqual(a, b) {
  const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function makeAdminSession() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 24) throw new Error('ADMIN_SESSION_SECRET must be a random secret of at least 24 characters.');
  const payload = Buffer.from(JSON.stringify({ role: 'admin', exp: Date.now() + 8 * 60 * 60 * 1000, nonce: crypto.randomBytes(12).toString('hex') })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function setAdminCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `yc_admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secure}`);
}
function clearAdminCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `yc_admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}

async function adjustOnlineCount(db, delta) {
  if (!delta) return;
  await db.ref('system/onlineCount').transaction(current => Math.max(0, Number(current || 0) + delta), undefined, false);
}
async function setUserOffline(db, uid) {
  const presenceRef = db.ref(`presence/${uid}`);
  const now = Date.now();
  let shouldDecrement = false;
  const tx = await presenceRef.transaction(oldValue => {
    if (!oldValue) return oldValue;
    shouldDecrement = oldValue.online !== false && now - Number(oldValue.lastSeen || 0) < 40000;
    return { ...oldValue, online: false, activeMatchId: null, lastSeen: now };
  }, undefined, false);
  if (tx.committed && shouldDecrement) await adjustOnlineCount(db, -1);
}

async function checkBan(db, ipHash) {
  const snap = await db.ref(`bans/${ipHash}`).get();
  const ban = snap.val();
  if (ban && ban.active && Number(ban.bannedUntil || 0) > Date.now()) {
    return { banned: true, bannedUntil: Number(ban.bannedUntil), reason: ban.reason || 'مخالفة قواعد المجتمع' };
  }
  return { banned: false, record: ban || null };
}
async function applyBan(db, ipHash, reason, targetUid) {
  const banRef = db.ref(`bans/${ipHash}`);
  let next = null;
  const now = Date.now();
  const tx = await banRef.transaction(oldValue => {
    const old = oldValue || {};
    const strikes = Math.max(0, Number(old.strikeCount || 0)) + 1;
    const hours = [6, 12, 24, 72, 168][Math.min(strikes - 1, 4)];
    next = {
      ipHash,
      strikeCount: strikes,
      active: true,
      reason: String(reason || 'مخالفة قواعد المجتمع').slice(0, 180),
      bannedUntil: now + hours * 60 * 60 * 1000,
      createdAt: Number(old.createdAt || now),
      updatedAt: now,
      lastTargetUid: String(targetUid || old.lastTargetUid || '').slice(0, 128)
    };
    return next;
  }, undefined, false);
  return (tx.snapshot && tx.snapshot.val()) || next;
}
async function endMatch(db, matchId) {
  if (!matchId) return;
  const matchRef = db.ref(`matches/${matchId}`);
  const snap = await matchRef.get();
  const match = snap.val();
  if (!match) return;
  const participants = Object.keys(match.participants || {});
  const updates = {};
  const presenceSnaps = await Promise.all(participants.map(uid => db.ref(`presence/${uid}`).get()));
  participants.forEach((uid, index) => {
    updates[`waiting/${uid}`] = null;
    if (presenceSnaps[index].exists()) updates[`presence/${uid}/activeMatchId`] = null;
  });
  if (Object.keys(updates).length) await db.ref().update(updates);
  // The entire match node, including its messages, is removed from the live database.
  await matchRef.remove();
}
function normalizeText(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
function containsBlockedLanguage(text) {
  const t = normalizeText(text);
  const patterns = [
    /(^|\s)(fuck|fucking|shit|bullshit|bitch|asshole|motherfucker|dickhead)(\s|$)/i,
    /(^|\s)(كسم|كس ام|شرموط|شرموطه|قحبه|متناك|يلعن دينك|ابن الكلب|خول)(\s|$)/i,
    /(^|\s)(نيك|منيوك)(\s|$)/i
  ];
  return patterns.some(p => p.test(t));
}
async function activeMatchFor(db, uid, suppliedId) {
  const presenceSnap = await db.ref(`presence/${uid}`).get();
  const presence = presenceSnap.val() || {};
  const matchId = suppliedId || presence.activeMatchId;
  if (!matchId) return { matchId: null, match: null };
  const snap = await db.ref(`matches/${matchId}`).get();
  const match = snap.val();
  if (!match || !match.participants || match.participants[uid] !== true) return { matchId: null, match: null };
  return { matchId, match, presence };
}
module.exports = { admin, getDb, json, body, method, getIp, getIpHash, getCountry, verifyUser, verifyAdmin, makeAdminSession, setAdminCookie, clearAdminCookie, checkBan, applyBan, endMatch, containsBlockedLanguage, activeMatchFor, safeEqual };
