import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendPasswordResetEmail, updateEmail, GoogleAuthProvider, signInWithRedirect, getRedirectResult } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getDatabase, ref, get, set, update, push, query, limitToLast, onValue, off, remove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

/*
  Yalla Chat Firebase configuration.
  The web config is public by design; database access must be protected by
  Firebase Authentication and the Realtime Database Security Rules.
*/
const firebaseConfig = {
  apiKey: "AIzaSyB0GAfkHo8MUjXd0MfNMluFTFg4N91I4X0",
  authDomain: "yalla-chat-286b2.firebaseapp.com",
  databaseURL: "https://yalla-chat-286b2-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "yalla-chat-286b2",
  storageBucket: "yalla-chat-286b2.firebasestorage.app",
  messagingSenderId: "679703194930",
  appId: "1:679703194930:web:29131db2baa81215363b2b",
  measurementId: "G-83PSP96REW"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const $ = id => document.getElementById(id);
const avatars = ["🦊","🐼","🐨","🐯","🦁","🐸","🐵","🐱","🐶","🐻","🐰","🐧","🦄","🐙","🐼","🐺"];
const state = { user:null, profile:null, selectedAvatar:"avatar1", chats:{}, activeChat:null, messages:[], unsubscribeMessages:null, unsubscribeChats:null, unsubscribePresence:null, activeChatMeta:null, blocked:false, online:{}, searchTerm:"", retentionDays:7, installPrompt:null, sending:false };
const avatarEmoji = id => avatars[Math.max(0, (parseInt(String(id||"avatar1").replace("avatar",""),10)||1)-1)%avatars.length];
const safe = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uidKey = (a,b) => [a,b].sort().join("_");
const cacheKey = id => `yalla_cache_${state.user?.uid}_${id}`;
function toast(message){const el=$("toast");if(!el)return;el.textContent=message;el.classList.add("show");clearTimeout(window.__yallaToastTimer);window.__yallaToastTimer=setTimeout(()=>el.classList.remove("show"),6500)}
function authNotice(message, isError=true){const el=$("authFeedback");if(el){el.textContent=message;el.classList.remove("hidden","error","success");el.classList.add(isError?"error":"success");el.setAttribute("role",isError?"alert":"status");}toast(message)}
function showModal(html){$("modalContent").innerHTML=html;$("modalBackdrop").classList.remove("hidden")}
function closeModal(){$("modalBackdrop").classList.add("hidden");$("modalContent").innerHTML=""}
function showView(view){["authView","profileView","appView"].forEach(id=>$(id).classList.toggle("hidden",id!==view))}
function profilePath(uid){return `users/${uid}`}
function chatPath(id){return `chats/${id}`}
function isConfigReady(){return firebaseConfig.databaseURL.startsWith("https://") && !firebaseConfig.databaseURL.includes("REPLACE_")}
function friendlyError(e){const map={"auth/invalid-credential":"البريد الإلكتروني أو كلمة المرور غير صحيحة","auth/invalid-login-credentials":"البريد الإلكتروني أو كلمة المرور غير صحيحة","auth/web-storage-unsupported":"المتصفح يمنع حفظ جلسة الدخول؛ جرّب السماح بملفات تعريف الارتباط والتخزين المحلي","auth/email-already-in-use":"البريد الإلكتروني مستخدم بالفعل","auth/weak-password":"كلمة المرور ضعيفة","auth/invalid-email":"صيغة البريد الإلكتروني غير صحيحة","auth/too-many-requests":"محاولات كثيرة، حاول لاحقاً","auth/operation-not-allowed":"فعّل طريقة تسجيل الدخول المطلوبة من Firebase Authentication > Sign-in method","auth/network-request-failed":"تحقق من اتصال الإنترنت وحاول مرة أخرى","auth/user-not-found":"لا يوجد حساب بهذا البريد","auth/wrong-password":"كلمة المرور غير صحيحة","auth/unauthorized-domain":"نطاق الموقع غير مصرح به في Firebase. أضف yalla-chat-gules.vercel.app إلى Authentication > Settings > Authorized domains","auth/invalid-api-key":"مفتاح Firebase غير صحيح؛ راجع إعدادات تطبيق الويب في Firebase","auth/popup-blocked":"المتصفح منع نافذة Google؛ اسمح بالنوافذ المنبثقة أو أعد المحاولة","auth/popup-closed-by-user":"أغلقت نافذة تسجيل الدخول قبل إكمال العملية","auth/configuration-not-found":"طريقة تسجيل الدخول غير مفعلة في Firebase Authentication","PERMISSION_DENIED":"قواعد Firebase لا تسمح بالعملية","database/permission-denied":"قواعد Firebase لا تسمح بالعملية. راجع نشر database.rules.json","auth/requires-recent-login":"لأمان حسابك، سجّل الخروج ثم الدخول مجدداً قبل تغيير البريد الإلكتروني"};return map[e.code]||e.message||"حدث خطأ غير متوقع"}
function renderAvatarPicker(){ $("avatarPicker").innerHTML=avatars.map((a,i)=>`<button type="button" class="avatar-choice ${state.selectedAvatar===`avatar${i+1}`?"selected":""}" data-avatar="avatar${i+1}">${a}</button>`).join("");$("avatarPicker").querySelectorAll("[data-avatar]").forEach(b=>b.onclick=()=>{state.selectedAvatar=b.dataset.avatar;renderAvatarPicker()}) }
function openInvite(){$("invitePopup").classList.remove("hidden")}
async function copyInvite(){
 const url=location.origin+location.pathname;
 try{
  if(navigator.share){await navigator.share({title:"Yalla Chat",text:"تعالى كلمني على Yalla Chat",url});toast("تم فتح قائمة المشاركة")}
  else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);toast("تم نسخ رابط يلا شات، شاركه في أي تطبيق")}
  else{showModal(`<h2>رابط دعوة الأصدقاء</h2><input id="inviteLinkField" readonly value="${safe(url)}"><p>انسخ الرابط وشاركه مع أصدقائك.</p><button id="copyFallback" class="primary">تحديد الرابط</button>`);$("copyFallback").onclick=()=>{$("inviteLinkField").select();document.execCommand("copy");toast("تم نسخ الرابط")}}
 }catch(e){if(e.name!=="AbortError")toast("لم تتم المشاركة. جرّب نسخ الرابط من جديد")}
}
function isStandalone(){return window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true}
function dismissInstallPopup(){
 $("installPopup").classList.add("hidden");
}
function showInstallPopup(){
 if(isStandalone())return;
 const ios=/iphone|ipad|ipod/i.test(navigator.userAgent),box=$("installInstructions"),action=$("installAction");
 if(ios){
  box.innerHTML="على iPhone أو iPad:<br>1. افتح الموقع في <b>Safari</b>.<br>2. اضغط زر <b>مشاركة</b> ⬆️.<br>3. اختر <b>Add to Home Screen / إضافة إلى الشاشة الرئيسية</b>.<br>4. اضغط <b>Add / إضافة</b>.";
  action.textContent="فهمت، هضيفه من Safari";action.onclick=()=>{dismissInstallPopup();toast("افتح الموقع في Safari ثم مشاركة ← إضافة إلى الشاشة الرئيسية")};
 }else{
  box.textContent="ثبّت التطبيق للوصول السريع. قد يعرض المتصفح زر التثبيت إذا كان جهازك يدعمه.";
  action.textContent=state.installPrompt?"تثبيت التطبيق":"طريقة التثبيت";
  action.onclick=async()=>{if(state.installPrompt){try{await state.installPrompt.prompt();const choice=await state.installPrompt.userChoice;state.installPrompt=null;if(choice?.outcome==="accepted")dismissInstallPopup();else if(choice?.outcome==="dismissed")dismissInstallPopup()}catch(e){toast("تعذر فتح نافذة التثبيت من المتصفح")}}else box.textContent="من قائمة المتصفح ⋮ أو مشاركة، اختر Install app / تثبيت التطبيق أو Add to Home Screen / إضافة إلى الشاشة الرئيسية."};
 }
 $("installPopup").classList.remove("hidden");
}
function showApp(){showView("appView");$("myName").textContent=state.profile?.nick||"حسابي";$("myEmail").textContent=state.user.email||"";$("myAvatar").textContent=avatarEmoji(state.profile?.av);renderChats();openInvite();startPresence()}
async function loadProfile(user){
  const snap=await get(ref(db,profilePath(user.uid)));
  state.profile=snap.val();
  if(!state.profile?.nick){
    state.selectedAvatar=state.profile?.av||"avatar1";
    $("nickname").value=state.profile?.nick||user.displayName||"";$("username").value=state.profile?.username||"";
    renderAvatarPicker();showView("profileView");
  }else showApp();
}
function emailKey(email){
  return encodeURIComponent(String(email||"").trim().toLowerCase()).replace(/\./g,"%2E");
}
async function saveProfile(e){
 e.preventDefault();
 const nick=$("nickname").value.trim(),username=$("username").value.trim().toLowerCase();
 if(nick.length<2||nick.length>30)return toast("اسم العرض لازم يكون من حرفين إلى 30 حرفاً");
 if(!/^[a-z0-9_]{3,24}$/.test(username))return toast("اسم المستخدم من 3 إلى 24 حرفاً إنجليزياً أو رقماً أو _");
 if(!state.user)return toast("سجّل الدخول أولاً");
 const btn=$("profileForm").querySelector('button[type="submit"]');btn.disabled=true;btn.textContent="جارٍ الحفظ...";
 try{
  const all=await get(ref(db,"publicProfiles"));
  const taken=Object.entries(all.val()||{}).some(([uid,p])=>uid!==state.user.uid&&(p.username||"").toLowerCase()===username);
  if(taken)return toast("اسم المستخدم مستخدم بالفعل، جرّب اسماً آخر");
  const existing=await get(ref(db,profilePath(state.user.uid)));
  const data={...(existing.val()||{}),uid:state.user.uid,nick:nick.slice(0,30),username,email:state.user.email||"",av:state.selectedAvatar,createdAt:existing.val()?.createdAt||Date.now()};
  await set(ref(db,profilePath(state.user.uid)),data);
  await set(ref(db,`publicProfiles/${state.user.uid}`),{nick:data.nick,username:data.username,av:data.av});
  if(data.email)await set(ref(db,`emailIndex/${emailKey(data.email)}`),state.user.uid);
  await updateProfile(state.user,{displayName:nick});state.profile=data;showApp();
 }catch(err){toast(friendlyError(err))}
 finally{btn.disabled=false;btn.textContent="حفظ والمتابعة"}
}
async function authSubmit(e){
  e.preventDefault();
  const email=$("authEmail").value.trim(),password=$("authPassword").value;
  if(!email || !$("authEmail").checkValidity()) return toast("اكتب بريداً إلكترونياً صحيحاً");
  if(!password) return toast("اكتب كلمة المرور");
  const btn=$("loginBtn");btn.disabled=true;btn.textContent="جارٍ الدخول...";
  try{await setPersistence(auth,browserLocalPersistence);await signInWithEmailAndPassword(auth,email,password);authNotice("تم تسجيل الدخول بنجاح",false)}
  catch(err){console.error("Email sign-in failed",err);authNotice(`تعذر تسجيل الدخول: ${friendlyError(err)}`)}
  finally{btn.disabled=false;btn.textContent="تسجيل الدخول"}
}
async function register(){
  const email=$("authEmail").value.trim(),password=$("authPassword").value;
  if(!email || !$("authEmail").checkValidity()) return toast("اكتب بريداً إلكترونياً صحيحاً أولاً");
  if(password.length<6) return toast("كلمة المرور لازم تكون 6 أحرف على الأقل");
  const btn=$("registerBtn");btn.disabled=true;btn.textContent="جارٍ إنشاء الحساب...";
  try{
    await setPersistence(auth,browserLocalPersistence);
    await createUserWithEmailAndPassword(auth,email,password);
    authNotice("تم إنشاء الحساب بنجاح. أكمل اسم العرض واسم المستخدم في الخطوة التالية.",false);
  }catch(err){console.error("Account creation failed",err);authNotice(`تعذر إنشاء الحساب: ${friendlyError(err)}`)}
  finally{btn.disabled=false;btn.textContent="إنشاء حساب جديد"}
}
async function resetPassword(){
  const email=$("authEmail").value.trim();
  if(!email || !$("authEmail").checkValidity()) return toast("اكتب بريدك الإلكتروني أولاً");
  try{await sendPasswordResetEmail(auth,email);toast("تم إرسال رابط استعادة كلمة المرور إلى بريدك")}
  catch(err){toast(friendlyError(err))}
}
function startPresence(){if(!state.user)return;const p=ref(db,`presence/${state.user.uid}`);set(p,{online:true,lastSeen:serverTimestamp()}).catch(()=>{});state.unsubscribePresence=()=>{};window.addEventListener("beforeunload",()=>update(p,{online:false,lastSeen:serverTimestamp()}),{once:true})}
async function searchUser(){
  const term=$("userSearch").value.trim();
  if(!term) return toast("اكتب البريد الإلكتروني أو الاسم المستعار");
  try{
    let uid=null, user=null;
    if(term.includes("@")){
      const index=await get(ref(db,`emailIndex/${emailKey(term)}`));
      if(index.exists()) uid=index.val();
    }else{
      const snap=await get(ref(db,"publicProfiles"));
      if(snap.exists()){
        const clean=term.toLowerCase().replace(/^@/,"");const found=Object.entries(snap.val()).find(([id,p])=>id!==state.user.uid&&((p.nick||"").toLowerCase()===term.toLowerCase()||(p.username||"").toLowerCase()===clean));
        if(found){uid=found[0];user=found[1]}
      }
    }
    if(!uid || uid===state.user.uid) return inviteSearch();
    if(!user){const p=await get(ref(db,`publicProfiles/${uid}`));user=p.val()||{}}
    await openDirectChat(uid,user);
  }catch(e){toast(friendlyError(e))}
}
function inviteSearch(){showModal(`<h2>المستخدم مش موجود</h2><p>تقدر تدعو صديقك للانضمام إلى Yalla Chat.</p><button id="modalCopyInvite" class="primary">نسخ رابط الدعوة</button>`);$("modalCopyInvite").onclick=copyInvite}
async function openDirectChat(uid,user){const id=`dm_${uidKey(state.user.uid,uid)}`;const chatRef=ref(db,chatPath(id));const snap=await get(chatRef);if(!snap.exists()){const data={type:"dm",members:{[state.user.uid]:true,[uid]:true},title:"",createdBy:state.user.uid,createdAt:serverTimestamp()};await set(chatRef,data);await Promise.all(Object.keys(data.members).map(member=>set(ref(db,`userChats/${member}/${id}`),true)))}state.chats[id]=(await get(chatRef)).val();state.chats[id]._displayTitle=user.nick||user.email||"محادثة";state.chats[id]._otherUid=uid;await selectChat(id)}
async function createGroup(){
 const contacts=Object.entries(state.chats).filter(([id,c])=>c.type==="dm"&&c._otherUid&&c.members?.[state.user.uid]);
 const contactRows=contacts.map(([id,c])=>`<label class="contact-pick"><input type="checkbox" data-contact-uid="${safe(c._otherUid)}"><span>${safe(c._displayTitle||"جهة اتصال")}</span><small>@${safe((Object.values(c.members||{}).length&&c._otherUsername)||"")}</small></label>`).join("");
 showModal(`<h2>إنشاء مجموعة</h2><label>اسم المجموعة</label><input id="groupName" maxlength="40" placeholder="مثلاً: صحابي"><label>إضافة بالاسم أو اسم المستخدم أو البريد</label><input id="groupMembers" placeholder="أحمد، @ahmed_22، friend@example.com"><p class="muted">افصل بين الأسماء بفواصل.</p>${contacts.length?`<label>أو اختار من جهات اتصالك في التطبيق</label><div class="contact-pick-list">${contactRows}</div>`:""}<button id="createGroupConfirm" class="primary">إنشاء المجموعة</button>`);
 $("createGroupConfirm").onclick=async()=>{
  const title=$("groupName").value.trim(),terms=$("groupMembers").value.split(",").map(x=>x.trim()).filter(Boolean);
  if(title.length<2)return toast("اكتب اسم المجموعة");
  const btn=$("createGroupConfirm");btn.disabled=true;btn.textContent="جارٍ إنشاء المجموعة...";
  try{
   const members={[state.user.uid]:true};
   for(const uid of $("modalContent").querySelectorAll("[data-contact-uid]:checked"))members[uid.dataset.contactUid]=true;
   for(const term of terms){const uid=await resolveMember(term);if(uid)members[uid]=true}
   if(Object.keys(members).length<2)throw new Error("أضف شخصاً مسجلاً واحداً على الأقل أو اختر جهة اتصال");
   const chatRef=push(ref(db,"chats"));
   await set(chatRef,{type:"group",title:title.slice(0,40),description:"",members,admins:{[state.user.uid]:true},createdBy:state.user.uid,createdAt:serverTimestamp()});
   await Promise.all(Object.keys(members).map(member=>set(ref(db,`userChats/${member}/${chatRef.key}`),true)));
   state.chats[chatRef.key]=(await get(chatRef)).val();closeModal();renderChats();await selectChat(chatRef.key);toast("تم إنشاء المجموعة");
  }catch(e){toast(e.code?friendlyError(e):e.message||friendlyError(e))}finally{if($("createGroupConfirm")){$("createGroupConfirm").disabled=false;$("createGroupConfirm").textContent="إنشاء المجموعة"}}
 }
}
function renderChats(){const list=$("chatList");const items=Object.entries(state.chats).filter(([id,c])=>c.members?.[state.user?.uid]).sort((a,b)=>(b[1].lastTs||0)-(a[1].lastTs||0));if(!items.length){list.innerHTML='<div class="empty-note">مفيش محادثات لسه.<br>ابحث عن صديق وابدأ الكلام.</div>';return}list.innerHTML=items.map(([id,c])=>{const title=c.type==="group"?c.title:(c._displayTitle||c.title||"محادثة");return `<div class="chat-item ${state.activeChat===id?"active":""}" data-chat="${safe(id)}"><span class="avatar">${c.type==="group"?"👥":avatarEmoji(c._avatar||"avatar1")}</span><div class="chat-item-info"><strong>${safe(title)}</strong><p>${safe(c.lastText|| (c.type==="group"?"مجموعة":"ابدأ المحادثة"))}</p></div></div>`}).join("");list.querySelectorAll("[data-chat]").forEach(el=>el.onclick=()=>selectChat(el.dataset.chat))}
function loadCached(id){try{return JSON.parse(localStorage.getItem(cacheKey(id))||"[]").map(m=>m&&m._pending?{...m,_pending:false,_failed:true}:m)}catch{return []}}
function saveCached(id,messages){try{localStorage.setItem(cacheKey(id),JSON.stringify(messages.slice(-50)))}catch{}}
async function selectChat(id){
 if(state.unsubscribeMessages){state.unsubscribeMessages();state.unsubscribeMessages=null}
 state.activeChat=id;
 let meta=state.chats[id];
 if(!meta){const snap=await get(ref(db,chatPath(id)));meta=snap.val();if(!meta)return toast("المحادثة غير موجودة أو لا تملك صلاحية الوصول");state.chats[id]=meta}
 if(!meta.members?.[state.user?.uid])return toast("أنت لست عضواً في هذه المحادثة");
 if(meta.type==="dm"){
  const otherUid=Object.keys(meta.members||{}).find(uid=>uid!==state.user.uid);meta._otherUid=otherUid||meta._otherUid;
  if(otherUid){try{const p=await get(ref(db,`publicProfiles/${otherUid}`));const profile=p.val()||{};meta._displayTitle=profile.nick||profile.displayName||meta._displayTitle||"محادثة";meta._avatar=profile.av||meta._avatar||"avatar1";meta._otherUsername=profile.username||""}catch{}}
 }
 state.chats[id]=meta;state.activeChatMeta=meta;
 $("appView").classList.add("chat-open");
 $("chatTitle").textContent=meta.type==="group"?meta.title:(meta._displayTitle||"محادثة");
 $("chatSubtitle").textContent=meta.type==="group"?"مجموعة":"محادثة خاصة";
 $("headerAvatar").textContent=meta.type==="group"?"👥":avatarEmoji(meta._avatar);
 $("messageForm").classList.remove("hidden");$("messages").innerHTML="";
 state.messages=loadCached(id);renderMessages();
 state.blocked=meta._otherUid?await isBlockedEitherWay(meta._otherUid):false;setComposerState();
 await cleanupOldMessages(id);
 const q=query(ref(db,`${chatPath(id)}/msgs`),limitToLast(50));
 state.unsubscribeMessages=onValue(q,snap=>{
  if(state.activeChat!==id)return;
  const localOnly=state.messages.filter(m=>m._pending||m._failed);
  const incoming=[];snap.forEach(ch=>incoming.push({id:ch.key,...ch.val()}));
  const incomingIds=new Set(incoming.map(m=>m.id));
  state.messages=[...incoming,...localOnly.filter(m=>!incomingIds.has(m.id))].sort((a,b)=>(a.ts||0)-(b.ts||0)).slice(-50);
  saveCached(id,state.messages);renderMessages();markSeen(id,state.messages);
 },err=>{if(state.activeChat===id)toast(`تعذر تحميل الرسائل: ${friendlyError(err)}`)});
 renderChats();
}
async function isBlockedEitherWay(otherUid){if(!otherUid||!state.user)return false;try{const [theirs,mine]=await Promise.all([get(ref(db,`blocks/${otherUid}/${state.user.uid}`)),get(ref(db,`blocks/${state.user.uid}/${otherUid}`))]);return theirs.exists()||mine.exists()}catch(e){console.debug("Block state unavailable",e);return false}}
function setComposerState(){$("blockedBanner").classList.toggle("hidden",!state.blocked);$("messageInput").disabled=state.blocked;$("sendBtn").disabled=state.blocked;$("messageInput").placeholder=state.blocked?"لا يمكنك الإرسال في هذه المحادثة":"اكتب رسالة..."}
async function cleanupOldMessages(chatId){const days=Math.max(1,Math.min(90,Number(state.retentionDays)||7));const cutoff=Date.now()-days*86400000;try{const snap=await get(query(ref(db,`${chatPath(chatId)}/msgs`),limitToLast(200)));if(!snap.exists())return;const updates={};snap.forEach(ch=>{const m=ch.val();if(m.ts&&m.ts<cutoff)updates[ch.key]=null});if(Object.keys(updates).length)await update(ref(db,`${chatPath(chatId)}/msgs`),updates)}catch(e){console.warn("Cleanup skipped",e)}}
function timeLabel(ts){if(!ts)return"";return new Date(ts).toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"})}
function renderMessages(){
 const box=$("messages");if(!state.activeChat)return;
 if(!state.messages.length){box.innerHTML='<div class="empty-note">ابدأ أول رسالة في المحادثة ✨</div>';return}
 const term=state.searchTerm.toLowerCase();
 box.innerHTML=state.messages.map(m=>{
  const mine=m.s===state.user.uid;let body=m.deleted?"تم حذف هذه الرسالة":safe(m.t||"");
  if(term&&m.t&&m.t.toLowerCase().includes(term)){const i=m.t.toLowerCase().indexOf(term);body=safe(m.t.slice(0,i))+`<span class="highlight">${safe(m.t.slice(i,i+term.length))}</span>`+safe(m.t.slice(i+term.length))}
  const seen=!!(m.seenBy&&Object.keys(m.seenBy).some(uid=>uid!==state.user.uid&&m.seenBy[uid]));
  const ticks=mine&&!m._pending&&!m._failed?`<span class="ticks ${seen?"seen":""}">${seen||m.delivered?"✓✓":"✓"}</span>`:"";
  const status=m._failed?`<span class="send-state failed" title="${safe(m._error||'تعذر الإرسال')}">فشل الإرسال</span>`:m._pending?'<span class="send-state">جارٍ الإرسال…</span>':timeLabel(m.ts);
  return `<article class="message ${mine?"mine":"theirs"} ${m.deleted?"deleted":""}" data-mid="${safe(m.id)}"><div class="msg-text">${body}</div><div class="msg-meta"><span>${status}</span>${ticks}</div>${!m.deleted?`<div class="msg-actions">${m._failed?`<button data-action="retry" data-id="${safe(m.id)}">إعادة الإرسال</button>`:""}<button data-action="more" data-id="${safe(m.id)}">خيارات</button></div>`:""}</article>`
 }).join("");
 box.querySelectorAll('[data-action="more"]').forEach(b=>b.onclick=()=>messageOptions(b.dataset.id));
 box.querySelectorAll('[data-action="retry"]').forEach(b=>b.onclick=()=>retryMessage(b.dataset.id));
 box.scrollTop=box.scrollHeight;
}
function updateChatPreview(chatId,text,ts){
 state.chats[chatId]={...(state.chats[chatId]||{}),lastText:text.slice(0,100),lastTs:ts};renderChats();
 // Update each permitted child independently and never hold up the message composer.
 Promise.all([
  set(ref(db,`${chatPath(chatId)}/lastText`),text.slice(0,100)),
  set(ref(db,`${chatPath(chatId)}/lastTs`),ts)
 ]).catch(err=>console.warn("Message sent; preview update failed",err));
}
async function sendMessage(e){
 e.preventDefault();
 if(state.sending) return;
 const input=$("messageInput"),button=$("sendBtn"),text=input.value.trim(),chatId=state.activeChat;
 if(!text||!chatId||state.blocked||!state.user) return;
 if(text.length>500){toast("الرسالة طويلة جداً");return}
 const chat=state.chats[chatId]||state.activeChatMeta;
 if(!chat?.members?.[state.user.uid]){toast("تعذر التحقق من عضويتك في المحادثة. حدّث الصفحة وحاول مجدداً.");return}
 state.sending=true;button.disabled=true;button.textContent="…";
 const msgRef=push(ref(db,`${chatPath(chatId)}/msgs`));
 const msg={s:state.user.uid,t:text,ts:Date.now()};
 const optimistic={id:msgRef.key,...msg,_pending:true};
 state.messages=[...state.messages.filter(m=>m.id!==optimistic.id),optimistic].slice(-50);
 saveCached(chatId,state.messages);renderMessages();
 input.value="";
 try{
  if(chat.type==="dm"){
   const other=chat._otherUid;
   if(other){
    const blocked=await isBlockedEitherWay(other);
    if(blocked){state.blocked=true;setComposerState();throw Object.assign(new Error("المراسلة متوقفة بسبب الحظر"),{code:"yalla/blocked"})}
   }
  }
  // Await the authoritative Firebase write before enabling the next send.
  await set(msgRef,msg);
  const local=state.activeChat===chatId?state.messages.find(m=>m.id===msgRef.key):null;
  if(local){local._pending=false;local._failed=false;local._error="";saveCached(chatId,state.messages);renderMessages()}
  updateChatPreview(chatId,text,msg.ts);
 }catch(err){
  const local=state.activeChat===chatId?state.messages.find(m=>m.id===msgRef.key):null;
  if(local){local._pending=false;local._failed=true;local._error=friendlyError(err);saveCached(chatId,state.messages);renderMessages()}
  // Keep failed text in the composer only if the user hasn't started a new message.
  if(!input.value.trim()){input.value=text}
  if(err.code==="yalla/blocked")toast(err.message);else toast(`لم تُرسل الرسالة: ${friendlyError(err)}`);
 }finally{
  state.sending=false;button.disabled=state.blocked;button.textContent="➤";
  if(input.value)input.focus();
 }
}
async function retryMessage(id){
 const m=state.messages.find(x=>x.id===id);if(!m||!m._failed||!state.activeChat||state.sending)return;
 const chatId=state.activeChat,chat=state.chats[chatId]||state.activeChatMeta;
 if(!chat?.members?.[state.user.uid])return toast("لا تملك صلاحية الإرسال في هذه المحادثة");
 const msg={s:m.s,t:m.t,ts:m.ts};state.sending=true;m._failed=false;m._pending=true;m._error="";renderMessages();
 try{await set(ref(db,`${chatPath(chatId)}/msgs/${id}`),msg);const local=state.messages.find(x=>x.id===id);if(local){local._pending=false;local._failed=false}saveCached(chatId,state.messages);renderMessages();updateChatPreview(chatId,m.t,m.ts)}
 catch(err){const local=state.messages.find(x=>x.id===id);if(local){local._pending=false;local._failed=true;local._error=friendlyError(err)}saveCached(chatId,state.messages);renderMessages();toast(`لم تُرسل الرسالة: ${friendlyError(err)}`)}
 finally{state.sending=false;$("sendBtn").disabled=state.blocked;$("sendBtn").textContent="➤"}
}
async function markSeen(chatId=state.activeChat,messages=state.messages){if(!chatId||!state.user)return;const unread=messages.filter(m=>m.s!==state.user.uid&&!m.deleted&&!(m.seenBy&&m.seenBy[state.user.uid]));if(!unread.length)return;const updates={};unread.forEach(m=>updates[`${m.id}/seenBy/${state.user.uid}`]=true);try{await update(ref(db,`${chatPath(chatId)}/msgs`),updates)}catch(e){console.debug("Seen receipt unavailable",e)}}
function messageOptions(id){const m=state.messages.find(x=>x.id===id);if(!m)return;const mine=m.s===state.user.uid;showModal(`<h2>خيارات الرسالة</h2><div class="modal-list"><button id="forwardMsg">إعادة التوجيه</button><button id="saveMsg">حفظ في الرسائل المحفوظة</button>${mine?'<button id="deleteMe">الحذف من عندي</button><button id="deleteAll">الحذف لدى الجميع</button>':""}</div>`);$("forwardMsg").onclick=()=>forwardMessage(m);$("saveMsg").onclick=()=>saveMessage(m);if(mine){$("deleteMe").onclick=()=>deleteForMe(m);$("deleteAll").onclick=()=>deleteForEveryone(m)}}
async function deleteForMe(m){try{await set(ref(db,`userDeleted/${state.user.uid}/${state.activeChat}/${m.id}`),true);closeModal();toast("تم إخفاء الرسالة من قائمتك")}catch(e){toast(friendlyError(e))}}
async function deleteForEveryone(m){try{await update(ref(db,`${chatPath(state.activeChat)}/msgs/${m.id}`),{t:"",deleted:true});closeModal();toast("تم حذف الرسالة لدى الجميع")}catch(e){toast(friendlyError(e))}}
async function saveMessage(m){try{const r=push(ref(db,`saved/${state.user.uid}`));await set(r,{s:m.s,t:m.t,ts:m.ts,source:state.activeChat});closeModal();toast("تم حفظ الرسالة")}catch(e){toast(friendlyError(e))}}
async function openSaved(){try{const snap=await get(ref(db,`saved/${state.user.uid}`));const items=[];snap.forEach(c=>items.push({id:c.key,...c.val()}));showModal(`<h2>الرسائل المحفوظة</h2>${items.length?`<div class="modal-list">${items.slice(-50).reverse().map(m=>`<button>${safe(m.t||"رسالة")}</button>`).join("")}</div>`:"<p>لسه مفيش رسائل محفوظة.</p>"}`)}catch(e){toast(friendlyError(e))}}
async function forwardMessage(m){closeModal();const entries=Object.entries(state.chats).filter(([id,c])=>id!==state.activeChat&&c.members?.[state.user.uid]);if(!entries.length)return toast("افتح أو أنشئ محادثة أخرى أولاً");showModal(`<h2>إعادة توجيه</h2><div class="modal-list">${entries.map(([id,c])=>`<button data-forward="${safe(id)}">${safe(c.title||c._displayTitle||"محادثة")}</button>`).join("")}</div>`);$("modalContent").querySelectorAll("[data-forward]").forEach(b=>b.onclick=async()=>{try{const id=b.dataset.forward,r=push(ref(db,`${chatPath(id)}/msgs`)),ts=Date.now();await set(r,{s:state.user.uid,t:m.t,ts,forwarded:true});await update(ref(db,chatPath(id)),{lastText:m.t.slice(0,100),lastTs:ts});closeModal();toast("تمت إعادة التوجيه")}catch(e){toast(friendlyError(e))}})}
function showChatSearch(){ $("searchInChatBar").classList.remove("hidden");$("searchInChat").focus() }
async function resolveMember(term){
 const value=String(term||"").trim().toLowerCase().replace(/^@/,"");if(!value)return null;
 if(value.includes("@")&&value.includes(".")){const ix=await get(ref(db,`emailIndex/${emailKey(value)}`));return ix.exists()?ix.val():null}
 const snap=await get(ref(db,"publicProfiles"));const found=Object.entries(snap.val()||{}).find(([uid,p])=>uid!==state.user.uid&&(String(p.username||"").toLowerCase()===value||String(p.nick||"").toLowerCase()===value));return found?.[0]||null;
}
async function manageGroup(){
 const id=state.activeChat,c=state.chats[id]||state.activeChatMeta;if(!c||c.type!=="group")return;
 const isAdmin=c.createdBy===state.user.uid||c.admins?.[state.user.uid]===true;
 if(!isAdmin)return toast("إدارة المجموعة متاحة للمشرفين فقط");
 try{
  const members=Object.keys(c.members||{});const profiles=await Promise.all(members.map(async uid=>{try{return [uid,(await get(ref(db,`publicProfiles/${uid}`))).val()||{}]}catch{return [uid,{}]}}));
  showModal(`<h2>إدارة المجموعة</h2><label>اسم المجموعة</label><input id="manageGroupTitle" maxlength="40" value="${safe(c.title||"")}"><label>وصف المجموعة</label><textarea id="manageGroupDescription" maxlength="180" placeholder="اكتب وصف المجموعة">${safe(c.description||"")}</textarea><button id="saveGroupDetails" class="primary">حفظ المعلومات</button><h3>الأعضاء والمشرفون</h3><div class="modal-list">${profiles.map(([uid,p])=>`<div class="group-member-row"><span><b>${safe(p.nick||p.username||"عضو")}</b><small>@${safe(p.username||"—")} ${c.createdBy===uid?" · المنشئ":c.admins?.[uid]?" · مشرف":""}</small></span>${uid!==c.createdBy?`<button data-promote="${safe(uid)}">${c.admins?.[uid]?"إلغاء الإشراف":"تعيين مشرف"}</button><button data-remove-member="${safe(uid)}">إزالة</button>`:""}</div>`).join("")}</div><label>إضافة أعضاء (اسم أو @مستخدم أو بريد، افصل بفواصل)</label><input id="addGroupMembers" placeholder="ahmed, friend@example.com"><button id="addGroupMembersBtn" class="secondary">إضافة الأعضاء</button><div class="modal-list">${c.createdBy!==state.user.uid?'<button id="leaveGroupBtn">مغادرة المجموعة</button>':""}${c.createdBy===state.user.uid?'<button id="deleteGroupBtn" class="danger">حذف المجموعة نهائياً</button>':""}</div>`);
  $("saveGroupDetails").onclick=async()=>{const title=$("manageGroupTitle").value.trim(),description=$("manageGroupDescription").value.trim();if(title.length<2)return toast("اسم المجموعة قصير جداً");try{await update(ref(db,chatPath(id)),{title:title.slice(0,40),description:description.slice(0,180)});c.title=title;c.description=description;$("chatTitle").textContent=title;renderChats();toast("تم تحديث معلومات المجموعة")}catch(e){toast(friendlyError(e))}};
  $("modalContent").querySelectorAll("[data-promote]").forEach(b=>b.onclick=async()=>{const uid=b.dataset.promote;try{await set(ref(db,`${chatPath(id)}/admins/${uid}`),c.admins?.[uid]?null:true);if(c.admins?.[uid])delete c.admins[uid];else c.admins={...(c.admins||{}),[uid]:true};toast("تم تحديث صلاحيات المشرف");manageGroup()}catch(e){toast(friendlyError(e))}});
  $("modalContent").querySelectorAll("[data-remove-member]").forEach(b=>b.onclick=async()=>{const uid=b.dataset.removeMember;try{await remove(ref(db,`${chatPath(id)}/members/${uid}`));await remove(ref(db,`${chatPath(id)}/admins/${uid}`));c.members[uid]=undefined;delete c.members[uid];if(c.admins)delete c.admins[uid];toast("تمت إزالة العضو");manageGroup()}catch(e){toast(friendlyError(e))}});
  $("addGroupMembersBtn").onclick=async()=>{const terms=$("addGroupMembers").value.split(",").map(x=>x.trim()).filter(Boolean);if(!terms.length)return toast("اكتب اسم أو بريد عضو");try{let added=0;for(const term of terms){const uid=await resolveMember(term);if(!uid){continue}await set(ref(db,`${chatPath(id)}/members/${uid}`),true);await set(ref(db,`userChats/${uid}/${id}`),true);c.members={...(c.members||{}),[uid]:true};added++}if(!added)return toast("لم يتم العثور على أعضاء مسجلين جدد");toast(`تمت إضافة ${added} عضو`);manageGroup()}catch(e){toast(`تعذرت إضافة الأعضاء: ${friendlyError(e)}`)}};
  $("leaveGroupBtn").onclick=async()=>{try{await remove(ref(db,`${chatPath(id)}/members/${state.user.uid}`));await remove(ref(db,`userChats/${state.user.uid}/${id}`));closeModal();state.activeChat=null;state.activeChatMeta=null;state.messages=[];if(state.unsubscribeMessages)state.unsubscribeMessages();state.unsubscribeMessages=null;$("appView").classList.remove("chat-open");delete state.chats[id];renderChats();toast("غادرت المجموعة")}catch(e){toast(friendlyError(e))}};
  if($("deleteGroupBtn"))$("deleteGroupBtn").onclick=async()=>{if(!confirm("هل تريد حذف المجموعة نهائياً لكل الأعضاء؟"))return;try{await remove(ref(db,chatPath(id)));await Promise.all(Object.keys(c.members||{}).map(uid=>remove(ref(db,`userChats/${uid}/${id}`))));closeModal();state.activeChat=null;state.activeChatMeta=null;delete state.chats[id];if(state.unsubscribeMessages)state.unsubscribeMessages();state.unsubscribeMessages=null;$("appView").classList.remove("chat-open");renderChats();toast("تم حذف المجموعة")}catch(e){toast(friendlyError(e))}};
 }catch(e){toast(friendlyError(e))}
}
function editProfile(){
 const p=state.profile||{};showModal(`<h2>تعديل الملف الشخصي</h2><label>اسم العرض</label><input id="editNick" maxlength="30" value="${safe(p.nick||"")}"><label>اسم المستخدم</label><input id="editUsername" maxlength="24" value="${safe(p.username||"")}"><label>البريد الإلكتروني</label><input id="editEmail" type="email" value="${safe(state.user.email||"")}"><label>الصورة الرمزية</label><div id="editAvatarPicker" class="avatar-picker">${avatars.map((a,i)=>`<button type="button" class="avatar-choice ${p.av===`avatar${i+1}`?"selected":""}" data-edit-avatar="avatar${i+1}">${a}</button>`).join("")}</div><button id="saveEditedProfile" class="primary">حفظ التعديلات</button>`);
 let av=p.av||"avatar1";$("modalContent").querySelectorAll("[data-edit-avatar]").forEach(b=>b.onclick=()=>{av=b.dataset.editAvatar;$("modalContent").querySelectorAll("[data-edit-avatar]").forEach(x=>x.classList.toggle("selected",x===b))});
 $("saveEditedProfile").onclick=async()=>{const nick=$("editNick").value.trim(),username=$("editUsername").value.trim().toLowerCase(),email=$("editEmail").value.trim().toLowerCase();if(nick.length<2||nick.length>30)return toast("راجع اسم العرض");if(!/^[a-z0-9_]{3,24}$/.test(username))return toast("اسم المستخدم من 3 إلى 24 حرفاً: a-z و0-9 و_");if(!email||!email.includes("@"))return toast("اكتب بريداً صحيحاً");try{const all=await get(ref(db,"publicProfiles"));if(Object.entries(all.val()||{}).some(([uid,x])=>uid!==state.user.uid&&(x.username||"").toLowerCase()===username))return toast("اسم المستخدم مستخدم بالفعل");if(email!==state.user.email){await updateEmail(state.user,email)}const next={...p,nick,username,email,av};await set(ref(db,profilePath(state.user.uid)),next);await set(ref(db,`publicProfiles/${state.user.uid}`),{nick,username,av});await set(ref(db,`emailIndex/${emailKey(email)}`),state.user.uid);await updateProfile(state.user,{displayName:nick});state.profile=next;$("myName").textContent=nick;$("myEmail").textContent=email;$("myAvatar").textContent=avatarEmoji(av);closeModal();toast("تم تحديث الملف الشخصي");loadChats(state.user)}catch(e){toast(friendlyError(e)+ (e.code==="auth/requires-recent-login"?"؛ سجّل الخروج ثم ادخل مجدداً قبل تغيير البريد.":""))}};
}
function openChatMenu(){if(!state.activeChat)return;const c=state.activeChatMeta;showModal(`<h2>خيارات المحادثة</h2><div class="modal-list">${c.type==="group"?'<button id="groupSettings">إدارة المجموعة</button>':'<button id="editProfileFromChat">تعديل الملف الشخصي</button>'}<button id="blockUser">${state.blocked?"المستخدم محظور":"حظر المستخدم"}</button><button id="retention">مدة الاحتفاظ بالرسائل</button></div>`);if($("groupSettings"))$("groupSettings").onclick=manageGroup;if($("editProfileFromChat"))$("editProfileFromChat").onclick=editProfile;$("blockUser").onclick=async()=>{if(!c._otherUid)return toast("الحظر من قائمة المستخدمين يحتاج محادثة خاصة");try{await set(ref(db,`blocks/${state.user.uid}/${c._otherUid}`),true);state.blocked=true;setComposerState();closeModal();toast("تم حظر المستخدم")}catch(e){toast(friendlyError(e))}};$("retention").onclick=()=>{showModal(`<h2>مدة الاحتفاظ بالرسائل</h2><p>المدة تطبق عند فتح المحادثة.</p><input id="retentionDays" type="number" min="1" max="90" value="${state.retentionDays}"><button id="saveRetention" class="primary">حفظ المدة</button>`);$("saveRetention").onclick=()=>{state.retentionDays=Math.max(1,Math.min(90,Number($("retentionDays").value)||7));localStorage.setItem("yalla_retention",String(state.retentionDays));closeModal();cleanupOldMessages(state.activeChat);toast("تم حفظ المدة على هذا الجهاز")}}}


async function showStatuses(){
 try{
  const snap=await get(ref(db,"statuses")),now=Date.now(),rows=[],all=snap.val()||{};
  for(const [id,item] of Object.entries(all)){if(item&&item.ts&&now-item.ts<86400000)rows.push({id,...item});else if(item&&item.s===state.user.uid)remove(ref(db,`statuses/${id}`)).catch(()=>{})}
  rows.sort((a,b)=>b.ts-a.ts);
  const cards=rows.map(s=>{const views=Object.keys(s.views||{}).filter(uid=>uid!==s.s);return `<article class="status-entry" data-status-id="${safe(s.id)}" style="background:${/^#[0-9a-f]{6}$/i.test(s.color||"")?s.color:"#14243b"};color:white"><strong>${safe(s.nick||"مستخدم")}${s.s===state.user.uid?" · حالتك":""}</strong><p>${safe(s.t||"")}</p><small>${new Date(s.ts).toLocaleString("ar-EG")}</small>${s.s===state.user.uid?`<div class="status-stats">👁 ${views.length} مشاهدة <button data-viewers="${safe(s.id)}">عرض المشاهدين</button> <button data-delete-status="${safe(s.id)}">حذف الحالة</button></div>`:"<small class="status-open-hint">اضغط لمشاهدة الحالة</small>"}</article>`}).join("");
  showModal(`<div class="statuses-page"><div class="statuses-page-head"><div><h2>الحالات</h2><p>الحالات النصية تختفي بعد 24 ساعة.</p></div><button id="addStatus" class="primary">＋ إنشاء حالة</button></div><div class="status-list">${cards||"<p>لا توجد حالات حديثة حالياً. شارك أول حالة مع أصدقائك.</p>"}</div></div>`);
  $("addStatus").onclick=()=>{
   const colors=["#123e9a","#532b91","#a52a54","#087e8b","#236b45","#8b4a16","#172033"];
   showModal(`<div class="status-editor" id="statusPreview"><button id="statusClose" class="status-close" aria-label="إغلاق">×</button><div class="status-editor-top">Yalla Chat <span>حالة نصية · 24 ساعة</span></div><textarea id="statusText" maxlength="280" placeholder="اكتب اللي في بالك..." aria-label="نص الحالة"></textarea><div class="status-editor-bottom"><div class="status-colors">${colors.map((c,i)=>`<button type="button" class="status-color ${i===0?"selected":""}" data-color="${c}" style="background:${c}" aria-label="لون ${i+1}"></button>`).join("")}</div></div><button id="publishStatus" class="primary">نشر الحالة ↗</button></div>`);
   let chosen=colors[0];const preview=$("statusPreview"),input=$("statusText");preview.style.background=chosen;$("statusClose").onclick=closeModal;
   $("modalContent").querySelectorAll("[data-color]").forEach(b=>b.onclick=()=>{chosen=b.dataset.color;preview.style.background=chosen;$("modalContent").querySelectorAll("[data-color]").forEach(x=>x.classList.toggle("selected",x===b))});
   $("publishStatus").onclick=async()=>{const t=input.value.trim();if(!t||t.length>280)return toast("اكتب نص الحالة أولاً");const btn=$("publishStatus");btn.disabled=true;try{const r=push(ref(db,"statuses"));await set(r,{s:state.user.uid,nick:state.profile.nick,t,color:chosen,ts:Date.now(),expiresAt:Date.now()+86400000,views:{}});toast("تم نشر الحالة");showStatuses()}catch(e){toast(friendlyError(e));btn.disabled=false}};
  };
  $("modalContent").querySelectorAll("[data-status-id]").forEach(card=>card.onclick=async e=>{if(e.target.closest("button")||card.dataset.statusId===undefined)return;const item=rows.find(x=>x.id===card.dataset.statusId);if(!item||item.s===state.user.uid)return;try{await set(ref(db,`statuses/${item.id}/views/${state.user.uid}`),true);card.querySelector(".status-open-hint")?.remove();toast("تم تسجيل مشاهدة الحالة")}catch(e){toast(friendlyError(e))}});
  $("modalContent").querySelectorAll("[data-viewers]").forEach(b=>b.onclick=async()=>{const item=rows.find(x=>x.id===b.dataset.viewers);if(!item)return;const uids=Object.keys(item.views||{}).filter(uid=>uid!==item.s);const names=await Promise.all(uids.map(async uid=>{try{const p=(await get(ref(db,`publicProfiles/${uid}`))).val()||{};return p.nick||p.username||"مستخدم"}catch{return "مستخدم"}}));showModal(`<h2>مشاهدات الحالة</h2><p>عدد المشاهدات: ${uids.length}</p>${names.length?`<div class="modal-list">${names.map(n=>`<div class="group-member-row"><b>${safe(n)}</b></div>`).join("")}</div>`:"<p>لم يشاهد أحد الحالة حتى الآن.</p>"}<button id="backToStatuses" class="secondary">رجوع للحالات</button>`);$("backToStatuses").onclick=showStatuses});
  $("modalContent").querySelectorAll("[data-delete-status]").forEach(b=>b.onclick=async()=>{try{await remove(ref(db,`statuses/${b.dataset.deleteStatus}`));toast("تم حذف الحالة");showStatuses()}catch(e){toast(friendlyError(e))}});
 }catch(e){toast(friendlyError(e))}
}
function showDeveloper(){
 showModal(`<div class="developer-card"><img src="./icon-192.png" alt="Yalla Chat" class="developer-logo"><p class="eyebrow">مشروع من تطوير</p><h2>Yalla Chat × NexCode</h2><p>يلا شات مشروع من شركة <b>NexCode</b>، شركة برمجيات متطورة في مجال الويب والتطبيقات، ولها مشاريع في أنحاء الوطن العربي.</p><a class="developer-link" href="https://mute-mouse-67d8.yousseframadan2211.workers.dev/" target="_blank" rel="noopener noreferrer">زيارة موقع NexCode ↗</a><button id="copySiteLink" class="secondary">نسخ رابط الموقع</button></div>`);
 $("copySiteLink").onclick=async()=>{try{await navigator.clipboard.writeText("https://mute-mouse-67d8.yousseframadan2211.workers.dev/");toast("تم نسخ رابط NexCode")}catch{toast("افتح رابط NexCode من الزر أعلاه")}}
}
function showSettings(){
 showModal(`<h2>الإعدادات</h2><p>الاسم: ${safe(state.profile.nick)}</p><p>البريد: ${safe(state.user.email||"")}</p><p>الأفاتار: ${avatarEmoji(state.profile.av)}</p><div class="modal-list"><button id="settingsEditProfile">تعديل الملف الشخصي</button><button id="settingsRetention">مدة الاحتفاظ بالرسائل: ${state.retentionDays} يوم</button><button id="settingsDeveloper">مطور المشروع · NexCode</button><button id="settingsBlocked">المستخدمون المحظورون</button></div>`);
 $("settingsEditProfile").onclick=editProfile;
 $("settingsRetention").onclick=()=>{showModal(`<h2>مدة الاحتفاظ بالرسائل</h2><p>تنظيف العميل لا يضمن الحذف إذا لم يفتح أحد التطبيق.</p><input id="retentionDays" type="number" min="1" max="90" value="${state.retentionDays}"><button id="saveRetention" class="primary">حفظ المدة</button>`);$("saveRetention").onclick=()=>{state.retentionDays=Math.max(1,Math.min(90,Number($("retentionDays").value)||7));localStorage.setItem("yalla_retention",String(state.retentionDays));closeModal();toast("تم حفظ المدة على هذا الجهاز")}};
 $("settingsDeveloper").onclick=showDeveloper;
 $("settingsBlocked").onclick=async()=>{try{const snap=await get(ref(db,`blocks/${state.user.uid}`)),entries=Object.keys(snap.val()||{});showModal(`<h2>المستخدمون المحظورون</h2>${entries.length?`<div class="modal-list">${entries.map(uid=>`<div class="blocked-user"><code>${safe(uid)}</code><button class="secondary" data-unblock="${safe(uid)}">إلغاء الحظر</button></div>`).join("")}</div>`:"<p>لا يوجد مستخدمون محظورون.</p>"}`);$("modalContent").querySelectorAll("[data-unblock]").forEach(b=>b.onclick=async()=>{try{await remove(ref(db,`blocks/${state.user.uid}/${b.dataset.unblock}`));toast("تم إلغاء الحظر");b.closest(".blocked-user").remove()}catch(e){toast(friendlyError(e))}})}catch(e){toast(friendlyError(e))}}
}
async function googleSignIn(){
 const btn=$("googleBtn");btn.disabled=true;btn.textContent="جارٍ التحويل إلى Google...";
 try{
  await setPersistence(auth,browserLocalPersistence);
  const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});
  // Redirect is more reliable than a popup on hosted PWAs and browsers that block popups.
  await signInWithRedirect(auth,provider);
 }catch(e){console.error("Google sign-in failed",e);authNotice(`تعذر تسجيل الدخول باستخدام Google: ${friendlyError(e)}`);btn.disabled=false;btn.innerHTML='<span class="google-g">G</span> المتابعة باستخدام Google'}
}
async function loadChats(user){
 if(state.unsubscribeChats)state.unsubscribeChats();
 state.unsubscribeChats=onValue(ref(db,`userChats/${user.uid}`),async snap=>{
  try{
   const ids=Object.keys(snap.val()||{});
   const pairs=await Promise.all(ids.map(async id=>{const c=(await get(ref(db,chatPath(id)))).val();return [id,c]}));
   const next={};
   await Promise.all(pairs.map(async([id,c])=>{
    if(!c?.members?.[user.uid])return;
    if(c.type==="dm"){
     const otherUid=Object.keys(c.members||{}).find(uid=>uid!==user.uid);c._otherUid=otherUid;
     if(otherUid){try{const ps=await get(ref(db,`publicProfiles/${otherUid}`));const p=ps.val()||{};c._displayTitle=p.nick||p.displayName||"محادثة";c._avatar=p.av||"avatar1";c._otherUsername=p.username||""}catch{c._displayTitle="محادثة"}}
    }
    next[id]=c;
   }));
   state.chats=next;renderChats();
   if(state.activeChat&&state.chats[state.activeChat])state.activeChatMeta={...state.activeChatMeta,...state.chats[state.activeChat]};
  }catch(e){toast(`تعذر تحميل قائمة المحادثات: ${friendlyError(e)}`)}
 },err=>toast(`تعذر الاتصال بالمحادثات: ${friendlyError(err)}`));
}
async function init(){
 try{await setPersistence(auth,browserLocalPersistence)}catch(e){console.error("Auth persistence setup failed",e);authNotice(`تعذر تجهيز حفظ تسجيل الدخول: ${friendlyError(e)}`)}
 state.retentionDays=Number(localStorage.getItem("yalla_retention")||7);$("authForm").addEventListener("submit",authSubmit);$("registerBtn").onclick=register;$("resetPasswordBtn").onclick=resetPassword;$("profileForm").addEventListener("submit",saveProfile);$("searchBtn").onclick=searchUser;$("userSearch").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();searchUser()}});$("newGroupBtn").onclick=createGroup;$("savedBtn").onclick=openSaved;$("statusBtn").onclick=showStatuses;$("developerBtn").onclick=showDeveloper;$("settingsBtn").onclick=showSettings;$("logoutBtn").onclick=async()=>{try{await signOut(auth)}catch(e){toast(friendlyError(e))}};$("messageForm").addEventListener("submit",sendMessage);$("chatSearchBtn").onclick=showChatSearch;$("closeChatSearch").onclick=()=>{$("searchInChatBar").classList.add("hidden");state.searchTerm="";renderMessages()};$("searchInChat").addEventListener("input",e=>{state.searchTerm=e.target.value;renderMessages()});$("chatMenuBtn").onclick=openChatMenu;$("mobileBackBtn").onclick=()=>$("appView").classList.remove("chat-open");$("modalClose").onclick=closeModal;$("modalBackdrop").addEventListener("click",e=>{if(e.target===$("modalBackdrop"))closeModal()});$("inviteClose").onclick=()=>$("invitePopup").classList.add("hidden");$("inviteShareBtn").onclick=copyInvite;$("googleBtn").onclick=googleSignIn;renderAvatarPicker();onAuthStateChanged(auth,async user=>{state.user=user;if(!user){if(state.unsubscribeMessages){state.unsubscribeMessages();state.unsubscribeMessages=null}if(state.unsubscribeChats){state.unsubscribeChats();state.unsubscribeChats=null}state.profile=null;state.chats={};state.activeChat=null;state.activeChatMeta=null;state.messages=[];state.blocked=false;state.sending=false;$("messageInput").value="";$("authEmail").value="";$("authPassword").value="";showView("authView");return}try{if(!isConfigReady()){showView("authView");toast("أضف databaseURL من Firebase Console إلى app.js");return}await loadProfile(user);loadChats(user)}catch(e){console.error("Signed in, but profile/database initialization failed",e);state.profile=state.profile||{uid:user.uid,nick:user.displayName||"حسابي",username:"",av:"avatar1"};showApp();loadChats(user);toast(`تم تسجيل الدخول، لكن تعذر تحميل بيانات الحساب: ${friendlyError(e)}`)}});if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(console.warn));window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();state.installPrompt=e;const action=$("installAction");if(action)action.textContent="تثبيت التطبيق"});
$("installClose").onclick=dismissInstallPopup;$("installLater").onclick=dismissInstallPopup;
window.addEventListener("appinstalled",()=>{dismissInstallPopup();toast("تم تثبيت Yalla Chat بنجاح")});
getRedirectResult(auth).then(result=>{if(result?.user)authNotice("تم تسجيل الدخول باستخدام Google بنجاح",false)}).catch(e=>{console.error("Google redirect result",e);authNotice(`تعذر إكمال تسجيل Google: ${friendlyError(e)}`)});
setTimeout(openInvite,700);if(!isStandalone())setTimeout(showInstallPopup,500);
}
window.addEventListener("unhandledrejection",event=>{console.error("Unhandled app error",event.reason);if(event.reason)authNotice(`خطأ غير متوقع: ${friendlyError(event.reason)}`)});
window.addEventListener("error",event=>{console.error("App runtime error",event.error||event.message);if(event.message)authNotice(`خطأ في تشغيل التطبيق: ${event.message}`)});
init().catch(e=>{console.error("Yalla Chat startup failed",e);toast(`تعذر تشغيل التطبيق: ${friendlyError(e)}`)});
