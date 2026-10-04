const CACHE='gym-tracker-v2.2';
const ASSETS=['./','./index.html','./config.js','./core.js','./app.js'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('gym-tracker-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);url.search='';if(event.request.method!=='GET'||url.origin!==self.location.origin||!ASSETS.some(asset=>new URL(asset,self.registration.scope).href===url.href))return;event.respondWith(caches.open(CACHE).then(async cache=>await cache.match(url.href)||fetch(event.request)));});
