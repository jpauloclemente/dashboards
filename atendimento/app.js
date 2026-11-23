/* Seu Trem 100% Vegano · Sistema de atendimento
   Telas: ?v=base (computador) · ?v=garcom&t=TOKEN (celular do garçom) · ?v=cozinha (TV)
          ?v=mesa&m=3&k=... (cliente na mesa) · ?v=pedido (delivery pelo WhatsApp) · ?v=pago (volta da InfinitePay)
   Dados: Firebase Firestore (nuvem) ou modo local (ensaio num navegador só). */
(function () {
'use strict';

// ================= utilidades =================
const LOJA = (new URLSearchParams(location.search).get('loja') || window.LOJA_ID || 'st1').replace(/[^\w-]/g, '');
const NOME_CURTO = 'Seu Trem 100% Vegano';
const FRASE = 'Quando der pague via pix para que nenhum centavo do seu momento pare no bolso do Trump.';
const AVISO_10 = '10% é opcional, nos ajuda a pagar a mão de obra do pessoal.';
const LGPD = 'Autorizo o Seu Trem a guardar meu nome e WhatsApp para o atendimento e para avisos da casa. Posso pedir para sair quando quiser.';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const R = v => 'R$ ' + (Math.round((+v || 0) * 100) / 100).toFixed(2).replace('.', ',');
const r2 = v => Math.round((+v || 0) * 100) / 100;
const agora = () => Date.now();
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const minDesde = ts => Math.max(0, Math.floor((agora() - ts) / 60000));
const hora = ts => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dataBR = ts => new Date(ts).toLocaleDateString('pt-BR');
const soDig = s => String(s || '').replace(/\D/g, '');
const telWa = t => { let d = soDig(t); if (d.length === 10 || d.length === 11) d = '55' + d; return d; };
const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
const ic = n => `<span class="ms">${n}</span>`;
const PARAMS = new URLSearchParams(location.search);
const VIEW = PARAMS.get('v') || 'inicio';
const BASE_URL = location.origin + location.pathname;
// Links que o sistema gera carregam a loja quando não é a padrão (ex.: ?loja=ensaio para treinar a equipe)
const BQ = BASE_URL + '?' + (PARAMS.get('loja') ? 'loja=' + encodeURIComponent(LOJA) + '&' : '');
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const wa = (tel, txt) => `https://wa.me/${telWa(tel)}?text=${encodeURIComponent(txt)}`;
function abrir(url) {
  const w = window.open(url, '_blank');
  if (w) return;
  if (VIEW === 'base' || VIEW === 'garcom') abrirModal({ render: () => `<h2>Abrir o WhatsApp</h2><p class="sub">O navegador segurou a janela. Toque abaixo.</p><a class="bt verde grande bloco" href="${esc(url)}" target="_blank" data-a="fecharModal">${ic('chat')} Abrir o WhatsApp</a>` });
  else location.href = url;
}
function ordinal(n) { return n + 'º'; }

function toast(msg, desfazer) {
  const t = document.createElement('div'); t.className = 't';
  t.innerHTML = `<span>${esc(msg)}</span>` + (desfazer ? '<button>Desfazer</button>' : '');
  if (desfazer) t.querySelector('button').onclick = () => { desfazer(); t.remove(); };
  $('#toast').appendChild(t); setTimeout(() => t.remove(), desfazer ? 8000 : 3500);
}
window.addEventListener('error', e => { try { toast('Erro: ' + (e.message || e)); } catch (x) {} });
window.addEventListener('unhandledrejection', e => { try { toast('Erro: ' + ((e.reason && e.reason.message) || e.reason)); } catch (x) {} });

// ================= cardápio e preços =================
const C = window.CARDAPIO;
const P = {}; C.itens.forEach(i => { P[i.cod] = i; });
const BURGUERS = C.itens.filter(i => i.tipo === 'burguer');
const ADICIONAIS = C.itens.filter(i => i.tipo === 'adicional');

// Combo de adicionais: 2 por R$ 10, 3 por R$ 12 (misturando os de R$ 8 e R$ 5). No espeto: 3 por R$ 10.
function precoAdds(adds, espeto) {
  adds = adds || [];
  const comb = adds.filter(a => P[a.cod] && P[a.cod].combina).map(a => a.preco).sort((a, b) => b - a);
  let t = adds.filter(a => !(P[a.cod] && P[a.cod].combina)).reduce((s, a) => s + a.preco, 0);
  let i = 0;
  while (comb.length - i >= 3) { t += espeto ? 10 : Math.min(12, comb[i] + comb[i + 1] + comb[i + 2]); i += 3; }
  const resto = comb.slice(i);
  if (resto.length === 2) t += Math.min(10, resto[0] + resto[1]); else if (resto.length === 1) t += resto[0];
  return t;
}
function precoItem(it) { return r2((it.base || 0) + (it.acresc || 0) + (it.partes || []).reduce((s, p) => s + precoAdds(p.adds, p.espeto), 0)); }
function itensValidos(itens) { return (itens || []).filter(i => !i.cancelado); }
function subtotal(itens) { return r2(itensValidos(itens).reduce((s, i) => s + precoItem(i), 0)); }
function descItem(it) {
  const linhas = [];
  (it.partes || []).forEach(p => {
    const extra = [...(p.adds || []).map(a => '+ ' + a.nome), p.det, p.obs].filter(Boolean);
    if (it.combo || (it.partes.length > 1)) linhas.push(p.nome + (extra.length ? ' (' + extra.join(', ') + ')' : ''));
    else if (extra.length) linhas.push(extra.join(', '));
  });
  return linhas;
}
function ehBebida(it) { return (it.partes || []).every(p => p.setor === 'bar'); }
function temSetor(it, s) { return (it.partes || []).some(p => p.setor === s); }

// ================= banco de dados =================
let DB = null;
function dbLocal() {
  const pre = 'stl:' + LOJA + ':';
  const subs = {}; let bc = null;
  try { bc = new BroadcastChannel('stl-' + LOJA); } catch (e) {}
  const ler = c => LS.get(pre + c, {});
  const avisar = c => (subs[c] || []).slice().forEach(f => f());
  const gravar = (c, o) => { LS.set(pre + c, o); avisar(c); try { bc && bc.postMessage(c); } catch (e) {} };
  if (bc) bc.onmessage = e => avisar(e.data);
  window.addEventListener('storage', e => { if (e.key && e.key.indexOf(pre) === 0) avisar(e.key.slice(pre.length)); });
  const sub = (c, f) => { (subs[c] = subs[c] || []).push(f); f(); return () => { subs[c] = subs[c].filter(x => x !== f); }; };
  return {
    modo: 'local',
    listen(c, cb, filtro) { return sub(c, () => { let a = Object.entries(ler(c)).map(([id, d]) => Object.assign({}, d, { id })); if (filtro) a = a.filter(d => d[filtro[0]] === filtro[1]); cb(a); }); },
    listenDoc(c, id, cb) { return sub(c, () => { const d = ler(c)[id]; cb(d ? Object.assign({}, d, { id }) : null); }); },
    async get(c, id) { const d = ler(c)[id]; return d ? Object.assign({}, clone(d), { id }) : null; },
    async set(c, id, data) { const o = ler(c); o[id] = clone(data); gravar(c, o); },
    async update(c, id, patch) { const o = ler(c); o[id] = Object.assign(o[id] || {}, clone(patch)); gravar(c, o); },
    async del(c, id) { const o = ler(c); delete o[id]; gravar(c, o); },
    async mutate(c, id, fn) { const o = ler(c); const cur = o[id] ? clone(o[id]) : null; const nx = fn(cur); if (nx === undefined) return cur; if (nx === null) delete o[id]; else o[id] = clone(nx); gravar(c, o); return nx; },
    async batch(ops) {
      const cache = {};
      ops.forEach(x => { const o = cache[x.c] = cache[x.c] || ler(x.c); if (x.op === 'del') delete o[x.id]; else if (x.op === 'update') o[x.id] = Object.assign(o[x.id] || {}, clone(x.data)); else o[x.id] = clone(x.data); });
      Object.keys(cache).forEach(c => gravar(c, cache[c]));
    }
  };
}
async function dbNuvem(cfg) {
  const V = '10.12.2';
  const [{ initializeApp }, fs, au] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`)
  ]);
  const app = initializeApp(cfg);
  await au.signInAnonymously(au.getAuth(app));
  // Cache em memória: o Firestore segura as gravações durante quedas curtas de Wi-Fi e reenvia sozinho.
  const db = fs.getFirestore(app);
  const col = c => fs.collection(db, 'lojas', LOJA, c);
  const ref = (c, id) => fs.doc(db, 'lojas', LOJA, c, String(id));
  const limpo = o => JSON.parse(JSON.stringify(o));
  const arr = s => s.docs.map(d => Object.assign({}, d.data(), { id: d.id }));
  const erro = e => { console.error(e); toast('Sem conexão com a nuvem: ' + (e.code || e.message)); };
  return {
    modo: 'nuvem',
    listen(c, cb, filtro) { const q = filtro ? fs.query(col(c), fs.where(filtro[0], '==', filtro[1])) : col(c); return fs.onSnapshot(q, s => cb(arr(s)), erro); },
    listenDoc(c, id, cb) { return fs.onSnapshot(ref(c, id), d => cb(d.exists() ? Object.assign({}, d.data(), { id: d.id }) : null), erro); },
    async get(c, id) { const d = await fs.getDoc(ref(c, id)); return d.exists() ? Object.assign({}, d.data(), { id: d.id }) : null; },
    async set(c, id, data) { await fs.setDoc(ref(c, id), limpo(data)); },
    async update(c, id, patch) { await fs.updateDoc(ref(c, id), limpo(patch)); },
    async del(c, id) { await fs.deleteDoc(ref(c, id)); },
    async mutate(c, id, fn) {
      return fs.runTransaction(db, async tx => {
        const d = await tx.get(ref(c, id));
        const cur = d.exists() ? d.data() : null;
        const nx = fn(cur ? clone(cur) : null);
        if (nx === undefined) return cur;
        if (nx === null) tx.delete(ref(c, id)); else tx.set(ref(c, id), limpo(nx));
        return nx;
      });
    },
    async batch(ops) {
      for (let i = 0; i < ops.length; i += 400) {
        const b = fs.writeBatch(db);
        ops.slice(i, i + 400).forEach(x => { if (x.op === 'del') b.delete(ref(x.c, x.id)); else if (x.op === 'update') b.update(ref(x.c, x.id), limpo(x.data)); else b.set(ref(x.c, x.id), limpo(x.data)); });
        await b.commit();
      }
    }
  };
}

// ================= estado =================
const S = { cfg: undefined, mesas: {}, cards: [], delivery: [], vendas: [], fretes: [], eu: null, ui: LS.get('st-ui-' + VIEW, {}), f: {} };
const F = S.f; // formulários
function salvarUI() { LS.set('st-ui-' + VIEW, { aba: S.ui.aba }); }
let agendado = false;
function render() {
  if (agendado) return; agendado = true;
  const vai = () => { if (!agendado) return; agendado = false; if (S.arrastando) return; pintar(); };
  requestAnimationFrame(vai); setTimeout(vai, 60); // o setTimeout garante a pintura com a aba em segundo plano
}
function pintar() {
  const app = $('#app'); const a = document.activeElement; let foco = null;
  if (a && a.id && (app.contains(a) || $('#modal').contains(a))) foco = { id: a.id, s: a.selectionStart, e: a.selectionEnd };
  const rolagem = window.scrollY;
  app.innerHTML = TELAS[VIEW] ? TELAS[VIEW]() : TELAS.inicio();
  if (MODAL) pintarModal();
  if (foco) { const el = document.getElementById(foco.id); if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(foco.s, foco.e); } catch (e) {} } }
  window.scrollTo(0, rolagem);
  if (DEPOIS.length) { const fs = DEPOIS.splice(0); fs.forEach(f => f()); }
  posPintura();
}
const DEPOIS = [];
function posPintura() {
  if (VIEW === 'cozinha' || (VIEW === 'base' && S.ui.aba === 'cozinha')) ligarArrastar();
  document.querySelectorAll('[data-qr]').forEach(el => { if (el.dataset.feito === el.dataset.qr) return; el.innerHTML = ''; desenharQR(el, el.dataset.qr); el.dataset.feito = el.dataset.qr; });
}
const cfg = () => S.cfg || {};
const noiteId = () => (cfg().noite && cfg().noite.id) || 'sem-noite';

function assinar(cols) {
  if (cols.includes('config')) DB.listenDoc('config', 'main', d => { S.cfg = d; tentarEu(); render(); });
  if (cols.includes('mesas')) DB.listen('mesas', a => { S.mesas = {}; a.forEach(m => { S.mesas[m.id] = m; }); render(); });
  if (cols.includes('cards')) DB.listen('cards', a => { const antes = S.cards.length; S.cards = a; aoMudarCards(antes); render(); });
  if (cols.includes('delivery')) DB.listen('delivery', a => { S.delivery = a; render(); });
  if (cols.includes('fretes')) DB.listen('fretes', a => { S.fretes = a; render(); });
}
let vendasOff = null, vendasNoite = null;
function assinarVendas(id) {
  if (vendasNoite === id) return; vendasNoite = id;
  if (vendasOff) vendasOff();
  vendasOff = DB.listen('vendas', a => { S.vendas = a.sort((x, y) => (x.fechadaEm || 0) - (y.fechadaEm || 0)); render(); }, ['noiteId', id]);
}

// ================= som, vibração e tela ligada =================
let audio = null;
function bip(vezes) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < (vezes || 1); i++) {
      const o = audio.createOscillator(), g = audio.createGain(); const t = audio.currentTime + i * 0.25;
      o.frequency.value = 880; o.connect(g); g.connect(audio.destination);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.start(t); o.stop(t + 0.22);
    }
  } catch (e) {}
}
let pendAnt = { cozinha: -1, bar: -1 };
function aoMudarCards() {
  const nc = filaDe('cozinha').length, nb = filaDe('bar').length;
  if (VIEW === 'cozinha' && pendAnt.cozinha >= 0 && nc > pendAnt.cozinha) bip(2);
  if (VIEW === 'garcom' && pendAnt.bar >= 0 && nb > pendAnt.bar) { try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {} bip(1); }
  pendAnt = { cozinha: nc, bar: nb };
}
async function telaLigada() { try { if ('wakeLock' in navigator) { const w = await navigator.wakeLock.request('screen'); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') navigator.wakeLock.request('screen').catch(() => {}); }); return w; } } catch (e) {} }

// ================= QR e PIX =================
function desenharQR(el, txt) {
  if (!window.QRCode) { el.innerHTML = '<div class="sub">QR indisponível sem internet</div>'; return; }
  new QRCode(el, { text: txt, width: 520, height: 520, correctLevel: QRCode.CorrectLevel.M });
}
function crc16(s) {
  let crc = 0xFFFF;
  for (let i = 0; i < s.length; i++) { crc ^= s.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF; }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function pixCopiaCola(valor, txid) {
  const p = cfg().pix || {};
  if (!p.chave) return null;
  const f = (id, v) => id + String(v.length).padStart(2, '0') + v;
  const limpa = (s, n) => norm(s).toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, n) || 'SEU TREM';
  let chave = String(p.chave).trim();
  if (/^\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/.test(chave) && soDig(chave).length >= 10 && soDig(chave).length <= 11) chave = '+55' + soDig(chave);
  else if (/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(chave) || /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(chave)) chave = soDig(chave);
  const mai = f('00', 'br.gov.bcb.pix') + f('01', chave);
  let s = f('00', '01') + f('26', mai) + f('52', '0000') + f('53', '986');
  if (valor > 0) s += f('54', r2(valor).toFixed(2));
  s += f('58', 'BR') + f('59', limpa(p.nome, 25)) + f('60', limpa(p.cidade || 'Belo Horizonte', 15));
  s += f('62', f('05', (txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'));
  s += '6304';
  return s + crc16(s);
}

// ================= InfinitePay (checkout por link) =================
async function criarLinkIP(pedido, total) {
  const handle = (cfg().infiniteTag || 'seutrem').replace(/^\$/, '');
  const body = {
    handle,
    items: [{ quantity: 1, price: Math.round(total * 100), description: `Pedido ${pedido.num} - Seu Trem` }],
    order_nsu: pedido.id,
    redirect_url: `${BQ}v=pago&id=${encodeURIComponent(pedido.id)}`
  };
  if (pedido.cliente) body.customer = { name: pedido.cliente.nome, phone_number: '+' + telWa(pedido.cliente.tel) };
  const r = await fetch('https://api.checkout.infinitepay.io/links', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) throw new Error('InfinitePay não gerou o link' + (j.message ? ': ' + j.message : ''));
  return j.url;
}
async function checarIP(q) {
  const handle = (cfg().infiniteTag || 'seutrem').replace(/^\$/, '');
  const r = await fetch('https://api.checkout.infinitepay.io/payment_check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ handle, order_nsu: q.order_nsu, transaction_nsu: q.transaction_nsu, slug: q.slug }) });
  return r.json();
}

// ================= equipe e acesso =================
// Acesso total: gerente e sócio (os poderes de cada um serão refinados depois, a pedido de JP em 23/11)
const ACESSO_TOTAL = ['gerente', 'socio'];
// Hierarquia da equipe (JP, 23/11): sócio > gerente > chefe de chapa e chefe de fritura (painel da cozinha) > gerente de mesas (app do garçom)
const PAPEIS = [['socio', 'Sócio (acesso total)'], ['gerente', 'Gerente (acesso total)'], ['cozinha', 'Chefe de chapa (cozinha)'], ['fritura', 'Chefe de fritura (cozinha)'], ['garcom', 'Gerente de mesas (garçom)']];
const PAPEIS_COZINHA = ['cozinha', 'fritura'];
const ordemPapel = p => { const i = PAPEIS.findIndex(x => x[0] === p); return i < 0 ? 99 : i; };
function equipeOrdenada() { return (cfg().pessoas || []).slice().sort((a, b) => ordemPapel(a.papel) - ordemPapel(b.papel) || a.nome.localeCompare(b.nome, 'pt-BR')); }
// O código pessoal nunca fica gravado em texto: guarda-se só a impressão (SHA-256).
async function hashPin(pin) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('seutrem:' + LOJA + ':' + String(pin).trim()));
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
}
async function pessoaPorPin(pin, papeis) {
  if (!pin) return null;
  const h = await hashPin(pin);
  return (cfg().pessoas || []).find(p => (p.h === h || (p.pin != null && String(p.pin) === String(pin))) && (!papeis || papeis.includes(p.papel)));
}
function carregarEu() {
  const e = LS.get('st-eu-' + LOJA + '-' + VIEW, null);
  if (!e || !S.cfg) return null;
  const p = (cfg().pessoas || []).find(x => x.id === e.id);
  if (!p) return null;
  if (VIEW === 'garcom' && e.token !== (cfg().noite || {}).token) return null;
  return p;
}
function quem() { return (S.eu && S.eu.nome) || 'sistema'; }
function logLinha(o) { return { t: agora(), quem: quem(), o }; }

// ================= cards de produção =================
function cardInicio(c) { return c.status === 'espera' ? c.liberaEm : (c.inicio || c.criadoEm); }
function emFila(c) { return c.status === 'fila' || c.status === 'aguardando' || (c.status === 'espera' && c.liberaEm <= agora()); }
// O bar só vê o pedido de 1º cliente depois do pagamento confirmado; a cozinha vê o card cinza.
function filaDe(setor) { return S.cards.filter(c => c.setor === setor && emFila(c) && !(setor === 'bar' && c.status === 'aguardando')).sort((a, b) => ordemDe(a) - ordemDe(b)); }
function ordemDe(c) { return c.status === 'espera' ? c.liberaEm : c.ordem; }
function corCoz(m) { return m < 20 ? 'verde' : m < 30 ? 'amarelo' : m < 35 ? 'laranja' : 'vermelho'; }
function corBar(m) { return m < 5 ? 'verde' : m < 10 ? 'amarelo' : 'vermelho'; }
function blocosDe(itens, setor) {
  return itens.map(it => {
    const ps = (it.partes || []).filter(p => p.setor === setor);
    if (!ps.length) return null;
    return {
      item: it.uid, combo: it.combo ? it.nome : null,
      linhas: ps.map(p => ({ nome: p.nome, trocas: [...(p.adds || []).map(a => '+ ' + a.nome), p.det, p.obs].filter(Boolean), grupo: p.grupo || 0, chapa: p.chapa || null, discos: p.discos || 0 }))
    };
  }).filter(Boolean);
}
function cardNovo(setor, itens, o) {
  const t = agora();
  return Object.assign({ id: uid(), setor, origem: 'salao', marca: 'st', ref: '', refId: '', criadoEm: t, inicio: t, ordem: t, status: 'fila', blocos: blocosDe(itens, setor), por: quem(), noiteId: noiteId() }, o);
}
async function marcarFeito(id) {
  const c = S.cards.find(x => x.id === id); if (!c) return;
  await DB.update('cards', id, { status: 'feito', feitoEm: agora(), feitoPor: quem() });
  toast((c.ref || 'Card') + ' feito', () => DB.update('cards', id, { status: c.status, feitoEm: null }));
  if (c.origem === 'whatsapp' && c.setor === 'cozinha') {
    const resta = S.cards.filter(x => x.refId === c.refId && x.setor === 'cozinha' && x.id !== id && x.status !== 'feito');
    if (!resta.length) DB.mutate('delivery', c.refId, d => { if (!d) return undefined; if (d.status === 'preparo') d.status = 'pronto'; d.prontoEm = agora(); return d; });
  }
}
async function confirmarPagamento(deliveryId, forma) {
  const d = S.delivery.find(x => x.id === deliveryId);
  await DB.mutate('delivery', deliveryId, x => {
    if (!x) return undefined;
    x.pg = Object.assign({}, x.pg, { confirmado: true, por: quem(), em: agora(), forma: forma || (x.pg && x.pg.forma) || (x.pagamento === 'pix' ? 'PIX' : 'Cartão') });
    if (x.status === 'pagamento') x.status = x.prontoEm ? 'pronto' : 'preparo';
    return x;
  });
  const ops = S.cards.filter(c => c.refId === deliveryId && (c.status === 'aguardando' || c.pgPendente)).map(c => ({ op: 'update', c: 'cards', id: c.id, data: c.status === 'aguardando' ? { status: 'fila', inicio: agora(), pgPendente: false } : { pgPendente: false } }));
  if (ops.length) await DB.batch(ops);
  toast('Pagamento confirmado' + (d ? ' · pedido ' + d.num : ''));
}

// ================= montar item (modal de escolhas) =================
function grupoDe(t) { return { burguer: 0, quesadilla: 1, espeto: 2, sobremesaFamilia: 3 }[t] || 0; }
function addsObj(cods) { return (cods || []).map(c => ({ cod: c, nome: P[c].nome, preco: P[c].preco })); }
function parteBurg(b, s, g) {
  const adds = addsObj(s.adds);
  return { nome: b.nome, setor: 'cozinha', chapa: 'burguer', discos: (b.discos || 1) + adds.filter(a => P[a.cod].disco).length, adds, obs: s.obs || '', grupo: g || 0 };
}
function bebidaCombo(c, MI) {
  const sab = MI.sabor ? ' · ' + MI.sabor : '';
  if (c.bebida === 'sucoRefri') return (MI.bebTipo || 'Suco 500 ml') + sab;
  if (c.bebida === 'soda') return 'Soda italiana' + sab;
  if (c.bebida === 'cerveja') return 'Cerveja' + sab;
  return 'Drink da casa' + sab;
}
function rotuloCombo(c) { return { sucoRefri: 'combo', soda: 'combo soda', cerveja: 'combo cerveja', drink: 'combo drink' }[c.bebida] || 'combo'; }
function partesCombo(c, MI) {
  return [
    { nome: 'Fritas (combo)', setor: 'cozinha', adds: [], grupo: 1 },
    { nome: MI.doce || 'Super brownie', setor: 'bar', adds: [], grupo: 1 },
    { nome: bebidaCombo(c, MI), setor: 'bar', adds: [], grupo: 1, bebida: true }
  ];
}
function novoMI(p) {
  const MI = { p, sel: [], combo: null, doce: null, bebTipo: null, sabor: '', obs: '', escolha: null, preco: null };
  const n = p.tipo === 'comboMesa' ? p.partes.length : 1;
  for (let i = 0; i < n; i++) MI.sel.push({ burg: p.tipo === 'burguer' ? p.cod : null, quesa: null, adds: [], obs: '' });
  if (p.tipo === 'comboBurguer') MI.combo = p.cod;
  if (p.tipo === 'comboFixo') MI.sel = [{ adds: [], obs: '' }];
  return MI;
}
function faltaMI(MI) {
  const p = MI.p, f = [];
  if (p.tipo === 'comboBurguer' && !MI.sel[0].burg) f.push('o burguer');
  if (p.tipo === 'comboMesa') p.partes.forEach((d, i) => { if (d.t === 'burguer' && !MI.sel[i].burg) f.push('o burguer ' + (i + 1)); if (d.t === 'quesadilla' && !MI.sel[i].quesa) f.push('a quesadilla'); });
  if (MI.combo) { if (!MI.doce) f.push('o doce do combo'); if (P[MI.combo].bebida === 'sucoRefri' && !MI.bebTipo) f.push('suco ou refri'); }
  if (p.escolha && !MI.escolha) f.push(p.escolha.titulo.toLowerCase());
  if (p.precoLivre && !(MI.preco >= p.precoLivre[0])) f.push('o preço do drink');
  return f;
}
function montarItem(MI) {
  const p = MI.p; const partes = []; let base = p.preco, acresc = 0, nome = p.nome, combo = false;
  if (p.tipo === 'burguer') {
    partes.push(parteBurg(p, MI.sel[0], 0));
    if (MI.combo) { const c = P[MI.combo]; base += c.preco; combo = true; nome = p.nome + ' + ' + rotuloCombo(c); partes.push(...partesCombo(c, MI)); }
  } else if (p.tipo === 'comboBurguer') {
    const b = P[MI.sel[0].burg]; base = b.preco + p.preco; combo = true; nome = b.nome + ' + ' + rotuloCombo(p);
    partes.push(parteBurg(b, MI.sel[0], 0), ...partesCombo(p, MI));
  } else if (p.tipo === 'comboMesa') {
    combo = p.partes.length > 1;
    p.partes.forEach((d, i) => {
      const s = MI.sel[i], g = grupoDe(d.t);
      if (d.t === 'burguer') { const b = P[s.burg]; if (!p.semPremium) acresc += (C.ACRESCIMO_COMBO_MESA[b.cod] || 0); partes.push(parteBurg(b, s, g)); }
      else if (d.t === 'quesadilla') partes.push({ nome: 'Quesadilla ' + s.quesa, setor: 'cozinha', chapa: 'quesadilla', adds: [], det: 'sem fritas', obs: s.obs || '', grupo: g });
      else if (d.t === 'espeto') partes.push({ nome: 'Espetinho', setor: 'cozinha', chapa: 'cogumelo', adds: addsObj(s.adds), espeto: true, det: 'sem fritas', obs: s.obs || '', grupo: g });
      else if (d.t === 'sobremesaFamilia') partes.push({ nome: 'Sobremesa brownie & açaí', setor: 'bar', adds: [], grupo: g });
    });
    if (!combo) nome = p.nome.replace('(combo da mesa)', '').trim() + (partes[0] && p.partes[0].t === 'burguer' ? ': ' + partes[0].nome : partes[0] && p.partes[0].t === 'quesadilla' ? ': ' + partes[0].nome.replace('Quesadilla ', '') : '') + ' (combo da mesa)';
  } else if (p.tipo === 'comboFixo') {
    combo = true;
    p.fixas.forEach((x, i) => partes.push({ nome: x.nome, setor: x.setor, chapa: x.chapa || null, discos: x.chapa === 'burguer' ? 1 : 0, adds: x.burguer ? addsObj(MI.sel[0].adds) : [], obs: x.burguer ? MI.sel[0].obs : '', grupo: i }));
  } else if (p.tipo === 'bebida') {
    if (p.precoLivre) base = +MI.preco;
    if (MI.sabor) nome = p.nome + ' · ' + MI.sabor;
    partes.push({ nome: p.nome + (MI.sabor ? ' · ' + MI.sabor : ''), setor: 'bar', adds: [], obs: MI.obs || '' });
  } else {
    partes.push({ nome: p.nome, setor: p.setor, chapa: p.chapa || null, discos: 0, adds: addsObj(MI.sel[0].adds), espeto: !!p.espeto, det: MI.escolha || '', obs: MI.sel[0].obs || MI.obs || '' });
  }
  return { uid: uid(), cod: p.cod, nome, base: r2(base), acresc, combo, partes, tipo: p.tipo, sel: false, comPrato: false, enviado: false, cards: [], por: quem(), ts: agora() };
}

// ================= modal =================
let MODAL = null; // { render: fn -> html, ...estado }
function abrirModal(m) { MODAL = m; pintarModal(); }
function fecharModal() { MODAL = null; $('#modal').innerHTML = ''; }
function pintarModal() {
  if (!MODAL) return;
  const a = document.activeElement; let foco = null;
  if (a && a.id && $('#modal').contains(a)) foco = { id: a.id, s: a.selectionStart, e: a.selectionEnd };
  const cx = $('#modal .caixa'); const sc = cx ? cx.scrollTop : 0;
  $('#modal').innerHTML = `<div class="fundo" data-a="fundoModal"><div class="caixa">${MODAL.render()}</div></div>`;
  const ncx = $('#modal .caixa'); if (ncx) ncx.scrollTop = sc;
  if (foco) { const el = document.getElementById(foco.id); if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(foco.s, foco.e); } catch (e) {} } }
  else if (MODAL.foco) { const el = document.getElementById(MODAL.foco); MODAL.foco = null; if (el) el.focus(); }
  document.querySelectorAll('#modal [data-qr]').forEach(el => { el.innerHTML = ''; desenharQR(el, el.dataset.qr); });
}
function pedirPIN(titulo, papeis, cb) {
  F.pinM = '';
  abrirModal({
    foco: 'pinM',
    render: () => `<h2>${esc(titulo)}</h2><p class="sub">Digite o código de 4 números de quem autoriza. Fica registrado com nome e hora.</p>
      <div class="campo"><input id="pinM" class="inp" data-f="pinM" inputmode="numeric" maxlength="6" type="password" autocomplete="off" value="${esc(F.pinM)}" data-enter="okPin"></div>
      <div class="linha"><button class="bt" data-a="fecharModal">Cancelar</button><button class="bt pri" data-a="okPin">Confirmar</button></div>`,
    async okPin() { const p = await pessoaPorPin(F.pinM, papeis); if (!p) { toast('Código não confere'); return; } fecharModal(); cb(p); }
  });
}
// Pede o código do gerente/sócio e um motivo (antifraude)
const MOTIVOS = ['Cliente desistiu', 'Lançado errado', 'Aberta por engano', 'Saiu errado da cozinha', 'Cortesia da casa', 'Outro'];
function pedirAutorizacao(titulo, cb) {
  F.pinM = ''; F.motivoM = ''; let motivo = null;
  abrirModal({
    foco: 'pinM',
    render: () => `<h2>${esc(titulo)}</h2><p class="sub">Só gerente ou sócio. Fica registrado quem pediu, quem autorizou, o motivo e a hora, e aparece na conferência da noite.</p>
      <div class="chips" style="margin-bottom:10px">${MOTIVOS.map(m => `<button class="chip ${motivo === m ? 'on' : ''}" data-a="mot" data-c="${m}">${m}</button>`).join('')}</div>
      ${motivo === 'Outro' ? `<input id="motivoM" class="inp" style="margin-bottom:10px" data-f="motivoM" placeholder="Qual o motivo?" value="${esc(F.motivoM)}">` : ''}
      <div class="campo"><label for="pinM">Código do gerente ou sócio</label><input id="pinM" class="inp" data-f="pinM" inputmode="numeric" maxlength="6" type="password" autocomplete="off" value="${esc(F.pinM)}" data-enter="okA"></div>
      <div class="linha"><button class="bt" data-a="fecharModal">Voltar</button><button class="bt verm pri" data-a="okA">Autorizar</button></div>`,
    mot(d) { motivo = d.c; pintarModal(); },
    async okA() {
      const m = motivo === 'Outro' ? (F.motivoM || '').trim() : motivo;
      if (!m) { toast('Escolha o motivo'); return; }
      const p = await pessoaPorPin(F.pinM, ACESSO_TOTAL);
      if (!p) { toast('Código não confere'); return; }
      fecharModal(); cb(p, m);
    }
  });
}

// Modal de escolha do item (garçom, base e cliente)
function modalItem(p, onAdd, opts) {
  opts = opts || {};
  const MI = novoMI(p);
  abrirModal({
    MI, foco: p.pedeSabor ? 'saborMI' : null,
    render() {
      const falta = faltaMI(MI);
      const it = falta.length ? null : montarItem(MI);
      let h;
      if (opts.cliente) {
        const k = CATS_PEDIDO[p.cat] || {}; const inc = inclusosDe(p);
        h = `<div class="md-hero" style="background:${k.bg};color:${k.cor}">${ic(icProd(p))}<button class="bt-ic md-x" data-a="fecharModal">${ic('close')}</button>${p.selo ? `<span class="selo">${esc(p.selo)}</span>` : ''}</div>
          <h2 style="margin-top:14px">${esc(p.nome)}</h2>${p.desc ? `<p class="md-desc">${esc(p.desc)}</p>` : ''}
          ${inc ? htmlInclusos(inc, true) : ''}${p.economia ? `<div class="pc-eco" style="margin:6px 0 4px">${esc(p.economia)}</div>` : ''}`;
      } else {
        h = `<div class="entre"><h2><span class="cod">${p.cod}</span> ${esc(p.nome)}</h2><button class="bt-ic" data-a="fecharModal">${ic('close')}</button></div>`;
        if (p.desc) h += `<p class="sub">${esc(p.desc)}</p>`;
      }
      const chipsAdds = (i, espeto, burg) => {
        const lista = ADICIONAIS.filter(a => burg || (a.cod !== 72 && a.cod !== 73));
        return `<div class="sub" style="margin:8px 0 6px">Adicionais ${espeto ? '(no espeto: 3 por R$ 10)' : '(2 por R$ 10 · 3 por R$ 12)'}</div><div class="chips">` +
          lista.map(a => `<button class="chip ${MI.sel[i].adds.includes(a.cod) ? 'on' : ''}" data-a="miAdd" data-i="${i}" data-c="${a.cod}">${esc(a.nome)} <span class="sub">${a.preco}</span></button>`).join('') + '</div>' +
          `<input id="obsMI${i}" class="inp" style="margin-top:8px" placeholder="Troca ou observação (ex.: sem cebola)" data-f="obsMI${i}" data-mi="${i}" value="${esc(MI.sel[i].obs)}">`;
      };
      const escolheBurg = (i) => `<div class="chips">` + BURGUERS.filter(b => !(p.semPremium && C.ACRESCIMO_COMBO_MESA[b.cod])).map(b => `<button class="chip ${MI.sel[i].burg === b.cod ? 'on' : ''}" data-a="miBurg" data-i="${i}" data-c="${b.cod}"><b>${b.cod}</b> ${esc(b.nome)}${opts.comboMesa && C.ACRESCIMO_COMBO_MESA[b.cod] ? ' <span class="sub">+' + C.ACRESCIMO_COMBO_MESA[b.cod] + '</span>' : ''}</button>`).join('') + '</div>';
      if (p.tipo === 'burguer' || p.tipo === 'comboBurguer') {
        if (p.tipo === 'comboBurguer') h += `<div class="passo ${MI.sel[0].burg ? '' : 'falta'}"><div class="pt">${ic('lunch_dining')} Qual burguer?</div>${escolheBurg(0)}</div>`;
        if (p.tipo === 'burguer') {
          h += `<div class="passo"><div class="pt">${ic('fastfood')} Completar com o combo?</div><div class="combo-ops">
            <button class="combo-op ${MI.combo === null ? 'on' : ''}" data-a="miCombo" data-c=""><b>Só o burguer</b><small>sem combo</small></button>` +
            [30, 31, 32, 33].map(c => { const pc = P[c]; return `<button class="combo-op ${MI.combo === c ? 'on' : ''}" data-a="miCombo" data-c="${c}"><b>+ ${R(pc.preco)}</b>${htmlInclusos(inclusoCombo(pc))}${pc.economia ? `<small class="eco">${esc(pc.economia.split('·').pop().trim())}</small>` : ''}</button>`; }).join('') + '</div></div>';
        }
        if (MI.combo) {
          const c = P[MI.combo];
          h += `<div class="passo ${MI.doce && (c.bebida !== 'sucoRefri' || MI.bebTipo) ? '' : 'falta'}"><div class="pt">${ic('local_bar')} No combo: fritas + doce + bebida</div>
            <div class="sub" style="margin-bottom:6px">Doce</div><div class="chips">${C.DOCES.map(d => `<button class="chip ${MI.doce === d ? 'on' : ''}" data-a="miDoce" data-c="${esc(d)}">${esc(d)}</button>`).join('')}</div>
            ${c.bebida === 'sucoRefri' ? `<div class="sub" style="margin:10px 0 6px">Bebida</div><div class="chips">${['Suco 500 ml', 'Refrigerante 600 ml'].map(d => `<button class="chip ${MI.bebTipo === d ? 'on' : ''}" data-a="miBeb" data-c="${d}">${d}</button>`).join('')}</div>` : ''}
            <input id="saborMI" class="inp" style="margin-top:8px" placeholder="${c.bebida === 'drink' ? 'Qual drink?' : c.bebida === 'cerveja' ? 'Qual cerveja?' : 'Sabor'}" data-f="saborMI" value="${esc(MI.sabor)}"></div>`;
        }
        if (MI.sel[0].burg) h += `<div class="passo"><div class="pt">${ic('add_circle')} ${esc(P[MI.sel[0].burg].nome)}: ${opts.cliente ? 'do seu jeito' : 'do jeito do cliente'}</div>${chipsAdds(0, false, true)}</div>`;
      } else if (p.tipo === 'comboMesa') {
        p.partes.forEach((d, i) => {
          const ok = d.t === 'burguer' ? MI.sel[i].burg : d.t === 'quesadilla' ? MI.sel[i].quesa : true;
          h += `<div class="passo ${ok ? '' : 'falta'}">`;
          if (d.t === 'burguer') { opts.comboMesa = true; h += `<div class="pt">${ic('lunch_dining')} Burguer ${p.partes.filter(x => x.t === 'burguer').length > 1 ? (p.partes.slice(0, i + 1).filter(x => x.t === 'burguer').length) : ''}</div>${escolheBurg(i)}${MI.sel[i].burg ? chipsAdds(i, false, true) : ''}`; }
          else if (d.t === 'quesadilla') h += `<div class="pt">${ic('local_pizza')} Quesadilla (sem fritas)</div><div class="chips">${C.QUESADILLAS.map(q => `<button class="chip ${MI.sel[i].quesa === q ? 'on' : ''}" data-a="miQuesa" data-i="${i}" data-c="${q}">${q}</button>`).join('')}</div><input id="obsMI${i}" class="inp" style="margin-top:8px" placeholder="Observação" data-f="obsMI${i}" data-mi="${i}" value="${esc(MI.sel[i].obs)}">`;
          else if (d.t === 'espeto') h += `<div class="pt">${ic('kebab_dining')} Espetinho (sem fritas)</div>${chipsAdds(i, true, false)}`;
          else h += `<div class="pt">${ic('icecream')} Sobremesa brownie & açaí <span class="tag cinza">bar</span></div>`;
          h += '</div>';
        });
      } else if (p.tipo === 'comboFixo') {
        h += `<div class="passo"><div class="pt">${ic('star')} Vem no combo</div>${p.fixas.map(x => `<div>• ${esc(x.nome)} ${x.setor === 'bar' ? '<span class="tag cinza">bar</span>' : ''}</div>`).join('')}</div>`;
        h += `<div class="passo"><div class="pt">${ic('add_circle')} Burguer Circuito 26: do jeito do cliente</div>${chipsAdds(0, false, true)}</div>`;
      } else if (p.tipo === 'bebida') {
        h += `<div class="passo"><div class="pt">${ic('local_bar')} ${esc(p.pedeSabor)}</div><input id="saborMI" class="inp" data-f="saborMI" value="${esc(MI.sabor)}" data-enter="miOk" placeholder="${esc(p.pedeSabor)} (opcional)">`;
        if (p.precoLivre) { const ps = []; for (let v = p.precoLivre[0]; v <= p.precoLivre[1]; v++) ps.push(v); h += `<div class="sub" style="margin:10px 0 6px">Preço</div><div class="chips">${ps.map(v => `<button class="chip ${MI.preco === v ? 'on' : ''}" data-a="miPreco" data-c="${v}">${v}</button>`).join('')}</div>`; }
        h += '</div>';
      } else {
        if (p.escolha) h += `<div class="passo ${MI.escolha ? '' : 'falta'}"><div class="pt">${esc(p.escolha.titulo)}</div><div class="chips">${p.escolha.opcoes.map(o => `<button class="chip ${MI.escolha === o ? 'on' : ''}" data-a="miEsc" data-c="${esc(o)}">${esc(o)}</button>`).join('')}</div></div>`;
        if (p.tipo === 'aperitivo') h += `<div class="passo"><div class="pt">${ic('add_circle')} Do jeito do cliente</div>${chipsAdds(0, !!p.espeto, false)}</div>`;
        else h += `<input id="obsMI0" class="inp" placeholder="Observação (opcional)" data-f="obsMI0" data-mi="0" value="${esc(MI.sel[0].obs)}" data-enter="miOk">`;
      }
      h += `<div class="entre rodape-m"><div><div class="sub">${falta.length ? 'Falta escolher: ' + esc(falta.join(', ')) : 'Preço'}</div><div style="font-size:22px;font-weight:500">${it ? R(precoItem(it)) : '—'}</div></div>
        <button class="bt pri grande" data-a="miOk" ${falta.length ? 'disabled' : ''}>${ic('add')} ${esc(opts.botao || 'Adicionar')}</button></div>`;
      return h;
    },
    miAdd(d) { const s = MI.sel[+d.i]; const c = +d.c; s.adds = s.adds.includes(c) ? s.adds.filter(x => x !== c) : s.adds.concat(c); pintarModal(); },
    miBurg(d) { MI.sel[+d.i].burg = +d.c; pintarModal(); },
    miQuesa(d) { MI.sel[+d.i].quesa = d.c; pintarModal(); },
    miCombo(d) { MI.combo = d.c ? +d.c : null; pintarModal(); },
    miDoce(d) { MI.doce = d.c; pintarModal(); },
    miBeb(d) { MI.bebTipo = d.c; pintarModal(); },
    miEsc(d) { MI.escolha = d.c; pintarModal(); },
    miPreco(d) { MI.preco = +d.c; pintarModal(); },
    miOk() { if (faltaMI(MI).length) return; const it = montarItem(MI); fecharModal(); onAdd(it); },
    campo(k, v, el) { if (k === 'saborMI') MI.sabor = v; else if (el.dataset.mi != null) MI.sel[+el.dataset.mi].obs = v; }
  });
}

// ================= busca de produtos =================
function buscar(q) {
  q = norm(q); if (!q) return [];
  const num = /^\d+$/.test(q) ? +q : null;
  const res = [];
  C.itens.forEach(p => {
    let sc = 0; const n = norm(p.nome);
    if (num != null) { if (p.cod === num) sc = 100; else if (String(p.cod).indexOf(q) === 0) sc = 50; }
    const m = q.match(/^(\d+)\s+(.+)$/); const tq = m ? m[2] : q;
    if (m && p.cod === +m[1]) sc = 100;
    if (n.indexOf(tq) === 0) sc = Math.max(sc, 80); else if (n.indexOf(tq) > 0) sc = Math.max(sc, 60);
    else { const ts = tq.split(' '); if (ts.every(t => n.indexOf(t) >= 0)) sc = Math.max(sc, 40); }
    if (sc) res.push([sc, p]);
  });
  return res.sort((a, b) => b[0] - a[0] || a[1].cod - b[1].cod).slice(0, 8).map(x => x[1]);
}
function precisaModal(p) { return !(p.tipo === 'simples' && !p.escolha); }

// ================= ações (cliques) =================
const A = {};
const CH = {};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const nome = el.dataset.a;
  if (nome === 'fundoModal') { if (e.target === el) fecharModal(); return; }
  if (MODAL && MODAL[nome] && $('#modal').contains(el)) { e.preventDefault(); MODAL[nome](el.dataset, el, e); return; }
  if (A[nome]) { e.preventDefault(); A[nome](el.dataset, el, e); }
});
document.addEventListener('input', e => {
  const el = e.target; if (!el.dataset || !el.dataset.f) return;
  F[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
  if (MODAL && MODAL.campo && $('#modal').contains(el)) MODAL.campo(el.dataset.f, el.value, el);
  if (el.dataset.vivo != null) render();
});
document.addEventListener('change', e => {
  const el = e.target; if (el.dataset && el.dataset.f && el.type === 'checkbox') { F[el.dataset.f] = el.checked; render(); }
  if (el.dataset && el.dataset.ch && CH[el.dataset.ch]) CH[el.dataset.ch](el, el.dataset);
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return; const el = e.target; if (!el.dataset || !el.dataset.enter) return;
  e.preventDefault(); const n = el.dataset.enter;
  if (MODAL && MODAL[n] && $('#modal').contains(el)) MODAL[n](el.dataset, el); else if (A[n]) A[n](el.dataset, el);
});
A.fecharModal = () => fecharModal();
A.aba = d => { S.ui.aba = d.c; S.ui.mesa = null; salvarUI(); window.scrollTo(0, 0); render(); };
A.sair = () => { LS.del('st-eu-' + LOJA + '-' + VIEW); S.eu = null; render(); };
A.copiar = d => { try { navigator.clipboard.writeText(d.c); toast('Copiado'); } catch (e) { prompt('Copie:', d.c); } };
A.link = d => abrir(d.c);

// ================= login, primeira configuração =================
function telaLogin(titulo, papeis, extra) {
  return `<div class="pag-estreita" style="padding-top:48px"><div class="card plano" style="text-align:center">
    <div class="logo" style="margin:0 auto 12px;width:56px;height:56px;border-radius:50%;background:var(--verde-v);color:#fff;display:grid;place-items:center;font-weight:900;font-size:22px">ST</div>
    <h1>${esc(titulo)}</h1><p class="sub">${esc(NOME_CURTO)} · digite o seu código pessoal de 4 números</p>${extra || ''}
    <input id="pinL" class="inp" style="text-align:center;font-size:28px;letter-spacing:.4em;max-width:220px;margin:12px auto" data-f="pinL" inputmode="numeric" type="password" maxlength="6" autocomplete="off" value="${esc(F.pinL || '')}" data-enter="entrar" data-papeis="${papeis.join(',')}">
    <div><button class="bt pri grande" data-a="entrar" data-papeis="${papeis.join(',')}">Entrar</button></div>
    <p class="sub" style="margin-top:14px">${DB.modo === 'local' ? 'Modo local (ensaio neste navegador)' : 'Conectado à nuvem'}</p></div></div>`;
}
A.entrar = async d => {
  const p = await pessoaPorPin(F.pinL, d.papeis.split(','));
  if (!p) { toast('Código não confere'); return; }
  F.pinL = ''; S.eu = p;
  LS.set('st-eu-' + LOJA + '-' + VIEW, { id: p.id, token: (cfg().noite || {}).token });
  if (VIEW === 'cozinha') { telaLigada(); bip(1); }
  render();
};
function telaConfigInicial() {
  return `<div class="pag-estreita"><div class="card plano"><h1>Primeira configuração</h1>
    <p class="sub">Uma vez só. Depois tudo isso se ajusta em "Equipe e loja".</p>
    ${campo('Seu nome', 'cNome', 'João Paulo')}${campo('Seu código pessoal (4 números)', 'cPin', '', 'numeric')}
    ${campo('WhatsApp da casa (com DDD)', 'cWa', '31 9…', 'tel')}${campo('Chave PIX da casa', 'cPix', 'CNPJ, telefone, e-mail ou aleatória')}
    ${campo('Nome no PIX (como aparece no banco)', 'cPixNome', 'SEU TREM')}${campo('Cidade do PIX', 'cPixCid', 'Belo Horizonte')}
    ${campo('InfiniteTag (InfinitePay)', 'cTag', 'seutrem')}${campo('Endereço de retirada (Uber Flash)', 'cEnd', 'Rua…, nº, bairro')}
    <button class="bt pri grande bloco" data-a="criarConfig">Criar o sistema</button></div></div>`;
}
function campo(rot, k, ph, modo, tipo) {
  return `<div class="campo"><label for="${k}">${esc(rot)}</label><input id="${k}" class="inp" data-f="${k}" placeholder="${esc(ph || '')}" ${modo ? `inputmode="${modo}"` : ''} type="${tipo || 'text'}" value="${esc(F[k] == null ? '' : F[k])}"></div>`;
}
function novaNoiteObj() { const d = new Date(); const id = d.toISOString().slice(0, 10) + '-' + uid().slice(0, 4); return { id, token: uid() + uid(), inicio: agora() }; }
A.criarConfig = async () => {
  if (!F.cNome || !/^\d{4}$/.test(F.cPin || '')) { toast('Preencha o nome e um código de 4 números'); return; }
  const eu = { id: uid(), nome: F.cNome.trim(), h: await hashPin(F.cPin), papel: 'gerente' };
  const c = {
    nome: NOME_CURTO, frase: FRASE, mesas: 14, minPrato: 15,
    pessoas: [eu], whatsapp: F.cWa || '', endereco: F.cEnd || '',
    pix: { chave: F.cPix || '', nome: F.cPixNome || 'SEU TREM', cidade: F.cPixCid || 'Belo Horizonte' },
    infiniteTag: (F.cTag || 'seutrem').replace(/^\$/, ''), noite: novaNoiteObj(), noites: [], seqPedido: 0, criadoEm: agora()
  };
  await DB.set('config', 'main', c);
  S.eu = eu; LS.set('st-eu-' + LOJA + '-base', { id: eu.id });
  toast('Sistema criado'); render();
};

// ================= mesas (compartilhado: garçom e base) =================
function listaMesas() {
  const n = cfg().mesas || 14; const ids = [];
  for (let i = 1; i <= n; i++) ids.push(String(i));
  Object.keys(S.mesas).filter(id => !ids.includes(id)).sort().forEach(id => ids.push(id));
  return ids;
}
function corMesa(id) {
  const cs = S.cards.filter(c => c.refId === id && c.origem === 'salao' && c.setor === 'cozinha' && emFila(c) && c.status !== 'aguardando');
  if (!cs.length) return null;
  return corCoz(minDesde(Math.min(...cs.map(cardInicio))));
}
function telaSlots() {
  const ids = listaMesas();
  let h = '<div class="slots">';
  ids.forEach(id => {
    const m = S.mesas[id];
    if (!m) { h += `<button class="slot livre" data-a="abrirMesa" data-id="${id}"><div class="num">${esc(rotuloMesa(id))}</div><div class="inf">livre</div></button>`; return; }
    const cor = corMesa(id); const tot = subtotal(m.itens); const pend = itensValidos(m.itens).filter(i => !i.enviado).length;
    h += `<button class="slot" data-a="verMesa" data-id="${id}"><div class="num">${esc(m.label || rotuloMesa(id))} ${cor ? `<span class="ponto c-${cor}"></span>` : ''}</div>
      <div class="nomes">${esc((m.nomes || []).join(', ') || '—')}</div>
      <div class="inf">${R(tot)} · ${minDesde(m.abertaEm)} min${pend ? ` · <b style="color:var(--laranja)">${pend} a enviar</b>` : ''}</div></button>`;
  });
  h += `<button class="slot novo" data-a="novoSlot">${ic('add')} Slot extra (fila)</button></div>`;
  return h;
}
function rotuloMesa(id) { return /^\d+$/.test(id) ? 'Mesa ' + id : (S.mesas[id] && S.mesas[id].label) || id; }
A.abrirMesa = d => modalAbrirMesa(d.id);
A.novoSlot = () => { const n = Object.keys(S.mesas).filter(k => /^F/.test(k)).length + 1; let id = 'F' + n; while (S.mesas[id]) id = 'F' + (+id.slice(1) + 1); modalAbrirMesa(id, 'Fila ' + id.slice(1)); };
function modalAbrirMesa(id, label) {
  F.nomesM = ''; F.labelM = label || '';
  abrirModal({
    foco: 'nomesM',
    render: () => `<h2>${label ? 'Novo slot' : 'Abrir ' + esc(rotuloMesa(id))}</h2>
      ${label ? campo('Nome do slot', 'labelM', 'Fila 1') : ''}
      <div class="campo"><label for="nomesM">Quem está na mesa? (separe por vírgula)</label>
      <input id="nomesM" class="inp" data-f="nomesM" placeholder="Ana, Bruno" value="${esc(F.nomesM)}" data-enter="okAbrir" autocomplete="off"></div>
      <p class="sub">Os nomes aparecem no slot e dão o número de pessoas da divisão da conta.</p>
      <div class="linha"><button class="bt" data-a="fecharModal">Cancelar</button><button class="bt pri" data-a="okAbrir">Abrir mesa</button></div>`,
    async okAbrir() {
      const nomes = (F.nomesM || '').split(',').map(s => s.trim()).filter(Boolean).map(s => s[0].toUpperCase() + s.slice(1));
      const t = agora();
      const r = await DB.mutate('mesas', id, cur => cur ? undefined : { id, label: label ? (F.labelM || label) : '', nomes, itens: [], pagamentos: [], dez: true, clientes: [], abertaEm: t, por: quem(), log: [logLinha('abriu a mesa' + (nomes.length ? ' (' + nomes.join(', ') + ')' : ''))] });
      fecharModal(); S.ui.mesa = id; S.f.busca = ''; render();
      if (r && r.abertaEm !== t) toast('Essa mesa já estava aberta');
    }
  });
}
A.verMesa = d => { S.ui.mesa = d.id; F.busca = ''; window.scrollTo(0, 0); render(); };
A.voltarMesas = () => { S.ui.mesa = null; render(); };

function statusItem(it) {
  if (!it.enviado) return '';
  const cs = (it.cards || []).map(id => S.cards.find(c => c.id === id)).filter(Boolean);
  if (!cs.length) return '<span class="tag cinza">enviado</span>';
  const pend = cs.filter(c => c.status !== 'feito');
  if (!pend.length) return '<span class="tag ok">pronto ✓</span>';
  return pend.map(c => {
    if (c.status === 'espera' && c.liberaEm > agora()) return `<span class="tag cinza">bebida com o prato · ${Math.ceil((c.liberaEm - agora()) / 60000)} min</span>`;
    const m = minDesde(cardInicio(c)); const cor = c.setor === 'bar' ? corBar(m) : corCoz(m);
    return `<span class="tag" style="background:#fff;border:1px solid var(--borda)"><span class="ponto c-${cor}"></span> ${c.setor === 'bar' ? 'bar' : 'cozinha'} ${m} min</span>`;
  }).join(' ');
}
function telaMesa(id) {
  const m = S.mesas[id];
  if (!m) return `<div class="vazio">Esta mesa foi fechada.<br><br><button class="bt" data-a="voltarMesas">Voltar às mesas</button></div>`;
  const val = itensValidos(m.itens); const pend = val.filter(i => !i.enviado); const env = val.filter(i => i.enviado);
  const cor = corMesa(id);
  let h = `<div class="mesa-topo"><button class="bt-ic" data-a="voltarMesas">${ic('arrow_back')}</button>
    <h1 style="margin:0;flex:1">${esc(m.label || rotuloMesa(id))} ${cor ? `<span class="ponto c-${cor}"></span>` : ''}</h1>
    <button class="bt ton" data-a="qrCliente" data-id="${id}">${ic('qr_code_2')} QR</button></div>
    <div class="nomes-mesa">${(m.nomes || []).map(n => `<span class="nome-p">${esc(n)}</span>`).join('')}<button class="chip" data-a="editarNomes" data-id="${id}">${ic('edit')} nomes</button>
    ${(m.clientes || []).length ? `<span class="tag whatsapp">${ic('chat')} ${m.clientes.length} no WhatsApp</span>` : ''}</div>
    <div class="busca">${ic('search')}<input id="busca" data-f="busca" data-vivo placeholder="Código ou nome (ex.: 6 ou 3 Queij)" autocomplete="off" value="${esc(F.busca || '')}" data-enter="addPrimeiro" data-id="${id}" inputmode="search">
    ${F.busca ? `<button class="bt-ic" data-a="limparBusca">${ic('close')}</button>` : ''}</div>`;
  const res = buscar(F.busca);
  if (res.length) h += `<div class="resultados">${res.map(p => `<div class="res" data-a="addProd" data-id="${id}" data-c="${p.cod}"><span class="cod">${p.cod}</span><span class="nm">${esc(p.nome)}</span><span class="pr">${p.precoLivre ? '17–30' : R(p.preco)}</span></div>`).join('')}</div>`;
  if (pend.length) {
    h += `<div class="secao-t">A enviar · marque o que sai primeiro</div><div class="itens">` + pend.map(it => `
      <div class="item"><input type="checkbox" class="ck" data-ch="selItem" data-id="${id}" data-u="${it.uid}" ${it.sel ? 'checked' : ''}>
        <div class="corpo"><div class="nm">${esc(it.nome)}</div>${descItem(it).map(l => `<div class="troca">${esc(l)}</div>`).join('')}
        ${temSetor(it, 'bar') ? `<label class="sub" style="display:flex;align-items:center;gap:6px;margin-top:4px"><input type="checkbox" data-ch="comPrato" data-id="${id}" data-u="${it.uid}" ${it.comPrato ? 'checked' : ''}> bebida vai com o prato (${cfg().minPrato || 15} min)</label>` : ''}</div>
        <div class="pr">${R(precoItem(it))}</div><button class="bt-ic" data-a="tirarItem" data-id="${id}" data-u="${it.uid}">${ic('close')}</button></div>`).join('') + '</div>';
    h += `<div class="barra-acao"><button class="bt pri grande" style="flex:1" data-a="enviarMesa" data-id="${id}">${ic('send')} Enviar ${pend.length} ${pend.length > 1 ? 'itens' : 'item'}</button></div>
      <p class="sub" style="margin-top:-4px">${esc(previaEnvio(pend))}</p>`;
  }
  if (env.length) {
    h += `<div class="secao-t">Na produção e servidos</div><div class="itens">` + env.map(it => `
      <div class="item enviado"><div class="corpo"><div class="nm">${esc(it.nome)}</div>${descItem(it).map(l => `<div class="troca">${esc(l)}</div>`).join('')}<div style="margin-top:4px">${statusItem(it)}</div></div>
      <div class="pr">${R(precoItem(it))}</div><button class="bt-ic" data-a="cancelarItem" data-id="${id}" data-u="${it.uid}" title="Cancelar (pede código do gerente)">${ic('delete')}</button></div>`).join('') + '</div>';
  }
  if (!val.length) h += `<div class="vazio">${ic('restaurant_menu')}<br>Digite o código ou o nome do prato acima.</div>`;
  const tot = subtotal(m.itens); const pago = (m.pagamentos || []).reduce((s, p) => s + p.valor, 0);
  h += `<div class="card" style="margin-top:16px"><div class="total-linha"><span>Subtotal</span><b>${R(tot)}</b></div>
    ${pago ? `<div class="total-linha"><span>Já recebido</span><span>${R(pago)}</span></div>` : ''}
    <div class="linha" style="margin-top:10px"><button class="bt" data-a="conta" data-id="${id}">${ic('receipt_long')} Conta</button><button class="bt pri" data-a="receber" data-id="${id}">${ic('payments')} Receber</button><span style="flex:1"></span><button class="bt txt verm" data-a="zerarMesa" data-id="${id}" title="Só gerente ou sócio">${ic('restart_alt')} Zerar mesa</button></div></div>`;
  h += `<details style="margin-top:14px"><summary class="sub">Histórico da mesa (${(m.log || []).length})</summary>${(m.log || []).slice().reverse().map(l => `<div class="sub">${hora(l.t)} · ${esc(l.quem)}: ${esc(l.o)}</div>`).join('')}</details>`;
  return h;
}
function previaEnvio(pend) {
  const sel = pend.some(i => i.sel);
  const coz = pend.filter(i => temSetor(i, 'cozinha')), bar = pend.filter(i => temSetor(i, 'bar'));
  const partes = [];
  if (coz.length) {
    let g = sel ? [coz.filter(i => i.sel), coz.filter(i => !i.sel)] : [coz.filter(i => i.tipo === 'aperitivo'), coz.filter(i => i.tipo !== 'aperitivo')];
    g = g.filter(x => x.length);
    partes.push(g.length > 1 ? `Cozinha em 2 cards: 1º ${g[0].map(i => i.nome).join(', ')}; depois o resto` : 'Cozinha: 1 card com tudo');
  }
  if (bar.length) {
    const jp = bar.filter(i => i.comPrato).length;
    partes.push(`Bar: ${bar.length - jp} agora${jp ? `, ${jp} com o prato` : ''}`);
  }
  return partes.join(' · ');
}
A.limparBusca = () => { F.busca = ''; render(); setTimeout(() => { const b = $('#busca'); b && b.focus(); }, 0); };
A.addPrimeiro = d => { const r = buscar(F.busca); if (r[0]) A.addProd({ id: d.id, c: r[0].cod }); };
A.addProd = d => {
  const p = P[+d.c]; const id = d.id;
  if (p.tipo === 'adicional') return modalAdicionalAvulso(id, p);
  const add = async it => {
    await DB.mutate('mesas', id, m => { if (!m) return undefined; m.itens.push(it); m.log = (m.log || []).concat(logLinha('lançou ' + it.nome)); return m; });
    F.busca = ''; render(); const b = $('#busca'); if (b && window.innerWidth > 700) b.focus();
  };
  if (!precisaModal(p)) return add(montarItem(novoMI(p)));
  modalItem(p, add);
};
function modalAdicionalAvulso(id, p) {
  const m = S.mesas[id]; const pend = itensValidos(m.itens).filter(i => !i.enviado);
  abrirModal({
    render: () => `<h2>${esc(p.nome)} · ${R(p.preco)}</h2><p class="sub">Em qual item entra? (itens ainda não enviados)</p>
      <div class="itens">${pend.map(it => it.partes.map((pt, k) => pt.setor === 'cozinha' ? `<button class="item" style="cursor:pointer;text-align:left" data-a="okAdd" data-u="${it.uid}" data-k="${k}"><div class="corpo"><div class="nm">${esc(pt.nome)}</div><div class="det">${esc(it.nome)}</div></div></button>` : '').join('')).join('') || '<div class="vazio">Nenhum item a enviar. Lance o prato antes, ou mande avulso.</div>'}</div>
      <div class="linha" style="margin-top:12px"><button class="bt" data-a="fecharModal">Cancelar</button><button class="bt" data-a="okAvulso">Mandar avulso</button></div>`,
    async okAdd(d) {
      await DB.mutate('mesas', id, mm => { const it = mm.itens.find(i => i.uid === d.u); if (!it) return undefined; it.partes[+d.k].adds = (it.partes[+d.k].adds || []).concat({ cod: p.cod, nome: p.nome, preco: p.preco }); it.partes[+d.k].discos = (it.partes[+d.k].discos || 0) + (p.disco || 0); mm.log.push(logLinha('+ ' + p.nome + ' em ' + it.nome)); return mm; });
      fecharModal(); F.busca = ''; render();
    },
    async okAvulso() {
      const it = montarItem(novoMI(Object.assign({}, p, { tipo: 'simples' })));
      await DB.mutate('mesas', id, mm => { mm.itens.push(it); mm.log.push(logLinha('lançou ' + p.nome + ' avulso')); return mm; });
      fecharModal(); F.busca = ''; render();
    }
  });
}
CH.selItem = async (el, d) => { await DB.mutate('mesas', d.id, m => { const it = m && m.itens.find(i => i.uid === d.u); if (!it) return undefined; it.sel = el.checked; return m; }); };
CH.comPrato = async (el, d) => { await DB.mutate('mesas', d.id, m => { const it = m && m.itens.find(i => i.uid === d.u); if (!it) return undefined; it.comPrato = el.checked; return m; }); };
A.tirarItem = async d => { await DB.mutate('mesas', d.id, m => { const it = m.itens.find(i => i.uid === d.u); if (!it || it.enviado) return undefined; m.itens = m.itens.filter(i => i.uid !== d.u); m.log.push(logLinha('tirou ' + it.nome + ' (antes de enviar)')); return m; }); };
A.cancelarItem = d => {
  const m = S.mesas[d.id]; const it = m && m.itens.find(i => i.uid === d.u); if (!it) return;
  pedirAutorizacao('Cancelar ' + it.nome + ' (' + R(precoItem(it)) + ')?', async (p, motivo) => {
    await DB.mutate('mesas', d.id, mm => { const x = mm.itens.find(i => i.uid === d.u); x.cancelado = { pediu: quem(), autorizou: p.nome, motivo, ts: agora(), valor: precoItem(x) }; mm.log.push({ t: agora(), quem: quem(), o: 'cancelou ' + x.nome + ' (já enviado) · autorizado por ' + p.nome + ' · ' + motivo }); return mm; });
    for (const cid of (it.cards || [])) await DB.mutate('cards', cid, c => { if (!c) return undefined; c.blocos = c.blocos.filter(b => b.item !== it.uid); return c.blocos.length ? c : null; });
    toast('Cancelado por ' + p.nome);
  });
};
// Zerar mesa (aberta por engano ou lançada errada): só acesso total, com motivo; fica registrado para a conferência
A.zerarMesa = d => {
  const id = d.id; const m0 = S.mesas[id]; if (!m0) return;
  const rot = m0.label || rotuloMesa(id);
  pedirAutorizacao('Zerar a ' + rot + '? Ela volta a ficar livre.', async (p, motivo) => {
    const m = S.mesas[id]; if (!m) return;
    const t = agora();
    const enviados = itensValidos(m.itens).filter(i => i.enviado);
    const reg = {
      id: 'z' + id + '-' + t, noiteId: noiteId(), canal: 'salao', marca: 'st', ref: rot + ' (ZERADA)', cancelado: true, zerada: true, nomes: m.nomes || [],
      itens: [], cancelados: enviados.map(i => ({ nome: i.nome, valor: precoItem(i), pediu: quem(), autorizou: p.nome, motivo, ts: t })),
      estornos: (m.pagamentos || []).map(x => Object.assign({}, x, { tiradoPor: quem(), autorizou: p.nome, motivo, tiradoEm: t })),
      garcons: [...new Set((m.itens || []).map(i => i.por).concat([m.por]))].filter(Boolean),
      subtotal: 0, dez: 0, frete: 0, total: 0, pagamentos: [], abertaEm: m.abertaEm, fechadaEm: t, por: quem(),
      log: (m.log || []).concat({ t, quem: quem(), o: 'zerou a mesa · autorizado por ' + p.nome + ' · ' + motivo })
    };
    await DB.set('vendas', reg.id, reg);
    const ops = [{ op: 'del', c: 'mesas', id }];
    S.cards.filter(c => c.refId === id && c.origem === 'salao' && c.status !== 'feito').forEach(c => ops.push({ op: 'del', c: 'cards', id: c.id }));
    await DB.batch(ops);
    S.ui.mesa = null; render();
    toast(rot + ' zerada por ' + p.nome);
  });
};
A.editarNomes = d => {
  const m = S.mesas[d.id]; F.nomesE = (m.nomes || []).join(', ');
  abrirModal({
    foco: 'nomesE',
    render: () => `<h2>Quem está na mesa?</h2><input id="nomesE" class="inp" data-f="nomesE" value="${esc(F.nomesE)}" data-enter="ok"><div class="linha" style="margin-top:12px"><button class="bt" data-a="fecharModal">Cancelar</button><button class="bt pri" data-a="ok">Salvar</button></div>`,
    async ok() { const nomes = F.nomesE.split(',').map(s => s.trim()).filter(Boolean); await DB.mutate('mesas', d.id, mm => { mm.nomes = nomes; mm.log.push(logLinha('nomes: ' + nomes.join(', '))); return mm; }); fecharModal(); }
  });
};
A.enviarMesa = async d => {
  const id = d.id; const m = S.mesas[id]; if (!m) return;
  const pend = itensValidos(m.itens).filter(i => !i.enviado); if (!pend.length) return;
  const sel = pend.some(i => i.sel); const t = agora(); const ref = (m.label || rotuloMesa(id)) + ((m.nomes || []).length ? ' · ' + m.nomes[0] : '');
  const base = { origem: 'salao', ref, refId: id };
  const cards = [];
  const coz = pend.filter(i => temSetor(i, 'cozinha'));
  let gc = sel ? [coz.filter(i => i.sel), coz.filter(i => !i.sel)] : [coz.filter(i => i.tipo === 'aperitivo'), coz.filter(i => i.tipo !== 'aperitivo')];
  gc.filter(g => g.length).forEach((g, k) => cards.push([g, cardNovo('cozinha', g, Object.assign({}, base, { ordem: t + k }))]));
  const bar = pend.filter(i => temSetor(i, 'bar'));
  const jaB = bar.filter(i => !i.comPrato), pratoB = bar.filter(i => i.comPrato);
  const gb = sel ? [jaB.filter(i => i.sel), jaB.filter(i => !i.sel)] : [jaB];
  gb.filter(g => g.length).forEach((g, k) => cards.push([g, cardNovo('bar', g, Object.assign({}, base, { ordem: t + k }))]));
  if (pratoB.length) { const lib = t + (cfg().minPrato || 15) * 60000; cards.push([pratoB, cardNovo('bar', pratoB, Object.assign({}, base, { status: 'espera', liberaEm: lib, ordem: lib }))]); }
  await DB.batch(cards.map(([, c]) => ({ op: 'set', c: 'cards', id: c.id, data: c })));
  await DB.mutate('mesas', id, mm => {
    if (!mm) return undefined;
    cards.forEach(([g, c]) => g.forEach(it => { const x = mm.itens.find(i => i.uid === it.uid); if (x) { x.cards = (x.cards || []).concat(c.id); } }));
    mm.itens.forEach(x => { if (pend.find(p => p.uid === x.uid)) { x.enviado = true; x.sel = false; x.enviadoEm = t; } });
    mm.log.push(logLinha('enviou ' + pend.length + ' itens em ' + cards.length + ' card(s)'));
    return mm;
  });
  toast('Enviado: ' + cards.length + ' card(s)');
};

// --- conta, QR do cliente, receber ---
function contaTexto(m, n) {
  const val = itensValidos(m.itens); const tot = subtotal(m.itens); const dez = r2(tot * 0.1);
  let s = `*${NOME_CURTO}* · ${m.label || rotuloMesa(m.id)}\n${(m.nomes || []).join(', ')}\n\n`;
  val.forEach(it => { s += `• ${it.nome}: ${R(precoItem(it))}\n`; descItem(it).forEach(l => { s += `   ${l}\n`; }); });
  s += `\nSubtotal: ${R(tot)}\n10%: ${R(dez)}\n*Total com 10%: ${R(tot + dez)}*\n`;
  if (n > 1) s += `Dividido por ${n}: ${R((tot + dez) / n)} cada (sem 10%: ${R(tot / n)})\n`;
  s += `_${AVISO_10}_\n\nPara pagar: PIX pelo QR no celular do garçom ou maquininha (crédito ou débito).\n${FRASE}`;
  return s;
}
A.conta = d => {
  const id = d.id; const m0 = S.mesas[id]; S.ui.nDiv = Math.max(1, (m0.nomes || []).length);
  abrirModal({
    render() {
      const m = S.mesas[id]; if (!m) return '<div class="vazio">Mesa fechada.</div><button class="bt" data-a="fecharModal">Fechar</button>';
      const tot = subtotal(m.itens), dez = r2(tot * 0.1), n = S.ui.nDiv;
      const cls = m.clientes || [];
      return `<div class="entre"><h2>Conta · ${esc(m.label || rotuloMesa(id))}</h2><button class="bt-ic" data-a="fecharModal">${ic('close')}</button></div>
        ${itensValidos(m.itens).map(it => `<div class="total-linha"><span>${esc(it.nome)}${descItem(it).length ? `<br><span class="sub">${esc(descItem(it).join(' · '))}</span>` : ''}</span><span>${R(precoItem(it))}</span></div>`).join('')}
        <div class="total-linha forte"><span>Subtotal</span><span>${R(tot)}</span></div>
        <div class="total-linha"><span>10% (opcional)</span><span>${R(dez)}</span></div>
        <div class="total-linha forte"><span>Total com 10%</span><span>${R(tot + dez)}</span></div>
        <div class="entre" style="margin:10px 0"><span>Dividir por</span><span class="linha"><button class="bt-ic" data-a="nDiv" data-c="-1">${ic('remove')}</button><b style="font-size:20px">${n}</b><button class="bt-ic" data-a="nDiv" data-c="1">${ic('add')}</button></span></div>
        ${n > 1 ? `<div class="card" style="background:var(--azul-cl);border:0"><b>${R((tot + dez) / n)}</b> cada com 10% · ${R(tot / n)} sem</div>` : ''}
        <p class="sub">${esc(AVISO_10)}</p>
        <div class="secao-t">Enviar no WhatsApp</div>
        ${cls.map((c, i) => `<button class="bt verde bloco" style="margin-bottom:8px" data-a="enviarConta" data-i="${i}">${ic('send')} Para ${esc(c.nome)} (${esc(c.tel)})</button>`).join('')}
        <div class="linha"><input id="telConta" class="inp" style="flex:1" data-f="telConta" inputmode="tel" placeholder="Outro número (DDD + número)" value="${esc(F.telConta || '')}"><button class="bt" data-a="enviarConta" data-i="-1">${ic('send')}</button></div>
        <div style="margin-top:14px"><button class="bt pri bloco grande" data-a="irReceber">${ic('payments')} Receber</button></div>`;
    },
    nDiv(dd) { S.ui.nDiv = Math.max(1, S.ui.nDiv + (+dd.c)); pintarModal(); },
    enviarConta(dd) {
      const m = S.mesas[id]; const tel = +dd.i >= 0 ? m.clientes[+dd.i].tel : F.telConta;
      if (soDig(tel).length < 10) { toast('Número incompleto'); return; }
      abrir(wa(tel, contaTexto(m, S.ui.nDiv)));
      DB.mutate('mesas', id, mm => { if (!mm) return undefined; mm.log.push(logLinha('enviou a conta para ' + tel)); return mm; });
    },
    irReceber() { fecharModal(); A.receber({ id }); }
  });
};
A.qrCliente = d => {
  const id = d.id;
  abrirModal({
    render() {
      const m = S.mesas[id]; if (!m) return '';
      const url = `${BQ}v=mesa&m=${encodeURIComponent(id)}&k=${m.abertaEm}`;
      return `<div class="entre"><h2>QR da ${esc(m.label || rotuloMesa(id))}</h2><button class="bt-ic" data-a="fecharModal">${ic('close')}</button></div>
        <p class="sub">O cliente aponta a câmera, deixa nome e WhatsApp e cai na conversa com a casa. Assim a conta vai para o número certo.</p>
        <div class="qr" data-qr="${esc(url)}"></div>
        <div class="secao-t">Já entraram</div>${(m.clientes || []).map(c => `<div>${ic('check_circle')} ${esc(c.nome)} · ${esc(c.tel)}</div>`).join('') || '<div class="sub">Ninguém ainda.</div>'}`;
    }
  });
};
A.receber = d => {
  const id = d.id; F.valorR = ''; S.ui.forma = null;
  abrirModal({
    render() {
      const m = S.mesas[id]; if (!m) return `<div class="vazio">Mesa fechada.</div><button class="bt bloco" data-a="fecharModal">OK</button>`;
      const tot = subtotal(m.itens), dez = m.dez !== false ? r2(tot * 0.1) : 0, dev = r2(tot + dez);
      const pago = r2((m.pagamentos || []).reduce((s, p) => s + p.valor, 0)); const falta = r2(dev - pago);
      const n = Math.max(1, (m.nomes || []).length);
      const v = F.valorR !== '' ? parseFloat(String(F.valorR).replace(',', '.')) : falta;
      let h = `<div class="entre"><h2>Receber · ${esc(m.label || rotuloMesa(id))}</h2><button class="bt-ic" data-a="fecharModal">${ic('close')}</button></div>
        <div class="total-linha"><span>Subtotal</span><span>${R(tot)}</span></div>
        <label class="total-linha" style="cursor:pointer"><span><input type="checkbox" data-ch="dez" data-id="${id}" ${m.dez !== false ? 'checked' : ''}> 10% (opcional)</span><span>${R(dez)}</span></label>
        <div class="total-linha forte"><span>Total</span><span>${R(dev)}</span></div>
        ${(m.pagamentos || []).map((p, i) => `<div class="total-linha"><span>${ic('check')} ${esc(p.forma)} <span class="sub">${hora(p.ts)} · ${esc(p.por)}</span></span><span>${R(p.valor)} <button class="bt-ic" data-a="tirarPg" data-i="${i}">${ic('close')}</button></span></div>`).join('')}
        <div class="total-linha forte" style="color:${falta > 0.004 ? 'var(--vermelho)' : 'var(--verde)'}"><span>${falta > 0.004 ? 'Faltam' : falta < -0.004 ? 'Troco' : 'Tudo pago'}</span><span>${R(Math.abs(falta))}</span></div>`;
      if (falta > 0.004) {
        h += `<div class="secao-t">Como pagou?</div><div class="chips">${['PIX', 'Crédito', 'Débito', 'Dinheiro'].map(f => `<button class="chip ${S.ui.forma === f ? 'on' : ''}" data-a="forma" data-c="${f}">${f}</button>`).join('')}</div>
          <div class="linha" style="margin-top:10px"><input id="valorR" class="inp" style="flex:1;font-size:20px" data-f="valorR" data-vivo inputmode="decimal" placeholder="${R(falta)}" value="${esc(F.valorR)}">
          ${n > 1 ? `<button class="chip" data-a="parte" data-c="${r2(dev / n)}">1/${n}: ${R(dev / n)}</button>` : ''}<button class="chip" data-a="parte" data-c="${falta}">tudo</button></div>`;
        if (S.ui.forma === 'PIX') {
          if (!S.ui.txid) S.ui.txid = 'ST' + String(id).replace(/\W/g, '') + 'H' + new Date().toTimeString().slice(0, 5).replace(':', '') + uid().slice(0, 3).toUpperCase();
          const pix = pixCopiaCola(v, S.ui.txid);
          h += pix ? `<div class="qr" data-qr="${esc(pix)}"></div><p class="sub" style="text-align:center">PIX de ${R(v)} para ${esc((cfg().pix || {}).nome || '')} · código ${esc(S.ui.txid)}. O cliente lê com o app do banco e mostra a tela de pago. Só então toque em Recebido.</p>`
            : `<p class="sub">Cadastre a chave PIX em Equipe e loja (base) para o QR aparecer aqui.</p>`;
        }
        h += `<button class="bt pri bloco grande" style="margin-top:12px" data-a="regPg" ${S.ui.forma && v > 0 ? '' : 'disabled'}>${ic('check')} ${S.ui.forma ? 'Recebido ' + R(v) + ' em ' + S.ui.forma : 'Escolha a forma'}</button>`;
      } else {
        h += `<button class="bt verde bloco grande" style="margin-top:12px" data-a="fecharMesa">${ic('done_all')} Fechar a mesa</button>`;
      }
      return h;
    },
    forma(dd) { S.ui.forma = dd.c; S.ui.txid = null; pintarModal(); },
    parte(dd) { F.valorR = String(dd.c).replace('.', ','); pintarModal(); },
    async regPg() {
      const m = S.mesas[id]; const tot = subtotal(m.itens), dez = m.dez !== false ? r2(tot * 0.1) : 0;
      const falta = r2(tot + dez - (m.pagamentos || []).reduce((s, p) => s + p.valor, 0));
      const v = r2(F.valorR !== '' ? parseFloat(String(F.valorR).replace(',', '.')) : falta);
      if (!(v > 0)) return;
      const pg = { forma: S.ui.forma, valor: v, por: quem(), ts: agora() };
      if (S.ui.forma === 'PIX') { pg.txid = S.ui.txid; pg.qr = !!pixCopiaCola(v, S.ui.txid); pg.chave = (cfg().pix || {}).chave || ''; }
      await DB.mutate('mesas', id, mm => { mm.pagamentos = (mm.pagamentos || []).concat(pg); mm.log.push(logLinha('recebeu ' + R(v) + ' em ' + S.ui.forma + (pg.txid ? ' (PIX ' + pg.txid + ')' : ''))); return mm; });
      F.valorR = ''; S.ui.forma = null; S.ui.txid = null; pintarModal();
    },
    tirarPg(dd) {
      const p0 = S.mesas[id].pagamentos[+dd.i];
      pedirAutorizacao('Tirar o pagamento de ' + R(p0.valor) + ' em ' + p0.forma + '?', async (p, motivo) => {
        await DB.mutate('mesas', id, mm => { const i = mm.pagamentos.findIndex(x => x.ts === p0.ts && x.valor === p0.valor); if (i < 0) return undefined; const x = mm.pagamentos.splice(i, 1)[0]; mm.estornos = (mm.estornos || []).concat(Object.assign({}, x, { tiradoPor: quem(), autorizou: p.nome, motivo, tiradoEm: agora() })); mm.log.push({ t: agora(), quem: quem(), o: 'tirou pagamento ' + R(x.valor) + ' ' + x.forma + ' · autorizado por ' + p.nome + ' · ' + motivo }); return mm; });
        A.receber({ id });
      });
    },
    async fecharMesa() { await fecharMesa(id); fecharModal(); S.ui.mesa = null; render(); }
  });
};
CH.dez = async (el, d) => { await DB.mutate('mesas', d.id, m => { m.dez = el.checked; m.log.push(logLinha(el.checked ? 'incluiu 10%' : 'tirou 10%')); return m; }); };
async function fecharMesa(id) {
  const m = S.mesas[id]; if (!m) return;
  const tot = subtotal(m.itens), dez = m.dez !== false ? r2(tot * 0.1) : 0;
  const venda = {
    id: 'm' + id + '-' + m.abertaEm, noiteId: noiteId(), canal: 'salao', marca: 'st', ref: m.label || rotuloMesa(id), nomes: m.nomes || [], clientes: m.clientes || [],
    itens: itensValidos(m.itens).map(i => ({ cod: i.cod, nome: i.nome, preco: precoItem(i), desc: descItem(i) })),
    cancelados: (m.itens || []).filter(i => i.cancelado).map(i => Object.assign({ nome: i.nome }, typeof i.cancelado === 'object' ? i.cancelado : {})),
    tiradosAntes: (m.log || []).filter(l => /tirou .* \(antes de enviar\)/.test(l.o)).length,
    semDez: m.dez === false, estornos: m.estornos || [], garcons: [...new Set((m.itens || []).map(i => i.por).concat((m.pagamentos || []).map(p => p.por)))],
    subtotal: tot, dez, frete: 0, total: r2(tot + dez), pagamentos: m.pagamentos || [], abertaEm: m.abertaEm, fechadaEm: agora(), por: quem(), log: (m.log || []).concat(logLinha('fechou a mesa'))
  };
  await DB.set('vendas', venda.id, venda);
  const ops = [{ op: 'del', c: 'mesas', id }];
  S.cards.filter(c => c.refId === id && c.origem === 'salao' && c.setor === 'bar' && c.status !== 'feito').forEach(c => ops.push({ op: 'update', c: 'cards', id: c.id, data: { status: 'feito', feitoEm: agora() } }));
  await DB.batch(ops);
  for (const c of (m.clientes || [])) await DB.mutate('clientes', telWa(c.tel), x => { x = x || { nome: c.nome, tel: telWa(c.tel), pedidos: 0, visitas: 0, lgpd: true, criadoEm: agora() }; x.visitas = (x.visitas || 0) + 1; x.ultimo = agora(); return x; });
  toast((m.label || rotuloMesa(id)) + ' fechada · ' + R(venda.total));
}

// ================= bebidas (aba do garçom) =================
function telaBebidas() {
  const fila = filaDe('bar');
  const espera = S.cards.filter(c => c.setor === 'bar' && c.status === 'espera' && c.liberaEm > agora()).sort((a, b) => a.liberaEm - b.liberaEm);
  let h = `<h2>Bebidas pendentes</h2>`;
  if (!fila.length) h += '<div class="vazio">Nada pendente no bar.</div>';
  h += '<div class="grade">' + fila.map(c => {
    const m = minDesde(cardInicio(c)); const veio = c.status === 'espera';
    return `<div class="bc ${corBar(m)}"><div class="entre"><span><span class="tag ${c.origem}">${c.origem === 'salao' ? 'salão' : c.origem}</span> <b>${esc(c.ref)}</b></span><b>${m} min</b></div>
      ${c.blocos.map(b => b.linhas.map(l => `<div class="bl">${esc(l.nome)}${l.trocas.length ? ` <span class="troca" style="color:#b06000;font-size:14px">${esc(l.trocas.join(', '))}</span>` : ''}</div>`).join('')).join('')}
      ${c.pgPendente ? '<span class="tag aviso">pagamento a confirmar</span>' : ''}
      <div class="linha"><button class="bt verde" style="flex:1" data-a="feito" data-id="${c.id}">${ic('check')} Feito</button>${veio ? `<button class="bt" data-a="voltaEspera" data-id="${c.id}">${ic('undo')} Voltar p/ espera</button>` : ''}</div></div>`;
  }).join('') + '</div>';
  if (espera.length) {
    h += `<div class="secao-t">Vão com o prato (entram sozinhas)</div><div class="grade">` + espera.map(c => `<div class="bc espera"><div class="entre"><b>${esc(c.ref)}</b><span>entra em ${Math.ceil((c.liberaEm - agora()) / 60000)} min</span></div>
      ${c.blocos.map(b => b.linhas.map(l => `<div class="bl">${esc(l.nome)}</div>`).join('')).join('')}
      <button class="bt" data-a="liberarJa" data-id="${c.id}">${ic('play_arrow')} Fazer agora</button></div>`).join('') + '</div>';
  }
  return h;
}
A.feito = d => marcarFeito(d.id);
A.voltaEspera = d => { const lib = agora() + (cfg().minPrato || 15) * 60000; DB.update('cards', d.id, { status: 'espera', liberaEm: lib, ordem: lib }); toast('Volta em ' + (cfg().minPrato || 15) + ' min'); };
A.liberarJa = d => { DB.update('cards', d.id, { status: 'fila', inicio: agora(), ordem: agora(), liberaEm: null }); };

// ================= estudo (cardápio na palma da mão) =================
function telaEstudo() {
  const q = norm(F.estudo || '');
  const cats = [];
  C.itens.forEach(p => { if (q && !(norm(p.nome).includes(q) || String(p.cod).startsWith(q))) return; let c = cats.find(x => x.n === p.cat); if (!c) cats.push(c = { n: p.cat, i: [] }); c.i.push(p); });
  return `<h2>Estudo · cardápio e códigos</h2><p class="sub">Burguers de 1 a 11 · aperitivos 21 a 28 · combo do burguer 30 a 33 · combos da mesa 41 a 46 · Circuito 50 a 53 · adicionais 61 a 73 · acompanhamentos e doces 81 a 84 · bebidas 91 a 95.</p>
    <div class="busca" style="margin:12px 0">${ic('search')}<input id="estudo" data-f="estudo" data-vivo placeholder="Procurar" value="${esc(F.estudo || '')}"></div>
    ${cats.map(c => `<div class="secao-t">${esc(c.n)}</div><div class="card" style="padding:4px 12px">${c.i.map(p => `<div class="res" style="cursor:default"><span class="cod">${p.cod}</span><span class="nm">${esc(p.nome)}${p.desc ? `<br><span class="sub">${esc(p.desc)}</span>` : ''}</span><span class="pr">${p.precoLivre ? '17–30' : R(p.preco)}${p.setor === 'bar' ? '<br><span class="tag cinza">bar</span>' : ''}</span></div>`).join('')}</div>`).join('')}
    <div class="secao-t">Regras de preço</div><div class="card sub" style="line-height:1.6">
    • Adicionais: 2 por R$ 10, 3 por R$ 12 (o sistema calcula sozinho). No espeto, 3 por R$ 10.<br>
    • Combo do burguer: fritas + brownie ou alfajor + suco 500 ml ou refri 600 ml = +R$ 28. Soda +30, cerveja +36, drink +37.<br>
    • Combos 41 e 42 com Bitrem: +R$ 15; com CTB: +R$ 5. No Combo Família e no + burguer, Bitrem e CTB não entram.<br>
    • Antes de enviar, o garçom tira o que quiser. Depois de enviado, só o gerente ou sócio cancela, com código e motivo.<br>
    • Pediu sem trigo: pão sem glúten +R$ 5; as iscas do Circuito só no fubá.<br>
    • Cozinha: verde até 20 min, amarelo 20 a 30, laranja 30 a 35, vermelho 35+. Bebidas: verde até 5, amarelo 5 a 10, vermelho 10+.</div>`;
}

// ================= cozinha (TV) =================
function somaFila(cards) {
  const s = { burguer: 0, quesadilla: 0, cogumelo: 0 };
  cards.forEach(c => c.blocos.forEach(b => b.linhas.forEach(l => { if (l.chapa === 'burguer') s.burguer += (l.discos || 1); else if (l.chapa) s[l.chapa] += 1; })));
  return s;
}
function cardCozinha(c) {
  const ag = c.status === 'aguardando'; const m = minDesde(ag ? c.criadoEm : cardInicio(c));
  const cor = ag ? 'aguardando' : corCoz(m);
  const tagO = c.origem === 'salao' ? 'salão' : c.origem === 'ifood' ? 'iFood' : 'WhatsApp';
  let h = `<div class="kc ${cor}" data-card="${c.id}"><div class="kh"><span class="tag ${c.origem}">${tagO}</span>${c.marca === 'ladob' ? '<span class="tag ladob">Lado B</span>' : ''}<span class="ref">${esc(c.ref)}</span><span class="tempo">${m} min</span></div>`;
  if (c.nPedido) h += `<div class="npedido">${ordinal(c.nPedido)} pedido com a gente</div>`;
  c.blocos.forEach(b => {
    if (b.combo) {
      let g = null;
      h += `<div class="bloco combo"><span class="tc">COMBO</span>` + b.linhas.map(l => { const sep = g !== null && l.grupo !== g; g = l.grupo; return `<div class="kl ${sep ? 'sep' : ''}">${esc(l.nome)}${l.trocas.length ? '<br>' + l.trocas.map(t => `<span class="kt">${esc(t)}</span>`).join('') : ''}</div>`; }).join('') + '</div>';
    } else {
      h += b.linhas.map(l => `<div class="kl">${esc(l.nome)}${l.trocas.length ? '<br>' + l.trocas.map(t => `<span class="kt">${esc(t)}</span>`).join('') : ''}</div>`).join('');
    }
  });
  if (ag) h += `<div class="aviso-pg">Aguardando pagamento · 1º pedido</div><button class="kfeito cinza" data-a="pgCozinha" data-id="${c.refId}">${ic('payments')} PAGAMENTO CONFIRMADO</button>`;
  else {
    if (c.pgPendente) h += `<div class="linha"><span class="tag aviso">pagamento a confirmar</span><button class="bt txt" data-a="pgCozinha" data-id="${c.refId}">confirmar</button></div>`;
    h += `<button class="kfeito" data-a="feito" data-id="${c.id}">✓ FEITO</button>`;
  }
  h += `<div class="kmove"><button data-a="mover" data-id="${c.id}" data-c="-1" title="Adiantar">${ic('arrow_back')}</button><button data-a="mover" data-id="${c.id}" data-c="1" title="Atrasar">${ic('arrow_forward')}</button></div></div>`;
  return h;
}
function telaFilaCozinha(compacta) {
  const fila = filaDe('cozinha'); const s = somaFila(fila.filter(c => c.status !== 'aguardando'));
  return `<div class="tv-topo">${compacta ? '' : `<b style="font-size:20px">Cozinha</b>`}<div class="soma"><div class="s"><b>${s.burguer}</b>hambúrgueres</div><div class="s"><b>${s.quesadilla}</b>quesadillas</div><div class="s"><b>${s.cogumelo}</b>cogumelos</div></div>
    <span class="esp" style="flex:1"></span><span style="font-size:22px;font-weight:700">${hora(agora())}</span>${compacta ? '' : `<button class="bt-ic" data-a="sair" title="Sair">${ic('logout')}</button>`}</div>
    ${fila.length ? `<div class="fila" id="fila">${fila.map(cardCozinha).join('')}</div>` : '<div class="tv-vazia">Fila vazia</div>'}
    ${compacta ? telaFeitosRecentes() : ''}`;
}
function telaFeitosRecentes() {
  const f = S.cards.filter(c => c.setor === 'cozinha' && c.status === 'feito').sort((a, b) => b.feitoEm - a.feitoEm).slice(0, 10);
  if (!f.length) return '';
  return `<div class="pag"><div class="secao-t">Feitos recentes</div>${f.map(c => `<div class="entre card" style="margin-bottom:6px;padding:10px"><span><span class="tag ${c.origem}">${c.origem}</span> <b>${esc(c.ref)}</b> · ${esc(c.blocos.map(b => b.linhas.map(l => l.nome).join(', ')).join(' / '))}</span><span class="sub">${hora(c.feitoEm)} <button class="bt txt" data-a="reabrir" data-id="${c.id}">Voltar para a fila</button></span></div>`).join('')}</div>`;
}
A.reabrir = d => DB.update('cards', d.id, { status: 'fila', feitoEm: null });
A.pgCozinha = d => confirmarPagamento(d.id);
A.mover = async d => {
  const fila = filaDe('cozinha'); const i = fila.findIndex(c => c.id === d.id); const j = i + (+d.c);
  if (i < 0 || j < 0 || j >= fila.length) return;
  const a = fila[i], b = fila[j];
  await DB.batch([{ op: 'update', c: 'cards', id: a.id, data: { ordem: ordemDe(b), status: a.status === 'espera' ? 'fila' : a.status } }, { op: 'update', c: 'cards', id: b.id, data: { ordem: ordemDe(a), status: b.status === 'espera' ? 'fila' : b.status } }]);
};
let sortable = null;
function ligarArrastar() {
  const el = $('#fila'); if (!el || !window.Sortable) return;
  sortable = Sortable.create(el, {
    animation: 150, handle: '.kh', delay: 120, delayOnTouchOnly: true,
    onStart: () => { S.arrastando = true; },
    onEnd: async ev => {
      S.arrastando = false;
      const fila = filaDe('cozinha'); const movido = fila[ev.oldIndex]; if (!movido || ev.oldIndex === ev.newIndex) { render(); return; }
      const resto = fila.filter(c => c.id !== movido.id);
      const ant = resto[ev.newIndex - 1], dep = resto[ev.newIndex];
      const nova = ant && dep ? (ordemDe(ant) + ordemDe(dep)) / 2 : ant ? ordemDe(ant) + 1 : ordemDe(dep) - 1;
      await DB.update('cards', movido.id, { ordem: nova });
      render();
    }
  });
}

// ================= WhatsApp do dia (base) =================
function colunaPedido(d) {
  if (d.status === 'cancelado') return null;
  if (d.status === 'frete') return 'frete';
  if (d.status === 'fim') return 'posvenda';
  if (d.status === 'despachado') return 'despachado';
  if (d.status === 'pronto') return 'pronto';
  if (!(d.pg && d.pg.confirmado) && d.nPedido === 1) return 'pagamento';
  return 'preparo';
}
function totalPedido(d) { return r2(subtotal(d.itens) + (d.frete || 0)); }
function sugestaoFrete(bairro) {
  const b = norm(bairro); if (!b) return null;
  const vs = S.fretes.filter(f => f.bairro === b).map(f => f.valor).sort((x, y) => x - y);
  if (vs.length < 2) return null;
  return { valor: vs[Math.floor(vs.length / 2)], n: vs.length };
}
function msgCobranca(d) {
  const tot = totalPedido(d);
  let s = `*${NOME_CURTO}* · Pedido ${d.num}\n`;
  if (d.frete) s += `Itens: ${R(subtotal(d.itens))}\nFrete: ${R(d.frete)}\n`;
  s += `*Total: ${R(tot)}*\n\n`;
  if (d.pagamento === 'cartao') s += d.pg && d.pg.link ? `Pague com cartão de crédito ou débito por este link:\n${d.pg.link}\n\nDepois, mande aqui o comprovante.` : 'O link do cartão vem em instantes.';
  else { const pix = pixCopiaCola(tot, 'P' + d.num); s += `PIX (chave): ${(cfg().pix || {}).chave || ''}\n` + (pix ? `\nPIX copia e cola:\n${pix}\n` : '') + `\nDepois, mande aqui o comprovante.`; }
  s += d.nPedido > 1 ? '\nSeu pedido já está indo para a produção.' : '\nAssim que o pagamento for confirmado, começamos o seu pedido.';
  return s + `\n\n${FRASE}`;
}
function telaWhatsApp() {
  const cols = [['frete', 'Aguardando frete'], ['pagamento', 'Aguardando pagamento'], ['preparo', 'Em preparo'], ['pronto', 'Pronto'], ['despachado', 'Despachado'], ['posvenda', 'Pós-venda']];
  const ped = S.delivery.filter(d => d.noiteId === noiteId() || !['fim', 'cancelado'].includes(d.status)).sort((a, b) => a.ts - b.ts);
  const linkPedido = BQ + 'v=pedido';
  let h = `<div class="entre" style="margin-bottom:12px"><div><h2 style="margin:0">WhatsApp do dia</h2><div class="sub">Link para a saudação do WhatsApp: ${esc(linkPedido)}</div></div>
    <div class="linha"><button class="bt" data-a="copiar" data-c="${esc(linkPedido)}">${ic('content_copy')} Copiar link</button><button class="bt ton" data-a="link" data-c="${esc(linkPedido)}">${ic('add')} Lançar pedido</button></div></div><div class="kanban">`;
  cols.forEach(([k, nome]) => {
    const ps = ped.filter(d => colunaPedido(d) === k);
    h += `<div class="kcol"><h3><span>${nome}</span><span>${ps.length}</span></h3>${ps.map(d => cardPedido(d, k)).join('')}</div>`;
  });
  return h + '</div>';
}
function cardPedido(d, col) {
  const tot = totalPedido(d); const pg = d.pg || {};
  let h = `<div class="pd"><div class="entre"><span class="pt">#${d.num} · ${esc(d.cliente.nome)}</span><span class="sub">${hora(d.ts)}</span></div>
    <div class="linha"><span class="tag ${d.nPedido > 1 ? 'ok' : 'aviso'}">${ordinal(d.nPedido)} pedido</span><span class="tag cinza">${d.entrega.tipo === 'moto' ? 'moto iFood' : 'Uber Flash'}</span><span class="tag cinza">${d.pagamento === 'pix' ? 'PIX' : 'cartão'}</span></div>
    <div class="sub">${d.itens.map(i => esc(i.nome)).join(' · ')}</div>
    ${d.entrega.tipo === 'moto' ? `<div class="sub">${ic('location_on')} ${esc([d.entrega.rua, d.entrega.numero, d.entrega.compl, d.entrega.bairro].filter(Boolean).join(', '))}${d.entrega.ref ? ' · ' + esc(d.entrega.ref) : ''}</div>` : ''}
    <div><b>${R(tot)}</b>${d.frete ? ` <span class="sub">(frete ${R(d.frete)})</span>` : ''}</div>
    <div class="linha">${pg.ip && pg.ip.paid ? `<span class="tag ok">InfinitePay pago ✓</span>` : ''}${pg.comprovante ? '<span class="tag ok">comprovante ✓</span>' : ''}${pg.confirmado ? `<span class="tag ok">pago · ${esc(pg.forma || '')}</span>` : '<span class="tag aviso">pagamento a confirmar</span>'}</div>`;
  if (col === 'frete') {
    const sg = sugestaoFrete(d.entrega.bairro);
    h += `<div class="linha"><input id="frete-${d.id}" class="inp" style="flex:1" data-f="frete-${d.id}" inputmode="decimal" placeholder="Frete R$" value="${esc(F['frete-' + d.id] || '')}">${sg ? `<button class="chip" data-a="sugFrete" data-id="${d.id}" data-c="${sg.valor}">${R(sg.valor)} (${sg.n})</button>` : ''}</div>
      <button class="bt pri" data-a="salvarFrete" data-id="${d.id}">${ic('send')} Salvar frete e cobrar</button>`;
  }
  if (!pg.confirmado && col !== 'frete') {
    h += `<label class="sub"><input type="checkbox" data-ch="comprovante" data-id="${d.id}" ${pg.comprovante ? 'checked' : ''}> comprovante recebido no WhatsApp</label>
      <div class="linha">${(d.pagamento === 'cartao' ? ['Cartão (link InfinitePay)'] : ['PIX']).map(f => `<button class="chip" data-a="confPg" data-id="${d.id}" data-c="${f}">${ic('check')} Pago: ${f}</button>`).join('')}</div>`;
    if (d.pagamento === 'cartao' && !pg.link) h += `<button class="bt" data-a="gerarLink" data-id="${d.id}">${ic('link')} Gerar link do cartão</button>`;
    h += `<button class="bt txt" data-a="cobrar" data-id="${d.id}">${ic('chat')} Mandar cobrança</button>`;
  }
  if (col === 'pronto') h += `<button class="bt verde" data-a="avisarPronto" data-id="${d.id}">${ic('notifications')} Avisar que está pronto</button><button class="bt pri" data-a="despachar" data-id="${d.id}">${ic('local_shipping')} Despachado</button>`;
  if (col === 'despachado') h += `<button class="bt" data-a="posVenda" data-id="${d.id}">${ic('favorite')} Pós-venda</button>`;
  h += `<div class="linha"><button class="bt txt" data-a="link" data-c="${esc(wa(d.cliente.tel, 'Olá, ' + d.cliente.nome + '!'))}">${ic('chat')} conversa</button>${['frete', 'pagamento', 'preparo'].includes(col) ? `<button class="bt txt verm" data-a="cancelarPedido" data-id="${d.id}">cancelar</button>` : ''}</div></div>`;
  return h;
}
const pedidoDe = id => S.delivery.find(x => x.id === id);
A.sugFrete = d => { F['frete-' + d.id] = String(d.c).replace('.', ','); render(); };
A.salvarFrete = async d => {
  const v = r2(parseFloat(String(F['frete-' + d.id] || '').replace(',', '.')));
  if (!(v >= 0)) { toast('Digite o frete'); return; }
  const p = pedidoDe(d.id);
  const pago = (p.pg && p.pg.confirmado) || p.nPedido > 1;
  await DB.update('delivery', d.id, { frete: v, status: !pago ? 'pagamento' : p.prontoEm ? 'pronto' : 'preparo' });
  await DB.set('fretes', uid(), { bairro: norm(p.entrega.bairro), valor: v, ts: agora(), por: quem() });
  const atual = Object.assign({}, p, { frete: v });
  if (p.pagamento === 'cartao') { try { const link = await criarLinkIP(atual, totalPedido(atual)); atual.pg = Object.assign({}, p.pg, { link }); await DB.update('delivery', d.id, { pg: atual.pg }); } catch (e) { toast(e.message); } }
  abrir(wa(p.cliente.tel, msgCobranca(atual)));
};
A.gerarLink = async d => {
  const p = pedidoDe(d.id);
  try { const link = await criarLinkIP(p, totalPedido(p)); const pg = Object.assign({}, p.pg, { link }); await DB.update('delivery', d.id, { pg }); abrir(wa(p.cliente.tel, msgCobranca(Object.assign({}, p, { pg })))); }
  catch (e) { toast(e.message + ' · gere o link no app da InfinitePay e cole na conversa'); }
};
A.cobrar = d => { const p = pedidoDe(d.id); abrir(wa(p.cliente.tel, msgCobranca(p))); };
CH.comprovante = (el, d) => { const p = pedidoDe(d.id); DB.update('delivery', d.id, { pg: Object.assign({}, p.pg, { comprovante: el.checked }) }); };
A.confPg = d => confirmarPagamento(d.id, d.c);
A.avisarPronto = d => {
  const p = pedidoDe(d.id);
  const txt = p.entrega.tipo === 'moto' ? `Oi, ${p.cliente.nome}! Seu pedido ${p.num} está pronto e a moto já vai sair. ${FRASE}` : `Oi, ${p.cliente.nome}! Pedido ${p.num} pronto! Pode chamar o Uber Flash para o endereço: ${cfg().endereco || '(endereço da casa)'}. Na chegada, é só falar o nome ${p.cliente.nome}.`;
  abrir(wa(p.cliente.tel, txt)); DB.update('delivery', d.id, { avisadoEm: agora() });
};
A.despachar = async d => {
  const p = pedidoDe(d.id);
  if (!(p.pg && p.pg.confirmado)) { if (!confirm('O pagamento ainda não foi confirmado. Despachar mesmo assim?')) return; }
  await DB.update('delivery', d.id, { status: 'despachado', despachadoEm: agora() });
  await DB.set('vendas', 'w' + p.id, {
    id: 'w' + p.id, noiteId: noiteId(), canal: 'whatsapp', marca: 'st', ref: 'Pedido ' + p.num + ' · ' + p.cliente.nome, cliente: p.cliente,
    itens: itensValidos(p.itens).map(i => ({ cod: i.cod, nome: i.nome, preco: precoItem(i), desc: descItem(i) })),
    subtotal: subtotal(p.itens), dez: 0, frete: p.frete || 0, total: subtotal(p.itens),
    pagamentos: [{ forma: (p.pg && p.pg.forma) || (p.pagamento === 'pix' ? 'PIX' : 'Cartão'), valor: totalPedido(p), por: (p.pg && p.pg.por) || quem(), ts: (p.pg && p.pg.em) || agora(), txid: p.pagamento === 'pix' ? 'P' + p.num : undefined }],
    comprovante: !!(p.pg && p.pg.comprovante), infinitepay: (p.pg && p.pg.ip) || null, abertaEm: p.ts, fechadaEm: agora(), por: quem()
  });
};
A.posVenda = d => {
  const p = pedidoDe(d.id);
  abrir(wa(p.cliente.tel, `Oi, ${p.cliente.nome}! Aqui é do Seu Trem. Chegou tudo certinho? Conta pra gente o que achou do pedido ${p.num}: a sua resposta ajuda a gente a melhorar.`));
  DB.update('delivery', d.id, { status: 'fim', posVendaEm: agora() });
};
A.cancelarPedido = d => pedirAutorizacao('Cancelar o pedido?', async (pe, motivo) => {
  const p = pedidoDe(d.id);
  await DB.update('delivery', d.id, { status: 'cancelado', canceladoPor: pe.nome, canceladoEm: agora(), motivoCancel: motivo });
  await DB.set('vendas', 'x' + d.id, { id: 'x' + d.id, noiteId: noiteId(), canal: 'whatsapp', marca: 'st', ref: 'Pedido ' + p.num + ' · ' + p.cliente.nome + ' (CANCELADO)', cancelado: true, itens: [], cancelados: itensValidos(p.itens).map(i => ({ nome: i.nome, valor: precoItem(i), autorizou: pe.nome, pediu: quem(), motivo, ts: agora() })), subtotal: 0, dez: 0, frete: 0, total: 0, pagamentos: [], fechadaEm: agora(), por: quem() });
  await DB.batch(S.cards.filter(c => c.refId === d.id).map(c => ({ op: 'del', c: 'cards', id: c.id })));
  toast('Pedido cancelado');
});

// ================= iFood: colar texto ou print =================
function lerIfood(txt) {
  const out = { num: '', hora: '', marca: /lado\s*b/i.test(txt) ? 'ladob' : 'st', itens: [], obs: [] };
  const mn = txt.match(/(?:pedido|n[ºo°]|#)\s*[:#]?\s*(\d{3,6})/i); if (mn) out.num = mn[1];
  const mh = txt.match(/\b([01]?\d|2[0-3])[:h]([0-5]\d)\b/); if (mh) out.hora = mh[1].padStart(2, '0') + ':' + mh[2];
  let ultimo = null;
  txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(l => {
    const m = l.match(/^(\d{1,2})\s*x?\s+(.{3,})$/i) || l.match(/^(\d{1,2})x\s*(.{3,})$/i);
    if (m) {
      const nome = m[2].replace(/R\$\s*[\d.,]+/g, '').trim(); const p = melhorProduto(nome);
      for (let k = 0; k < Math.min(+m[1], 20); k++) out.itens.push({ texto: nome, cod: p ? p.cod : null });
      ultimo = out.itens.length - 1; return;
    }
    if (ultimo != null && /^[-•+*]|^obs|^observa|^sem |^com /i.test(l)) {
      const limpo = l.replace(/^[-•+*]\s*/, '').replace(/R\$\s*[\d.,]+/g, '').trim();
      const a = melhorProduto(limpo, 'adicional');
      const it = out.itens[ultimo];
      if (a && a.tipo === 'adicional') { it.adds = (it.adds || []).concat(a.cod); } else it.obs = [it.obs, limpo].filter(Boolean).join(', ');
    }
  });
  return out;
}
function melhorProduto(nome, tipo) {
  const n = norm(nome); if (!n) return null;
  let best = null, bs = 0;
  C.itens.forEach(p => {
    if (tipo && p.tipo !== tipo) return;
    const pn = norm(p.nome); let s = 0;
    if (n.includes(pn)) s = 100 + pn.length; else { const ts = pn.split(' ').filter(t => t.length > 2); const hit = ts.filter(t => n.includes(t)).length; s = ts.length ? (hit / ts.length) * 80 : 0; }
    if (s > bs) { bs = s; best = p; }
  });
  return bs >= 50 ? best : null;
}
let ocr = null;
async function lerPrint(arquivo) {
  toast('Lendo o print…');
  if (!window.Tesseract) await new Promise((ok, erro) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'; s.onload = ok; s.onerror = erro; document.head.appendChild(s); });
  const r = await Tesseract.recognize(arquivo, 'por');
  return r.data.text;
}
function telaIfood() {
  const it = S.ui.ifood;
  let h = `<h2>iFood na mesma fila</h2><p class="sub">Cole aqui o texto do pedido copiado do gestor do iFood, ou cole/arraste um print da tela com o pedido aberto (Ctrl+V). Confira o card e confirme.</p>
    <textarea id="ifoodTxt" class="inp" data-f="ifoodTxt" placeholder="Cole o pedido aqui (Ctrl+V)">${esc(F.ifoodTxt || '')}</textarea>
    <div class="linha" style="margin:10px 0"><button class="bt pri" data-a="lerIfood">${ic('auto_fix_high')} Ler o pedido</button>
    <label class="bt">${ic('image')} Escolher print<input type="file" accept="image/*" data-ch="printIfood" style="display:none"></label></div>`;
  if (it) {
    h += `<div class="card"><div class="linha"><div class="campo" style="flex:1"><label>Nº do pedido</label><input id="ifNum" class="inp" data-f="ifNum" value="${esc(F.ifNum || '')}"></div>
      <div class="campo" style="width:120px"><label>Hora</label><input id="ifHora" class="inp" data-f="ifHora" placeholder="20:15" value="${esc(F.ifHora || '')}"></div></div>
      <div class="chips" style="margin-bottom:10px"><button class="chip ${it.marca === 'st' ? 'on' : ''}" data-a="ifMarca" data-c="st">Seu Trem</button><button class="chip ${it.marca === 'ladob' ? 'on' : ''}" data-a="ifMarca" data-c="ladob" style="${it.marca === 'ladob' ? 'background:var(--ladob);color:#fff' : ''}">Lado B</button></div>
      <div class="itens">${it.itens.map((x, i) => `<div class="item"><div class="corpo">${x.item ? `<div class="nm">${esc(x.item.nome)}</div>${descItem(x.item).map(l => `<div class="troca">${esc(l)}</div>`).join('')}` : `<div class="nm" style="color:var(--vermelho)">Não reconhecido: ${esc(x.texto)}</div><div class="sub">Tire e lance pela busca abaixo.</div>`}<div class="sub">do iFood: ${esc(x.texto || '')}</div></div><button class="bt-ic" data-a="ifTirar" data-i="${i}">${ic('close')}</button></div>`).join('')}</div>
      <div class="busca" style="margin-top:10px">${ic('search')}<input id="buscaIf" data-f="buscaIf" data-vivo placeholder="Acrescentar item (código ou nome)" value="${esc(F.buscaIf || '')}" autocomplete="off"></div>
      ${buscar(F.buscaIf).length ? `<div class="resultados">${buscar(F.buscaIf).map(p => `<div class="res" data-a="ifAdd" data-c="${p.cod}"><span class="cod">${p.cod}</span><span class="nm">${esc(p.nome)}</span></div>`).join('')}</div>` : ''}
      <div class="entre" style="margin-top:14px"><span class="sub">Referência pelo cardápio: ${R(subtotal(it.itens.filter(x => x.item).map(x => x.item)))}</span><button class="bt verde grande" data-a="ifConfirmar" ${it.itens.some(x => !x.item) || !it.itens.length ? 'disabled' : ''}>${ic('check')} Mandar para a TV</button></div></div>`;
  }
  const feitos = S.cards.filter(c => c.origem === 'ifood').sort((a, b) => b.criadoEm - a.criadoEm).slice(0, 8);
  if (feitos.length) h += `<div class="secao-t">Últimos do iFood</div>${feitos.map(c => `<div class="sub">#${esc(c.ref)} · ${hora(c.inicio)} · ${c.status === 'feito' ? 'feito' : 'na fila'}</div>`).join('')}`;
  return h;
}
function prepararIfood(txt) {
  const r = lerIfood(txt);
  F.ifNum = r.num; F.ifHora = r.hora;
  S.ui.ifood = {
    marca: r.marca,
    itens: r.itens.map(x => {
      if (!x.cod) return { texto: x.texto, item: null };
      const p = P[x.cod]; let it;
      if (p.tipo === 'burguer' || p.tipo === 'aperitivo' || p.tipo === 'simples' || p.tipo === 'bebida') {
        const MI = novoMI(p); MI.sel[0].adds = x.adds || []; MI.sel[0].obs = x.obs || ''; MI.obs = x.obs || ''; if (p.precoLivre) MI.preco = p.precoLivre[0];
        it = montarItem(MI);
      } else return { texto: x.texto + ' (combo: lance pela busca para escolher)', item: null };
      return { texto: x.texto, item: it };
    })
  };
  render();
}
A.lerIfood = () => { if (!F.ifoodTxt) { toast('Cole o pedido primeiro'); return; } prepararIfood(F.ifoodTxt); };
CH.printIfood = async el => { const f = el.files[0]; if (!f) return; try { F.ifoodTxt = await lerPrint(f); prepararIfood(F.ifoodTxt); } catch (e) { toast('Não consegui ler o print'); } };
document.addEventListener('paste', async e => {
  if (VIEW !== 'base' || S.ui.aba !== 'ifood') return;
  const img = [...(e.clipboardData || {}).items || []].find(i => i.type && i.type.indexOf('image') === 0);
  if (img) { e.preventDefault(); try { F.ifoodTxt = await lerPrint(img.getAsFile()); prepararIfood(F.ifoodTxt); } catch (x) { toast('Não consegui ler o print'); } }
});
A.ifMarca = d => { S.ui.ifood.marca = d.c; render(); };
A.ifTirar = d => { S.ui.ifood.itens.splice(+d.i, 1); render(); };
A.ifAdd = d => { const p = P[+d.c]; const add = it => { S.ui.ifood.itens.push({ texto: '(lançado)', item: it }); F.buscaIf = ''; render(); }; if (!precisaModal(p)) add(montarItem(novoMI(p))); else modalItem(p, add); };
A.ifConfirmar = async () => {
  const it = S.ui.ifood; const itens = it.itens.map(x => x.item);
  let ts = agora();
  if (/^\d{1,2}:\d{2}$/.test(F.ifHora || '')) { const [hh, mm] = F.ifHora.split(':').map(Number); const d = new Date(); d.setHours(hh, mm, 0, 0); if (d.getTime() <= agora() + 60000) ts = d.getTime(); }
  const ref = (F.ifNum ? '#' + F.ifNum : 'iFood ' + hora(ts));
  const base = { origem: 'ifood', marca: it.marca, ref, refId: 'if-' + (F.ifNum || uid()), criadoEm: ts, inicio: ts, ordem: ts };
  const ops = [];
  ['cozinha', 'bar'].forEach(s => { const g = itens.filter(i => temSetor(i, s)); if (g.length) { const c = cardNovo(s, g, base); ops.push({ op: 'set', c: 'cards', id: c.id, data: c }); } });
  ops.push({ op: 'set', c: 'vendas', id: 'i' + base.refId, data: { id: 'i' + base.refId, noiteId: noiteId(), canal: 'ifood', marca: it.marca, ref: 'iFood ' + ref, itens: itens.map(i => ({ cod: i.cod, nome: i.nome, preco: precoItem(i), desc: descItem(i) })), subtotal: subtotal(itens), dez: 0, frete: 0, total: subtotal(itens), referencia: true, pagamentos: [{ forma: 'iFood', valor: subtotal(itens) }], abertaEm: ts, fechadaEm: agora(), por: quem() } });
  await DB.batch(ops);
  S.ui.ifood = null; F.ifoodTxt = ''; F.ifNum = ''; F.ifHora = ''; render(); toast('Pedido do iFood na fila');
};

// ================= noite: links, relatório, nova noite =================
function telaNoite() {
  const n = cfg().noite || {}; const linkG = `${BQ}v=garcom&t=${n.token}`; const linkC = `${BQ}v=cozinha`;
  const vs = S.vendas; const tot = r2(vs.reduce((s, v) => s + v.total, 0));
  const formas = {}; vs.forEach(v => (v.pagamentos || []).forEach(p => { formas[p.forma] = r2((formas[p.forma] || 0) + p.valor); }));
  const canais = {}; vs.forEach(v => { canais[v.canal] = r2((canais[v.canal] || 0) + v.total); });
  const dez = r2(vs.reduce((s, v) => s + (v.dez || 0), 0));
  let h = `<div class="grade" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
    <div class="card"><h3>${ic('smartphone')} Link dos garçons desta noite</h3><div class="qr" data-qr="${esc(linkG)}"></div><div class="copia">${esc(linkG)}</div>
      <div class="linha" style="margin-top:8px"><button class="bt" data-a="copiar" data-c="${esc(linkG)}">${ic('content_copy')} Copiar</button></div><p class="sub">O link muda a cada "Nova noite". Cada um entra com o próprio código.</p></div>
    <div class="card"><h3>${ic('tv')} Cozinha (celular da TV)</h3><div class="qr" data-qr="${esc(linkC)}"></div><div class="copia">${esc(linkC)}</div>
      <p class="sub">Abre no celular da cozinha, entra com um código de cozinha ou gerente e espelha na TV com o celular deitado.</p></div>
    <div class="card"><h3>${ic('dark_mode')} Noite</h3><p>Começou ${dataBR(n.inicio)} às ${hora(n.inicio)}.</p><p class="sub">Nova noite: novo link dos garçons, limpa a fila da cozinha e começa outro relatório. Mesas abertas impedem.</p>
      <button class="bt verm" data-a="novaNoite">${ic('restart_alt')} Nova noite</button></div></div>
    <div class="entre nao-imprimir" style="margin:20px 0 10px"><h2 style="margin:0">Relatório da noite</h2><div class="linha">
      <select class="inp" style="width:auto" data-ch="verNoite">${[n.id].concat((cfg().noites || []).map(x => x.id)).map(id => `<option ${id === S.ui.noiteVer ? 'selected' : ''} value="${id}">${id === n.id ? 'Noite atual' : id}</option>`).join('')}</select>
      <button class="bt" data-a="imprimir">${ic('print')} Imprimir / PDF</button><button class="bt" data-a="csv">${ic('download')} Planilha (CSV)</button></div></div>
    <div class="kpis"><div class="kpi"><div class="v">${R(tot)}</div><div class="l">Total para NFC-e (com 10%)</div></div><div class="kpi"><div class="v">${vs.filter(v => !v.cancelado).length}</div><div class="l">Vendas fechadas</div></div><div class="kpi"><div class="v">${R(dez)}</div><div class="l">10% incluído</div></div>
      ${Object.entries(canais).map(([k, v]) => `<div class="kpi"><div class="v">${R(v)}</div><div class="l">${k === 'salao' ? 'Salão' : k === 'ifood' ? 'iFood (pelo cardápio)' : 'WhatsApp'}</div></div>`).join('')}
      ${Object.entries(formas).map(([k, v]) => `<div class="kpi"><div class="v">${R(v)}</div><div class="l">${esc(k)}</div></div>`).join('')}</div>
    <div class="card" style="overflow-x:auto"><table class="tab"><tr><th>Hora</th><th>Venda</th><th>Itens</th><th class="n">Subtotal</th><th class="n">10%</th><th class="n">Total NFC-e</th><th>Pagamentos</th></tr>
    ${vs.map(v => `<tr><td>${hora(v.fechadaEm)}</td><td><span class="tag ${v.canal}">${v.canal === 'salao' ? 'salão' : v.canal}</span>${v.marca === 'ladob' ? ' <span class="tag ladob">Lado B</span>' : ''}<br>${esc(v.ref)}${v.nomes && v.nomes.length ? '<br><span class="sub">' + esc(v.nomes.join(', ')) + '</span>' : ''}</td>
      <td>${v.itens.map(i => `${esc(i.nome)} <span class="sub">${R(i.preco)}</span>`).join('<br>')}${v.frete ? `<br><span class="sub">frete ${R(v.frete)} (fora da nota)</span>` : ''}</td><td class="n">${R(v.subtotal)}</td><td class="n">${R(v.dez)}</td><td class="n"><b>${R(v.total)}</b></td>
      <td>${(v.pagamentos || []).map(p => `${esc(p.forma)} ${R(p.valor)}`).join('<br>')}${v.comprovante ? '<br><span class="tag ok">comprovante</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="vazio">Nenhuma venda fechada ainda.</td></tr>'}</table></div>
    <p class="sub">iFood entra pelo preço do cardápio (referência); o valor real e as taxas ficam na planilha de Gestão do iFood. O 10% está dentro do total da NFC-e até a contadora responder.</p>`;
  return h + telaConferencia();
}

// ================= antifraude: conferência do caixa da noite =================
function pagamentosDaNoite() {
  const out = [];
  S.vendas.forEach(v => (v.pagamentos || []).forEach((p, i) => out.push(Object.assign({ venda: v.id, ref: v.ref, canal: v.canal, i }, p))));
  return out.sort((a, b) => (a.ts || 0) - (b.ts || 0));
}
function chavePg(p) { return p.venda + ':' + p.i; }
function telaConferencia() {
  const cf = S.conf || {}; const pgs = pagamentosDaNoite();
  const ehMaq = p => p.canal === 'salao' && (p.forma === 'Crédito' || p.forma === 'Débito');
  const pix = pgs.filter(p => /PIX/.test(p.forma));
  const soma = (arr) => r2(arr.reduce((s, p) => s + p.valor, 0));
  const sysCred = soma(pgs.filter(p => ehMaq(p) && p.forma === 'Crédito')), sysDeb = soma(pgs.filter(p => ehMaq(p) && p.forma === 'Débito'));
  const num = k => { const v = parseFloat(String((cf.valores || {})[k] == null ? '' : cf.valores[k]).replace(',', '.')); return isNaN(v) ? null : v; };
  const inputConf = (k, ph, st) => { const fk = 'cv-' + k.replace(/[^\w]/g, '_'); const v = F[fk] != null ? F[fk] : ((cf.valores || {})[k] || ''); return `<input id="${fk}" class="inp" style="${st}" inputmode="decimal" placeholder="${esc(ph)}" data-f="${fk}" data-ch="confV" data-k="${esc(k)}" value="${esc(v)}">`; };
  const dif = (real, sist) => real == null ? '<span class="sub">a conferir</span>' : Math.abs(real - sist) < 0.01 ? '<span class="tag ok">bateu ✓</span>' : `<span class="tag" style="background:var(--vermelho-cl);color:var(--vermelho)">diferença ${R(real - sist)}</span>`;
  // por garçom
  const gs = {};
  const g = n => (gs[n] = gs[n] || { PIX: 0, 'Crédito': 0, 'Débito': 0, Dinheiro: 0, outros: 0, cancel: 0, cancelV: 0, semDez: 0, estornos: 0, tirados: 0 });
  pgs.forEach(p => { if (!p.por || p.canal === 'ifood') return; const x = g(p.por); if (p.forma === 'PIX' || p.forma === 'Crédito' || p.forma === 'Débito' || p.forma === 'Dinheiro') x[p.forma] = r2(x[p.forma] + p.valor); else x.outros = r2(x.outros + p.valor); });
  S.vendas.forEach(v => {
    (v.cancelados || []).forEach(c => { if (typeof c !== 'object') return; const x = g(c.pediu || v.por || '?'); x.cancel++; x.cancelV = r2(x.cancelV + (c.valor || 0)); });
    if (v.semDez) (v.garcons || [v.por]).forEach(n => { g(n).semDez++; });
    (v.estornos || []).forEach(e => { g(e.tiradoPor || '?').estornos++; });
    if (v.tiradosAntes) g(v.por || '?').tirados += v.tiradosAntes;
  });
  const cancelados = []; S.vendas.forEach(v => (v.cancelados || []).forEach(c => { if (typeof c === 'object') cancelados.push(Object.assign({ ref: v.ref }, c)); }));
  const estornos = []; S.vendas.forEach(v => (v.estornos || []).forEach(e => estornos.push(Object.assign({ ref: v.ref }, e))));
  const ini = (cfg().noite || {}).inicio || 0;
  const trocaChave = (cfg().logLoja || []).filter(l => l.t >= ini && /chave PIX/.test(l.o));
  const pixOk = pix.filter(p => (cf.pix || {})[chavePg(p)]).length;
  let h = `<div class="entre" style="margin:28px 0 10px"><h2 style="margin:0">${ic('verified_user')} Conferência do caixa</h2><span class="sub">${cf.por ? 'por ' + esc(cf.por) + ' · ' + hora(cf.em) : 'antifraude'}</span></div>
    <p class="sub">Garante que tudo o que os garçons receberam chegou às contas da empresa: cada PIX no extrato, a maquininha e o dinheiro de cada um. Quem conferiu e quando fica registrado.</p>`;
  if (trocaChave.length) h += `<div class="card" style="background:var(--vermelho-cl);border-color:var(--vermelho);margin-bottom:10px"><b>${ic('warning')} A chave PIX foi alterada durante a noite</b>${trocaChave.map(l => `<div class="sub">${hora(l.t)} · ${esc(l.quem)}: ${esc(l.o)}</div>`).join('')}</div>`;
  h += `<div class="card" style="overflow-x:auto;margin-bottom:10px"><h3>Por garçom</h3><table class="tab"><tr><th>Quem</th><th class="n">PIX</th><th class="n">Crédito</th><th class="n">Débito</th><th class="n">Dinheiro</th><th class="n">Dinheiro entregue</th><th>Alertas</th></tr>
    ${Object.entries(gs).map(([n, x]) => { const k = 'din:' + n; const ent = num(k); const al = [x.cancel ? `${x.cancel} cancelamento(s) ${R(x.cancelV)}` : '', x.estornos ? `${x.estornos} pagamento(s) tirado(s)` : '', x.semDez ? `${x.semDez} mesa(s) sem 10%` : '', x.tirados ? `${x.tirados} item(ns) tirado(s) antes de enviar` : ''].filter(Boolean);
      return `<tr><td><b>${esc(n)}</b></td><td class="n">${R(x.PIX)}</td><td class="n">${R(x['Crédito'])}</td><td class="n">${R(x['Débito'])}</td><td class="n">${R(x.Dinheiro)}</td>
      <td class="n">${x.Dinheiro ? `${inputConf(k, 'R$', 'width:110px;min-height:36px')} ${dif(ent, x.Dinheiro)}` : '—'}</td>
      <td>${al.map(a => `<span class="tag aviso">${esc(a)}</span>`).join(' ') || '<span class="sub">nenhum</span>'}</td></tr>`; }).join('') || '<tr><td colspan="7" class="sub">Sem pagamentos ainda.</td></tr>'}</table></div>`;
  h += `<div class="grade" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));margin-bottom:10px"><div class="card"><h3>${ic('point_of_sale')} Maquininha (salão)</h3>
    <div class="total-linha"><span>Crédito no sistema</span><b>${R(sysCred)}</b></div><div class="linha">${inputConf('maqCred', 'Crédito no relatório da maquininha', 'flex:1')}${dif(num('maqCred'), sysCred)}</div>
    <div class="total-linha" style="margin-top:8px"><span>Débito no sistema</span><b>${R(sysDeb)}</b></div><div class="linha">${inputConf('maqDeb', 'Débito no relatório da maquininha', 'flex:1')}${dif(num('maqDeb'), sysDeb)}</div></div>
    <div class="card"><h3>${ic('qr_code')} PIX: ${pixOk} de ${pix.length} achados no extrato</h3><p class="sub">Abra o extrato da conta da empresa e marque cada PIX pelo valor e pela hora. PIX que não aparece = recebido fora da conta da casa.</p>
    ${pix.map(p => `<label class="entre" style="padding:6px 0;border-bottom:1px solid #f1f3f4;cursor:pointer"><span><input type="checkbox" data-ch="confPix" data-k="${esc(chavePg(p))}" ${(cf.pix || {})[chavePg(p)] ? 'checked' : ''}> ${p.ts ? hora(p.ts) : ''} · ${esc(p.ref)} · ${esc(p.por || '')}${p.txid ? `<br><span class="sub">código ${esc(p.txid)}${p.qr ? ' · QR do sistema' : ''}</span>` : ''}</span><b>${R(p.valor)}</b></label>`).join('') || '<div class="sub">Nenhum PIX na noite.</div>'}</div></div>`;
  if (cancelados.length || estornos.length) h += `<div class="card" style="margin-bottom:10px"><h3>${ic('gpp_maybe')} Cancelamentos e pagamentos tirados</h3>
    ${cancelados.map(c => `<div class="entre" style="padding:4px 0"><span>${esc(c.ref)} · <b>${esc(c.nome)}</b> · pediu ${esc(c.pediu || '?')} · autorizou <b>${esc(c.autorizou || '?')}</b> · ${esc(c.motivo || '')}</span><span>${c.valor ? R(c.valor) : ''} ${c.ts ? '<span class="sub">' + hora(c.ts) + '</span>' : ''}</span></div>`).join('')}
    ${estornos.map(e => `<div class="entre" style="padding:4px 0"><span>${esc(e.ref)} · pagamento ${esc(e.forma)} tirado por ${esc(e.tiradoPor || '?')} · autorizou <b>${esc(e.autorizou || '?')}</b> · ${esc(e.motivo || '')}</span><span>${R(e.valor)} <span class="sub">${hora(e.tiradoEm)}</span></span></div>`).join('')}</div>`;
  h += `<div class="card sub" style="line-height:1.6"><b style="color:var(--txt)">Regras do antifraude</b><br>
    • O garçom tira um item só antes de enviar. Depois, só gerente ou sócio cancela, com código e motivo.<br>
    • Pagamento registrado só sai com código do gerente; a mesa só fecha quando a soma bate com o total.<br>
    • O QR do PIX sai sempre do sistema, com a chave da casa e um código por cobrança; trocar a chave fica registrado e acende alerta aqui.<br>
    • A cozinha e o bar só produzem o que está na tela: nada sai sem estar lançado.<br>
    • No fim da noite: marcar cada PIX no extrato, digitar os totais da maquininha e o dinheiro de cada garçom.</div>`;
  return h;
}
async function salvarConf(fn) {
  const id = S.ui.noiteVer || noiteId();
  await DB.mutate('conferencias', id, c => { c = c || { noiteId: id, valores: {}, pix: {} }; fn(c); c.por = quem(); c.em = agora(); return c; });
}
CH.confV = (el, d) => salvarConf(c => { c.valores = c.valores || {}; c.valores[d.k] = el.value; });
CH.confPix = (el, d) => salvarConf(c => { c.pix = c.pix || {}; c.pix[d.k] = el.checked ? { por: quem(), em: agora() } : null; if (!el.checked) delete c.pix[d.k]; });
let confOff = null, confNoite = null;
function assinarConf(id) { if (confNoite === id) return; confNoite = id; if (confOff) confOff(); confOff = DB.listenDoc('conferencias', id, d => { S.conf = d; render(); }); }

// Caixa do próprio garçom (o que ele recebeu na noite)
function telaCaixa() {
  const eu = S.eu.nome; const pgs = pagamentosDaNoite().filter(p => p.por === eu);
  Object.values(S.mesas).forEach(m => (m.pagamentos || []).forEach(p => { if (p.por === eu) pgs.push(Object.assign({ ref: (m.label || rotuloMesa(m.id)) + ' (aberta)' }, p)); }));
  const formas = {}; pgs.forEach(p => { formas[p.forma] = r2((formas[p.forma] || 0) + p.valor); });
  return `<h2>Meu caixa</h2><p class="sub">O que você recebeu nesta noite. No fim, entregue o dinheiro ao gerente: ele confere com o sistema.</p>
    <div class="kpis">${Object.entries(formas).map(([k, v]) => `<div class="kpi"><div class="v">${R(v)}</div><div class="l">${esc(k)}</div></div>`).join('') || '<div class="sub">Nada recebido ainda.</div>'}</div>
    <div class="card" style="padding:4px 12px">${pgs.map(p => `<div class="total-linha"><span>${p.ts ? hora(p.ts) : ''} · ${esc(p.ref)} · ${esc(p.forma)}</span><b>${R(p.valor)}</b></div>`).join('')}</div>`;
}
CH.verNoite = el => { S.ui.noiteVer = el.value; assinarVendas(el.value); render(); };
A.imprimir = () => window.print();
A.csv = () => {
  const linhas = [['noite', 'hora', 'canal', 'marca', 'venda', 'itens', 'subtotal', '10%', 'frete', 'total_nfce', 'pagamentos']];
  S.vendas.forEach(v => linhas.push([v.noiteId, hora(v.fechadaEm), v.canal, v.marca, v.ref, v.itens.map(i => i.nome + ' ' + i.preco.toFixed(2)).join(' | '), v.subtotal.toFixed(2), (v.dez || 0).toFixed(2), (v.frete || 0).toFixed(2), v.total.toFixed(2), (v.pagamentos || []).map(p => p.forma + ' ' + p.valor.toFixed(2)).join(' | ')]));
  const csv = '﻿' + linhas.map(l => l.map(x => '"' + String(x).replace(/"/g, '""').replace(/\./g, ',') + '"').join(';')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'Relatorio da noite ' + (S.ui.noiteVer || noiteId()) + '.csv'; a.click();
};
A.novaNoite = () => {
  const abertas = Object.keys(S.mesas).length;
  if (abertas) { toast(abertas + ' mesa(s) aberta(s). Feche antes da nova noite.'); return; }
  pedirPIN('Começar uma nova noite?', ACESSO_TOTAL, async p => {
    const antiga = cfg().noite; const nova = novaNoiteObj();
    await DB.mutate('config', 'main', c => { c.noites = [{ id: antiga.id, inicio: antiga.inicio, fim: agora() }].concat(c.noites || []).slice(0, 60); c.noite = nova; return c; });
    const ops = S.cards.filter(c => c.status === 'feito').map(c => ({ op: 'del', c: 'cards', id: c.id }));
    S.delivery.filter(d => ['fim', 'cancelado', 'despachado'].includes(d.status)).forEach(d => ops.push({ op: 'del', c: 'delivery', id: d.id }));
    await DB.batch(ops);
    S.ui.noiteVer = nova.id; assinarVendas(nova.id);
    toast('Nova noite aberta por ' + p.nome + '. Mande o link novo aos garçons.');
  });
};

// ================= equipe e loja =================
function telaEquipe() {
  const c = cfg();
  return `<div class="grade" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))"><div class="card"><h2>Equipe</h2>
    <p class="sub">Cada pessoa tem um código de 4 números. Ele identifica quem fez cada mudança (não é senha de banco).</p>
    <table class="tab"><tr><th>Nome</th><th>Função</th><th>Código</th><th></th></tr>${equipeOrdenada().map(p => `<tr><td>${esc(p.nome)}</td><td><select class="inp" style="min-height:34px;padding:4px 8px;width:auto" data-ch="papelPessoa" data-id="${p.id}">${PAPEIS.map(([k, l]) => `<option value="${k}" ${p.papel === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td><td>••••</td><td class="n"><button class="bt-ic" data-a="tirarPessoa" data-id="${p.id}">${ic('delete')}</button></td></tr>`).join('')}</table>
    <div class="secao-t">Acrescentar</div>${campo('Nome', 'pNome', 'Nome')}${campo('Código (4 números)', 'pPin', '', 'numeric')}
    <div class="chips" style="margin-bottom:10px">${[['socio', 'Sócio'], ['gerente', 'Gerente'], ['cozinha', 'Chefe de chapa'], ['fritura', 'Chefe de fritura'], ['garcom', 'Gerente de mesas']].map(([k, l]) => `<button class="chip ${(S.ui.pPapel || 'garcom') === k ? 'on' : ''}" data-a="pPapel" data-c="${k}">${l}</button>`).join('')}</div>
    <button class="bt pri" data-a="addPessoa">${ic('person_add')} Acrescentar</button></div>
    <div class="card"><h2>Loja</h2>
    ${['lWa', 'lEnd', 'lPix', 'lPixNome', 'lPixCid', 'lTag', 'lMesas', 'lMin'].map(k => { if (F[k] == null) F[k] = { lWa: c.whatsapp, lEnd: c.endereco, lPix: (c.pix || {}).chave, lPixNome: (c.pix || {}).nome, lPixCid: (c.pix || {}).cidade, lTag: c.infiniteTag, lMesas: c.mesas, lMin: c.minPrato }[k]; return ''; }).join('')}
    ${campo('WhatsApp da casa', 'lWa', '31 9…', 'tel')}${campo('Endereço de retirada (Uber Flash)', 'lEnd', '')}${campo('Chave PIX', 'lPix', '')}${campo('Nome no PIX', 'lPixNome', '')}${campo('Cidade do PIX', 'lPixCid', '')}
    ${campo('InfiniteTag', 'lTag', 'seutrem')}${campo('Número de mesas', 'lMesas', '14', 'numeric')}${campo('Bebida com o prato entra em (min)', 'lMin', '15', 'numeric')}
    <button class="bt pri" data-a="salvarLoja">${ic('save')} Salvar</button>
    <p class="sub" style="margin-top:12px">Dados: ${DB.modo === 'nuvem' ? 'nuvem (Firebase)' : 'modo local (ensaio)'} · loja ${esc(LOJA)}</p></div></div>`;
}
A.pPapel = d => { S.ui.pPapel = d.c; render(); };
CH.papelPessoa = async (el, d) => {
  const novo = el.value;
  const outrosTotais = (cfg().pessoas || []).filter(p => p.id !== d.id && ACESSO_TOTAL.includes(p.papel)).length;
  if (!ACESSO_TOTAL.includes(novo) && !outrosTotais) { toast('Precisa ficar pelo menos uma pessoa com acesso total'); render(); return; }
  await DB.mutate('config', 'main', c => { const p = c.pessoas.find(x => x.id === d.id); if (!p) return undefined; c.logLoja = [{ t: agora(), quem: quem(), o: p.nome + ': ' + p.papel + ' → ' + novo }].concat(c.logLoja || []).slice(0, 100); p.papel = novo; return c; });
  toast('Função alterada');
};
A.addPessoa = async () => {
  if (!F.pNome || !/^\d{4}$/.test(F.pPin || '')) { toast('Nome e código de 4 números'); return; }
  if (await pessoaPorPin(F.pPin)) { toast('Esse código já é de outra pessoa'); return; }
  const p = { id: uid(), nome: F.pNome.trim(), h: await hashPin(F.pPin), papel: S.ui.pPapel || 'garcom' };
  await DB.mutate('config', 'main', c => { c.pessoas.push(p); return c; });
  F.pNome = ''; F.pPin = ''; toast(p.nome + ' na equipe');
};
A.tirarPessoa = d => { if (d.id === (S.eu || {}).id) { toast('Você não pode se tirar'); return; } if (!confirm('Tirar da equipe?')) return; DB.mutate('config', 'main', c => { c.pessoas = c.pessoas.filter(p => p.id !== d.id); return c; }); };
A.salvarLoja = async () => {
  await DB.mutate('config', 'main', c => {
    const novaChave = (F.lPix || '').trim();
    if (novaChave !== ((c.pix || {}).chave || '')) c.logLoja = [{ t: agora(), quem: quem(), o: 'chave PIX: ' + ((c.pix || {}).chave || '(vazia)') + ' → ' + novaChave }].concat(c.logLoja || []).slice(0, 100);
    c.whatsapp = F.lWa || ''; c.endereco = F.lEnd || ''; c.pix = { chave: novaChave, nome: F.lPixNome || 'SEU TREM', cidade: F.lPixCid || 'Belo Horizonte' };
    c.infiniteTag = (F.lTag || 'seutrem').replace(/^\$/, ''); c.mesas = Math.max(1, +F.lMesas || 14); c.minPrato = Math.max(1, +F.lMin || 15); return c;
  });
  toast('Loja salva');
};
function telaCardapio() {
  const cats = []; C.itens.forEach(p => { let c = cats.find(x => x.n === p.cat); if (!c) cats.push(c = { n: p.cat, i: [] }); c.i.push(p); });
  return `<h2>Cardápio do sistema</h2><p class="sub">Do Cardápio A3 FINAL, com os códigos confirmados por JP em 23/11. Mudança de preço ou item novo: peça ao Claude (arquivo menu.js).</p>
    <div class="grade" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">${cats.map(c => `<div class="card"><h3>${esc(c.n)}</h3><table class="tab">${c.i.map(p => `<tr><td><span class="cod">${p.cod}</span></td><td>${esc(p.nome)}</td><td>${p.setor === 'bar' ? '<span class="tag cinza">bar</span>' : ''}</td><td class="n">${p.precoLivre ? '17–30' : R(p.preco)}</td></tr>`).join('')}</table></div>`).join('')}</div>`;
}

// ================= telas =================
const TELAS = {};
TELAS.inicio = () => `<div class="pag-estreita" style="padding-top:40px"><div class="card plano"><h1>${esc(NOME_CURTO)}</h1><p class="sub">Sistema de atendimento</p>
  <div class="grade" style="margin-top:16px"><a class="bt pri grande" href="?v=base">${ic('desktop_windows')} Plataforma base</a><a class="bt grande" href="?v=cozinha">${ic('tv')} Painel da cozinha</a>
  <a class="bt grande" href="?v=pedido">${ic('shopping_bag')} Página de pedido (cliente)</a></div>
  <p class="sub" style="margin-top:16px">O app do garçom abre pelo link da noite, que a base gera.</p></div></div>`;

TELAS.base = () => {
  if (S.cfg === undefined) return '<div class="carregando">Carregando…</div>';
  if (!S.cfg) return telaConfigInicial();
  if (!S.eu) return telaLogin('Plataforma base', ACESSO_TOTAL);
  const aba = S.ui.aba || 'mesas';
  const nPg = S.delivery.filter(d => ['frete', 'pagamento'].includes(colunaPedido(d))).length;
  const abas = [['mesas', 'table_restaurant', 'Mesas ao vivo'], ['cozinha', 'skillet', 'Cozinha'], ['whatsapp', 'chat', 'WhatsApp do dia', nPg], ['ifood', 'delivery_dining', 'iFood'], ['noite', 'dark_mode', 'Noite e relatório'], ['cardapio', 'menu_book', 'Cardápio'], ['equipe', 'group', 'Equipe e loja']];
  let corpo;
  if (aba === 'mesas') corpo = S.ui.mesa ? `<div class="pag-estreita" style="padding:0">${telaMesa(S.ui.mesa)}</div>` : `<div class="entre"><h2>Mesas ao vivo</h2><span class="sub">Acesso total: abra qualquer mesa. Tudo fica registrado com o seu nome.</span></div>` + telaSlots();
  else if (aba === 'cozinha') return topoBase(abas, aba) + `<div class="tv" style="min-height:0">${telaFilaCozinha(true)}</div>`;
  else if (aba === 'whatsapp') corpo = telaWhatsApp();
  else if (aba === 'ifood') corpo = `<div class="pag-estreita" style="padding:0;max-width:760px">${telaIfood()}</div>`;
  else if (aba === 'noite') { if (!S.ui.noiteVer) { S.ui.noiteVer = noiteId(); } assinarVendas(S.ui.noiteVer); assinarConf(S.ui.noiteVer); corpo = telaNoite(); }
  else if (aba === 'cardapio') corpo = telaCardapio();
  else corpo = telaEquipe();
  return topoBase(abas, aba) + `<div class="pag">${corpo}</div>`;
};
function topoBase(abas, aba) {
  return `<div class="topo"><div class="marca"><span class="logo">ST</span><b>${esc(NOME_CURTO)}</b><span class="longo">· base</span></div>
    <nav class="abas">${abas.map(([k, i, l, b]) => `<button class="${k === aba ? 'on' : ''}" data-a="aba" data-c="${k}">${ic(i)} ${l}${b ? ` <span class="badge">${b}</span>` : ''}</button>`).join('')}</nav>
    <span class="esp"></span><span class="quem">${ic('account_circle')} ${esc(S.eu.nome)} <button class="bt-ic" data-a="sair" title="Trocar de pessoa">${ic('logout')}</button></span></div>`;
}

TELAS.garcom = () => {
  if (S.cfg === undefined) return '<div class="carregando">Carregando…</div>';
  if (!S.cfg) return '<div class="vazio">O sistema ainda não foi configurado na base.</div>';
  const n = cfg().noite || {};
  if (PARAMS.get('t') !== n.token) return `<div class="pag-estreita" style="padding-top:60px"><div class="card plano" style="text-align:center"><h1>${ic('link_off')} Link vencido</h1><p>Este link é de outra noite. Peça o link novo na base.</p></div></div>`;
  if (!S.eu) return telaLogin('App do garçom', ['garcom'].concat(ACESSO_TOTAL));
  const aba = S.ui.aba || 'mesas';
  const nb = filaDe('bar').length;
  if (aba === 'caixa') assinarVendas(noiteId());
  let corpo = aba === 'bebidas' ? telaBebidas() : aba === 'estudo' ? telaEstudo() : aba === 'caixa' ? telaCaixa() : (S.ui.mesa ? telaMesa(S.ui.mesa) : `<div class="entre"><h2>Mesas</h2><span class="sub">${esc(S.eu.nome)}</span></div>` + telaSlots());
  return `<div class="topo"><div class="marca"><span class="logo">ST</span><b>${esc(NOME_CURTO)}</b></div><span class="esp"></span><span class="quem">${esc(S.eu.nome)}<button class="bt-ic" data-a="sair">${ic('logout')}</button></span></div>
    <div class="pag com-nav">${corpo}</div>
    <nav class="nav-inf">${[['mesas', 'table_restaurant', 'Mesas'], ['bebidas', 'local_bar', 'Bebidas', nb], ['caixa', 'payments', 'Meu caixa'], ['estudo', 'school', 'Estudo']].map(([k, i, l, b]) => `<button class="${k === aba ? 'on' : ''}" data-a="aba" data-c="${k}"><span class="ms">${i}</span>${l}${b ? `<span class="badge">${b}</span>` : ''}</button>`).join('')}</nav>`;
};

TELAS.cozinha = () => {
  if (S.cfg === undefined) return '<div class="carregando">Carregando…</div>';
  if (!S.cfg) return '<div class="vazio">O sistema ainda não foi configurado na base.</div>';
  if (!S.eu) return telaLogin('Painel da cozinha', PAPEIS_COZINHA.concat(ACESSO_TOTAL));
  return `<div class="tv">${telaFilaCozinha(false)}</div>`;
};

// --- página da mesa (cliente) ---
TELAS.mesa = () => {
  const id = PARAMS.get('m'), k = PARAMS.get('k');
  const m = S.mesaCli;
  const topo = `<div class="cli-topo"><div class="n">${esc(NOME_CURTO)} · ${esc(m ? (m.label || rotuloMesa(id)) : 'Mesa ' + id)}</div><div class="frase">${esc(FRASE)}</div></div>`;
  if (S.mesaCli === undefined || S.cfg === undefined) return topo + '<div class="carregando">Carregando…</div>';
  if (!m || String(m.abertaEm) !== k) return topo + `<div class="pag-estreita"><div class="card vazio">Este QR é de uma mesa que já fechou. Peça um novo ao garçom.<br><br>${cfg().whatsapp ? `<a class="bt verde" href="${wa(cfg().whatsapp, 'Olá!')}">${ic('chat')} Falar com o Seu Trem</a>` : ''}</div></div>`;
  if (S.ui.feitoCli) return topo + `<div class="pag-estreita"><div class="card" style="text-align:center"><h2>Obrigado, ${esc(S.ui.feitoCli)}!</h2><p>Toque para abrir a conversa com a casa. A conta chega por lá.</p>
    <a class="bt verde grande bloco" href="${wa(cfg().whatsapp, `Olá! Sou ${S.ui.feitoCli}, estou na ${m.label || rotuloMesa(id)}.`)}">${ic('chat')} Falar com o Seu Trem</a></div></div>`;
  return topo + `<div class="pag-estreita"><div class="card"><h2>Bem-vindo!</h2><p class="sub">Deixe seu nome e WhatsApp: a conta da mesa chega direto na sua conversa com a casa.</p>
    ${campo('Seu nome', 'cliNome', '')}${campo('Seu WhatsApp (com DDD)', 'cliTel', '31 9…', 'tel', 'tel')}
    <label class="sub" style="display:flex;gap:8px;align-items:flex-start;margin-bottom:14px"><input type="checkbox" data-f="cliLgpd" ${F.cliLgpd ? 'checked' : ''} style="margin-top:3px"> ${esc(LGPD)}</label>
    <button class="bt verde grande bloco" data-a="cliEntrar">${ic('chat')} Falar com o Seu Trem</button></div></div>`;
};
A.cliEntrar = async () => {
  const id = PARAMS.get('m'); const nome = (F.cliNome || '').trim(); const tel = soDig(F.cliTel);
  if (!nome || tel.length < 10) { toast('Nome e WhatsApp com DDD'); return; }
  if (!F.cliLgpd) { toast('Marque a autorização para seguir'); return; }
  await DB.mutate('mesas', id, m => { if (!m) return undefined; m.clientes = (m.clientes || []).filter(c => soDig(c.tel) !== tel).concat({ nome, tel, ts: agora() }); m.log = (m.log || []).concat({ t: agora(), quem: nome, o: 'entrou pelo QR (WhatsApp ' + tel + ')' }); return m; });
  await DB.mutate('clientes', telWa(tel), x => { x = x || { nome, tel: telWa(tel), pedidos: 0, visitas: 0, criadoEm: agora() }; x.nome = nome; x.lgpd = true; x.lgpdEm = agora(); return x; });
  S.ui.feitoCli = nome; render();
  abrir(wa(cfg().whatsapp, `Olá! Sou ${nome}, estou na ${S.mesaCli.label || rotuloMesa(id)}.`));
};

// --- página de pedido (delivery do WhatsApp) ---
let CARRINHO = LS.get('st-carrinho', []);
function salvarCarrinho() { LS.set('st-carrinho', CARRINHO); }
// Visual da página de pedido: categorias com ícone e cor (estética Google, R43; vitrine inspirada nos apps de delivery)
const CATS_PEDIDO = {
  'Circuito 2026': { ic: 'emoji_events', cor: '#b06000', bg: '#fef7e0', titulo: 'Circuito 2026 · lançamento' },
  'Burguers': { ic: 'lunch_dining', cor: '#c5221f', bg: '#fce8e6', sub: 'Todos no pão brioche artesanal. Versão sem trigo: pão sem glúten +R$ 5.' },
  'Combo do burguer': { ic: 'fastfood', cor: '#9334e6', bg: '#f3e8fd', titulo: 'Complete com o combo', sub: 'Na compra de qualquer burguer: fritas + brownie ou alfajor + bebida.' },
  'Aperitivos': { ic: 'tapas', cor: '#188038', bg: '#e6f4ea', titulo: 'Aperitivos para começar ou dividir' },
  'Combos da mesa': { ic: 'dinner_dining', cor: '#1a73e8', bg: '#e8f0fe', titulo: 'Combos para dividir' },
  'Acompanhamentos e sobremesas': { ic: 'icecream', cor: '#d01884', bg: '#fde7f3', titulo: 'Acompanhamentos e doces' },
  'Bebidas': { ic: 'local_bar', cor: '#007b83', bg: '#e4f7fb' }
};
const ORDEM_CATS = ['Circuito 2026', 'Burguers', 'Combo do burguer', 'Aperitivos', 'Combos da mesa', 'Acompanhamentos e sobremesas', 'Bebidas'];
function icProd(p) {
  if (!p) return 'restaurant';
  if (p.tipo === 'burguer') return 'lunch_dining';
  if (p.tipo === 'comboBurguer') return 'fastfood';
  if (p.chapa === 'quesadilla') return 'local_pizza';
  if (p.espeto) return 'kebab_dining';
  if ([21, 24, 51].includes(p.cod)) return 'eco';
  if ([22, 23, 25, 81, 82].includes(p.cod)) return 'fastfood';
  if (p.cod === 83) return 'cake'; if (p.cod === 84) return 'cookie'; if (p.cod === 53) return 'icecream';
  if (p.cod === 41 || p.cod === 42) return 'dinner_dining'; if (p.cod === 43) return 'groups'; if (p.cod === 50) return 'emoji_events';
  return { 91: 'local_drink', 92: 'water_full', 93: 'sports_bar', 94: 'glass_cup', 95: 'local_bar' }[p.cod] || 'restaurant';
}
function inclusoCombo(c) {
  const beb = { sucoRefri: ['local_drink', 'Suco ou refri'], soda: ['glass_cup', 'Soda italiana'], cerveja: ['sports_bar', 'Cerveja'], drink: ['local_bar', 'Drink da casa'] }[c.bebida];
  return [['fastfood', 'Fritas'], ['cake', 'Brownie ou alfajor'], beb];
}
function htmlInclusos(lista, grande) { return `<div class="inclusos ${grande ? 'g' : ''}">` + lista.map(([i, t]) => `<span class="incl">${ic(i)}<small>${esc(t)}</small></span>`).join('<span class="mais">+</span>') + '</div>'; }
function inclusosDe(p) {
  if (p.tipo === 'comboBurguer') return [['lunch_dining', 'Burguer']].concat(inclusoCombo(p));
  if (p.cod === 41) return [['lunch_dining', 'Burguer'], ['local_pizza', 'Quesadilla']];
  if (p.cod === 42) return [['lunch_dining', 'Burguer'], ['local_pizza', 'Quesadilla'], ['kebab_dining', 'Espeto']];
  if (p.cod === 43) return [['lunch_dining', '2 burguers'], ['local_pizza', '2 quesadillas'], ['kebab_dining', '2 espetos'], ['icecream', 'Sobremesa']];
  if (p.cod === 50) return [['eco', 'Filezinhos'], ['lunch_dining', 'Burguer'], ['icecream', 'Sobremesa']];
  return null;
}
function precoCard(p) {
  if (p.precoLivre) return 'R$ 17 a 30';
  if (p.tipo === 'comboBurguer') return '+ ' + R(p.preco);
  if (p.cod === 41 || p.cod === 42) return 'a partir de ' + R(p.preco);
  return R(p.preco);
}
function cardProduto(p) {
  const k = CATS_PEDIDO[p.cat] || {}; const inc = inclusosDe(p);
  const n = CARRINHO.filter(i => i.cod === p.cod).length;
  return `<button class="pc" data-a="cliProd" data-c="${p.cod}">
    <div class="pc-img" style="background:${k.bg};color:${k.cor}">${ic(icProd(p))}${p.selo ? `<span class="selo">${esc(p.selo)}</span>` : ''}${n ? `<span class="qtd">${n}</span>` : ''}</div>
    <div class="pc-corpo"><div class="pc-nome">${esc(p.nome)}</div>
    ${inc ? htmlInclusos(inc) : (p.desc ? `<div class="pc-desc">${esc(p.desc)}</div>` : '')}
    ${p.economia ? `<div class="pc-eco">${esc(p.economia.split('·').pop().trim())}</div>` : ''}
    <div class="pc-pe"><b>${precoCard(p)}</b><span class="pc-add">${ic('add')}</span></div></div></button>`;
}
function topoPedido(compacto) {
  if (compacto) return `<div class="cli-topo"><div class="n">${esc(NOME_CURTO)}</div></div>`;
  return `<div class="hero"><div class="hero-in"><div class="hero-logo">ST</div><div><div class="hero-n">${esc(NOME_CURTO)}</div><div class="hero-s">Plant-based · um trem feito procê desde 2020</div></div></div>
    <div class="hero-chips"><span>${ic('hail')} Retirada pelo Uber Flash</span><span>${ic('two_wheeler')} Entrega por moto</span><span>${ic('payments')} PIX ou cartão</span><span>${ic('eco')} 100% vegano</span></div></div>`;
}
TELAS.pedido = () => {
  if (S.cfg === undefined) return '<div class="carregando">Carregando…</div>';
  if (S.ui.pedidoFeito) return topoPedido(true) + telaPedidoFeito();
  if (S.ui.checkout) return topoPedido(true) + telaCheckout();
  const lista = C.itens.filter(p => p.tipo !== 'adicional' && !(p.tipo === 'comboMesa' && p.partes.length === 1));
  const q = norm(F.buscaCli || '');
  const filtra = p => !q || norm(p.nome + ' ' + (p.desc || '')).includes(q);
  const cats = ORDEM_CATS.map(n => ({ n, i: lista.filter(p => p.cat === n && filtra(p)) })).filter(c => c.i.length);
  const tot = subtotal(CARRINHO);
  let h = topoPedido(false);
  h += `<div class="cats-nav">${cats.map(c => `<button class="cat-chip" data-a="irCat" data-c="${esc(c.n)}">${ic(CATS_PEDIDO[c.n].ic)} ${esc(c.n)}</button>`).join('')}</div>`;
  h += `<div class="pag-estreita pedido" style="padding-bottom:110px">
    <div class="busca" style="margin:4px 0 14px">${ic('search')}<input id="buscaCli" data-f="buscaCli" data-vivo placeholder="Buscar no cardápio" value="${esc(F.buscaCli || '')}" autocomplete="off"></div>`;
  if (!q) h += `<div class="sec-t">Destaques da casa</div><div class="destaques">${[P[50], P[30], P[43]].map(p => { const k = CATS_PEDIDO[p.cat]; return `<button class="dq" data-a="cliProd" data-c="${p.cod}" style="background:${k.bg}"><div class="dq-ic" style="color:${k.cor}">${ic(icProd(p))}</div>${p.selo ? `<span class="selo-in">${esc(p.selo)}</span>` : ''}<b class="dq-n">${esc(p.cod === 30 ? 'Combo do burguer' : p.nome)}</b>${htmlInclusos(inclusosDe(p))}${p.economia ? `<div class="pc-eco">${esc(p.economia)}</div>` : ''}<div class="dq-p">${precoCard(p)}</div></button>`; }).join('')}</div>`;
  cats.forEach(c => {
    const k = CATS_PEDIDO[c.n];
    h += `<div class="sec" id="cat-${norm(c.n).replace(/\W+/g, '-')}"><div class="sec-t"><span class="sec-ic" style="background:${k.bg};color:${k.cor}">${ic(k.ic)}</span>${esc(k.titulo || c.n)}</div>${k.sub ? `<div class="sec-sub">${esc(k.sub)}</div>` : ''}<div class="grade-p">${c.i.map(cardProduto).join('')}</div></div>`;
  });
  if (!cats.length) h += '<div class="vazio">Nada encontrado.</div>';
  h += `<p class="sub" style="text-align:center;margin-top:28px">${esc(FRASE)}</p></div>`;
  if (CARRINHO.length) h += `<div class="carrinho-bar"><button class="bt-sacola" data-a="irCheckout"><span class="sac-n">${CARRINHO.length}</span><span>Ver sacola</span><b>${R(tot)}</b></button></div>`;
  return h;
};
A.irCat = d => { const el = document.getElementById('cat-' + norm(d.c).replace(/\W+/g, '-')); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: 'smooth' }); };
A.cliProd = d => { const p = P[+d.c]; modalItem(p, it => { CARRINHO.push(it); salvarCarrinho(); toast(it.nome + ' na sacola'); render(); }, { botao: 'Pôr na sacola', cliente: true }); };
A.irCheckout = () => { S.ui.checkout = true; window.scrollTo(0, 0); render(); };
A.voltarCardapio = () => { S.ui.checkout = false; render(); };
A.tirarCarrinho = d => { CARRINHO.splice(+d.i, 1); salvarCarrinho(); render(); };
A.repetirItem = d => { const it = clone(CARRINHO[+d.i]); it.uid = uid(); CARRINHO.splice(+d.i + 1, 0, it); salvarCarrinho(); render(); };
function opcao(a, v, atual, i, t, s) { return `<button class="opcao ${atual === v ? 'on' : ''}" data-a="${a}" data-c="${v}">${ic(i)}<span><b>${t}</b><small>${s}</small></span>${ic(atual === v ? 'radio_button_checked' : 'radio_button_unchecked')}</button>`; }
function telaCheckout() {
  const tot = subtotal(CARRINHO); const ent = F.entrega || 'retirada'; const pg = F.pgto || 'pix';
  if (F.pNomeC == null) { const u = LS.get('st-cliente', {}); F.pNomeC = u.nome || ''; F.pTelC = u.tel || ''; }
  const tem = re => CARRINHO.some(i => (i.partes || []).some(p => re.test(p.nome)));
  const sug = [].concat(tem(/fritas|onion/i) ? [] : [P[81]], tem(/suco|refri|cerveja|soda|drink/i) ? [] : [P[91], P[92]], tem(/brownie|alfajor|sobremesa/i) ? [] : [P[83], P[84]]).slice(0, 4);
  return `<div class="pag-estreita pedido" style="padding-bottom:40px"><button class="bt txt" data-a="voltarCardapio">${ic('arrow_back')} Voltar ao cardápio</button>
    <div class="etapa"><div class="etapa-t"><span class="etapa-n">1</span> Sua sacola</div>
      <div class="itens">${CARRINHO.map((it, i) => { const p = P[it.cod] || {}; const k = CATS_PEDIDO[p.cat] || {}; return `<div class="item"><span class="it-ic" style="background:${k.bg};color:${k.cor}">${ic(icProd(p))}</span><div class="corpo"><div class="nm">${esc(it.nome)}</div>${descItem(it).map(l => `<div class="troca">${esc(l)}</div>`).join('')}</div><div class="pr">${R(precoItem(it))}<div class="qtd-bt"><button class="bt-ic" data-a="tirarCarrinho" data-i="${i}" title="Tirar">${ic('remove_circle_outline')}</button><button class="bt-ic" data-a="repetirItem" data-i="${i}" title="Mais um igual">${ic('add_circle_outline')}</button></div></div></div>`; }).join('') || '<div class="vazio">Sua sacola está vazia.</div>'}</div>
      ${sug.length && CARRINHO.length ? `<div class="sub" style="margin:14px 0 8px">Peça também</div><div class="sugs">${sug.map(p => `<button class="sug" data-a="cliProd" data-c="${p.cod}"><span class="sug-ic" style="background:${CATS_PEDIDO[p.cat].bg};color:${CATS_PEDIDO[p.cat].cor}">${ic(icProd(p))}</span><span class="sug-n">${esc(p.nome.replace(' (acompanha)', ''))}</span><b>${R(p.preco)}</b></button>`).join('')}</div>` : ''}</div>
    <div class="etapa"><div class="etapa-t"><span class="etapa-n">2</span> Você</div>${campo('Nome', 'pNomeC', '')}${campo('WhatsApp (com DDD)', 'pTelC', '31 9…', 'tel', 'tel')}</div>
    <div class="etapa"><div class="etapa-t"><span class="etapa-n">3</span> Como recebe</div>
      <div class="opcoes">${opcao('cliEnt', 'retirada', ent, 'hail', 'Retirada', 'Você chama o Uber Flash quando avisarmos que está pronto')}${opcao('cliEnt', 'moto', ent, 'two_wheeler', 'Entrega por moto', 'A casa chama a moto; o frete vem pelo WhatsApp')}</div>
      ${ent === 'moto' ? `<div style="margin-top:12px">${campo('Rua', 'eRua', '')}<div class="linha"><div style="flex:1">${campo('Número', 'eNum', '', 'numeric')}</div><div style="flex:2">${campo('Complemento', 'eCompl', 'apto, bloco')}</div></div>${campo('Bairro', 'eBairro', '')}${campo('Ponto de referência', 'eRef', '')}</div>` : ''}</div>
    <div class="etapa"><div class="etapa-t"><span class="etapa-n">4</span> Como paga</div>
      <div class="opcoes">${opcao('cliPg', 'pix', pg, 'qr_code', 'PIX', 'Código copia e cola na hora, com o valor certinho')}${opcao('cliPg', 'cartao', pg, 'credit_card', 'Cartão', 'Crédito ou débito no link seguro da InfinitePay')}</div>
      <div style="margin-top:12px">${campo('Observação para a cozinha (opcional)', 'pObs', 'ex.: sem cebola')}</div></div>
    <div class="etapa"><div class="total-linha"><span>Itens</span><span>${R(tot)}</span></div><div class="total-linha"><span>${ent === 'moto' ? 'Frete' : 'Retirada'}</span><span>${ent === 'moto' ? 'calculado no WhatsApp' : 'sem taxa'}</span></div>
      <div class="total-linha forte"><span>Total</span><span>${R(tot)}${ent === 'moto' ? ' + frete' : ''}</span></div>
      <label class="sub" style="display:flex;gap:8px;align-items:flex-start;margin:12px 0 14px"><input type="checkbox" data-f="pLgpd" ${F.pLgpd ? 'checked' : ''} style="margin-top:3px"> ${esc(LGPD)}</label>
      <button class="bt verde grande bloco" data-a="finalizarPedido" ${CARRINHO.length ? '' : 'disabled'}>${ic('check')} Finalizar pedido · ${R(tot)}</button></div></div>`;
}
A.cliEnt = d => { F.entrega = d.c; render(); };
A.cliPg = d => { F.pgto = d.c; render(); };
A.finalizarPedido = async (d, el) => {
  const nome = (F.pNomeC || '').trim(), tel = soDig(F.pTelC); const ent = F.entrega || 'retirada', pg = F.pgto || 'pix';
  if (!nome || tel.length < 10) { toast('Nome e WhatsApp com DDD'); return; }
  if (ent === 'moto' && (!F.eRua || !F.eNum || !F.eBairro)) { toast('Rua, número e bairro'); return; }
  if (!F.pLgpd) { toast('Marque a autorização para seguir'); return; }
  el.disabled = true;
  try {
    LS.set('st-cliente', { nome, tel });
    const c = await DB.mutate('config', 'main', x => { x.seqPedido = (x.seqPedido || 0) + 1; return x; });
    const num = c.seqPedido;
    const cl = await DB.mutate('clientes', telWa(tel), x => { x = x || { nome, tel: telWa(tel), pedidos: 0, visitas: 0, criadoEm: agora() }; x.nome = nome; x.pedidos = (x.pedidos || 0) + 1; x.lgpd = true; x.ultimo = agora(); return x; });
    const nPedido = cl.pedidos; const id = 'p' + num + '-' + uid().slice(0, 4); const t = agora();
    const itens = CARRINHO.map(i => Object.assign({}, i, { enviado: true }));
    if (F.pObs) { const alvo = itens.find(i => temSetor(i, 'cozinha')) || itens[0]; const pt = alvo.partes.find(x => x.setor === 'cozinha') || alvo.partes[0]; pt.obs = [pt.obs, F.pObs].filter(Boolean).join(', '); }
    const ped = { id, num, ts: t, noiteId: noiteId(), cliente: { nome, tel }, nPedido, itens, entrega: { tipo: ent, rua: F.eRua || '', numero: F.eNum || '', compl: F.eCompl || '', bairro: F.eBairro || '', ref: F.eRef || '' }, frete: ent === 'moto' ? null : 0, pagamento: pg, status: ent === 'moto' ? 'frete' : (nPedido > 1 ? 'preparo' : 'pagamento'), pg: { confirmado: false }, obs: F.pObs || '' };
    const base = { origem: 'whatsapp', ref: nome.split(' ')[0] + ' · #' + num, refId: id, nPedido, status: nPedido > 1 ? 'fila' : 'aguardando', pgPendente: nPedido > 1, criadoEm: t, inicio: t, ordem: t, por: 'cliente' };
    const ops = [];
    ['cozinha', 'bar'].forEach(s => { const g = itens.filter(i => temSetor(i, s)); if (g.length) { const cd = cardNovo(s, g, base); ops.push({ op: 'set', c: 'cards', id: cd.id, data: cd }); } });
    if (pg === 'cartao' && ent === 'retirada') { try { ped.pg.link = await criarLinkIP(ped, subtotal(itens)); } catch (e) { ped.pg.erroLink = String(e.message || e); } }
    ops.push({ op: 'set', c: 'delivery', id, data: ped });
    await DB.batch(ops);
    CARRINHO = []; salvarCarrinho(); S.ui.pedidoFeito = ped; S.ui.checkout = false; render(); window.scrollTo(0, 0);
  } catch (e) { el.disabled = false; toast('Não deu para finalizar: ' + (e.message || e)); }
};
function msgPedidoCliente(p) {
  let s = `Olá! Fiz o pedido ${p.num} pelo site.\n\n`;
  p.itens.forEach(it => { s += `• ${it.nome}: ${R(precoItem(it))}\n`; descItem(it).forEach(l => { s += `   ${l}\n`; }); });
  s += `\nItens: ${R(subtotal(p.itens))}\n`;
  s += p.entrega.tipo === 'moto' ? `Entrega em: ${[p.entrega.rua, p.entrega.numero, p.entrega.compl, p.entrega.bairro].filter(Boolean).join(', ')}\nAguardo o frete e o total.` : 'Retirada: eu chamo o Uber Flash.';
  s += `\nPagamento: ${p.pagamento === 'pix' ? 'PIX' : 'cartão'}`;
  if (p.entrega.tipo !== 'moto') s += p.pagamento === 'pix' ? '\nSegue o comprovante do PIX:' : '\nSegue o comprovante do cartão:';
  return s;
}
function telaPedidoFeito() {
  const p = S.ui.pedidoFeito; const tot = subtotal(p.itens); const casa = cfg().whatsapp;
  let h = `<div class="pag-estreita"><div class="card"><h2>${ic('check_circle')} Pedido ${p.num} recebido!</h2>`;
  if (p.nPedido > 1) h += `<p class="sub">Que bom te ver de novo: é o seu ${ordinal(p.nPedido)} pedido com a gente.</p>`;
  if (p.entrega.tipo === 'moto') {
    h += `<p>Agora a gente calcula o frete para <b>${esc(p.entrega.bairro)}</b> e te manda o total no WhatsApp.</p><a class="bt verde grande bloco" href="${wa(casa, msgPedidoCliente(p))}" target="_blank">${ic('chat')} Abrir o WhatsApp</a>`;
  } else if (p.pagamento === 'pix') {
    const pix = pixCopiaCola(tot, 'P' + p.num);
    h += `<p>Total: <b style="font-size:22px">${R(tot)}</b></p><p>Pague no PIX e mande o comprovante no WhatsApp. ${p.nPedido > 1 ? 'Seu pedido já vai para a produção.' : 'Assim que o pagamento for confirmado, começamos.'}</p>
      ${pix ? `<div class="qr" data-qr="${esc(pix)}"></div><div class="sub">PIX copia e cola:</div><div class="copia">${esc(pix)}</div><button class="bt bloco" style="margin:8px 0" data-a="copiar" data-c="${esc(pix)}">${ic('content_copy')} Copiar o código PIX</button>` : `<p>Chave PIX: <b>${esc((cfg().pix || {}).chave || '')}</b></p>`}
      <a class="bt verde grande bloco" href="${wa(casa, msgPedidoCliente(p))}" target="_blank">${ic('send')} Mandar pedido e comprovante no WhatsApp</a>`;
  } else {
    h += `<p>Total: <b style="font-size:22px">${R(tot)}</b></p>`;
    h += p.pg.link ? `<p>Pague com cartão no link seguro da InfinitePay. Depois, mande o comprovante no WhatsApp.</p><a class="bt pri grande bloco" href="${esc(p.pg.link)}">${ic('credit_card')} Pagar com cartão</a>`
      : `<p>O link do cartão vem pelo WhatsApp em instantes.</p><a class="bt verde grande bloco" href="${wa(casa, msgPedidoCliente(p))}" target="_blank">${ic('chat')} Abrir o WhatsApp</a>`;
  }
  return h + `<button class="bt txt bloco" style="margin-top:10px" data-a="novoPedido">Fazer outro pedido</button></div></div>`;
}
A.novoPedido = () => { S.ui.pedidoFeito = null; render(); };

// --- volta da InfinitePay ---
TELAS.pago = () => {
  const topo = `<div class="cli-topo"><div class="n">${esc(NOME_CURTO)}</div><div class="frase">${esc(FRASE)}</div></div>`;
  const r = S.ui.pago;
  if (!r) return topo + '<div class="carregando">Conferindo o pagamento…</div>';
  const casa = cfg().whatsapp; const rec = PARAMS.get('receipt_url') || '';
  const txt = `Olá! Paguei o pedido ${r.num || ''} no ${PARAMS.get('capture_method') === 'pix' ? 'PIX' : 'cartão'} pela InfinitePay. Comprovante: ${rec}`;
  return topo + `<div class="pag-estreita"><div class="card" style="text-align:center">${r.paid ? `<h2>${ic('check_circle')} Pagamento confirmado!</h2><p>Para fechar, mande o comprovante no WhatsApp (é a nossa dupla conferência).</p>` : `<h2>Ainda não confirmamos o pagamento</h2><p class="sub">Se você pagou, mande o comprovante no WhatsApp que a gente confere.</p>`}
    <a class="bt verde grande bloco" href="${wa(casa, txt)}">${ic('send')} Mandar o comprovante no WhatsApp</a>${rec ? `<p><a href="${esc(rec)}" target="_blank">Ver comprovante</a></p>` : ''}</div></div>`;
};
async function iniciarPago() {
  const id = PARAMS.get('id'); const q = { order_nsu: PARAMS.get('order_nsu') || id, transaction_nsu: PARAMS.get('transaction_nsu'), slug: PARAMS.get('slug') };
  let res = { paid: false };
  try { res = await checarIP(q); } catch (e) {}
  const ped = await DB.get('delivery', id);
  if (ped) {
    const ip = { paid: !!res.paid, amount: res.amount || null, paid_amount: res.paid_amount || null, capture_method: res.capture_method || PARAMS.get('capture_method') || null, receipt_url: PARAMS.get('receipt_url') || null, slug: q.slug, transaction_nsu: q.transaction_nsu, em: agora() };
    const forma = ip.capture_method === 'pix' ? 'PIX (InfinitePay)' : 'Cartão (InfinitePay)';
    await DB.update('delivery', id, { pg: Object.assign({}, ped.pg, { ip, forma }) });
  }
  S.ui.pago = { paid: !!res.paid, num: ped ? ped.num : '' }; render();
}

// ================= início =================
async function iniciar() {
  try { DB = window.FIREBASE_CONFIG ? await dbNuvem(window.FIREBASE_CONFIG) : dbLocal(); }
  catch (e) { console.error(e); $('#app').innerHTML = `<div class="vazio">Não consegui conectar à nuvem (${esc(e.code || e.message)}). Confira a internet e recarregue.</div>`; return; }
  document.body.classList.toggle('tv', VIEW === 'cozinha');
  if (VIEW === 'base') { assinar(['config', 'mesas', 'cards', 'delivery', 'fretes']); }
  else if (VIEW === 'garcom') { assinar(['config', 'mesas', 'cards']); }
  else if (VIEW === 'cozinha') { assinar(['config', 'cards']); }
  else if (VIEW === 'mesa') { assinar(['config']); DB.listenDoc('mesas', PARAMS.get('m'), m => { S.mesaCli = m; render(); }); }
  else if (VIEW === 'pedido') { assinar(['config']); }
  else if (VIEW === 'pago') { assinar(['config']); iniciarPago(); }
  setInterval(() => { tentarEu(); render(); }, 15000);
  render();
}
function tentarEu() {
  if (S.cfg && S.eu) { const p = (cfg().pessoas || []).find(x => x.id === S.eu.id); if (!p) S.eu = null; }
  if (!S.eu && S.cfg) { S.eu = carregarEu(); if (S.eu && VIEW === 'cozinha') telaLigada(); }
}
iniciar();
})();
