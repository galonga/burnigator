const CACHE_NAME='burnigator-offline-v55';
const SHELL_FILES=[
  './','./index.php','./api.php',
  './assets/style.css','./assets/design-system.css','./assets/i18n.js','./assets/theme.js','./assets/easter-egg.js','./assets/map.js','./assets/matomo.js','./assets/pwa.js',
  './manifest.php','./app-icon.php?size=180','./app-icon.php?size=192','./app-icon.php?size=512',
  './assets/app-icon.svg','./assets/app-icon-192.png','./assets/app-icon-512.png','./assets/apple-touch-icon.png',
  './assets/vendor/leaflet/leaflet.css','./assets/vendor/leaflet/leaflet.js','./assets/vendor/qrcode.min.js',
  './assets/vendor/leaflet/images/layers.png','./assets/vendor/leaflet/images/layers-2x.png',
  './assets/vendor/leaflet/images/marker-icon.png','./assets/vendor/leaflet/images/marker-icon-2x.png','./assets/vendor/leaflet/images/marker-shadow.png',
  './assets/vendor/fontawesome/css/all.min.css','./assets/vendor/fontawesome/webfonts/fa-solid-900.woff2',
  './assets/vendor/fontawesome/webfonts/fa-regular-400.woff2','./assets/vendor/fontawesome/webfonts/fa-brands-400.woff2',
  './assets/vendor/fontawesome/webfonts/fa-v4compatibility.woff2'
];

self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);
  await cache.addAll(SHELL_FILES);
  const apiUrl=new URL('api.php',self.registration.scope);
  const response=await cache.match(apiUrl.href);
  if(response){
    const map=await response.clone().json();
    for(const key of ['image','logo','favicon']){
      const path=map?.[key];
      if(typeof path==='string'&&/^uploads\/(?:map-[a-f0-9]{24}\.(?:png|jpg)|(?:logo|favicon)-[a-f0-9]{24}\.png)$/.test(path)){
        try{const assetUrl=new URL(path,self.registration.scope);const asset=await fetch(assetUrl.href);if(asset.ok)await cache.put(assetUrl.href,asset);}catch(_){}
      }
    }
  }
  await self.skipWaiting();
})()));

self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith('burnigator-offline-')&&key!==CACHE_NAME)await caches.delete(key);
  await self.clients.claim();
})()));

self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url);if(url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith((async()=>{const cache=await caches.open(CACHE_NAME);try{const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response;}catch(_){return await cache.match(request)||await cache.match(new URL('index.php',self.registration.scope).href)||Response.error();}})());
    return;
  }
  if(url.pathname.endsWith('/api.php')&&!url.search){
    event.respondWith((async()=>{const cache=await caches.open(CACHE_NAME);try{const response=await fetch(request);if(response.ok)await cache.put(new URL('api.php',self.registration.scope).href,response.clone());return response;}catch(_){const cached=await cache.match(new URL('api.php',self.registration.scope).href);if(!cached)return Response.error();const headers=new Headers(cached.headers);headers.set('X-Burnigator-Data-Source','offline-cache');return new Response(cached.body,{status:cached.status,statusText:cached.statusText,headers});}})());
    return;
  }
  if(url.pathname.endsWith('/manifest.php')||url.pathname.endsWith('/app-icon.php')){
    event.respondWith((async()=>{const cache=await caches.open(CACHE_NAME);try{const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response;}catch(_){return await cache.match(request)||Response.error();}})());
    return;
  }
  if(url.pathname.includes('/assets/')||url.pathname.includes('/uploads/')){
    event.respondWith((async()=>{const cache=await caches.open(CACHE_NAME);const cached=await cache.match(request,{ignoreSearch:true});try{const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response;}catch(_){return cached||Response.error();}})());
  }
});
