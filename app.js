import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
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
function toast(message){$("toast").textContent=message;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2600)}
function showModal(html){$("modalContent").innerHTML=html;$("modalBackdrop").classList.remove("hidden")}
function closeModal(){$("modalBackdrop").classList.add("hidden");$("modalContent").innerHTML=""}
function showView(view){["authView","profileView","appView"].forEach(id=>$(id).classList.toggle("hidden",id!==view))}
function profilePath(uid){return `users/${uid}`}
function chatPath(id){return `chats/${id}`}
function isConfigReady(){return firebaseConfig.databaseURL.startsWith("https://") && !firebaseConfig.databaseURL.includes("REPLACE_")}
function friendlyError(e){const map={"auth/invalid-credential":"البريد الإلكتروني أو كلمة المرور غير صحيحة","auth/email-already-in-use":"البريد الإلكتروني مستخدم بالفعل","auth/weak-password":"كلمة المرور ضعيفة","auth/invalid-email":"صيغة البريد الإلكتروني غير صحيحة","auth/too-many-requests":"محاولات كثيرة، حاول لاحقاً","auth/operation-not-allowed":"فعّل تسجيل الدخول بالبريد وكلمة المرور من Firebase Authentication","auth/network-request-failed":"تحقق من اتصال الإنترنت وحاول مرة أخرى","auth/user-not-found":"لا يوجد حساب بهذا البريد","auth/wrong-password":"كلمة المرور غير صحيحة","PERMISSION_DENIED":"قواعد Firebase لا تسمح بالعملية"};return map[e.code]||e.message||"حدث خطأ غير متوقع"}
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
function showInstallPopup(){
 if(isStandalone())return;
 const ios=/iphone|ipad|ipod/i.test(navigator.userAgent),box=$("installInstructions"),action=$("installAction");
 if(ios){
  box.innerHTML="على iPhone أو iPad:<br>1. افتح الموقع في <b>Safari</b>.<br>2. اضغط زر <b>مشاركة</b> ⬆️.<br>3. اختر <b>Add to Home Screen / إضافة إلى الشاشة الرئيسية</b>.<br>4. اضغط <b>Add / إضافة</b>.";
  action.textContent="فهمت، هضيفه من Safari";action.onclick=()=>{$("installPopup").classList.add("hidden");toast("افتح الموقع في Safari ثم مشاركة ← إضافة إلى الشاشة الرئيسية")};
 }else{
  box.textContent="ثبّت التطبيق للوصول السريع. قد يعرض المتصفح زر التثبيت إذا كان جهازك يدعمه.";
  action.textContent=state.installPrompt?"تثبيت التطبيق":"طريقة التثبيت";
  action.onclick=async()=>{if(state.installPrompt){try{await state.installPrompt.prompt();await state.installPrompt.userChoice;state.installPrompt=null;if(isStandalone())$("installPopup").classList.add("hidden")}catch(e){toast("تعذر فتح نافذة التثبيت من المتصفح")}}else box.textContent="من قائمة المتصفح ⋮ أو مشاركة، اختر Install app / تثبيت التطبيق أو Add to Home Screen / إضافة إلى الشاشة الرئيسية."};
 }
 $("installPopup").classList.remove("hidden");
}
function showApp(){showView("appView");$("myName").textContent=state.profile?.nick||"حسابي";$("myEmail").textContent=state.user.email||"";$("myAvatar").textContent=avatarEmoji(state.profile?.av);renderChats();openInvite();startPresence()}
async function loadProfile(user){
  const snap=await get(ref(db,profilePath(user.uid)));
  state.profile=snap.val();
  if(!state.profile?.nick){
    state.selectedAvatar=state.profile?.av||"avatar1";
    renderAvatarPicker();showView("profileView");
  }else showApp();
}
function emailKey(email){
  return encodeURIComponent(String(email||"").trim().toLowerCase()).replace(/\./g,"%2E");
}
async function saveProfile(e){
  e.preventDefault();
  const nick=$("nickname").value.trim();
  if(nick.length<2 || nick.length>30) return toast("الاسم لازم يكون من حرفين إلى 30 حرفاً");
  if(!state.user) return toast("سجّل الدخول أولاً");
  const btn=$("profileForm").querySelector('button[type="submit"]');
  btn.disabled=true; btn.textContent="جارٍ الحفظ...";
  try{
    const data={uid:state.user.uid,nick:nick.slice(0,30),email:state.user.email||"",av:state.selectedAvatar,createdAt:Date.now()};
    await set(ref(db,profilePath(state.user.uid)),data);
    await set(ref(db,`publicProfiles/${state.user.uid}`),{nick:data.nick,av:data.av});
    if(data.email) await set(ref(db,`emailIndex/${emailKey(data.email)}`),state.user.uid);
    await updateProfile(state.user,{displayName:nick});
    state.profile=data; showApp();
  }catch(err){toast(friendlyError(err))}
  finally{btn.disabled=false;btn.textContent="حفظ والمتابعة"}
}
async function authSubmit(e){
  e.preventDefault();
  const email=$("authEmail").value.trim(),password=$("authPassword").value;
  if(!email || !$("authEmail").checkValidity()) return toast("اكتب بريداً إلكترونياً صحيحاً");
  if(!password) return toast("اكتب كلمة المرور");
  const btn=$("loginBtn");btn.disabled=true;btn.textContent="جارٍ الدخول...";
  try{await signInWithEmailAndPassword(auth,email,password)}
  catch(err){toast(friendlyError(err))}
  finally{btn.disabled=false;btn.textContent="تسجيل الدخول"}
}
async function register(){
  const email=$("authEmail").value.trim(),password=$("authPassword").value;
  if(!email || !$("authEmail").checkValidity()) return toast("اكتب بريداً إلكترونياً صحيحاً أولاً");
  if(password.length<6) return toast("كلمة المرور لازم تكون 6 أحرف على الأقل");
  const btn=$("registerBtn");btn.disabled=true;btn.textContent="جارٍ إنشاء الحساب...";
  try{
    await createUserWithEmailAndPassword(auth,email,password);
    toast("تم إنشاء الحساب. اختار اسمك المستعار والأفاتار لإكمال الملف الشخصي.");
  }catch(err){toast(friendlyError(err))}
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
        const found=Object.entries(snap.val()).find(([id,p])=>id!==state.user.uid&&(p.nick||"").toLowerCase()===term.toLowerCase());
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
async function createGroup(){showModal(`<h2>إنشاء مجموعة</h2><label>اسم المجموعة</label><input id="groupName" maxlength="40" placeholder="مثلاً: صحابي"><label>أعضاء المجموعة (اسم المستخدم أو البريد الإلكتروني، مفصول بفواصل)</label><input id="groupMembers" placeholder="@ahmed, friend@example.com"><button id="createGroupConfirm" class="primary">إنشاء المجموعة</button>`);$("createGroupConfirm").onclick=async()=>{const title=$("groupName").value.trim(),emails=$("groupMembers").value.split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);if(title.length<2)return toast("اكتب اسم المجموعة");try{const members={[state.user.uid]:true};for(const term of emails){if(term.includes("@")&&term.includes(".")){const found=await get(ref(db,`emailIndex/${emailKey(term)}`));if(found.exists())members[found.val()]=true;}else{const profiles=await get(ref(db,"publicProfiles"));if(profiles.exists()){const match=Object.entries(profiles.val()).find(([uid,p])=>uid!==state.user.uid&&(p.username||p.nick||"").toLowerCase().replace(/^@/,"")===term.toLowerCase().replace(/^@/,""));if(match)members[match[0]]=true;}}}if(Object.keys(members).length<2)return toast("أضف بريداً واحداً مسجلاً على الأقل");const chatRef=push(ref(db,"chats"));await set(chatRef,{type:"group",title:title.slice(0,40),members,createdBy:state.user.uid,createdAt:serverTimestamp()});await Promise.all(Object.keys(members).map(member=>set(ref(db,`userChats/${member}/${chatRef.key}`),true)));state.chats[chatRef.key]=(await get(chatRef)).val();closeModal();renderChats();selectChat(chatRef.key);toast("تم إنشاء المجموعة")}catch(e){toast(friendlyError(e))}}}
function renderChats(){const list=$("chatList");const items=Object.entries(state.chats).filter(([id,c])=>c.members?.[state.user?.uid]).sort((a,b)=>(b[1].lastTs||0)-(a[1].lastTs||0));if(!items.length){list.innerHTML='<div class="empty-note">مفيش محادثات لسه.<br>ابحث عن صديق وابدأ الكلام.</div>';return}list.innerHTML=items.map(([id,c])=>{const title=c.type==="group"?c.title:(c._displayTitle||c.title||"محادثة");return `<div class="chat-item ${state.activeChat===id?"active":""}" data-chat="${safe(id)}"><span class="avatar">${c.type==="group"?"👥":avatarEmoji(c._avatar||"avatar1")}</span><div class="chat-item-info"><strong>${safe(title)}</strong><p>${safe(c.lastText|| (c.type==="group"?"مجموعة":"ابدأ المحادثة"))}</p></div></div>`}).join("");list.querySelectorAll("[data-chat]").forEach(el=>el.onclick=()=>selectChat(el.dataset.chat))}
function loadCached(id){try{return JSON.parse(localStorage.getItem(cacheKey(id))||"[]")}catch{return []}}
function saveCached(id,messages){try{localStorage.setItem(cacheKey(id),JSON.stringify(messages.slice(-50)))}catch{}}
async function selectChat(id){if(state.unsubscribeMessages){state.unsubscribeMessages();state.unsubscribeMessages=null}state.activeChat=id;state.activeChatMeta=state.chats[id];if(!state.activeChatMeta){const snap=await get(ref(db,chatPath(id)));state.activeChatMeta=snap.val();state.chats[id]=snap.val()}$("appView").classList.add("chat-open");$("chatTitle").textContent=state.activeChatMeta.type==="group"?state.activeChatMeta.title:(state.activeChatMeta._displayTitle||state.activeChatMeta.title||"محادثة");$("chatSubtitle").textContent=state.activeChatMeta.type==="group"?"مجموعة":"محادثة خاصة";$("headerAvatar").textContent=state.activeChatMeta.type==="group"?"👥":avatarEmoji(state.activeChatMeta._avatar);$("messageForm").classList.remove("hidden");$("messages").innerHTML="";state.messages=loadCached(id);renderMessages();const other=state.activeChatMeta._otherUid;state.blocked=other?await isBlockedEitherWay(other):false;setComposerState();await cleanupOldMessages(id);const q=query(ref(db,`${chatPath(id)}/msgs`),limitToLast(50));state.unsubscribeMessages=onValue(q,snap=>{state.messages=[];snap.forEach(ch=>state.messages.push({id:ch.key,...ch.val()}));saveCached(id,state.messages);renderMessages();markSeen();});renderChats()}
async function isBlockedEitherWay(otherUid){try{const s=await get(ref(db,`blocks/${otherUid}/${state.user.uid}`));return s.exists()}catch{return false}}
function setComposerState(){$("blockedBanner").classList.toggle("hidden",!state.blocked);$("messageInput").disabled=state.blocked;$("sendBtn").disabled=state.blocked;$("messageInput").placeholder=state.blocked?"لا يمكنك الإرسال في هذه المحادثة":"اكتب رسالة... (500 حرف كحد أقصى)"}
async function cleanupOldMessages(chatId){const days=Math.max(1,Math.min(90,Number(state.retentionDays)||7));const cutoff=Date.now()-days*86400000;try{const snap=await get(query(ref(db,`${chatPath(chatId)}/msgs`),limitToLast(200)));if(!snap.exists())return;const updates={};snap.forEach(ch=>{const m=ch.val();if(m.ts&&m.ts<cutoff)updates[ch.key]=null});if(Object.keys(updates).length)await update(ref(db,`${chatPath(chatId)}/msgs`),updates)}catch(e){console.warn("Cleanup skipped",e)}}
function timeLabel(ts){if(!ts)return"";return new Date(ts).toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"})}
function renderMessages(){const box=$("messages");if(!state.activeChat){return}if(!state.messages.length){box.innerHTML='<div class="empty-note">ابدأ أول رسالة في المحادثة ✨</div>';return}const term=state.searchTerm.toLowerCase();box.innerHTML=state.messages.map(m=>{const mine=m.s===state.user.uid;let body=m.deleted?"تم حذف هذه الرسالة":safe(m.t||"");if(term&&m.t&&m.t.toLowerCase().includes(term)){const i=m.t.toLowerCase().indexOf(term);body=safe(m.t.slice(0,i))+`<span class="highlight">${safe(m.t.slice(i,i+term.length))}</span>`+safe(m.t.slice(i+term.length))}const ticks=mine?`<span class="ticks ${m.seenBy&&Object.keys(m.seenBy).some(uid=>uid!==state.user.uid&&m.seenBy[uid])?"seen":""}">${m.seenBy&&Object.keys(m.seenBy).some(uid=>uid!==state.user.uid&&m.seenBy[uid])?"✓✓":m.delivered?"✓✓":"✓"}</span>`:"";return `<article class="message ${mine?"mine":"theirs"} ${m.deleted?"deleted":""}" data-mid="${safe(m.id)}"><div class="msg-text">${body}</div><div class="msg-meta"><span>${timeLabel(m.ts)}</span>${ticks}</div>${!m.deleted?`<div class="msg-actions"><button data-action="more" data-id="${safe(m.id)}">خيارات</button></div>`:""}</article>`}).join("");box.querySelectorAll('[data-action="more"]').forEach(b=>b.onclick=()=>messageOptions(b.dataset.id));box.scrollTop=box.scrollHeight}
async function sendMessage(e){
 e.preventDefault();if(state.sending)return;
 const input=$("messageInput"),button=$("sendBtn"),text=input.value.trim(),chatId=state.activeChat;
 if(!text||text.length>500||!chatId||state.blocked)return;
 state.sending=true;button.disabled=true;button.textContent="…";
 try{
  if(state.activeChatMeta?.type==="dm"&&state.activeChatMeta?._otherUid){
   const other=state.activeChatMeta._otherUid,blocked=await isBlockedEitherWay(other),mine=await get(ref(db,`blocks/${state.user.uid}/${other}`));
   if(blocked||mine.exists()){state.blocked=true;setComposerState();toast("المراسلة متوقفة بسبب الحظر");return}
  }
  const msg={s:state.user.uid,t:text,ts:Date.now()},newRef=push(ref(db,`${chatPath(chatId)}/msgs`));
  await set(newRef,msg);input.value="";$("charCount").textContent="0/500";
  try{await update(ref(db,chatPath(chatId)),{lastText:text.slice(0,100),lastTs:msg.ts})}catch(metaErr){console.warn("Message sent; preview update failed",metaErr)}
 }catch(err){toast(friendlyError(err))}
 finally{state.sending=false;button.disabled=state.blocked;button.textContent="➤";if(input.value)input.focus()}
}
async function markSeen(){if(!state.activeChat)return;const unread=state.messages.filter(m=>m.s!==state.user.uid&&!m.deleted);if(!unread.length)return;const updates={};unread.forEach(m=>updates[`${m.id}/seenBy/${state.user.uid}`]=true);try{await update(ref(db,`${chatPath(state.activeChat)}/msgs`),updates)}catch{}}
function messageOptions(id){const m=state.messages.find(x=>x.id===id);if(!m)return;const mine=m.s===state.user.uid;showModal(`<h2>خيارات الرسالة</h2><div class="modal-list"><button id="forwardMsg">إعادة التوجيه</button><button id="saveMsg">حفظ في الرسائل المحفوظة</button>${mine?'<button id="deleteMe">الحذف من عندي</button><button id="deleteAll">الحذف لدى الجميع</button>':""}</div>`);$("forwardMsg").onclick=()=>forwardMessage(m);$("saveMsg").onclick=()=>saveMessage(m);if(mine){$("deleteMe").onclick=()=>deleteForMe(m);$("deleteAll").onclick=()=>deleteForEveryone(m)}}
async function deleteForMe(m){try{await set(ref(db,`userDeleted/${state.user.uid}/${state.activeChat}/${m.id}`),true);closeModal();toast("تم إخفاء الرسالة من قائمتك")}catch(e){toast(friendlyError(e))}}
async function deleteForEveryone(m){try{await update(ref(db,`${chatPath(state.activeChat)}/msgs/${m.id}`),{t:"",deleted:true});closeModal();toast("تم حذف الرسالة لدى الجميع")}catch(e){toast(friendlyError(e))}}
async function saveMessage(m){try{const r=push(ref(db,`saved/${state.user.uid}`));await set(r,{s:m.s,t:m.t,ts:m.ts,source:state.activeChat});closeModal();toast("تم حفظ الرسالة")}catch(e){toast(friendlyError(e))}}
async function openSaved(){try{const snap=await get(ref(db,`saved/${state.user.uid}`));const items=[];snap.forEach(c=>items.push({id:c.key,...c.val()}));showModal(`<h2>الرسائل المحفوظة</h2>${items.length?`<div class="modal-list">${items.slice(-50).reverse().map(m=>`<button>${safe(m.t||"رسالة")}</button>`).join("")}</div>`:"<p>لسه مفيش رسائل محفوظة.</p>"}`)}catch(e){toast(friendlyError(e))}}
async function forwardMessage(m){closeModal();const entries=Object.entries(state.chats).filter(([id,c])=>id!==state.activeChat&&c.members?.[state.user.uid]);if(!entries.length)return toast("افتح أو أنشئ محادثة أخرى أولاً");showModal(`<h2>إعادة توجيه</h2><div class="modal-list">${entries.map(([id,c])=>`<button data-forward="${safe(id)}">${safe(c.title||c._displayTitle||"محادثة")}</button>`).join("")}</div>`);$("modalContent").querySelectorAll("[data-forward]").forEach(b=>b.onclick=async()=>{try{const id=b.dataset.forward,r=push(ref(db,`${chatPath(id)}/msgs`)),ts=Date.now();await set(r,{s:state.user.uid,t:m.t,ts,forwarded:true});await update(ref(db,chatPath(id)),{lastText:m.t.slice(0,100),lastTs:ts});closeModal();toast("تمت إعادة التوجيه")}catch(e){toast(friendlyError(e))}})}
function showChatSearch(){ $("searchInChatBar").classList.remove("hidden");$("searchInChat").focus() }
function openChatMenu(){if(!state.activeChat)return;const c=state.activeChatMeta;showModal(`<h2>خيارات المحادثة</h2><div class="modal-list"><button id="blockUser">${state.blocked?"المستخدم محظور":"حظر المستخدم"}</button><button id="retention">مدة الاحتفاظ بالرسائل</button>${c.type==="group"?`<p class="group-member">المجموعة لا تُحذف تلقائياً.</p>`:""}</div>`);$("blockUser").onclick=async()=>{if(!c._otherUid)return toast("إدارة أعضاء المجموعة تحتاج اختيار عضو");try{await set(ref(db,`blocks/${state.user.uid}/${c._otherUid}`),true);closeModal();toast("تم حظر المستخدم")}catch(e){toast(friendlyError(e))}};$("retention").onclick=()=>{showModal(`<h2>مدة الاحتفاظ بالرسائل</h2><p>المدة تطبق عند فتح المحادثة، من يوم إلى 90 يوماً.</p><input id="retentionDays" type="number" min="1" max="90" value="${state.retentionDays}"><button id="saveRetention" class="primary">حفظ المدة</button>`);$("saveRetention").onclick=()=>{state.retentionDays=Math.max(1,Math.min(90,Number($("retentionDays").value)||7));localStorage.setItem("yalla_retention",String(state.retentionDays));closeModal();cleanupOldMessages(state.activeChat);toast("تم حفظ المدة على هذا الجهاز")}}}

async function showStatuses(){
 try{
  const snap=await get(ref(db,"statuses")),now=Date.now(),rows=[],all=snap.val()||{};
  for(const [id,item] of Object.entries(all)){if(item&&item.ts&&now-item.ts<86400000)rows.push({id,...item});else if(item&&item.s===state.user.uid)remove(ref(db,`statuses/${id}`)).catch(()=>{})}
  rows.sort((a,b)=>b.ts-a.ts);
  showModal(`<h2>الحالات</h2><p>شارك فكرة أو اقتباسًا نصيًا يختفي بعد 24 ساعة.</p><button id="addStatus" class="primary">＋ إنشاء حالة</button><div class="status-list">${rows.length?rows.map(s=>`<article class="status-entry" style="background:${/^#[0-9a-f]{6}$/i.test(s.color||"")?s.color:"#14243b"};color:white"><strong>${safe(s.nick||"مستخدم")}</strong><p>${safe(s.t||"")}</p><small>${new Date(s.ts).toLocaleString("ar-EG")}</small></article>`).join(""):"<p>لا توجد حالات حديثة حالياً.</p>"}</div>`);
  $("addStatus").onclick=()=>{
   const colors=["#123e9a","#532b91","#a52a54","#087e8b","#236b45","#8b4a16","#172033"];
   showModal(`<div class="status-editor" id="statusPreview"><button id="statusClose" class="status-close" aria-label="إغلاق">×</button><div class="status-editor-top">Yalla Chat <span>حالة نصية · 24 ساعة</span></div><textarea id="statusText" maxlength="280" placeholder="اكتب اللي في بالك..." aria-label="نص الحالة"></textarea><div class="status-editor-bottom"><div class="status-colors">${colors.map((c,i)=>`<button type="button" class="status-color ${i===0?"selected":""}" data-color="${c}" style="background:${c}" aria-label="لون ${i+1}"></button>`).join("")}</div><span id="statusCount">0/280</span></div><button id="publishStatus" class="primary">نشر الحالة ↗</button></div>`);
   let chosen=colors[0];const preview=$("statusPreview"),input=$("statusText");preview.style.background=chosen;
   $("statusClose").onclick=closeModal;input.addEventListener("input",()=>{$("statusCount").textContent=`${input.value.length}/280`});
   $("modalContent").querySelectorAll("[data-color]").forEach(b=>b.onclick=()=>{chosen=b.dataset.color;preview.style.background=chosen;$("modalContent").querySelectorAll("[data-color]").forEach(x=>x.classList.toggle("selected",x===b))});
   $("publishStatus").onclick=async()=>{const t=input.value.trim();if(!t||t.length>280)return toast("اكتب حالة من 1 إلى 280 حرفاً");const btn=$("publishStatus");btn.disabled=true;try{const r=push(ref(db,"statuses"));await set(r,{s:state.user.uid,nick:state.profile.nick,t,color:chosen,ts:Date.now(),expiresAt:Date.now()+86400000});closeModal();toast("تم نشر الحالة");showStatuses()}catch(e){toast(friendlyError(e));btn.disabled=false}};
  };
 }catch(e){toast(friendlyError(e))}
}
function showDeveloper(){
 showModal(`<div class="developer-card"><img src="./icon-192.png" alt="Yalla Chat" class="developer-logo"><p class="eyebrow">مشروع من تطوير</p><h2>Yalla Chat × NexCode</h2><p>يلا شات مشروع من شركة <b>NexCode</b>، شركة برمجيات متطورة في مجال الويب والتطبيقات، ولها مشاريع في أنحاء الوطن العربي.</p><a class="developer-link" href="https://mute-mouse-67d8.yousseframadan2211.workers.dev/" target="_blank" rel="noopener noreferrer">زيارة موقع NexCode ↗</a><button id="copySiteLink" class="secondary">نسخ رابط الموقع</button></div>`);
 $("copySiteLink").onclick=async()=>{try{await navigator.clipboard.writeText("https://mute-mouse-67d8.yousseframadan2211.workers.dev/");toast("تم نسخ رابط NexCode")}catch{toast("افتح رابط NexCode من الزر أعلاه")}}
}
function showSettings(){
 showModal(`<h2>الإعدادات</h2><p>الاسم: ${safe(state.profile.nick)}</p><p>البريد: ${safe(state.user.email||"")}</p><p>الأفاتار: ${avatarEmoji(state.profile.av)}</p><div class="modal-list"><button id="settingsRetention">مدة الاحتفاظ بالرسائل: ${state.retentionDays} يوم</button><button id="settingsDeveloper">مطور المشروع · NexCode</button><button id="settingsBlocked">المستخدمون المحظورون</button></div>`);
 $("settingsRetention").onclick=()=>{showModal(`<h2>مدة الاحتفاظ بالرسائل</h2><p>تنظيف العميل لا يضمن الحذف إذا لم يفتح أحد التطبيق.</p><input id="retentionDays" type="number" min="1" max="90" value="${state.retentionDays}"><button id="saveRetention" class="primary">حفظ المدة</button>`);$("saveRetention").onclick=()=>{state.retentionDays=Math.max(1,Math.min(90,Number($("retentionDays").value)||7));localStorage.setItem("yalla_retention",String(state.retentionDays));closeModal();toast("تم حفظ المدة على هذا الجهاز")}};
 $("settingsDeveloper").onclick=showDeveloper;
 $("settingsBlocked").onclick=async()=>{try{const snap=await get(ref(db,`blocks/${state.user.uid}`)),entries=Object.keys(snap.val()||{});showModal(`<h2>المستخدمون المحظورون</h2>${entries.length?`<div class="modal-list">${entries.map(uid=>`<div class="blocked-user"><code>${safe(uid)}</code><button class="secondary" data-unblock="${safe(uid)}">إلغاء الحظر</button></div>`).join("")}</div>`:"<p>لا يوجد مستخدمون محظورون.</p>"}`);$("modalContent").querySelectorAll("[data-unblock]").forEach(b=>b.onclick=async()=>{try{await remove(ref(db,`blocks/${state.user.uid}/${b.dataset.unblock}`));toast("تم إلغاء الحظر");b.closest(".blocked-user").remove()}catch(e){toast(friendlyError(e))}})}catch(e){toast(friendlyError(e))}}
}
async function googleSignIn(){
 const btn=$("googleBtn");btn.disabled=true;btn.textContent="جارٍ فتح Google...";
 try{const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});await signInWithPopup(auth,provider)}
 catch(e){if(e.code==="auth/popup-blocked"||e.code==="auth/operation-not-supported-in-this-environment"){try{await signInWithRedirect(auth,new GoogleAuthProvider())}catch(err){toast(friendlyError(err))}}else toast(friendlyError(e))}
 finally{btn.disabled=false;btn.innerHTML='<span class="google-g">G</span> المتابعة باستخدام Google'}
}
async function loadChats(user){if(state.unsubscribeChats)state.unsubscribeChats();state.unsubscribeChats=onValue(ref(db,`userChats/${user.uid}`),async snap=>{const ids=Object.keys(snap.val()||{});const pairs=await Promise.all(ids.map(async id=>[id,(await get(ref(db,chatPath(id)))).val()]));state.chats={};for(const [id,c] of pairs){if(c?.members?.[user.uid])state.chats[id]=c}renderChats();if(state.activeChat&&state.chats[state.activeChat]){state.activeChatMeta={...state.activeChatMeta,...state.chats[state.activeChat]}}},err=>toast(friendlyError(err)))}
function init(){state.retentionDays=Number(localStorage.getItem("yalla_retention")||7);$("authForm").addEventListener("submit",authSubmit);$("registerBtn").onclick=register;$("resetPasswordBtn").onclick=resetPassword;$("profileForm").addEventListener("submit",saveProfile);$("searchBtn").onclick=searchUser;$("userSearch").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();searchUser()}});$("newGroupBtn").onclick=createGroup;$("savedBtn").onclick=openSaved;$("statusBtn").onclick=showStatuses;$("developerBtn").onclick=showDeveloper;$("settingsBtn").onclick=showSettings;$("logoutBtn").onclick=()=>signOut(auth);$("messageForm").addEventListener("submit",sendMessage);$("messageInput").addEventListener("input",()=>{$("charCount").textContent=`${$("messageInput").value.length}/500`});$("chatSearchBtn").onclick=showChatSearch;$("closeChatSearch").onclick=()=>{$("searchInChatBar").classList.add("hidden");state.searchTerm="";renderMessages()};$("searchInChat").addEventListener("input",e=>{state.searchTerm=e.target.value;renderMessages()});$("chatMenuBtn").onclick=openChatMenu;$("mobileBackBtn").onclick=()=>$("appView").classList.remove("chat-open");$("modalClose").onclick=closeModal;$("modalBackdrop").addEventListener("click",e=>{if(e.target===$("modalBackdrop"))closeModal()});$("inviteClose").onclick=()=>$("invitePopup").classList.add("hidden");$("inviteShareBtn").onclick=copyInvite;$("googleBtn").onclick=googleSignIn;renderAvatarPicker();onAuthStateChanged(auth,async user=>{state.user=user;if(!user){if(state.unsubscribeChats)state.unsubscribeChats();showView("authView");return}try{if(!isConfigReady()){showView("authView");toast("أضف databaseURL من Firebase Console إلى app.js");return}await loadProfile(user);loadChats(user)}catch(e){toast(friendlyError(e))}});if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(console.warn));window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();state.installPrompt=e;const action=$("installAction");if(action)action.textContent="تثبيت التطبيق"});
$("installClose").onclick=()=>$("installPopup").classList.add("hidden");$("installLater").onclick=()=>$("installPopup").classList.add("hidden");
window.addEventListener("appinstalled",()=>{$("installPopup").classList.add("hidden");toast("تم تثبيت Yalla Chat بنجاح")});
getRedirectResult(auth).catch(e=>console.warn("Google redirect result",e));
setTimeout(openInvite,700);if(!isStandalone())setTimeout(showInstallPopup,500);
}
init();
