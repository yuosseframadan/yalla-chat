YALLA CHAT 2.0 — Random text chat + protected admin dashboard
============================================================

WHAT'S INCLUDED
- Guest-only user experience: no visible sign-up or login. Firebase Anonymous Authentication runs in the background to secure each guest session.
- Random one-to-one text matching, skip/end controls, live messages, country flag/name when Vercel supplies the country header, and online count.
- Arabic/English interface, RTL/LTR layout, light/dark theme, PWA manifest and service worker.
- Install prompt on each browser visit until the app is installed (browser limitations apply), plus a friend-invite popup on each visit.
- NexCode link.
- Automatic first-pass language filtering and progressive IP-hash bans (6h, 12h, 24h, 3d, 7d). The built-in word filter is a basic heuristic, not an AI classifier and not a complete safety system.
- Protected moderator dashboard at /admin. It shows active chats and messages, lets the moderator end a chat, ban a participant, unban a record, and review reports.
- Active chat messages are deleted from the live database when a chat ends or when a participant disconnects. A report stores a limited excerpt of up to 15 messages for moderation; resolved reports are automatically pruned after 7 days, and old unresolved reports after 30 days when cleanup runs.
- Raw IP addresses are not stored by this app. A keyed HMAC hash is stored for progressive bans; country is taken from Vercel's country header when available.

IMPORTANT PRIVACY NOTE
The site discloses that active conversations may be reviewed by authorized moderators and automated safety systems. Do not remove that notice while retaining moderator access to live message content. A report may retain a limited excerpt as evidence until review/retention cleanup.

DEPLOY TO VERCEL
1. Back up the current project/repository before replacing it. Upload the CONTENTS of this yalla-chat folder to the root of the Vercel project.
2. In Vercel > Project > Settings > Environment Variables, add these variables for Production (and Preview if needed):
   - ADMIN_PASSWORD: set this to the moderator password chosen by the project owner.
   - ADMIN_SESSION_SECRET: a unique random secret, at least 32 characters.
   - IP_HASH_SECRET: another unique random secret, at least 32 characters.
   - FIREBASE_DATABASE_URL: https://yalla-chat-286b2-default-rtdb.europe-west1.firebasedatabase.app
   - FIREBASE_SERVICE_ACCOUNT_JSON: paste the full JSON service-account key generated in Firebase Console > Project settings > Service accounts. Never commit this key to Git or place it in a public file.
3. To generate random secrets on a computer with Node.js, run this command twice and use the two different outputs:
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
4. In Firebase Console > Authentication > Sign-in method, enable Anonymous. Add yalla-chat-gules.vercel.app under Authentication > Settings > Authorized domains.
5. In Firebase Console > Realtime Database > Rules, publish the contents of database.rules.json. These rules permit authenticated participants to read their own active match and permit a participant to delete that match on disconnect; browser clients cannot create or edit messages directly. Server APIs write through Firebase Admin SDK.
6. Redeploy the project on Vercel after setting environment variables. The API routes require those environment variables; the dashboard cannot authenticate until setup is complete.
7. Open https://yalla-chat-gules.vercel.app/ for guests. Open https://yalla-chat-gules.vercel.app/admin for the moderator dashboard.

FIREBASE SERVICE ACCOUNT
The service-account JSON is a server secret. Copy the complete JSON into the Vercel environment variable named FIREBASE_SERVICE_ACCOUNT_JSON. Do not add it to this folder, GitHub, or the browser JavaScript.

DATABASE CLEANUP
- A chat is deleted from /matches when a participant ends it or the Firebase client disconnects (onDisconnect). A secondary cleanup pass also removes stale matches and waiting entries whenever /api/online-count is called.
- Presence records older than 24 hours are removed by cleanup. Resolved reports older than 7 days, unresolved reports older than 30 days, and inactive ban records older than 180 days are also pruned when cleanup runs.
- The old Yalla Chat database paths (such as old users/chats/groups/statuses from the previous app) are not deleted automatically. Back them up first, then remove them manually in Firebase Console if you want to reclaim that storage.

LIMITATIONS / VERIFY BEFORE PUBLIC LAUNCH
- The word filter is a basic rule-based starter list, not an AI moderation model. It can miss abusive content or flag text incorrectly. For real AI moderation, integrate a server-side moderation provider and keep its key only in Vercel environment variables.
- Country flags depend on Vercel's x-vercel-ip-country header; local development or unsupported proxies may show an unknown country.
- Closing the browser normally triggers Firebase onDisconnect; if the device loses power/network abruptly, server cleanup may happen on the next online-count request rather than instantly.
- This package has had local syntax/JSON checks. It has not been deployed or tested against the live Firebase/Vercel account from this environment.
