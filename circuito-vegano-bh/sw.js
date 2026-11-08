// Cópia do app no celular (service worker) · Circuito Vegano BH 2026
// Publicar junto com o app: circuito-vegano-bh/sw.js no GitHub (ao lado do index.html).
// Página: rede primeiro (quem está online recebe sempre a versão nova); sem internet ou com sinal
// muito fraco (mais de 3,5 s), abre a cópia guardada. Ícones, manifest e fontes: cópia guardada,
// atualizada em segundo plano.
const CACHE = "cvbh26-v2"; // v2 (08/11): a página sempre confere a versão nova, sem o cache de 10 min do GitHub
const TIMEOUT = 3500;
const PAGINA = new URL("./", self.registration.scope).href;

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(["./", "./manifest.webmanifest", "./icon-192.png", "./apple-touch-icon.png"].map(u => new Request(u, { cache: "no-cache" }))).catch(() => {})));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith("cvbh26-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (r.mode === "navigate") { e.respondWith(pagina(r)); return; }
  // leitor de QR (jsQR, no cdn.jsdelivr.net) também fica guardado: no iPhone ele é o leitor do check-in por QR
  if (u.origin === location.origin || /^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname) || u.hostname === "cdn.jsdelivr.net") e.respondWith(guardada(r));
});

async function pagina(r) {
  const c = await caches.open(CACHE);
  // "no-cache": pergunta sempre ao GitHub se há versão nova (o navegador guardaria a página por 10 min)
  const rede = fetch(r, { cache: "no-cache" }).then(resp => { if (resp.ok) c.put(PAGINA, resp.clone()); return resp; });
  const copia = await c.match(PAGINA);
  if (!copia) return rede;
  return Promise.race([rede.catch(() => copia), new Promise(ok => setTimeout(() => ok(copia), TIMEOUT))]);
}

async function guardada(r) {
  const c = await caches.open(CACHE);
  const hit = await c.match(r);
  const rede = fetch(r).then(resp => { if (resp.ok || resp.type === "opaque") c.put(r, resp.clone()); return resp; }).catch(() => hit);
  return hit || rede;
}
