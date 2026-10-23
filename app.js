import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getDatabase, ref, onValue, off, onDisconnect } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';

const firebaseConfig = {
  apiKey: 'AIzaSyB0GAfkHo8MUjXd0MfNMluFTFg4N91I4X0',
  authDomain: 'yalla-chat-286b2.firebaseapp.com',
  databaseURL: 'https://yalla-chat-286b2-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'yalla-chat-286b2',
  storageBucket: 'yalla-chat-286b2.firebasestorage.app',
  messagingSenderId: '679703194930',
  appId: '1:679703194930:web:29131db2baa81215363b2b',
  measurementId: 'G-83PSP96REW'
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const $ = id => document.getElementById(id);
const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = { user:null, idToken:'', activeMatchId:null, matchUnsub:null, pollTimer:null, heartbeatTimer:null, countTimer:null, waiting:false, sending:false, installPrompt:null, lang:localStorage.getItem('yc_lang') || 'ar', theme:localStorage.getItem('yc_theme') || 'dark', inviteScheduled:false, adminTab:'chats', adminTimer:null, adminData:null };
const isAdminPath = location.pathname.replace(/\/$/,'') === '/admin';

const words = {
 ar: {
  online:'متصل الآن', eyebrow:'مكانك لمحادثة جديدة', heroTitle:'غريب اليوم،<br><span>صديق محتمل بكرة.</span>', heroLead:'ابدأ محادثة نصية مع شخص جديد من أي مكان. بدون حساب، بدون تعقيد — أنت تختار متى تبدأ ومتى تنهي.', startChat:'ابدأ محادثة', howItWorks:'إزاي بيشتغل؟', noAccount:'من غير تسجيل', textOnly:'شات نصي', youControl:'أنت المتحكم', personFromEgypt:'شخص من مصر', readyToChat:'جاهز للدردشة', peopleEverywhere:'ناس من كل مكان', oneClickAway:'على بُعد ضغطة', newFriend:'صديق جديد', connected:'متصل', previewHello:'أهلاً! عامل إيه؟ 👋', previewReply:'أهلاً بيك، منور!', previewQuestion:'بتحب البرمجة؟', writeMessage:'اكتب رسالة...', fastMatch:'دخول سريع', fastMatchDesc:'ابدأ كضيف في ثواني.', randomTalk:'محادثات عشوائية', randomTalkDesc:'كل مرة فرصة جديدة للتعارف.', safetyFirst:'الأمان أولاً', safetyFirstDesc:'إبلاغ وحظر ومكافحة للرسائل المسيئة.', simpleTitle:'ببساطة', howTitle:'ثلاث خطوات وتبدأ الكلام', step1Title:'اضغط ابدأ', step1Desc:'مش محتاج بريد أو حساب.', step2Title:'اتصل بشخص جديد', step2Desc:'هنوصلك بمستخدم متاح ونوضح الدولة المتاحة.', step3Title:'اتكلم أو اعمل التالي', step3Desc:'أنهِ المحادثة في أي وقت وابدأ واحدة جديدة.', safetyTitle:'خلي المحادثة لطيفة وآمنة', safetyText:'لا تشارك عنوانك أو بياناتك الخاصة. قد تُراجع المحادثات النشطة بواسطة أنظمة الإشراف والمشرفين المصرّح لهم لأغراض السلامة. تُحذف الرسائل عند انتهاء المحادثة، إلا إذا قُدّم بلاغ يتطلب الاحتفاظ بدليل محدود.', communityRules:'قواعد المجتمع', findingPerson:'بنبحث عن شخص...', connecting:'جاري الاتصال', searchingTitle:'بنلاقي لك حد تتكلم معاه', searchingText:'ثواني بسيطة، وهنوصلك بشخص متاح.', cancel:'إلغاء', sayHello:'ابدأ بكلمة لطيفة 👋', messagePlaceholder:'اكتب رسالتك...', nextPerson:'الشخص التالي', endChat:'إنهاء المحادثة', chatFooterTip:'خليك محترم، وبلّغ عن أي إساءة.', peopleOnlineNow:'شخص متصل الآن', chatTipsTitle:'نصائح سريعة', tip1:'ابدأ بتحية بسيطة وسؤال لطيف.', tip2:'ما تشاركش معلوماتك الشخصية.', tip3:'لو واجهت إساءة، اخرج وبلّغ.', madeBy:'تم التطوير بواسطة NexCode', privacyRules:'الخصوصية والقواعد', nexcode:'NexCode ↗', installKicker:'خلي يلا شات أقرب ليك', installTitle:'ثبّت Yalla Chat على جهازك', installDesc:'افتحه بسرعة من الشاشة الرئيسية، بتجربة شبه التطبيقات.', installButton:'تثبيت التطبيق', maybeLater:'مش دلوقتي', inviteKicker:'اللمة أحلى مع أصحابك', inviteTitle:'اعزم صاحبك على Yalla Chat', inviteDesc:'ابعتله الرابط وخليه يجرب محادثات جديدة بنفسه. ضغطة واحدة وتبدأوا تكتشفوا ناس واهتمامات جديدة.', inviteButton:'نسخ رابط الدعوة', rulesTitle:'قواعد المجتمع والخصوصية', rulesBody:'<ul><li>عامل الطرف الآخر باحترام، ويُمنع التحرش والتهديد والإهانات والروابط الضارة.</li><li>لا تشارك عنوانك أو رقم هاتفك أو كلمات المرور أو معلوماتك الخاصة.</li><li>قد تُراجع المحادثات النشطة بواسطة أنظمة آلية ومشرفين مصرح لهم لأغراض السلامة.</li><li>عند انتهاء المحادثة تُحذف رسائلها من قاعدة البيانات الحية. إذا أُرسل بلاغ، قد يُحتفظ بمقتطف محدود من الرسائل كدليل إلى حين مراجعة البلاغ.</li><li>يُطبق الحظر المتدرج على المخالفات، وقد يؤدي تكرارها إلى حظر أطول.</li><li>الشات نصي فقط. لا ترسل محتوى غير قانوني أو معلومات حساسة.</li></ul>', howModalTitle:'إزاي Yalla Chat بيشتغل؟', howModalBody:'<ol><li>اضغط «ابدأ محادثة» للدخول كضيف.</li><li>نبحث عن مستخدم متاح ونربطكما في غرفة نصية خاصة بالمشاركين.</li><li>استخدم «الشخص التالي» للانتقال أو «إنهاء المحادثة» للخروج.</li><li>يمكنك الإبلاغ عن الإساءة. المحادثة النشطة قد تخضع للمراجعة لأغراض السلامة.</li></ol>', installIos:'على iPhone أو iPad: افتح الموقع في Safari، واضغط مشاركة ثم «إضافة إلى الشاشة الرئيسية».', installAndroid:'لو ظهر خيار التثبيت في المتصفح اضغط عليه. أو افتح قائمة المتصفح واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».', installGeneric:'التثبيت يعتمد على المتصفح والجهاز. استخدم قائمة المتصفح ثم «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».', waitingToast:'بنبحث عن شخص متاح...', sessionError:'تعذر بدء جلسة الضيف. تأكد من تفعيل Anonymous في Firebase Authentication.', connectionError:'تعذر الاتصال بالخدمة. راجع إعدادات Firebase وVercel.', banned:'تم تقييد دخولك بسبب مخالفة قواعد المجتمع.', matchEnded:'انتهت المحادثة. تقدر تبدأ محادثة جديدة.', reportPrompt:'اكتب سبب البلاغ باختصار:', reportSent:'وصل البلاغ. شكرًا لمساعدتنا في الحفاظ على مجتمع آمن.', reportFailed:'تعذر إرسال البلاغ. حاول مرة أخرى.', sendFailed:'تعذر إرسال الرسالة.', noPeer:'شخص جديد', unknownCountry:'دولة غير معروفة', copySuccess:'تم نسخ رابط الدعوة. ابعته لصاحبك!', copyFail:'تعذر النسخ تلقائيًا. انسخ الرابط من شريط العنوان.', shareText:'جرّب Yalla Chat — شات نصي عشوائي مع ناس جديدة! ادخل من هنا:', installUnsupported:'المتصفح لا يدعم التثبيت المباشر من هنا. استخدم قائمة المتصفح لإضافة الموقع إلى الشاشة الرئيسية.', searchingAgain:'بنبحث عن شخص جديد...', confirmEnd:'تنهي المحادثة الحالية؟', reportTitle:'الإبلاغ عن المستخدم', reportChoices:['سلوك مسيء أو تحرش','تهديد أو محتوى غير قانوني','رسائل مزعجة أو روابط ضارة','سبب آخر'], adminTitle:'لوحة المشرف', adminLoginTitle:'دخول المشرف', adminLoginDesc:'منطقة إدارة محمية لمشرفي Yalla Chat.', adminPassword:'كلمة مرور المشرف', adminLoginButton:'دخول آمن', adminWrong:'تعذر تسجيل الدخول.', adminChats:'الشاتات الحية', adminBans:'المحظورون', adminReports:'البلاغات', adminOnline:'المتصلون الآن', adminLiveChats:'المحادثات النشطة', adminRecent:'مستخدمون نشطون خلال 24 ساعة', adminBanCount:'سجلات الحظر', adminReportCount:'البلاغات', adminRefresh:'تحديث الآن', adminLogout:'تسجيل خروج', adminNoChats:'لا توجد محادثات نشطة حاليًا.', adminNoBans:'لا توجد سجلات حظر.', adminNoReports:'لا توجد بلاغات.', adminViewChat:'رسائل المحادثة الحية', adminBanUser:'حظر هذا الطرف', adminEndChat:'إنهاء الشات', adminUnban:'فك الحظر', adminLeaveBan:'ترك الحظر', adminStrike:'المخالفة رقم', adminReason:'السبب', adminRemaining:'المتبقي', adminExpired:'منتهي / غير نشط', adminActive:'نشط', adminResolve:'تمت المراجعة', adminDelete:'حذف البلاغ', adminEvidence:'مقتطف البلاغ', adminNoEvidence:'لا يوجد مقتطف محفوظ.', adminLoginRequired:'سجّل دخول المشرف للمتابعة.', adminActionFailed:'تعذر تنفيذ الإجراء.', adminConfirmBan:'تحظر هذا الطرف الآن؟', adminConfirmEnd:'تنهي المحادثة وتحذف رسائلها الآن؟', adminTabHint:'تُحدّث بيانات اللوحة تلقائيًا. لا تُعرض عناوين IP الخام.', adminSessionExpired:'انتهت جلسة المشرف. سجّل الدخول مرة أخرى.', adminCountry:'الدولة', adminTime:'وقت البداية', adminParticipant:'المشارك', adminStatus:'الحالة', adminUnresolved:'قيد المراجعة', adminResolved:'تمت المراجعة', adminNoAccess:'لا يمكن الوصول إلى لوحة المشرف.'
 },
 en: {
  online:'online now', eyebrow:'Your place for a new conversation', heroTitle:'A stranger today,<br><span>a possible friend tomorrow.</span>', heroLead:'Start a text conversation with someone new, anywhere. No account, no fuss — you choose when to start and when to leave.', startChat:'Start chatting', howItWorks:'How it works', noAccount:'No sign-up', textOnly:'Text chat', youControl:'You’re in control', personFromEgypt:'Someone from Egypt', readyToChat:'Ready to chat', peopleEverywhere:'People everywhere', oneClickAway:'One click away', newFriend:'New friend', connected:'Connected', previewHello:'Hey! How’s it going? 👋', previewReply:'Hey there, welcome!', previewQuestion:'Are you into coding?', writeMessage:'Write a message...', fastMatch:'Quick start', fastMatchDesc:'Join as a guest in seconds.', randomTalk:'Random conversations', randomTalkDesc:'A new chance to meet someone each time.', safetyFirst:'Safety first', safetyFirstDesc:'Reporting, blocking and abuse prevention.', simpleTitle:'Simple by design', howTitle:'Three steps to start talking', step1Title:'Press start', step1Desc:'No email or account needed.', step2Title:'Meet someone new', step2Desc:'We connect you with an available user and show their country.', step3Title:'Chat or skip', step3Desc:'End any conversation and start a new one whenever you want.', safetyTitle:'Keep conversations kind and safe', safetyText:'Do not share your address or private information. Active conversations may be reviewed by automated safety systems and authorized moderators. Messages are deleted when a conversation ends, unless a report requires limited evidence to be retained.', communityRules:'Community rules', findingPerson:'Finding someone...', connecting:'Connecting', searchingTitle:'Finding someone to chat with', searchingText:'Just a moment — we’ll connect you with someone available.', cancel:'Cancel', sayHello:'Start with a friendly hello 👋', messagePlaceholder:'Write your message...', nextPerson:'Next person', endChat:'End chat', chatFooterTip:'Be respectful and report abuse.', peopleOnlineNow:'people online now', chatTipsTitle:'Quick tips', tip1:'Start with a simple greeting.', tip2:'Never share private information.', tip3:'If someone is abusive, leave and report them.', madeBy:'Developed by NexCode', privacyRules:'Privacy & rules', nexcode:'NexCode ↗', installKicker:'Keep Yalla Chat close', installTitle:'Install Yalla Chat', installDesc:'Launch it quickly from your home screen with an app-like experience.', installButton:'Install app', maybeLater:'Not now', inviteKicker:'Better with friends', inviteTitle:'Invite a friend to Yalla Chat', inviteDesc:'Share the link and let them try random conversations too. One tap and you can discover new people and interests.', inviteButton:'Copy invite link', rulesTitle:'Community rules & privacy', rulesBody:'<ul><li>Be respectful. Harassment, threats, insults and harmful links are prohibited.</li><li>Do not share your address, phone number, passwords or private information.</li><li>Active conversations may be reviewed by automated systems and authorized moderators for safety.</li><li>When a conversation ends, its messages are deleted from the live database. If a report is submitted, a limited excerpt may be retained as evidence until the report is reviewed.</li><li>Repeated violations lead to progressively longer bans.</li><li>Text chat only. Do not send illegal content or sensitive information.</li></ul>', howModalTitle:'How Yalla Chat works', howModalBody:'<ol><li>Press “Start chatting” to join as a guest.</li><li>We find an available user and connect you in a text room visible to its participants.</li><li>Use “Next person” to switch or “End chat” to leave.</li><li>You can report abuse. Active conversations may be reviewed for safety.</li></ol>', installIos:'On iPhone or iPad: open this site in Safari, tap Share, then “Add to Home Screen”.', installAndroid:'If your browser offers Install, tap it. Or open the browser menu and choose “Install app” or “Add to Home screen”.', installGeneric:'Installation depends on your browser and device. Use the browser menu and choose “Install app” or “Add to Home screen”.', waitingToast:'Looking for someone available...', sessionError:'Could not start a guest session. Enable Anonymous sign-in in Firebase Authentication.', connectionError:'Could not connect to the service. Check Firebase and Vercel setup.', banned:'Your access was restricted for violating community rules.', matchEnded:'The conversation ended. You can start a new one.', reportPrompt:'Briefly describe the reason for this report:', reportSent:'Report received. Thanks for helping keep the community safe.', reportFailed:'Could not send the report. Try again.', sendFailed:'Could not send the message.', noPeer:'New person', unknownCountry:'Unknown country', copySuccess:'Invite link copied. Send it to a friend!', copyFail:'Could not copy automatically. Copy the address from the browser bar.', shareText:'Try Yalla Chat — random text chat with new people! Join here:', installUnsupported:'Your browser does not support direct installation here. Use its menu to add this site to your home screen.', searchingAgain:'Finding someone new...', confirmEnd:'End the current conversation?', reportTitle:'Report this user', reportChoices:['Abusive behavior or harassment','Threats or illegal content','Spam or harmful links','Other'], adminTitle:'Admin dashboard', adminLoginTitle:'Moderator sign-in', adminLoginDesc:'Protected management area for Yalla Chat moderators.', adminPassword:'Moderator password', adminLoginButton:'Secure sign in', adminWrong:'Could not sign in.', adminChats:'Live chats', adminBans:'Banned users', adminReports:'Reports', adminOnline:'Online now', adminLiveChats:'Active conversations', adminRecent:'Users active in the last 24 hours', adminBanCount:'Ban records', adminReportCount:'Reports', adminRefresh:'Refresh now', adminLogout:'Sign out', adminNoChats:'No active conversations right now.', adminNoBans:'No ban records.', adminNoReports:'No reports.', adminViewChat:'Live conversation messages', adminBanUser:'Ban this participant', adminEndChat:'End chat', adminUnban:'Unban', adminLeaveBan:'Keep ban', adminStrike:'Strike', adminReason:'Reason', adminRemaining:'Remaining', adminExpired:'Expired / inactive', adminActive:'Active', adminResolve:'Mark reviewed', adminDelete:'Delete report', adminEvidence:'Report excerpt', adminNoEvidence:'No excerpt was retained.', adminLoginRequired:'Sign in as a moderator to continue.', adminActionFailed:'Could not complete the action.', adminConfirmBan:'Ban this participant now?', adminConfirmEnd:'End this chat and delete its messages now?', adminTabHint:'Dashboard data refreshes automatically. Raw IP addresses are not displayed.', adminSessionExpired:'Moderator session expired. Please sign in again.', adminCountry:'Country', adminTime:'Started', adminParticipant:'Participant', adminStatus:'Status', adminUnresolved:'Needs review', adminResolved:'Reviewed', adminNoAccess:'Cannot access the moderator dashboard.'
 }
};

function t(key) { return (words[state.lang] && words[state.lang][key]) || words.ar[key] || key; }
function applyLanguage() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el => { const key = el.dataset.i18n; if (t(key) != null) el.textContent = t(key); });
  document.querySelectorAll('[data-i18n-html]').forEach(el => { const key = el.dataset.i18nHtml; if (t(key) != null) el.innerHTML = t(key); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  $('langBtn').textContent = state.lang === 'ar' ? 'EN' : 'عربي';
  $('themeBtn').textContent = state.theme === 'dark' ? '☼' : '☾';
}
function applyTheme() { document.documentElement.dataset.theme = state.theme; localStorage.setItem('yc_theme', state.theme); applyLanguage(); }
function toast(message) { const el = $('toast'); if (!el) return; el.textContent = message; el.classList.add('show'); clearTimeout(window.__ycToast); window.__ycToast = setTimeout(() => el.classList.remove('show'), 4000); }
function showModal(title, html) { $('modalContent').innerHTML = `<h2>${safe(title)}</h2>${html}`; $('modalBackdrop').classList.remove('hidden'); }
function closeModal() { $('modalBackdrop').classList.add('hidden'); $('modalContent').innerHTML = ''; }
function flagFor(code) { if (!/^[A-Z]{2}$/.test(String(code || ''))) return '🌐'; return String.fromCodePoint(...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0))); }
function countryName(code) { if (!/^[A-Z]{2}$/.test(String(code || ''))) return t('unknownCountry'); try { return new Intl.DisplayNames([state.lang], { type:'region' }).of(code) || t('unknownCountry'); } catch { return code; } }
function timeString(ts) { try { return new Date(Number(ts || 0)).toLocaleTimeString(state.lang === 'ar' ? 'ar-EG' : 'en-US', {hour:'2-digit', minute:'2-digit'}); } catch { return ''; } }
function dateString(ts) { try { return new Date(Number(ts || 0)).toLocaleString(state.lang === 'ar' ? 'ar-EG' : 'en-US'); } catch { return ''; } }
async function api(action, payload = {}) {
  if (!state.user) throw new Error(t('sessionError'));
  const token = await state.user.getIdToken(); state.idToken = token;
  const response = await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body:JSON.stringify({action,...payload}) });
  let data = {}; try { data = await response.json(); } catch {}
  if (!response.ok) { const err = new Error(data.error || t('connectionError')); err.status = response.status; err.bannedUntil = data.bannedUntil; throw err; }
  return data;
}
function showHome() {
  stopMatchListener(); clearInterval(state.pollTimer); state.pollTimer = null;
  state.activeMatchId = null; state.waiting = false;
  $('homeView').classList.remove('hidden'); $('chatView').classList.add('hidden'); $('siteFooter').classList.remove('hidden');
  $('searchingPanel').classList.remove('hidden'); $('messages').classList.add('hidden'); $('composer').classList.add('hidden'); $('emptyChatHint').classList.add('hidden');
  $('nextBtn').classList.add('hidden'); $('endBtn').classList.add('hidden'); $('reportBtn').classList.add('hidden'); $('peerCountry').classList.add('hidden');
  $('peerName').textContent = t('findingPerson'); $('peerStatus').innerHTML = `<i class="mini-dot"></i>${safe(t('connecting'))}`;
}
function showSearchPanel() {
  $('homeView').classList.add('hidden'); $('siteFooter').classList.add('hidden'); $('chatView').classList.remove('hidden');
  $('searchingPanel').classList.remove('hidden'); $('messages').classList.add('hidden'); $('composer').classList.add('hidden'); $('emptyChatHint').classList.add('hidden');
  $('nextBtn').classList.add('hidden'); $('endBtn').classList.add('hidden'); $('reportBtn').classList.add('hidden'); $('peerCountry').classList.add('hidden');
  $('peerName').textContent = t('findingPerson'); $('peerStatus').innerHTML = `<i class="mini-dot"></i>${safe(t('connecting'))}`;
}
function stopMatchListener() { if (state.matchUnsub) { state.matchUnsub(); state.matchUnsub = null; } }
function renderMessages(match) {
  const list = $('messages'); const msgs = Object.entries(match.messages || {}).map(([id, m]) => ({id,...m})).sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0));
  list.innerHTML = msgs.map(m => `<article class="chat-message ${m.senderUid === state.user?.uid ? 'mine' : ''}">${safe(m.text)}<small>${safe(timeString(m.createdAt))}</small></article>`).join('');
  list.scrollTop = list.scrollHeight;
  $('emptyChatHint').classList.toggle('hidden', msgs.length > 0);
  $('messages').classList.remove('hidden');
}
function connectMatch(matchId) {
  if (state.activeMatchId === matchId && state.matchUnsub) return;
  stopMatchListener(); state.activeMatchId = matchId; state.waiting = false; clearInterval(state.pollTimer); state.pollTimer = null;
  $('searchingPanel').classList.add('hidden'); $('messages').classList.remove('hidden'); $('composer').classList.remove('hidden'); $('nextBtn').classList.remove('hidden'); $('endBtn').classList.remove('hidden'); $('reportBtn').classList.remove('hidden'); $('chatView').classList.remove('hidden'); $('homeView').classList.add('hidden'); $('siteFooter').classList.add('hidden');
  const matchRef = ref(db, `matches/${matchId}`);
  // Best-effort server-side cleanup if this browser/PWA disconnects unexpectedly.
  onDisconnect(matchRef).remove().catch(err => console.warn('onDisconnect cleanup', err));
  state.matchUnsub = onValue(matchRef, snapshot => {
    const match = snapshot.val();
    if (!match) {
      if (state.activeMatchId === matchId) { state.activeMatchId = null; stopMatchListener(); showHome(); toast(t('matchEnded')); api('status').catch(()=>{}); }
      return;
    }
    const peerUid = Object.keys(match.participants || {}).find(uid => uid !== state.user?.uid);
    const peer = (match.users && match.users[peerUid]) || {};
    $('peerName').textContent = peer.alias || t('noPeer');
    $('peerAvatar').textContent = (peer.alias || 'Y').slice(-1).toUpperCase();
    $('peerStatus').innerHTML = `<i class="mini-dot"></i>${safe(t('connected'))}`;
    const code = peer.countryCode || 'XX';
    $('peerFlag').textContent = flagFor(code); $('peerCountryName').textContent = countryName(code); $('peerCountry').classList.remove('hidden');
    renderMessages(match);
  }, error => { console.error('match listener', error); toast(t('connectionError')); });
}
async function pollChatStatus() {
  if (!state.waiting) return;
  try { const result = await api('status'); if (result.status === 'matched' && result.matchId) connectMatch(result.matchId); else if (result.status === 'idle' && state.waiting) { const restarted = await api('start'); if (restarted.status === 'matched' && restarted.matchId) connectMatch(restarted.matchId); } }
  catch (e) { if (e.status === 403) { toast(e.message); showHome(); } }
}
async function startChat() {
  if (!state.user) return toast(t('sessionError'));
  showSearchPanel(); state.waiting = true; toast(t('waitingToast'));
  clearInterval(state.pollTimer); state.pollTimer = null;
  try { const result = await api('start'); if (result.status === 'matched' && result.matchId) connectMatch(result.matchId); else { state.pollTimer = setInterval(pollChatStatus, 1500); pollChatStatus(); } }
  catch (e) { state.waiting = false; clearInterval(state.pollTimer); state.pollTimer = null; showHome(); toast(e.message || t('connectionError')); }
}
async function nextChat() {
  if (!state.user) return;
  const oldMatchId = state.activeMatchId;
  stopMatchListener(); state.activeMatchId = null; state.waiting = true; showSearchPanel(); toast(t('searchingAgain'));
  clearInterval(state.pollTimer); state.pollTimer = null;
  try { const result = await api('next', { matchId: oldMatchId }); if (result.status === 'matched' && result.matchId) connectMatch(result.matchId); else { state.pollTimer = setInterval(pollChatStatus, 1500); pollChatStatus(); } }
  catch (e) { state.waiting = false; clearInterval(state.pollTimer); showHome(); toast(e.message || t('connectionError')); }
}
async function endChat(ask = true) {
  if (ask && state.activeMatchId && !confirm(t('confirmEnd'))) return;
  const matchId = state.activeMatchId;
  stopMatchListener(); state.activeMatchId = null;
  try { await api('leave', { matchId }); } catch (e) { if (e.status === 403) toast(e.message); }
  showHome();
}
async function sendMessage(event) {
  event.preventDefault(); if (state.sending) return;
  const input = $('messageInput'), text = input.value.trim(); if (!text || !state.activeMatchId) return;
  state.sending = true; const button = $('composer').querySelector('button'); button.disabled = true;
  try { await api('send', { matchId:state.activeMatchId, text }); input.value = ''; }
  catch (e) { toast(e.message || t('sendFailed')); if (e.status === 403) { stopMatchListener(); state.activeMatchId = null; showHome(); } }
  finally { state.sending = false; button.disabled = false; input.focus(); }
}
async function reportPeer() {
  if (!state.activeMatchId) return;
  const reason = prompt(t('reportPrompt')); if (!reason || !reason.trim()) return;
  try { await api('report', {matchId:state.activeMatchId, reason:reason.trim()}); toast(t('reportSent')); }
  catch (e) { toast(e.message || t('reportFailed')); }
}
async function updateOnlineCount() {
  try { const response = await fetch('/api/online-count', {cache:'no-store'}); const data = await response.json(); const count = Number(data.count || 0); $('onlineCount').textContent = count.toLocaleString(state.lang === 'ar' ? 'ar-EG' : 'en-US'); $('chatOnlineCount').textContent = count.toLocaleString(state.lang === 'ar' ? 'ar-EG' : 'en-US'); }
  catch { $('onlineCount').textContent = '—'; }
}
function showRules() { showModal(t('rulesTitle'), t('rulesBody')); }
function showHow() { showModal(t('howModalTitle'), t('howModalBody')); }
async function copyInvite() {
  const url = `${location.origin}/`;
  const message = `${t('shareText')} ${url}`;
  try {
    if (navigator.share) { await navigator.share({title:'Yalla Chat', text:message, url}); toast(t('copySuccess')); return; }
    await navigator.clipboard.writeText(message); toast(t('copySuccess'));
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    try { const input = document.createElement('textarea'); input.value = message; document.body.appendChild(input); input.select(); const ok = document.execCommand('copy'); input.remove(); toast(ok ? t('copySuccess') : t('copyFail')); }
    catch { toast(t('copyFail')); }
  }
}
function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
function closeInstall() { $('installOverlay').classList.add('hidden'); scheduleInvite(700); }
function showInstall() {
  if (isStandalone() || localStorage.getItem('yc_installed') === '1' || isAdminPath) { scheduleInvite(1300); return; }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const android = /android/i.test(navigator.userAgent);
  $('installInstructions').textContent = ios ? t('installIos') : android ? t('installAndroid') : t('installGeneric');
  $('installOverlay').classList.remove('hidden');
  $('installAction').textContent = state.installPrompt ? t('installButton') : (state.lang === 'ar' ? 'طريقة التثبيت' : 'Installation help');
}
function scheduleInvite(delay = 1200) {
  if (state.inviteScheduled || isAdminPath) return;
  state.inviteScheduled = true;
  setTimeout(() => { if (!$('installOverlay').classList.contains('hidden')) { state.inviteScheduled = false; return; } $('invitePopup').classList.remove('hidden'); }, delay);
}
function initInstallAndInvite() {
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); state.installPrompt = event; if (!$('installOverlay').classList.contains('hidden')) $('installAction').textContent = t('installButton'); });
  window.addEventListener('appinstalled', () => { state.installPrompt = null; localStorage.setItem('yc_installed', '1'); $('installOverlay').classList.add('hidden'); toast(state.lang === 'ar' ? 'تم تثبيت Yalla Chat بنجاح!' : 'Yalla Chat installed successfully!'); });
  $('installClose').onclick = closeInstall; $('installLater').onclick = closeInstall;
  $('installAction').onclick = async () => {
    if (state.installPrompt) {
      try { await state.installPrompt.prompt(); const choice = await state.installPrompt.userChoice; state.installPrompt = null; if (choice && choice.outcome === 'accepted') $('installOverlay').classList.add('hidden'); else closeInstall(); }
      catch { closeInstall(); }
    } else { toast(t('installUnsupported')); closeInstall(); }
  };
  $('inviteClose').onclick = () => $('invitePopup').classList.add('hidden'); $('inviteShareBtn').onclick = copyInvite;
  setTimeout(showInstall, 900);
}
function initChatApp() {
  applyTheme(); applyLanguage(); $('yearNow').textContent = new Date().getFullYear();
  $('langBtn').onclick = () => { state.lang = state.lang === 'ar' ? 'en' : 'ar'; localStorage.setItem('yc_lang', state.lang); applyLanguage(); updateOnlineCount(); if (state.activeMatchId) { const id = state.activeMatchId; connectMatch(id); } };
  $('themeBtn').onclick = () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; applyTheme(); };
  $('startBtn').onclick = startChat; $('cancelSearchBtn').onclick = () => endChat(false); $('nextBtn').onclick = nextChat; $('endBtn').onclick = () => endChat(true); $('composer').addEventListener('submit', sendMessage); $('reportBtn').onclick = reportPeer;
  $('backHomeBtn').onclick = () => endChat(true); $('howBtn').onclick = showHow; $('rulesBtn').onclick = showRules; $('footerRulesBtn').onclick = showRules;
  $('modalClose').onclick = closeModal; $('modalBackdrop').onclick = e => { if (e.target === $('modalBackdrop')) closeModal(); };
  initInstallAndInvite(); updateOnlineCount(); state.countTimer = setInterval(updateOnlineCount, 9000);
  onAuthStateChanged(auth, async user => {
    if (!user) {
      try { await signInAnonymously(auth); }
      catch (e) { console.error(e); toast(t('sessionError')); }
      return;
    }
    state.user = user;
    try { state.idToken = await user.getIdToken(); await api('heartbeat'); state.heartbeatTimer = setInterval(async () => { try { await api('heartbeat'); } catch (e) { if (e.status === 403) { toast(e.message); showHome(); } } }, 10000); }
    catch (e) { console.error(e); toast(e.message || t('connectionError')); }
  });
  window.addEventListener('pagehide', () => {
    if (!state.user || !state.idToken) return;
    try { fetch('/api/chat', { method:'POST', keepalive:true, headers:{'Content-Type':'application/json','Authorization':`Bearer ${state.idToken}`}, body:JSON.stringify({action:'leave',matchId:state.activeMatchId || ''}) }); } catch {}
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/service-worker.js').catch(err => console.warn('SW', err));
}

function renderAdminLogin(error = '') {
  $('adminRoot').innerHTML = `<div class="admin-login-wrap"><form id="adminLoginForm" class="admin-login-card"><img src="/yalla-chat-logo.png" alt="Yalla Chat"><h1>${safe(t('adminLoginTitle'))}</h1><p>${safe(t('adminLoginDesc'))}</p><label for="adminPassword">${safe(t('adminPassword'))}</label><input id="adminPassword" type="password" autocomplete="current-password" required maxlength="200"><button class="primary-btn" type="submit">${safe(t('adminLoginButton'))}</button><div id="adminError" class="admin-error">${safe(error)}</div><p class="admin-muted">Yalla Chat · NexCode</p></form></div>`;
  $('adminLoginForm').addEventListener('submit', async e => {
    e.preventDefault(); const btn = $('adminLoginForm').querySelector('button'); btn.disabled = true; $('adminError').textContent = '';
    try {
      const response = await fetch('/api/admin-login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('adminPassword').value})});
      const data = await response.json(); if (!response.ok) throw new Error(data.error || t('adminWrong'));
      await loadAdminDashboard();
    } catch (err) { $('adminError').textContent = err.message || t('adminWrong'); btn.disabled = false; }
  });
}
function adminFetch(path, options = {}) { return fetch(path, {...options, credentials:'same-origin', headers:{...(options.headers || {}), ...(options.body ? {'Content-Type':'application/json'} : {})}}); }
async function loadAdminDashboard() {
  const response = await adminFetch('/api/admin-data');
  const data = await response.json();
  if (!response.ok) { renderAdminLogin(data.error || t('adminLoginRequired')); return; }
  state.adminData = data;
  renderAdminDashboard();
  clearInterval(state.adminTimer); state.adminTimer = setInterval(refreshAdmin, 3000);
}
async function refreshAdmin() {
  try {
    const response = await adminFetch('/api/admin-data'); const data = await response.json();
    if (response.status === 401) { clearInterval(state.adminTimer); renderAdminLogin(data.error || t('adminSessionExpired')); return; }
    if (response.ok) { state.adminData = data; renderAdminDashboard(); }
  } catch (e) { console.warn('admin refresh', e); }
}
function renderAdminDashboard() {
  const previousScroll = window.scrollY;
  const d = state.adminData || {activeUsers:0,activeChats:[],bans:[],reports:[],recentUsers:0};
  const activeBans = d.bans.filter(b => b.active && Number(b.bannedUntil || 0) > Date.now()).length;
  $('adminRoot').innerHTML = `<header class="admin-header"><div class="admin-title"><img src="/yalla-chat-logo.png" alt=""><div><h1>${safe(t('adminTitle'))}</h1><p>${safe(t('adminTabHint'))}</p></div></div><div class="admin-actions"><button class="admin-button" id="adminRefresh">↻ ${safe(t('adminRefresh'))}</button><button class="admin-button" id="adminLogout">${safe(t('adminLogout'))}</button><a class="admin-button" href="/">Yalla Chat ↗</a></div></header>
  <section class="admin-stats"><article class="admin-stat"><small>${safe(t('adminOnline'))}</small><b>${Number(d.activeUsers||0).toLocaleString()}</b></article><article class="admin-stat"><small>${safe(t('adminLiveChats'))}</small><b>${d.activeChats.length.toLocaleString()}</b></article><article class="admin-stat"><small>${safe(t('adminBanCount'))} · ${safe(t('adminActive'))}</small><b>${activeBans.toLocaleString()}</b></article><article class="admin-stat"><small>${safe(t('adminReportCount'))}</small><b>${d.reports.filter(r=>!r.resolved).length.toLocaleString()}</b></article></section>
  <nav class="admin-tabs"><button class="admin-tab ${state.adminTab==='chats'?'active':''}" data-tab="chats">${safe(t('adminChats'))} (${d.activeChats.length})</button><button class="admin-tab ${state.adminTab==='bans'?'active':''}" data-tab="bans">${safe(t('adminBans'))} (${d.bans.length})</button><button class="admin-tab ${state.adminTab==='reports'?'active':''}" data-tab="reports">${safe(t('adminReports'))} (${d.reports.filter(r=>!r.resolved).length})</button></nav>
  <section class="admin-section" id="adminTabContent">${renderAdminTab()}</section>`;
  $('adminRefresh').onclick = refreshAdmin;
  $('adminLogout').onclick = async () => { clearInterval(state.adminTimer); await adminFetch('/api/admin-logout',{method:'POST'}); renderAdminLogin(); };
  $('adminRoot').querySelectorAll('[data-tab]').forEach(btn => btn.onclick = () => { state.adminTab = btn.dataset.tab; renderAdminDashboard(); });
  $('adminRoot').querySelectorAll('[data-admin-action]').forEach(btn => btn.onclick = () => runAdminAction(btn.dataset.adminAction, btn.dataset.id, btn.dataset.uid, btn.dataset.hash));
  window.scrollTo(0, previousScroll);
  requestAnimationFrame(() => $('adminRoot').querySelectorAll('.admin-chat-log').forEach(log => { log.scrollTop = log.scrollHeight; }));
}
function renderAdminTab() {
  const d = state.adminData || {};
  if (state.adminTab === 'chats') {
    if (!d.activeChats || !d.activeChats.length) return `<div class="admin-empty">${safe(t('adminNoChats'))}</div>`;
    return `<h2>${safe(t('adminLiveChats'))}</h2><div class="admin-chat-grid">${d.activeChats.map(chat => {
      const users = Object.entries(chat.users || {}); const title = users.map(([uid,u])=>`${u.alias} ${flagFor(u.countryCode)} ${countryName(u.countryCode)}`).join(' ↔ ');
      const messages = (chat.messages || []).map(m => { const sender = (chat.users && chat.users[m.senderUid]) || {}; return `<div class="admin-msg"><b>${safe(sender.alias || 'Guest')}:</b> ${safe(m.text)} <small>${safe(timeString(m.createdAt))}</small></div>`; }).join('') || `<div class="admin-muted">${safe(t('adminViewChat'))}: —</div>`;
      return `<article class="admin-chat-card"><div class="admin-chat-head"><div><b>${safe(title || chat.id)}</b><small>${safe(t('adminTime'))}: ${safe(dateString(chat.createdAt))}</small></div><span class="admin-live">● LIVE</span></div><div class="admin-chat-log">${messages}</div><div class="admin-chat-actions">${users.map(([uid,u])=>`<button class="admin-button danger" data-admin-action="ban-user" data-id="${safe(chat.id)}" data-uid="${safe(uid)}">${safe(t('adminBanUser'))}: ${safe(u.alias)}</button>`).join('')}<button class="admin-button" data-admin-action="end-chat" data-id="${safe(chat.id)}">${safe(t('adminEndChat'))}</button></div></article>`;
    }).join('')}</div>`;
  }
  if (state.adminTab === 'bans') {
    if (!d.bans || !d.bans.length) return `<div class="admin-empty">${safe(t('adminNoBans'))}</div>`;
    return `<h2>${safe(t('adminBans'))}</h2>${d.bans.map(b => { const remaining = Number(b.bannedUntil||0)-Date.now(); const active = b.active && remaining>0; return `<article class="admin-row-card"><div><b>${safe(t('adminStrike'))} ${Number(b.strikeCount||0)}</b> <span class="admin-badge ${active?'danger':''}">${safe(active?t('adminActive'):t('adminExpired'))}</span><p>${safe(t('adminReason'))}: ${safe(b.reason || '—')}</p><small>${safe(t('adminRemaining'))}: ${safe(active?formatRemaining(remaining):'—')} · ${safe(dateString(b.updatedAt))}</small><p><code>${safe(String(b.ipHash||'').slice(0,14))}…</code></p></div><div class="admin-actions"><button class="admin-button ${active?'primary':''}" data-admin-action="unban" data-hash="${safe(b.ipHash)}">${safe(t('adminUnban'))}</button></div></article>`; }).join('')}`;
  }
  if (state.adminTab === 'reports') {
    if (!d.reports || !d.reports.length) return `<div class="admin-empty">${safe(t('adminNoReports'))}</div>`;
    return `<h2>${safe(t('adminReports'))}</h2>${d.reports.map(r => `<article class="admin-row-card"><div><b>${safe(r.reason || 'Report')}</b> <span class="admin-badge ${r.resolved?'':'danger'}">${safe(r.resolved?t('adminResolved'):t('adminUnresolved'))}</span><p>${safe(dateString(r.createdAt))} · ${safe(t('adminParticipant'))}: ${safe(String(r.reporterUid||'').slice(0,8))} → ${safe(String(r.targetUid||'').slice(0,8))}</p><div class="admin-chat-log">${(r.evidence||[]).map(m=>`<div class="admin-msg"><b>${safe(String(m.senderUid||'').slice(0,8))}:</b> ${safe(m.text)} <small>${safe(timeString(m.createdAt))}</small></div>`).join('') || safe(t('adminNoEvidence'))}</div></div><div class="admin-actions">${r.resolved?'':`<button class="admin-button primary" data-admin-action="resolve-report" data-id="${safe(r.id)}">${safe(t('adminResolve'))}</button>`}<button class="admin-button danger" data-admin-action="delete-report" data-id="${safe(r.id)}">${safe(t('adminDelete'))}</button></div></article>`).join('')}`;
  }
  return '';
}
function formatRemaining(ms) { const total = Math.max(0, Math.ceil(ms/60000)); const h = Math.floor(total/60), m = total%60; return state.lang==='ar' ? `${h} س ${m} د` : `${h}h ${m}m`; }
async function runAdminAction(action, id, uid, hash) {
  if (action === 'ban-user' && !confirm(t('adminConfirmBan'))) return;
  if (action === 'end-chat' && !confirm(t('adminConfirmEnd'))) return;
  const body = {action}; if (id) body.matchId = id; if (uid) body.uid = uid; if (hash) body.ipHash = hash;
  if (action === 'resolve-report' || action === 'delete-report') body.reportId = id;
  try {
    const response = await adminFetch('/api/admin-action',{method:'POST',body:JSON.stringify(body)}); const data = await response.json();
    if (!response.ok) throw new Error(data.error || t('adminActionFailed'));
    toast(state.lang==='ar'?'تم تنفيذ الإجراء.':'Action completed.'); await refreshAdmin();
  } catch (e) { toast(e.message || t('adminActionFailed')); }
}
function initAdminPage() {
  document.body.classList.add('admin-mode');
  ['.topbar','#homeView','#chatView','#siteFooter','#modalBackdrop','#installOverlay','#invitePopup'].forEach(selector => { const el = document.querySelector(selector); if (el) el.classList.add('hidden'); });
  $('adminRoot').classList.remove('hidden');
  applyTheme(); applyLanguage(); renderAdminLogin();
  // Reuse a valid HttpOnly admin session after refreshing /admin.
  adminFetch('/api/admin-data').then(async response => {
    if (!response.ok) return;
    state.adminData = await response.json();
    renderAdminDashboard();
    clearInterval(state.adminTimer); state.adminTimer = setInterval(refreshAdmin, 3000);
  }).catch(() => {});
}

if (isAdminPath) initAdminPage(); else initChatApp();
