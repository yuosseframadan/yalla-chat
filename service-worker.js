const CACHE_NAME = "yalla-chat-static-v6";
const STATIC_ASSETS = ["./", "./index.html", "./style.css", "./manifest.json", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./yalla-chat-logo.png"];
self.addEventListener("install", event => {event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));});
self.addEventListener("activate", event => {event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("yalla-chat-static-") && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));});
self.addEventListener("fetch", event => {
 const request=event.request,url=new URL(request.url);if(request.method!=="GET"||url.origin!==self.location.origin)return;
 if(request.mode==="navigate"){event.respondWith(fetch(request).then(response=>{if(response.ok)caches.open(CACHE_NAME).then(cache=>cache.put("./index.html",response.clone()));return response}).catch(()=>caches.match("./index.html")));return}
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok&&/\.(css|json|png|svg|ico)$/.test(url.pathname))caches.open(CACHE_NAME).then(cache=>cache.put(request,response.clone()));return response}).catch(()=>cached||Response.error())));
});
