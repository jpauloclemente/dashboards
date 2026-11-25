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
// Preço curto, sempre com R$ (JP, 24/11/2026: "tudo que representar preço não pode ser somente 8"): R$ 8 · R$ 49,90
const Rc = v => { v = r2(v); return 'R$ ' + (Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',')); };
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
// Celular: tela estreita com toque. Na base, o celular entra só com código de sócio (JP, 23/11/2026).
const CELULAR = (() => { try { return matchMedia('(max-width: 820px)').matches && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window); } catch (e) { return false; } })();
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
const P = {};
let BURGUERS = [], ADICIONAIS = [];
// Bebidas e sobremesas: lista editável na base (config.extras); enquanto ninguém editar, vale a lista inicial do menu.js.
let EXTRAS_CFG = null;
function extrasAtuais() { return Array.isArray(EXTRAS_CFG) ? EXTRAS_CFG : C.EXTRAS; }
// Ajustes do menu.js (EXTRAS_AJUSTES) sobre a lista que a base já gravou: valem na leitura até a próxima edição na base,
// que grava a lista ajustada e marca os ajustes como feitos (config.ajustesExtras). Assim o item novo do cardápio
// impresso chega ao garçom e à página de pedido mesmo quando a base já tem a própria lista (R50).
function aplicarAjustesExtras(lista, feitos) {
  const out = clone(lista); const ja = feitos || [];
  (C.EXTRAS_AJUSTES || []).forEach(a => {
    if (ja.includes(a.id)) return;
    Object.keys(a.set || {}).forEach(cod => {
      const it = out.find(x => x.cod === +cod); const ref = C.EXTRAS.find(x => x.cod === +cod);
      if (it && ref) a.set[cod].forEach(k => { it[k] = clone(ref[k]); });
    });
    (a.novo || []).forEach(cod => { const ref = C.EXTRAS.find(x => x.cod === cod); if (ref && !out.some(x => x.cod === cod)) out.push(clone(ref)); });
  });
  return out;
}
const idsAjustesExtras = () => (C.EXTRAS_AJUSTES || []).map(a => a.id);
// Cardápio fixo também se edita na base (v11, R50: tudo o que se vende tem uma fonte só, a base). O menu.js é o
// ponto de partida; a base grava por cima, em config.fixosCfg: { edit: { código: campos mudados }, novos: [itens novos] }.
// A estrutura dos combos (o que vem em cada um) e as regras de preço seguem no menu.js; nome, preço, descrição,
// abreviação, glúten, selo e ligar/desligar mudam na base.
let FIXOS_CFG = null;
C.FIXOS_BASE = C.fixos.slice();
function montarCardapio() {
  Object.keys(P).forEach(k => { delete P[k]; });
  const ed = (FIXOS_CFG && FIXOS_CFG.edit) || {}; const novos = (FIXOS_CFG && Array.isArray(FIXOS_CFG.novos)) ? FIXOS_CFG.novos : [];
  C.fixos = C.FIXOS_BASE.map(i => ed[i.cod] ? Object.assign({}, i, ed[i.cod], { editado: true }) : Object.assign({}, i))
    .concat(novos.filter(n => !C.FIXOS_BASE.some(b => b.cod === n.cod)).map(n => Object.assign({}, n, { novo: true })));
  C.fixos.forEach(i => { P[i.cod] = i; });
  const ex = extrasAtuais().map(i => Object.assign({ setor: 'bar', tipo: 'bebida' }, i, { desc: i.ingredientes || i.desc || '', extra: true }));
  ex.forEach(i => { if (!P[i.cod]) P[i.cod] = i; });
  // Foto do produto (v10): arquivo fotos/<código>.jpg registrado em FOTOS no menu.js
  C.fixos.concat(ex).forEach(i => { const f = (C.FOTOS || {})[i.cod]; if (f && !i.foto) i.foto = f; });
  C.itens = C.fixos.filter(i => i.ativo !== false).concat(ex.filter(i => i.ativo !== false && P[i.cod] === i));
  BURGUERS = C.itens.filter(i => i.tipo === 'burguer');
  ADICIONAIS = C.itens.filter(i => i.tipo === 'adicional');
}
montarCardapio();
const ativo = p => p && p.ativo !== false;
// Bebida do combo do burguer vem da lista de bebidas da base (R50, JP 24/11/2026): cada bebida diz em que combo entra
// (sucoRefri, soda, cerveja, drink ou nenhum). Sem marcação na base, vale o padrão do menu.js (COMBO_BEBIDA).
function comboDe(x) { return x && x.combo != null ? x.combo : ((C.COMBO_BEBIDA || {})[x && x.cod] || ''); }
function bebidasDoCombo(tipo) { return C.itens.filter(p => p.extra && ativo(p) && comboDe(p) === tipo); }
const ROT_COMBO = { sucoRefri: 'Suco ou refri', soda: 'Soda italiana', cerveja: 'Cerveja', drink: 'Drink da casa' };
// Perguntas das escolhas (JP: em vez de "Sabor", "Qual o sabor da soda?")
const COMUNS = ['soda', 'suco', 'cerveja', 'caipirinha', 'caipi', 'dose', 'água', 'refrigerante', 'drink'];
function daBebida(p) { const w = String(p.nome || '').split(' ')[0]; const lw = w.toLowerCase(); const n = COMUNS.includes(lw) ? lw : w; return (/a$/i.test(w) ? 'da ' : 'do ') + n; }
function pergunta(p, g) {
  const t = String(g.t || '').trim();
  if (/\?$/.test(t)) return t;
  if (/sabor/i.test(t)) return 'Qual o sabor ' + daBebida(p) + '?';
  if (/destilado/i.test(t)) return 'Com qual destilado?';
  if (/tamanho/i.test(t)) return 'Qual o tamanho?';
  if (/^qual$/i.test(t)) return 'Qual ' + String(p.nome || '').split(' ')[0].toLowerCase() + '?';
  return t + '?';
}
const ehMix = o => o && /^mix$/i.test(o.n);
// Nome, abreviação e acréscimo de uma bebida com as escolhas feitas (Mix: os sabores escolhidos por toque)
function descBebida(p, opsSel, mix) {
  const ops = (p.grupos || []).map((g, i) => g.ops[opsSel[i]]).filter(Boolean);
  const mixOps = (mix || []).map(i => { const g = (p.grupos || []).find(gg => gg.ops.some(ehMix)); return g && g.ops[i]; }).filter(Boolean);
  const nomes = ops.map(o => ehMix(o) && mixOps.length ? 'Mix (' + mixOps.map(m => m.n).join(' + ') + ')' : o.n);
  const abs = ops.map(o => ehMix(o) && mixOps.length ? 'MIX ' + mixOps.map(m => m.ab || m.n).join('/') : o.ab);
  return { nome: p.nome + (nomes.length ? ' · ' + nomes.join(' · ') : ''), ab: [p.ab].concat(abs).filter(Boolean).join(' '), mais: ops.reduce((s, o) => s + (+o.mais || 0), 0) };
}
// Blocos de escolha por toque de uma bebida (grupos + sabores do Mix). pre: prefixo das ações (op/mix ou cbOp/cbMix)
function htmlEscolhasBebida(p, opsSel, mix, pre) {
  let h = '';
  (p.grupos || []).forEach((g, gi) => {
    h += `<div class="passo ${opsSel[gi] == null ? 'falta' : ''}"><div class="pt">${ic('local_bar')} ${esc(pergunta(p, g))}</div><div class="chips">${g.ops.map((o, oi) => `<button class="chip ${opsSel[gi] === oi ? 'on' : ''}" data-a="${pre}Op" data-g="${gi}" data-c="${oi}">${esc(o.n)}${o.mais ? ` <span class="sub">+ ${Rc(o.mais)}</span>` : ''}</button>`).join('')}</div>`;
    const esc1 = g.ops[opsSel[gi]];
    if (ehMix(esc1)) {
      const n = (mix || []).length;
      h += `<div class="mix ${n < 2 ? 'falta' : ''}"><div class="sub" style="margin:10px 0 6px">Quais sabores vão no mix? <b>Toque em 2 ou mais</b></div><div class="chips">${g.ops.map((o, oi) => ehMix(o) ? '' : `<button class="chip ${(mix || []).includes(oi) ? 'on' : ''}" data-a="${pre}Mix" data-c="${oi}">${ic((mix || []).includes(oi) ? 'check_box' : 'check_box_outline_blank')} ${esc(o.n)}</button>`).join('')}</div></div>`;
    }
    h += '</div>';
  });
  return h;
}
function faltaBebida(p, opsSel, mix) {
  const f = [];
  (p.grupos || []).forEach((g, i) => { if (opsSel[i] == null) f.push(pergunta(p, g).replace(/\?$/, '').toLowerCase()); else if (ehMix(g.ops[opsSel[i]]) && (mix || []).length < 2) f.push('os sabores do mix'); });
  return f;
}

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
function precoCheio(it) { return r2((it.base || 0) + (it.acresc || 0) + (it.partes || []).reduce((s, p) => s + precoAdds(p.adds, p.espeto), 0)); }
// Desconto no item da mesa (d100, d50, d5...): só com código de gerente ou sócio; vai para o relatório e a conferência
function precoItem(it) { const c = precoCheio(it); return it.desconto && it.desconto.pct > 0 ? r2(c * (1 - Math.min(100, it.desconto.pct) / 100)) : c; }
const pctTxt = p => String(r2(p)).replace('.', ',') + '%';
function itensValidos(itens) { return (itens || []).filter(i => !i.cancelado); }
function subtotal(itens) { return r2(itensValidos(itens).reduce((s, i) => s + precoItem(i), 0)); }
function descItem(it) {
  const linhas = [];
  (it.partes || []).forEach(p => {
    const extra = [...(p.adds || []).map(a => '+ ' + a.nome), p.det, p.obs, p.alergia].filter(Boolean);
    if (it.combo || (it.partes.length > 1)) linhas.push(p.nome + (extra.length ? ' (' + extra.join(', ') + ')' : ''));
    else if (extra.length) linhas.push(extra.join(', '));
  });
  if (it.desconto && it.desconto.pct > 0) linhas.push('desconto de ' + pctTxt(it.desconto.pct) + ' (de ' + R(precoCheio(it)) + ')');
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
  // Faixas que rolam de lado (destaques, categorias, abas, kanban) ficam onde a pessoa deixou (JP, 24/11/2026:
  // o carrossel dos destaques voltava sozinho para o primeiro a cada repintura)
  const lados = {}; app.querySelectorAll('[data-rola]').forEach(el => { lados[el.dataset.rola] = el.scrollLeft; });
  app.innerHTML = (MODO_TESTE ? faixaTeste() : '') + (TELAS[VIEW] ? TELAS[VIEW]() : TELAS.inicio());
  app.querySelectorAll('[data-rola]').forEach(el => { const x = lados[el.dataset.rola]; if (x) el.scrollLeft = x; });
  if (MODAL) pintarModal();
  if (foco) { const el = document.getElementById(foco.id); if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(foco.s, foco.e); } catch (e) {} } }
  window.scrollTo(0, rolagem);
  if (DEPOIS.length) { const fs = DEPOIS.splice(0); fs.forEach(f => f()); }
  posPintura();
  SIG = sigTempo();
}
// Sem repintura por relógio (JP, 24/11/2026: "quem utilizar precisa ter liberdade de navegação própria").
// A tela só se redesenha quando algo muda de verdade (pedido novo, item, pagamento). Os relógios (minutos, cores
// de urgência, hora) se atualizam no lugar, sem mexer em rolagem, foco ou no que a pessoa está fazendo.
// Única exceção: quando o tempo muda o que está na fila (bebida "com o prato" que entra sozinha).
const CORES_T = ['verde', 'amarelo', 'laranja', 'vermelho'];
let SIG = '';
function sigTempo() { return ['base', 'garcom', 'cozinha'].includes(VIEW) && S.cfg ? ['cozinha', 'bar'].map(s => filaDe(s).map(c => c.id).join(',')).join('|') : ''; }
function tique() {
  const antes = S.eu; tentarEu();
  if (S.eu !== antes || sigTempo() !== SIG) { render(); return; }
  document.querySelectorAll('[data-min]').forEach(el => { el.textContent = minDesde(+el.dataset.min) + ' min'; });
  document.querySelectorAll('[data-ate]').forEach(el => { el.textContent = Math.max(0, Math.ceil((+el.dataset.ate - agora()) / 60000)); });
  document.querySelectorAll('[data-cor]').forEach(el => { const m = minDesde(+el.dataset.cor); const cor = el.dataset.esc === 'bar' ? corBar(m) : corCoz(m); const p = el.dataset.pref || ''; CORES_T.forEach(c => el.classList.remove(p + c)); el.classList.add(p + cor); });
  document.querySelectorAll('[data-relogio]').forEach(el => { el.textContent = hora(agora()); });
}
const DEPOIS = [];
function posPintura() {
  if (VIEW === 'cozinha' || (VIEW === 'base' && S.ui.aba === 'cozinha')) ligarArrastar();
  document.querySelectorAll('[data-qr]').forEach(el => { if (el.dataset.feito === el.dataset.qr) return; el.innerHTML = ''; desenharQR(el, el.dataset.qr); el.dataset.feito = el.dataset.qr; });
}
const cfg = () => S.cfg || {};
const noiteId = () => (cfg().noite && cfg().noite.id) || 'sem-noite';

function assinar(cols) {
  if (cols.includes('config')) DB.listenDoc('config', 'main', d => { S.cfg = d; EXTRAS_CFG = d && Array.isArray(d.extras) ? aplicarAjustesExtras(d.extras, d.ajustesExtras) : null; FIXOS_CFG = (d && d.fixosCfg) || null; montarCardapio(); tentarEu(); render(); });
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
// Consumo interno e perdas: coleção própria, fora das vendas e do caixa (R41)
let consumoOff = null, consumoNoite = null;
S.consumo = [];
function assinarConsumo(id) {
  if (consumoNoite === id) return; consumoNoite = id;
  if (consumoOff) consumoOff();
  consumoOff = DB.listen('consumo', a => { S.consumo = a.sort((x, y) => (x.ts || 0) - (y.ts || 0)); render(); }, ['noiteId', id]);
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
async function hashPin(pin, loja) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('seutrem:' + (loja || LOJA) + ':' + String(pin).trim()));
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
}

// ================= modo de teste (JP, 24/11/2026) =================
// Botão na base, só com código de sócio. Leva para a loja de ensaio (dados separados da loja real), já com o
// sócio cadastrado (o mesmo código) e o cardápio da loja real copiado. Tudo fica com outro ambiente visual
// (faixa listrada, cores roxas) para ficar explícito que é teste. Os links gerados lá (garçom, cozinha, pedido)
// carregam o modo de teste junto.
const LOJA_TESTE = 'ensaio';
const MODO_TESTE = LOJA === LOJA_TESTE || LOJA === 'local';
function faixaTeste() {
  const sair = ['base', 'cozinha', 'pedido'].includes(VIEW);
  return `<div class="faixa-teste">${ic('science')}<span class="t">Modo de teste<span class="d"> · ${DB && DB.modo === 'local' ? 'ensaio neste navegador' : 'loja de ensaio'} · nada aqui vale para a loja real</span></span>${sair ? `<button data-a="sairTeste">${ic('logout')} Sair do teste</button>` : ''}</div>`;
}
const acaoModoTeste = () => pedirPIN('Entrar no modo de teste', ['socio'], async (p, pin) => {
  const c = cfg();
  const ida = {
    eu: { id: p.id, nome: p.nome, h: await hashPin(pin, LOJA_TESTE) },
    cardapio: { extras: Array.isArray(c.extras) ? c.extras : null, fixosCfg: c.fixosCfg || null },
    loja: { nome: c.nome || NOME_CURTO, frase: c.frase || FRASE, mesas: c.mesas || 14, minPrato: c.minPrato || 15, whatsapp: c.whatsapp || '', endereco: c.endereco || '', pix: c.pix || {}, infiniteTag: c.infiniteTag || 'seutrem' }
  };
  try { sessionStorage.setItem('st-teste', JSON.stringify(ida)); } catch (e) {}
  location.href = BASE_URL + '?v=base&loja=' + LOJA_TESTE;
});
const acaoSairTeste = () => { location.href = BASE_URL + '?v=' + (VIEW === 'pedido' || VIEW === 'cozinha' ? VIEW : 'base'); };
// Chegada na loja de ensaio: garante o sócio (mesmo código) e copia o cardápio da loja real
async function chegadaTeste() {
  let ida = null; try { ida = JSON.parse(sessionStorage.getItem('st-teste') || 'null'); sessionStorage.removeItem('st-teste'); } catch (e) {}
  if (!ida || LOJA !== LOJA_TESTE) return;
  await DB.mutate('config', 'main', c => {
    c = c || Object.assign({}, ida.loja, { pessoas: [], noite: novaNoiteObj(), noites: [], seqPedido: 0, criadoEm: agora() });
    c.pessoas = (c.pessoas || []).filter(x => x.id !== ida.eu.id).concat({ id: ida.eu.id, nome: ida.eu.nome, h: ida.eu.h, papel: 'socio' });
    c.extras = ida.cardapio.extras; c.fixosCfg = ida.cardapio.fixosCfg;
    c.logLoja = [{ t: agora(), quem: ida.eu.nome, o: 'entrou no modo de teste (cardápio copiado da loja real)' }].concat(c.logLoja || []).slice(0, 100);
    return c;
  });
  LS.set('st-eu-' + LOJA + '-base', { id: ida.eu.id });
  toast('Modo de teste: cardápio da loja real copiado');
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
      item: it.uid, combo: it.combo ? it.nome : null, comboAb: it.combo ? (it.comboAb || '') : '',
      linhas: ps.map(p => ({ nome: p.nome, ab: p.ab || '', alergia: p.alergia || '', trocas: [...(p.adds || []).map(a => '+ ' + a.nome), p.det, p.obs].filter(Boolean), grupo: p.grupo || 0, chapa: p.chapa || null, discos: p.discos || 0, cod: p.cod || null, fritas: p.fritas || null, esc: p.esc || p.det || '', adds: (p.adds || []).map(a => a.cod) }))
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
  return { cod: b.cod, nome: b.nome, ab: b.ab || '', gl: ('pao ' + (b.gl || '')).trim(), setor: 'cozinha', chapa: 'burguer', discos: (b.discos || 1) + adds.filter(a => P[a.cod].disco).length, adds, obs: s.obs || '', grupo: g || 0 };
}
// Pedido sem glúten (alergia): tudo o que tem glúten entra no alerta (JP, 23 e 24/11/2026). A isca de shimeji empanada
// vai só no fubá, o onion ring sai, o pão brioche e a tortilha da quesadilla são de trigo. Toda parte da cozinha do item
// ganha o aviso, em vermelho na TV. Quando a ficha técnica existir, os ingredientes com glúten virão dela.
const TXT_GL = { isca: 'ISCA SÓ NO FUBÁ', onion: 'SEM ONION RINGS', trigo: 'TORTILHA DE TRIGO', oniprato: 'ONION RINGS TÊM GLÚTEN' };
function glutenNoItem(p) { return p.setor === 'cozinha'; }
function textosGluten(pt) {
  const t = [];
  String(pt.gl || '').split(' ').filter(Boolean).forEach(k => {
    if (k === 'pao') t.push((pt.adds || []).some(a => a.cod === 73) ? 'PÃO SEM GLÚTEN' : 'PÃO BRIOCHE TEM TRIGO');
    else if (TXT_GL[k]) t.push(TXT_GL[k]);
  });
  if ((pt.adds || []).some(a => a.cod === 64)) t.push('ADICIONAL ONION TEM GLÚTEN');
  return t;
}
function aplicarGluten(partes) {
  partes.forEach(pt => { if (pt.setor === 'cozinha') { const t = textosGluten(pt); pt.alergia = 'ALERGIA GLÚTEN' + (t.length ? ': ' + t.join(' · ') : ''); } });
}
// Bebida com opções (sabor, destilado, tamanho): preço e abreviação somam as escolhas. Ex.: BELO GIN PIT.
function opsEscolhidas(p, MI) { return (p.grupos || []).map((g, i) => g.ops[MI.ops[i]]).filter(Boolean); }
function temMix(p, MI) { return opsEscolhidas(p, MI).some(o => /^mix$/i.test(o.n)); }
function bebidaCombo(c, MI) {
  const sab = MI.sabor ? ' · ' + MI.sabor : '';
  if (c.bebida === 'sucoRefri') return (MI.bebTipo || 'Suco 500 ml') + sab;
  if (c.bebida === 'soda') return 'Soda italiana' + sab;
  if (c.bebida === 'cerveja') return 'Cerveja' + sab;
  return 'Drink da casa' + sab;
}
function rotuloCombo(c) { return { sucoRefri: 'combo', soda: 'combo soda', cerveja: 'combo cerveja', drink: 'combo drink' }[c.bebida] || 'combo'; }
// Bebida do combo escolhida por toque da lista da base (v10); sem ela (itens antigos), vale o texto de antes
function bebidaDoCombo(c, MI) {
  const b = MI.cbCod && P[MI.cbCod];
  if (!b) return { nome: bebidaCombo(c, MI), ab: '', mais: 0 };
  return descBebida(b, MI.cbOps, MI.cbMix);
}
function partesCombo(c, MI) {
  const b = bebidaDoCombo(c, MI);
  return [
    { nome: 'Fritas (combo)', ab: 'FRI 100g', fritas: 'P', setor: 'cozinha', adds: [], grupo: 1 },
    { nome: MI.doce || 'Super brownie', setor: 'bar', adds: [], grupo: 1 },
    { nome: b.nome, ab: b.ab, setor: 'bar', adds: [], grupo: 1, bebida: true }
  ];
}
function novoMI(p) {
  const MI = { p, sel: [], combo: null, doce: null, bebTipo: null, sabor: '', obs: '', escolha: null, preco: null, ops: {}, mix: [], cbCod: null, cbOps: {}, cbMix: [], semGluten: false, delivery: false };
  (p.grupos || []).forEach((g, i) => { if (/tamanho/i.test(g.t)) MI.ops[i] = 0; });
  const n = p.tipo === 'comboMesa' ? p.partes.length : 1;
  for (let i = 0; i < n; i++) MI.sel.push({ burg: p.tipo === 'burguer' ? p.cod : null, quesa: null, adds: [], obs: '' });
  if (p.tipo === 'comboBurguer') { MI.combo = p.cod; autoBebCombo(MI); }
  if (p.tipo === 'comboFixo') MI.sel = [{ adds: [], obs: '' }];
  return MI;
}
// Combo com uma bebida só na lista (ex.: soda italiana): já vem marcada e o cliente escolhe só o sabor
function escolherBebCombo(MI, c) {
  if (MI.cbCod === c) return;
  MI.cbCod = c; MI.cbOps = {}; MI.cbMix = [];
  const b = P[c]; ((b && b.grupos) || []).forEach((g, i) => { if (/tamanho/i.test(g.t)) MI.cbOps[i] = 0; });
}
function autoBebCombo(MI) { if (!MI.combo) return; const l = bebidasDoCombo(P[MI.combo].bebida); if (l.length === 1) escolherBebCombo(MI, l[0].cod); }
function faltaMI(MI) {
  const p = MI.p, f = [];
  if (p.tipo === 'comboBurguer' && !MI.sel[0].burg) f.push('o burguer');
  if (p.tipo === 'comboMesa') p.partes.forEach((d, i) => { if (d.t === 'burguer' && !MI.sel[i].burg) f.push('o burguer ' + (i + 1)); if (d.t === 'quesadilla' && !MI.sel[i].quesa) f.push('a quesadilla'); });
  if (MI.combo) {
    if (!MI.doce) f.push('o doce do combo');
    if (!MI.cbCod) f.push('a bebida do combo'); else f.push(...faltaBebida(P[MI.cbCod], MI.cbOps, MI.cbMix));
  }
  if (p.escolha && !MI.escolha) f.push(p.escolha.titulo.toLowerCase());
  if (p.precoLivre && !(MI.preco >= p.precoLivre[0])) f.push('o preço do drink');
  if (p.tipo === 'bebida') f.push(...faltaBebida(p, MI.ops, MI.mix));
  return f;
}
function montarItem(MI) {
  const p = MI.p; const partes = []; let base = (MI.delivery && p.precoDelivery) || p.preco, acresc = 0, nome = p.nome, combo = false, comboAb = '';
  if (p.tipo === 'burguer') {
    partes.push(parteBurg(p, MI.sel[0], 0));
    if (MI.combo) { const c = P[MI.combo]; base += c.preco; acresc += bebidaDoCombo(c, MI).mais; combo = true; comboAb = c.ab || ''; nome = p.nome + ' + ' + rotuloCombo(c); partes.push(...partesCombo(c, MI)); }
  } else if (p.tipo === 'comboBurguer') {
    const b = P[MI.sel[0].burg]; base = b.preco + p.preco; acresc += bebidaDoCombo(p, MI).mais; combo = true; comboAb = p.ab || ''; nome = b.nome + ' + ' + rotuloCombo(p);
    partes.push(parteBurg(b, MI.sel[0], 0), ...partesCombo(p, MI));
  } else if (p.tipo === 'comboMesa') {
    combo = p.partes.length > 1; comboAb = p.ab || '';
    p.partes.forEach((d, i) => {
      const s = MI.sel[i], g = grupoDe(d.t);
      if (d.t === 'burguer') { const b = P[s.burg]; if (!p.semPremium) acresc += (C.ACRESCIMO_COMBO_MESA[b.cod] || 0); partes.push(parteBurg(b, s, g)); }
      else if (d.t === 'quesadilla') partes.push({ nome: 'Quesadilla ' + s.quesa, ab: (C.AB_QUESA || {})[s.quesa] || '', gl: 'trigo', setor: 'cozinha', chapa: 'quesadilla', adds: [], det: 'sem fritas', obs: s.obs || '', grupo: g });
      else if (d.t === 'espeto') partes.push({ nome: 'Espetinho', ab: 'E1', gl: 'isca', setor: 'cozinha', chapa: 'cogumelo', adds: addsObj(s.adds), espeto: true, det: 'sem fritas', obs: s.obs || '', grupo: g });
      else if (d.t === 'sobremesaFamilia') partes.push({ nome: 'Sobremesa brownie & açaí', setor: 'bar', adds: [], grupo: g });
    });
    if (!combo) nome = p.nome.replace('(combo da mesa)', '').trim() + (partes[0] && p.partes[0].t === 'burguer' ? ': ' + partes[0].nome : partes[0] && p.partes[0].t === 'quesadilla' ? ': ' + partes[0].nome.replace('Quesadilla ', '') : '') + ' (combo da mesa)';
  } else if (p.tipo === 'comboFixo') {
    combo = true; comboAb = p.ab || '';
    p.fixas.forEach((x, i) => partes.push({ cod: x.cod || null, fritas: x.fritas || null, nome: x.nome, ab: x.ab || '', gl: x.gl || '', setor: x.setor, chapa: x.chapa || null, discos: x.chapa === 'burguer' ? 1 : 0, adds: x.burguer ? addsObj(MI.sel[0].adds) : [], obs: x.burguer ? MI.sel[0].obs : '', grupo: i }));
  } else if (p.tipo === 'bebida') {
    if (p.precoLivre) base = +MI.preco;
    const d = descBebida(p, MI.ops, MI.mix);
    base += d.mais;
    nome = MI.sabor ? d.nome + ' · ' + MI.sabor : d.nome;
    partes.push({ nome, ab: d.ab, setor: 'bar', adds: [], obs: MI.obs || '' });
  } else {
    const abE = p.abEscolha && MI.escolha && p.abEscolha[MI.escolha];
    partes.push({ cod: p.cod, esc: MI.escolha || '', nome: p.nome, ab: abE || p.ab || '', gl: (p.glEscolha && MI.escolha && p.glEscolha[MI.escolha]) || p.gl || '', setor: p.setor, chapa: p.chapa || null, discos: 0, adds: addsObj(MI.sel[0].adds), espeto: !!p.espeto, det: abE ? '' : (MI.escolha || ''), obs: MI.sel[0].obs || MI.obs || '' });
  }
  if (MI.semGluten) aplicarGluten(partes);
  return { uid: uid(), cod: p.cod, nome, base: r2(base), acresc, combo, comboAb, partes, tipo: p.tipo, sel: false, comPrato: false, enviado: false, cards: [], por: quem(), ts: agora() };
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
  $('#modal').innerHTML = `<div class="fundo" data-a="fundoModal"><div class="caixa${MODAL.largo ? ' largo' : ''}">${MODAL.render()}</div></div>`;
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
      <div class="campo">${inputPin('pinM', 'okPin')}</div>
      <div class="linha"><button class="bt" data-a="fecharModal">Cancelar</button><button class="bt pri" data-a="okPin">Confirmar</button></div>`,
    async okPin() { const pin = F.pinM; const p = await pessoaPorPin(pin, papeis); F.pinM = ''; if (!p) { toast('Código não confere'); pintarModal(); return; } fecharModal(); cb(p, pin); }
  });
}
// Campo do código pessoal: texto mascarado (não é campo de senha), para o navegador não guardar nem preencher sozinho
// o código de quem autorizou da última vez (aconteceu na noite teste de 23/11 com o código de sócio).
function inputPin(id, enter, st, extra) {
  return `<input id="${id}" class="inp pin" style="${st || ''}" data-f="${id}" inputmode="numeric" maxlength="6" type="text" name="c${uid()}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore value="${esc(F[id] || '')}" data-enter="${enter}" ${extra || ''}>`;
}
// Pede o código do gerente/sócio e um motivo (antifraude)
const MOTIVOS = ['Cliente desistiu', 'Lançado errado', 'Aberta por engano', 'Saiu errado da cozinha', 'Cortesia da casa', 'Outro'];
function pedirAutorizacao(titulo, cb, motivos) {
  F.pinM = ''; F.motivoM = ''; let motivo = null; const lista = motivos || MOTIVOS;
  abrirModal({
    foco: 'pinM',
    render: () => `<h2>${esc(titulo)}</h2><p class="sub">Só gerente ou sócio. Fica registrado quem pediu, quem autorizou, o motivo e a hora, e aparece na conferência da noite.</p>
      <div class="chips" style="margin-bottom:10px">${lista.map(m => `<button class="chip ${motivo === m ? 'on' : ''}" data-a="mot" data-c="${m}">${m}</button>`).join('')}</div>
      ${motivo === 'Outro' ? `<input id="motivoM" class="inp" style="margin-bottom:10px" data-f="motivoM" placeholder="Qual o motivo?" value="${esc(F.motivoM)}">` : ''}
      <div class="campo"><label for="pinM">Código do gerente ou sócio</label>${inputPin('pinM', 'okA')}</div>
      <div class="linha"><button class="bt" data-a="fecharModal">Voltar</button><button class="bt verm pri" data-a="okA">Autorizar</button></div>`,
    mot(d) { motivo = d.c; pintarModal(); },
    async okA() {
      const m = motivo === 'Outro' ? (F.motivoM || '').trim() : motivo;
      if (!m) { toast('Escolha o motivo'); return; }
      const p = await pessoaPorPin(F.pinM, ACESSO_TOTAL);
      F.pinM = '';
      if (!p) { toast('Código não confere'); pintarModal(); return; }
      fecharModal(); cb(p, m);
    }
  });
}

// Modal de escolha do item (garçom, base e cliente)
function modalItem(p, onAdd, opts) {
  opts = opts || {};
  const MI = novoMI(p);
  MI.delivery = !!opts.cliente;
  if (opts.q) preencherOps(p, MI, opts.q);
  abrirModal({
    MI, foco: p.pedeSabor ? 'saborMI' : null,
    render() {
      const falta = faltaMI(MI);
      const it = falta.length ? null : montarItem(MI);
      let h;
      if (opts.cliente) {
        const k = CATS_PEDIDO[p.cat] || {}; const inc = inclusosDe(p);
        h = `<div class="md-hero${p.foto ? ' foto' : ''}" style="background:${k.bg};color:${k.cor}">${p.foto ? `<img src="${esc(p.foto)}" alt="">` : ic(icProd(p))}<button class="bt-ic md-x" data-a="fecharModal">${ic('close')}</button>${p.selo ? `<span class="selo">${esc(p.selo)}</span>` : ''}</div>
          <h2 style="margin-top:14px">${esc(p.nome)}</h2>${p.desc ? `<p class="md-desc">${esc(p.desc)}</p>` : ''}
          ${inc ? htmlInclusos(inc, true) : ''}${p.economia ? `<div class="pc-eco" style="margin:6px 0 4px">${esc(p.economia)}</div>` : ''}`;
      } else {
        h = `<div class="entre"><h2><span class="cod">${p.cod}</span> ${esc(p.nome)}</h2><button class="bt-ic" data-a="fecharModal">${ic('close')}</button></div>`;
        if (p.desc) h += `<p class="sub">${esc(p.desc)}</p>`;
      }
      const chipsAdds = (i, espeto, burg) => {
        const lista = ADICIONAIS.filter(a => burg || (a.cod !== 72 && a.cod !== 73));
        return `<div class="sub" style="margin:8px 0 6px">Adicionais ${espeto ? '(no espeto: 3 por R$ 10)' : '(2 por R$ 10 · 3 por R$ 12)'}</div><div class="chips">` +
          lista.map(a => `<button class="chip ${MI.sel[i].adds.includes(a.cod) ? 'on' : ''}" data-a="miAdd" data-i="${i}" data-c="${a.cod}">${esc(a.nome)} <span class="sub">${Rc(a.preco)}</span></button>`).join('') + '</div>' +
          `<input id="obsMI${i}" class="inp" style="margin-top:8px" placeholder="Troca ou observação (ex.: sem cebola)" data-f="obsMI${i}" data-mi="${i}" value="${esc(MI.sel[i].obs)}">`;
      };
      const escolheBurg = (i) => `<div class="chips">` + BURGUERS.filter(b => !(p.semPremium && C.ACRESCIMO_COMBO_MESA[b.cod])).map(b => `<button class="chip ${MI.sel[i].burg === b.cod ? 'on' : ''}" data-a="miBurg" data-i="${i}" data-c="${b.cod}"><b>${b.cod}</b> ${esc(b.nome)}${opts.comboMesa && C.ACRESCIMO_COMBO_MESA[b.cod] ? ' <span class="sub">+ ' + Rc(C.ACRESCIMO_COMBO_MESA[b.cod]) + '</span>' : ''}</button>`).join('') + '</div>';
      if (p.tipo === 'burguer' || p.tipo === 'comboBurguer') {
        if (p.tipo === 'comboBurguer') h += `<div class="passo ${MI.sel[0].burg ? '' : 'falta'}"><div class="pt">${ic('lunch_dining')} Qual burguer?</div>${escolheBurg(0)}</div>`;
        if (p.tipo === 'burguer') {
          h += `<div class="passo"><div class="pt">${ic('fastfood')} Completar com o combo?</div><div class="combo-ops">
            <button class="combo-op ${MI.combo === null ? 'on' : ''}" data-a="miCombo" data-c=""><b>Só o burguer</b><small>sem combo</small></button>` +
            [30, 31, 32, 33].map(c => { const pc = P[c]; return `<button class="combo-op ${MI.combo === c ? 'on' : ''}" data-a="miCombo" data-c="${c}"><b>+ ${R(pc.preco)}</b>${htmlInclusos(inclusoCombo(pc))}${pc.economia ? `<small class="eco">${esc(pc.economia.split('·').pop().trim())}</small>` : ''}</button>`; }).join('') + '</div></div>';
        }
        if (MI.combo) {
          const c = P[MI.combo];
          // Tudo por toque (JP, 24/11/2026): doce, bebida da lista da base e as escolhas da bebida (sabor, destilado, Mix)
          const bebs = bebidasDoCombo(c.bebida);
          const b1 = MI.cbCod && P[MI.cbCod];
          h += `<div class="passo ${MI.doce ? '' : 'falta'}"><div class="pt">${ic('cake')} Qual o doce do combo?</div><div class="chips">${C.DOCES.map(d => `<button class="chip ${MI.doce === d ? 'on' : ''}" data-a="miDoce" data-c="${esc(d)}">${esc(d)}</button>`).join('')}</div></div>`;
          h += `<div class="passo ${b1 ? '' : 'falta'}"><div class="pt">${ic('local_bar')} ${c.bebida === 'drink' ? 'Qual drink?' : c.bebida === 'cerveja' ? 'Qual cerveja?' : c.bebida === 'soda' ? 'A bebida do combo' : 'Qual a bebida do combo?'}</div>
            ${bebs.length ? `<div class="chips">${bebs.map(x => `<button class="chip ${MI.cbCod === x.cod ? 'on' : ''}" data-a="miCbBeb" data-c="${x.cod}">${esc(x.nome)}</button>`).join('')}</div>` : `<div class="sub">Nenhuma bebida ligada para este combo na base.</div>`}</div>`;
          if (b1) h += htmlEscolhasBebida(b1, MI.cbOps, MI.cbMix, 'miCb');
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
        h += htmlEscolhasBebida(p, MI.ops, MI.mix, 'mi');
        if (p.pedeSabor) h += `<div class="passo"><div class="pt">${ic('local_bar')} ${esc(p.pedeSabor)}</div><input id="saborMI" class="inp" data-f="saborMI" value="${esc(MI.sabor)}" data-enter="miOk" placeholder="${esc(p.pedeSabor)} (opcional)"></div>`;
        if (p.precoLivre) { const ps = []; for (let v = p.precoLivre[0]; v <= p.precoLivre[1]; v++) ps.push(v); h += `<div class="sub" style="margin:10px 0 6px">Preço</div><div class="chips">${ps.map(v => `<button class="chip ${MI.preco === v ? 'on' : ''}" data-a="miPreco" data-c="${v}">${Rc(v)}</button>`).join('')}</div>`; }
        h += `<input id="obsBeb" class="inp" style="margin-top:8px" data-f="obsBeb" value="${esc(MI.obs)}" data-enter="miOk" placeholder="Observação (opcional, ex.: sem gelo)">`;
        const abNow = descBebida(p, MI.ops, MI.mix).ab;
        if (abNow && !opts.cliente) h += `<p class="sub" style="margin-top:8px">No painel do bar: <b>${esc(abNow)}</b></p>`;
      } else {
        if (p.escolha) h += `<div class="passo ${MI.escolha ? '' : 'falta'}"><div class="pt">${esc(p.escolha.titulo)}</div><div class="chips">${p.escolha.opcoes.map(o => `<button class="chip ${MI.escolha === o ? 'on' : ''}" data-a="miEsc" data-c="${esc(o)}">${esc(o)}</button>`).join('')}</div></div>`;
        if (p.tipo === 'aperitivo') h += `<div class="passo"><div class="pt">${ic('add_circle')} Do jeito do cliente</div>${chipsAdds(0, !!p.espeto, false)}</div>`;
        else h += `<input id="obsMI0" class="inp" placeholder="Observação (opcional)" data-f="obsMI0" data-mi="0" value="${esc(MI.sel[0].obs)}" data-enter="miOk">`;
      }
      // Checkpoint da alergia a glúten (garçom e base): a troca vai em destaque forte para a linha de produção
      if (!opts.cliente && glutenNoItem(p)) {
        let av = '';
        if (MI.semGluten) {
          const prev = it ? it.partes.filter(pt => pt.setor === 'cozinha').map(pt => (pt.ab || pt.nome) + ': ' + (pt.alergia || 'ALERGIA GLÚTEN').replace('ALERGIA GLÚTEN: ', '').replace('ALERGIA GLÚTEN', 'cuidado com glúten')) : [];
          const txt = prev.join(' | ');
          av = `<div class="sub" style="margin-top:8px">Na TV, em vermelho: ${esc(txt || 'complete as escolhas para ver')}.</div>`;
          if (/BRIOCHE/.test(txt)) av += `<div class="sub" style="color:var(--vermelho);margin-top:4px">${ic('info')} O pão brioche é de trigo: ofereça o pão sem glúten (+R$ 5) nos adicionais.</div>`;
          if (/TORTILHA|ONION RINGS TÊM/.test(txt)) av += `<div class="sub" style="color:var(--vermelho);margin-top:4px">${ic('info')} Este prato tem glúten na base (tortilha de trigo ou onion rings): avise o cliente antes de enviar.</div>`;
        }
        h += `<div class="passo ${MI.semGluten ? 'alergia' : ''}"><div class="pt">${ic('warning')} Alergia ou intolerância a glúten?</div>
          <button class="chip ${MI.semGluten ? 'on verm' : ''}" data-a="miGl">${ic(MI.semGluten ? 'check_box' : 'check_box_outline_blank')} Sem glúten (alergia)</button>${av}</div>`;
      }
      h += `<div class="entre rodape-m"><div><div class="sub">${falta.length ? 'Falta escolher: ' + esc(falta.join(', ')) : 'Preço'}</div><div style="font-size:22px;font-weight:500">${it ? R(precoItem(it)) : '—'}</div></div>
        <button class="bt pri grande" data-a="miOk" ${falta.length ? 'disabled' : ''}>${ic('add')} ${esc(opts.botao || 'Adicionar')}</button></div>`;
      return h;
    },
    miAdd(d) { const s = MI.sel[+d.i]; const c = +d.c; s.adds = s.adds.includes(c) ? s.adds.filter(x => x !== c) : s.adds.concat(c); pintarModal(); },
    miBurg(d) { MI.sel[+d.i].burg = +d.c; pintarModal(); },
    miQuesa(d) { MI.sel[+d.i].quesa = d.c; pintarModal(); },
    miCombo(d) { MI.combo = d.c ? +d.c : null; MI.cbCod = null; MI.cbOps = {}; MI.cbMix = []; autoBebCombo(MI); pintarModal(); },
    miDoce(d) { MI.doce = d.c; pintarModal(); },
    miBeb(d) { MI.bebTipo = d.c; pintarModal(); },
    miEsc(d) { MI.escolha = d.c; pintarModal(); },
    miPreco(d) { MI.preco = +d.c; pintarModal(); },
    miOp(d) { MI.ops[+d.g] = +d.c; if (!ehMix(((p.grupos || [])[+d.g] || { ops: [] }).ops[+d.c])) MI.mix = []; pintarModal(); },
    miMix(d) { const i = +d.c; MI.mix = MI.mix.includes(i) ? MI.mix.filter(x => x !== i) : MI.mix.concat(i); pintarModal(); },
    miCbBeb(d) { escolherBebCombo(MI, +d.c); pintarModal(); },
    miCbOp(d) { const b = P[MI.cbCod]; MI.cbOps[+d.g] = +d.c; if (!ehMix(((b && b.grupos) || [])[+d.g] && b.grupos[+d.g].ops[+d.c])) MI.cbMix = []; pintarModal(); },
    miCbMix(d) { const i = +d.c; MI.cbMix = MI.cbMix.includes(i) ? MI.cbMix.filter(x => x !== i) : MI.cbMix.concat(i); pintarModal(); },
    miGl() { MI.semGluten = !MI.semGluten; pintarModal(); },
    miOk() { if (faltaMI(MI).length) { toast('Falta escolher: ' + faltaMI(MI).join(', ')); return; } const it = montarItem(MI); fecharModal(); onAdd(it); },
    campo(k, v, el) {
      if (k === 'saborMI') MI.sabor = v;
      else if (k === 'obsBeb') { const antes = !!String(MI.obs || '').trim(); MI.obs = v; if (antes !== !!v.trim()) pintarModal(); }
      else if (el.dataset.mi != null) MI.sel[+el.dataset.mi].obs = v;
    }
  });
}
// Busca que já traz a opção: "belo gin pit" abre o Belorihills com gin e pitanga marcados; "coca 600" marca a Coca.
function preencherOps(p, MI, q) {
  const t = ' ' + norm(q) + ' ';
  (p.grupos || []).forEach((g, i) => {
    let melhor = -1, tam = 0;
    g.ops.forEach((o, oi) => { const a = norm(o.ab); if (a && t.indexOf(' ' + a + ' ') >= 0 && a.length > tam) { melhor = oi; tam = a.length; } });
    if (melhor >= 0) MI.ops[i] = melhor;
  });
}

// ================= busca de produtos =================
function buscar(q) {
  q = norm(q); if (!q) return [];
  const num = /^\d+$/.test(q) ? +q : null;
  const res = [];
  const t = ' ' + q + ' ';
  C.itens.forEach(p => {
    let sc = 0; const n = norm(p.nome); const ab = norm(p.ab);
    if (num != null) { if (p.cod === num) sc = 100; else if (String(p.cod).indexOf(q) === 0) sc = 50; }
    const m = q.match(/^(\d+)\s+(.+)$/); const tq = m ? m[2] : q;
    if (m && p.cod === +m[1]) sc = 100;
    // abreviação da linha de produção (TV, CLASS, XT, B24, PILSEN, BELO GIN PIT...)
    if (ab && num == null) { if (ab === q) sc = Math.max(sc, 95); else if (q.indexOf(ab + ' ') === 0) sc = Math.max(sc, 88); else if (ab.indexOf(q) === 0) sc = Math.max(sc, 70); }
    (p.grupos || []).forEach(g => g.ops.forEach(o => { const a = norm(o.ab); if (a && a.indexOf(' ') > 0 && t.indexOf(' ' + a + ' ') >= 0) sc = Math.max(sc, 92); }));
    if (n.indexOf(tq) === 0) sc = Math.max(sc, 80); else if (n.indexOf(tq) > 0) sc = Math.max(sc, 60);
    else { const ts = tq.split(' '); if (ts.every(t => n.indexOf(t) >= 0)) sc = Math.max(sc, 40); }
    if (sc) res.push([sc, p]);
  });
  return res.sort((a, b) => b[0] - a[0] || a[1].cod - b[1].cod).slice(0, 8).map(x => x[1]);
}
function precisaModal(p) {
  if (p.tipo === 'bebida') return !!((p.grupos && p.grupos.length) || p.pedeSabor || p.precoLivre);
  return !(p.tipo === 'simples' && !p.escolha);
}

// ================= ações (cliques) =================
const A = {};
const CH = {};
A.modoTeste = acaoModoTeste; A.sairTeste = acaoSairTeste;
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
    ${inputPin('pinL', 'entrar', 'text-align:center;font-size:28px;letter-spacing:.4em;max-width:220px;margin:12px auto', `data-papeis="${papeis.join(',')}"`)}
    <div><button class="bt pri grande" data-a="entrar" data-papeis="${papeis.join(',')}">Entrar</button></div>
    <p class="sub" style="margin-top:14px">${DB.modo === 'local' ? 'Modo local (ensaio neste navegador)' : 'Conectado à nuvem'}</p></div></div>`;
}
A.entrar = async d => {
  const p = await pessoaPorPin(F.pinL, d.papeis.split(','));
  if (!p) { F.pinL = ''; toast(CELULAR && VIEW === 'base' ? 'Código não confere (no celular, a base é só para sócio)' : 'Código não confere'); render(); return; }
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
function inicioMesa(id) {
  const cs = S.cards.filter(c => c.refId === id && c.origem === 'salao' && c.setor === 'cozinha' && emFila(c) && c.status !== 'aguardando');
  return cs.length ? Math.min(...cs.map(cardInicio)) : null;
}
function corMesa(id) { const t = inicioMesa(id); return t == null ? null : corCoz(minDesde(t)); }
// Bolinha de urgência que muda de cor sozinha (sem repintar a tela)
function pontoMesa(id) { const t = inicioMesa(id); return t == null ? '' : `<span class="ponto c-${corCoz(minDesde(t))}" data-cor="${t}" data-pref="c-"></span>`; }
function telaSlots() {
  const ids = listaMesas();
  const ci = consumoValidos(); const porTipo = contarPorTipo(ci);
  let h = `<button class="slot-ci" data-a="verCI"><span class="ci-ic">${ic('inventory_2')}</span><span class="ci-t"><b>Consumo interno e perdas</b>
    <small>${ci.length ? Object.entries(porTipo).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(' · ') : 'Tudo o que sai sem virar venda: consumo, cortesia, bonificação, desconto e perda'}</small></span>
    <span class="ci-n">${ci.length ? `<b>${ci.length}</b><small>lançamento${ci.length > 1 ? 's' : ''}</small>` : ic('add')}</span></button>`;
  h += '<div class="slots">';
  ids.forEach(id => {
    const m = S.mesas[id];
    if (!m) { h += `<button class="slot livre" data-a="abrirMesa" data-id="${id}"><div class="num">${esc(rotuloMesa(id))}</div><div class="inf">livre</div></button>`; return; }
    const tot = subtotal(m.itens); const pend = itensValidos(m.itens).filter(i => !i.enviado).length;
    h += `<button class="slot" data-a="verMesa" data-id="${id}"><div class="num">${esc(m.label || rotuloMesa(id))} ${pontoMesa(id)}</div>
      <div class="nomes">${esc((m.nomes || []).join(', ') || '—')}</div>
      <div class="inf">${R(tot)} · <span data-min="${m.abertaEm}">${minDesde(m.abertaEm)} min</span>${pend ? ` · <b style="color:var(--laranja)">${pend} a enviar</b>` : ''}</div></button>`;
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

// ================= consumo interno e perdas (slot fixo no painel das mesas) =================
// Não cobra, não abre conta, não entra no caixa nem na conferência. Sem preço: o fiscal valora pelo custo de mercado
// ou da ficha técnica, nunca pelo cardápio (R41). Todos lançam; apagar pede código de gerente ou sócio (JP, 24/11/2026).
const CI_ID = '__ci';
const CI_TIPOS = [['Consumo', 'Sócios, equipe e freelas comem ou bebem'], ['Cortesia', 'A casa oferece ao cliente'], ['Bonificação', 'Bônus prometido, ex.: o do recado de substituição'], ['Desconto', 'Desconto dado a um cliente'], ['Perda', 'Feito sem precisar, estragou, caiu']];
const CI_PARA = ['Sócio', 'Equipe', 'Freela', 'Cliente'];
const CI_MOTIVOS_APAGAR = ['Lançado errado', 'Lançado em dobro', 'Outro'];
function consumoValidos() { return (S.consumo || []).filter(c => !c.apagado); }
function contarPorTipo(lista) { const o = {}; lista.forEach(c => { o[c.tipo] = (o[c.tipo] || 0) + (+c.qtd || 1); }); return o; }
function paraQuem(c) { return c.para ? c.para + (c.nome ? ' · ' + c.nome : '') : '—'; }
A.verCI = () => { S.ui.mesa = CI_ID; F.ciBusca = ''; window.scrollTo(0, 0); render(); };
function telaConsumo() {
  const f = S.ui.ci = S.ui.ci || { item: null, qtd: 1, tipo: null, para: null };
  const lista = (S.consumo || []).slice().reverse(); const val = consumoValidos(); const porTipo = contarPorTipo(val);
  let h = `<div class="mesa-topo"><button class="bt-ic" data-a="voltarMesas">${ic('arrow_back')}</button><h1 style="margin:0;flex:1">Consumo interno e perdas</h1></div>
    <p class="sub" style="margin-top:-6px">Não é venda: não cobra, não entra no caixa. Sem preço: o fiscal valora pelo custo (preço do mercado ou ficha técnica). Tudo fica com o seu nome e a hora.</p>
    <div class="card ci-form">`;
  // 1. item
  if (f.item) h += `<div class="secao-t" style="margin-top:0">Item</div><div class="ci-item">${f.item.cod ? `<span class="cod">${f.item.cod}</span>` : `<span class="tag cinza">item livre</span>`}<b style="flex:1">${esc(f.item.nome)}</b><button class="bt-ic" data-a="ciTirarItem">${ic('close')}</button></div>`;
  else {
    const q = (F.ciBusca || '').trim(); const res = q ? buscar(q).slice(0, 6) : [];
    h += `<div class="secao-t" style="margin-top:0">Item</div><div class="busca">${ic('search')}<input id="ciBusca" data-f="ciBusca" data-vivo placeholder="Código, nome, abreviação ou item livre (ex.: cerveja do mercado)" autocomplete="off" value="${esc(F.ciBusca || '')}" data-enter="ciPrimeiro"></div>`;
    if (q) h += `<div class="resultados">${res.map(p => `<div class="res" data-a="ciItem" data-c="${p.cod}"><span class="cod">${p.cod}</span><span class="nm">${esc(p.nome)}${p.ab ? ` <span class="sub">${esc(p.ab)}</span>` : ''}</span></div>`).join('')}
      <div class="res" data-a="ciLivre">${ic('edit_note')}<span class="nm">Item livre: <b>${esc(q)}</b> <span class="sub">(fora do cardápio, ex.: comprado no mercado)</span></span></div></div>`;
  }
  // 2. quantidade
  h += `<div class="secao-t">Quantidade</div><div class="linha"><button class="bt-ic borda" data-a="ciQtd" data-c="-1">${ic('remove')}</button><b class="ci-qtd">${f.qtd}</b><button class="bt-ic borda" data-a="ciQtd" data-c="1">${ic('add')}</button></div>`;
  // 3. tipo
  h += `<div class="secao-t">Tipo</div><div class="chips">${CI_TIPOS.map(([t, s]) => `<button class="chip ${f.tipo === t ? 'on' : ''}" data-a="ciTipo" data-c="${t}" title="${esc(s)}">${t}</button>`).join('')}</div>`;
  if (f.tipo) h += `<div class="sub" style="margin-top:6px">${esc((CI_TIPOS.find(x => x[0] === f.tipo) || [])[1] || '')}</div>`;
  // 4. para quem
  h += `<div class="secao-t">Para quem${f.tipo === 'Perda' ? ' <span style="text-transform:none;letter-spacing:0;font-weight:400">(na perda, opcional)</span>' : ''}</div><div class="chips">${CI_PARA.map(t => `<button class="chip ${f.para === t ? 'on' : ''}" data-a="ciPara" data-c="${t}">${t}</button>`).join('')}</div>
    <input id="ciNome" class="inp" style="margin-top:8px" data-f="ciNome" placeholder="Nome (opcional, ex.: Yuri, Júlia, mesa 4)" value="${esc(F.ciNome || '')}" autocomplete="off">`;
  // 5. motivo e pedido
  h += `<div class="secao-t">Motivo curto</div><input id="ciMotivo" class="inp" data-f="ciMotivo" placeholder="Ex.: refeição da equipe, caiu no chão, aniversário do cliente" value="${esc(F.ciMotivo || '')}" autocomplete="off" data-enter="ciLancar">`;
  if (['Cortesia', 'Bonificação', 'Desconto'].includes(f.tipo)) h += `<div class="secao-t">Nº do pedido (opcional)</div><input id="ciPedido" class="inp" data-f="ciPedido" placeholder="Ex.: 1051 (iFood) ou 23 (WhatsApp)" value="${esc(F.ciPedido || '')}" autocomplete="off">`;
  const falta = [!f.item && 'o item', !f.tipo && 'o tipo', !f.para && f.tipo !== 'Perda' && 'para quem'].filter(Boolean);
  h += `<div class="entre" style="margin-top:14px"><span class="sub">${falta.length ? 'Falta: ' + falta.join(', ') : 'Lançado por ' + esc(quem()) + ' às ' + hora(agora())}</span>
    <button class="bt pri grande" data-a="ciLancar" ${falta.length ? 'disabled' : ''}>${ic('add_task')} Lançar</button></div></div>`;
  // lista da noite
  h += `<div class="entre" style="margin-top:18px"><div class="secao-t" style="margin:0">Nesta noite</div><div class="chips">${Object.entries(porTipo).map(([k, v]) => `<span class="tag cinza">${esc(k)} ${v}</span>`).join('')}</div></div>`;
  h += lista.length ? `<div class="itens" style="margin-top:8px">${lista.map(c => `<div class="item ${c.apagado ? 'apagado' : ''}"><div class="corpo">
      <div class="nm">${esc(c.item)} <span class="sub">× ${c.qtd}</span> <span class="tag ci-${norm(c.tipo).replace(/\W/g, '')}">${esc(c.tipo)}</span></div>
      <div class="det">${esc(paraQuem(c))}${c.motivo ? ' · ' + esc(c.motivo) : ''}${c.pedido ? ' · pedido ' + esc(c.pedido) : ''}</div>
      <div class="det">${hora(c.ts)} · lançou ${esc(c.por)}${c.livre ? ' · item livre' : ''}${c.apagado ? ` · <b>apagado</b> por ${esc(c.apagado.pediu)}, autorizou ${esc(c.apagado.autorizou)} (${esc(c.apagado.motivo)})` : ''}</div></div>
      ${c.apagado ? '' : `<button class="bt-ic" data-a="ciApagar" data-id="${c.id}" title="Apagar (pede código de gerente ou sócio)">${ic('delete')}</button>`}</div>`).join('')}</div>`
    : '<div class="vazio">Nada lançado nesta noite.</div>';
  return h;
}
A.ciPrimeiro = () => { const r = buscar(F.ciBusca); if (r[0]) A.ciItem({ c: r[0].cod }); else if ((F.ciBusca || '').trim()) A.ciLivre(); };
A.ciItem = d => { const p = P[+d.c]; S.ui.ci.item = { cod: p.cod, nome: p.nome, ab: p.ab || '' }; F.ciBusca = ''; render(); };
A.ciLivre = () => { const n = (F.ciBusca || '').trim(); if (!n) return; S.ui.ci.item = { cod: null, nome: n[0].toUpperCase() + n.slice(1), ab: '' }; F.ciBusca = ''; render(); };
A.ciTirarItem = () => { S.ui.ci.item = null; render(); setTimeout(() => { const b = $('#ciBusca'); b && b.focus(); }, 0); };
A.ciQtd = d => { S.ui.ci.qtd = Math.max(1, Math.min(99, S.ui.ci.qtd + (+d.c))); render(); };
A.ciTipo = d => { S.ui.ci.tipo = d.c; render(); };
A.ciPara = d => { S.ui.ci.para = S.ui.ci.para === d.c ? null : d.c; render(); };
A.ciLancar = async () => {
  const f = S.ui.ci; if (!f || !f.item || !f.tipo || (!f.para && f.tipo !== 'Perda')) { toast('Escolha o item, o tipo e para quem'); return; }
  const t = agora(); const id = 'ci-' + t + '-' + uid().slice(0, 4);
  const doc = { id, noiteId: noiteId(), ts: t, item: f.item.nome, cod: f.item.cod, ab: f.item.ab || '', livre: !f.item.cod, qtd: f.qtd, tipo: f.tipo, para: f.para || '', nome: (F.ciNome || '').trim(), motivo: (F.ciMotivo || '').trim(), pedido: ['Cortesia', 'Bonificação', 'Desconto'].includes(f.tipo) ? (F.ciPedido || '').trim() : '', por: quem() };
  await DB.set('consumo', id, doc);
  S.ui.ci = { item: null, qtd: 1, tipo: f.tipo, para: f.para }; F.ciNome = ''; F.ciMotivo = ''; F.ciPedido = ''; F.ciBusca = '';
  toast(doc.tipo + ' lançado: ' + doc.qtd + ' × ' + doc.item); render();
};
A.ciApagar = d => {
  const c = (S.consumo || []).find(x => x.id === d.id); if (!c) return;
  pedirAutorizacao('Apagar ' + c.qtd + ' × ' + c.item + ' (' + c.tipo + ')?', async (p, motivo) => {
    await DB.update('consumo', c.id, { apagado: { pediu: quem(), autorizou: p.nome, motivo, ts: agora() } });
    toast('Lançamento apagado · autorizado por ' + p.nome);
  }, CI_MOTIVOS_APAGAR);
};
A.voltarMesas = () => { S.ui.mesa = null; render(); };

function statusItem(it) {
  if (!it.enviado) return '';
  const cs = (it.cards || []).map(id => S.cards.find(c => c.id === id)).filter(Boolean);
  if (!cs.length) return '<span class="tag cinza">enviado</span>';
  const pend = cs.filter(c => c.status !== 'feito');
  if (!pend.length) return '<span class="tag ok">pronto ✓</span>';
  return pend.map(c => {
    if (c.status === 'espera' && c.liberaEm > agora()) return `<span class="tag cinza">bebida com o prato · <span data-ate="${c.liberaEm}">${Math.ceil((c.liberaEm - agora()) / 60000)}</span> min</span>`;
    const t0 = cardInicio(c); const m = minDesde(t0); const cor = c.setor === 'bar' ? corBar(m) : corCoz(m);
    return `<span class="tag" style="background:#fff;border:1px solid var(--borda)"><span class="ponto c-${cor}" data-cor="${t0}" data-esc="${c.setor === 'bar' ? 'bar' : 'coz'}" data-pref="c-"></span> ${c.setor === 'bar' ? 'bar' : 'cozinha'} <span data-min="${t0}">${m} min</span></span>`;
  }).join(' ');
}
function telaMesa(id) {
  const m = S.mesas[id];
  if (!m) return `<div class="vazio">Esta mesa foi fechada.<br><br><button class="bt" data-a="voltarMesas">Voltar às mesas</button></div>`;
  const val = itensValidos(m.itens); const pend = val.filter(i => !i.enviado); const env = val.filter(i => i.enviado);
  let h = `<div class="mesa-topo"><button class="bt-ic" data-a="voltarMesas">${ic('arrow_back')}</button>
    <h1 style="margin:0;flex:1">${esc(m.label || rotuloMesa(id))} ${pontoMesa(id)}</h1>
    <button class="bt ton" data-a="qrCliente" data-id="${id}">${ic('qr_code_2')} QR</button></div>
    <div class="nomes-mesa">${(m.nomes || []).map(n => `<span class="nome-p">${esc(n)}</span>`).join('')}<button class="chip" data-a="editarNomes" data-id="${id}">${ic('edit')} nomes</button>
    ${(m.clientes || []).length ? `<span class="tag whatsapp">${ic('chat')} ${m.clientes.length} no WhatsApp</span>` : ''}</div>
    <div class="busca">${ic('search')}<input id="busca" data-f="busca" data-vivo placeholder="Código ou nome (ex.: 6 ou 3 Queij)" autocomplete="off" value="${esc(F.busca || '')}" data-enter="addPrimeiro" data-id="${id}" inputmode="search">
    ${F.busca ? `<button class="bt-ic" data-a="limparBusca">${ic('close')}</button>` : ''}</div>`;
  const res = buscar(F.busca);
  if (res.length) h += `<div class="resultados">${res.map(p => `<div class="res" data-a="addProd" data-id="${id}" data-c="${p.cod}"><span class="cod">${p.cod}</span><span class="nm">${esc(p.nome)}${p.ab ? ` <span class="sub">${esc(p.ab)}</span>` : ''}</span><span class="pr">${p.precoLivre ? 'R$ 17 a 30' : R(p.preco)}</span></div>`).join('')}</div>`;
  if (pend.length) {
    h += `<div class="secao-t">A enviar · marque o que sai primeiro</div><div class="itens">` + pend.map(it => `
      <div class="item"><input type="checkbox" class="ck" data-ch="selItem" data-id="${id}" data-u="${it.uid}" ${it.sel ? 'checked' : ''}>
        <div class="corpo"><div class="nm toca" data-a="descontoItem" data-id="${id}" data-u="${it.uid}">${esc(it.nome)}</div>${descItem(it).map(l => `<div class="troca">${esc(l)}</div>`).join('')}${tagDesconto(it)}
        ${temSetor(it, 'bar') ? `<label class="sub" style="display:flex;align-items:center;gap:6px;margin-top:4px"><input type="checkbox" data-ch="comPrato" data-id="${id}" data-u="${it.uid}" ${it.comPrato ? 'checked' : ''}> bebida vai com o prato (${cfg().minPrato || 15} min)</label>` : ''}</div>
        ${precoHtml(it, id)}<button class="bt-ic" data-a="tirarItem" data-id="${id}" data-u="${it.uid}">${ic('close')}</button></div>`).join('') + '</div>';
    h += `<div class="barra-acao"><button class="bt pri grande" style="flex:1" data-a="enviarMesa" data-id="${id}">${ic('send')} Enviar ${pend.length} ${pend.length > 1 ? 'itens' : 'item'}</button></div>
      <p class="sub" style="margin-top:-4px">${esc(previaEnvio(pend))}</p>`;
  }
  if (env.length) {
    h += `<div class="secao-t">Na produção e servidos</div><div class="itens">` + env.map(it => `
      <div class="item enviado"><div class="corpo"><div class="nm toca" data-a="descontoItem" data-id="${id}" data-u="${it.uid}">${esc(it.nome)}</div>${descItem(it).map(l => `<div class="troca">${esc(l)}</div>`).join('')}${tagDesconto(it)}<div style="margin-top:4px">${statusItem(it)}</div></div>
      ${precoHtml(it, id)}<button class="bt-ic" data-a="cancelarItem" data-id="${id}" data-u="${it.uid}" title="Cancelar (pede código do gerente)">${ic('delete')}</button></div>`).join('') + '</div>';
  }
  if (!val.length) h += `<div class="vazio">${ic('restaurant_menu')}<br>Digite o código ou o nome do prato acima.</div>`;
  else h += `<p class="sub" style="margin-top:6px">${ic('sell')} Desconto: toque no nome ou no preço do item (pede código de gerente ou sócio).</p>`;
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
// --- desconto no item: toca no item, digita d100 / d50 / d5 (qualquer valor), confirma com código de gerente ou sócio ---
function precoHtml(it, id) {
  const tem = it.desconto && it.desconto.pct > 0;
  return `<div class="pr toca" data-a="descontoItem" data-id="${id}" data-u="${it.uid}" title="Desconto (código de gerente ou sócio)">${tem ? `<s class="sub">${R(precoCheio(it))}</s><br>` : ''}${R(precoItem(it))}</div>`;
}
function tagDesconto(it) { const d = it.desconto; return d && d.pct > 0 ? `<div><span class="tag desc">${ic('sell')} −${pctTxt(d.pct)} · autorizou ${esc(d.autorizou)}${d.motivo ? ' · ' + esc(d.motivo) : ''}</span></div>` : ''; }
function lerPct(s) { const m = String(s || '').trim().match(/^d?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*%?$/i); if (!m) return null; const v = parseFloat(m[1].replace(',', '.')); return v >= 0 && v <= 100 ? v : null; }
A.descontoItem = d => {
  const id = d.id, u = d.u; const m0 = S.mesas[id]; const it0 = m0 && m0.itens.find(i => i.uid === u); if (!it0 || it0.cancelado) return;
  F.descM = it0.desconto && it0.desconto.pct > 0 ? 'd' + it0.desconto.pct : ''; F.motivoD = (it0.desconto && it0.desconto.motivo) || ''; F.pinM = '';
  abrirModal({
    foco: 'descM',
    render() {
      const m = S.mesas[id]; const it = m && m.itens.find(i => i.uid === u); if (!it) return '<div class="vazio">Item não está mais na mesa.</div><button class="bt bloco" data-a="fecharModal">OK</button>';
      const c = precoCheio(it); const p = lerPct(F.descM); const ok = p != null;
      return `<div class="entre"><h2>Desconto</h2><button class="bt-ic" data-a="fecharModal">${ic('close')}</button></div>
        <p class="sub" style="margin:0 0 10px">${esc(it.nome)} · ${R(c)}</p>
        <input id="descM" class="inp" style="font-size:24px;text-align:center;letter-spacing:.06em" data-f="descM" data-vivo inputmode="text" autocomplete="off" placeholder="d100, d50, d5…" value="${esc(F.descM)}" data-enter="okD">
        <div class="desc-prev">${!String(F.descM || '').trim() ? 'Digite d e a porcentagem: d100 = 100%, d50 = 50%, d5 = 5%. d0 tira o desconto.' : !ok ? '<span style="color:var(--vermelho)">Use d e um número de 0 a 100 (ex.: d50)</span>' : p === 0 ? 'Sem desconto: volta a ' + R(c) : `<b>${pctTxt(p)}</b> de desconto: ${R(c)} → <b>${R(c * (1 - p / 100))}</b> <span class="sub">(−${R(c * p / 100)})</span>`}</div>
        <input id="motivoD" class="inp" style="margin-top:10px" data-f="motivoD" autocomplete="off" placeholder="Motivo (ex.: demorou, cliente fiel, saiu errado)" value="${esc(F.motivoD)}">
        <div class="campo" style="margin-top:10px"><label for="pinM">Código do gerente ou sócio</label>${inputPin('pinM', 'okD')}</div>
        <div class="linha"><button class="bt" data-a="fecharModal">Voltar</button><span style="flex:1"></span><button class="bt pri" data-a="okD" ${ok ? '' : 'disabled'}>${ic('sell')} Aplicar</button></div>`;
    },
    async okD() {
      const p = lerPct(F.descM); if (p == null) { toast('Digite d e a porcentagem, ex.: d50'); return; }
      const pe = await pessoaPorPin(F.pinM, ACESSO_TOTAL); F.pinM = '';
      if (!pe) { toast('Código não confere (só gerente ou sócio)'); pintarModal(); return; }
      const motivo = (F.motivoD || '').trim(); let txt = '';
      await DB.mutate('mesas', id, mm => {
        const x = mm && mm.itens.find(i => i.uid === u); if (!x) return undefined;
        const c = precoCheio(x);
        if (p === 0) { if (!x.desconto) return undefined; txt = 'tirou o desconto de ' + x.nome; delete x.desconto; }
        else { x.desconto = { pct: p, cheio: c, valor: r2(c * p / 100), pediu: quem(), autorizou: pe.nome, motivo, ts: agora() }; txt = 'desconto de ' + pctTxt(p) + ' em ' + x.nome + ' (−' + R(x.desconto.valor) + ')'; }
        mm.log = (mm.log || []).concat({ t: agora(), quem: quem(), o: txt + ' · autorizado por ' + pe.nome + (motivo ? ' · ' + motivo : '') });
        return mm;
      });
      fecharModal(); if (txt) toast(txt[0].toUpperCase() + txt.slice(1));
    }
  });
};
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
  modalItem(p, add, { q: F.busca });
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
    itens: itensValidos(m.itens).map(i => Object.assign({ cod: i.cod, nome: i.nome, preco: precoItem(i), desc: descItem(i) }, i.desconto && i.desconto.pct > 0 ? { cheio: precoCheio(i), descPct: i.desconto.pct } : {})),
    descontos: itensValidos(m.itens).filter(i => i.desconto && i.desconto.pct > 0).map(i => ({ nome: i.nome, pct: i.desconto.pct, cheio: precoCheio(i), valor: r2(precoCheio(i) - precoItem(i)), pediu: i.desconto.pediu, autorizou: i.desconto.autorizou, motivo: i.desconto.motivo || '', ts: i.desconto.ts })),
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
    const t0 = cardInicio(c); const m = minDesde(t0); const veio = c.status === 'espera';
    return `<div class="bc ${corBar(m)}" data-cor="${t0}" data-esc="bar"><div class="entre"><span><span class="tag ${c.origem}">${c.origem === 'salao' ? 'salão' : c.origem}</span> <b>${esc(c.ref)}</b></span><b data-min="${t0}">${m} min</b></div>
      ${c.blocos.map(b => b.linhas.map(l => `<div class="bl">${esc(l.ab || l.nome)}${l.trocas.length ? ` <span class="troca" style="color:#b06000;font-size:14px">${esc(l.trocas.join(', '))}</span>` : ''}</div>`).join('')).join('')}
      ${c.pgPendente ? '<span class="tag aviso">pagamento a confirmar</span>' : ''}
      <div class="linha"><button class="bt verde" style="flex:1" data-a="feito" data-id="${c.id}">${ic('check')} Feito</button>${veio ? `<button class="bt" data-a="voltaEspera" data-id="${c.id}">${ic('undo')} Voltar p/ espera</button>` : ''}</div></div>`;
  }).join('') + '</div>';
  if (espera.length) {
    h += `<div class="secao-t">Vão com o prato (entram sozinhas)</div><div class="grade">` + espera.map(c => `<div class="bc espera"><div class="entre"><b>${esc(c.ref)}</b><span>entra em <span data-ate="${c.liberaEm}">${Math.ceil((c.liberaEm - agora()) / 60000)}</span> min</span></div>
      ${c.blocos.map(b => b.linhas.map(l => `<div class="bl">${esc(l.ab || l.nome)}</div>`).join('')).join('')}
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
  return `<h2>Estudo · cardápio e códigos</h2><p class="sub">Burguers de 1 a 11 · aperitivos 21 a 28 · combo do burguer 30 a 33 · combos da mesa 41 a 46 · Circuito 50 a 53 · adicionais 61 a 73 · acompanhamentos e sobremesas 81 a 89 · bebidas 91 a 107 · combos do bar 108 a 110. Lance pelo código, pelo nome ou pela abreviação da linha (ex.: XT, B24, PILSEN, BELO GIN PIT).</p>
    <div class="busca" style="margin:12px 0">${ic('search')}<input id="estudo" data-f="estudo" data-vivo placeholder="Procurar" value="${esc(F.estudo || '')}"></div>
    ${cats.map(c => `<div class="secao-t">${esc(c.n)}</div><div class="card" style="padding:4px 12px">${c.i.map(p => `<div class="res" style="cursor:default"><span class="cod">${p.cod}</span><span class="nm">${esc(p.nome)}${p.ab ? ` <span class="tag cinza">${esc(p.ab)}</span>` : ''}${p.desc ? `<br><span class="sub">${esc(p.desc)}</span>` : ''}${p.grupos ? `<br><span class="sub">${esc(p.grupos.map(g => g.t + ': ' + g.ops.map(o => o.n + (o.ab ? ' (' + o.ab + ')' : '') + (o.mais ? ' + ' + Rc(o.mais) : '')).join(', ')).join(' · '))}</span>` : ''}</span><span class="pr">${p.precoLivre ? 'R$ 17 a 30' : R(p.preco)}${p.setor === 'bar' ? '<br><span class="tag cinza">bar</span>' : ''}</span></div>`).join('')}</div>`).join('')}
    <div class="secao-t">Regras de preço</div><div class="card sub" style="line-height:1.6">
    • Adicionais: 2 por R$ 10, 3 por R$ 12 (o sistema calcula sozinho). No espeto, 3 por R$ 10.<br>
    • Combo do burguer: fritas + brownie ou alfajor + suco 500 ml ou refri 600 ml = + R$ 28. Soda + R$ 30, cerveja + R$ 36, drink + R$ 37.<br>
    • Combos 41 e 42 com Bitrem: +R$ 15; com CTB: +R$ 5. No Combo Família e no + burguer, Bitrem e CTB não entram.<br>
    • Antes de enviar, o garçom tira o que quiser. Depois de enviado, só o gerente ou sócio cancela, com código e motivo.<br>
    • Alergia a glúten: marque "Sem glúten (alergia)" no item. A TV mostra em vermelho: isca de shimeji só no fubá e sem onion rings. Pão sem glúten +R$ 5 nos adicionais.<br>
    • Consumo da equipe, cortesia, bonificação, desconto e perda: lance no slot Consumo interno e perdas (não é venda, não cobra).<br>
    • Cozinha: verde até 20 min, amarelo 20 a 30, laranja 30 a 35, vermelho 35+. Bebidas: verde até 5, amarelo 5 a 10, vermelho 10+.</div>`;
}

// ================= cozinha (TV) =================
function somaFila(cards) {
  const s = { burguer: 0, quesadilla: 0, cogumelo: 0 };
  cards.forEach(c => c.blocos.forEach(b => b.linhas.forEach(l => { if (l.chapa === 'burguer') s.burguer += (l.discos || 1); else if (l.chapa) s[l.chapa] += 1; })));
  return s;
}
function cardCozinha(c) {
  const ag = c.status === 'aguardando'; const t0 = ag ? c.criadoEm : cardInicio(c); const m = minDesde(t0);
  const cor = ag ? 'aguardando' : corCoz(m);
  const tagO = c.origem === 'salao' ? 'salão' : c.origem === 'ifood' ? 'iFood' : 'WhatsApp';
  const alergia = c.blocos.some(b => b.linhas.some(l => l.alergia));
  let h = `<div class="kc ${cor} ${alergia ? 'com-alergia' : ''}" data-card="${c.id}"${ag ? '' : ` data-cor="${t0}"`}><div class="kh"><span class="tag ${c.origem}">${tagO}</span>${c.marca === 'ladob' ? '<span class="tag ladob">Lado B</span>' : ''}<span class="ref">${esc(c.ref)}</span>${LEVAS_CARD[c.id] ? `<span class="tag leva-tag">${[...LEVAS_CARD[c.id]].map(x => 'L' + (x + 1)).join('/')}</span>` : ''}<span class="tempo" data-min="${t0}">${m} min</span></div>`;
  if (alergia) h += `<div class="kalerta">${ic('warning')} ALERGIA A GLÚTEN</div>`;
  if (c.nPedido) h += `<div class="npedido">${ordinal(c.nPedido)} pedido com a gente</div>`;
  // Na TV, a abreviação da linha de produção (como nas fichas de montagem); sem abreviação, o nome
  const linhaK = (l, sep) => `<div class="kl ${sep ? 'sep' : ''}">${esc(l.ab || l.nome)}${l.trocas.length ? '<br>' + l.trocas.map(t => `<span class="kt">${esc(t)}</span>`).join('') : ''}${l.alergia ? `<br><span class="ka">${esc(l.alergia)}</span>` : ''}</div>`;
  c.blocos.forEach(b => {
    if (b.combo) {
      let g = null;
      h += `<div class="bloco combo"><span class="tc">${esc(b.comboAb || 'COMBO')}</span>` + b.linhas.map(l => { const sep = g !== null && l.grupo !== g; g = l.grupo; return linhaK(l, sep); }).join('') + '</div>';
    } else {
      h += b.linhas.map(l => linhaK(l, false)).join('');
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
// ================= leva de produção (JP, 24/11/2026) =================
// Uma pessoa produz até 10 burguers por leva. O painel mostra o que a leva da vez pede: proteínas de grão de bico e
// de soja, recheios de iscas, onion rings dos burguers, porções de onion e as fritas P, M e G. Passou de 10, o resto
// fica para a próxima leva, com o aviso ao lado. As porções entram na leva em que estão na fila.
const LEVA_MAX = 10;
// O produto da linha: pelo código (cards novos) ou, nos cards antigos, pela abreviação ou pelo nome
function prodDaLinha(l) {
  if (l.cod && P[l.cod]) return P[l.cod];
  const ab = norm(l.ab), nm = norm(l.nome);
  return C.fixos.find(p => (ab && norm(p.ab) === ab && (p.tipo === 'burguer') === (l.chapa === 'burguer')) || norm(p.nome) === nm) || null;
}
function prodLinha(l) {
  const r = { burg: 0, gb: 0, soja: 0, protX: 0, isca: 0, oniB: 0, oniP: 0, P: 0, M: 0, G: 0, meio: 0 };
  const p = prodDaLinha(l); const adds = l.adds || [];
  const semOnion = /SEM ONION/.test(l.alergia || '');
  if (l.chapa === 'burguer') {
    r.burg = 1;
    const prot = (p && p.prot) || [];
    prot.forEach(k => { r[k] += 1; });
    adds.filter(c => c === 72).forEach(() => { if (prot[0]) r[prot[0]] += 1; else r.protX += 1; });
    const gl = String((p && p.gl) || '');
    if (/\bisca\b/.test(gl)) r.isca = 1;
    if (/\bonion\b/.test(gl) && !semOnion) r.oniB += 2;
    r.oniB += adds.filter(c => c === 64).length * 2;
    return r;
  }
  const esc = l.esc || ''; const tam = l.fritas || (p && p.fritas) || (/^FRI 100g$/i.test(l.ab) ? 'P' : /^1\/2 FIL/i.test(l.ab) ? 'M' : /FRI/i.test(l.ab) && !p ? 'G' : null);
  const oniEsc = p && p.escolha && esc && /oniprato/.test(((p.glEscolha || {})[esc]) || '');
  const meio = /meio|mix/i.test(esc);
  const soOnion = oniEsc && !meio;
  if (tam && !soOnion) { r[tam] += 1; if (meio) r.meio += 1; }
  if (oniEsc || (p && !p.escolha && /oniprato/.test(p.gl || ''))) r.oniP += 1;
  return r;
}
// Divide a fila em levas de até 10 burguers; devolve o resumo de cada leva e as levas de cada card
function levasDaFila(fila) {
  const lev = []; const doCard = {}; let L = 0, n = 0;
  const nova = () => ({ burg: 0, gb: 0, soja: 0, protX: 0, isca: 0, oniB: 0, oniP: 0, P: 0, M: 0, G: 0, meio: 0 });
  fila.filter(c => c.status !== 'aguardando').forEach(c => {
    (c.blocos || []).forEach(b => (b.linhas || []).forEach(l => {
      const r = prodLinha(l);
      if (r.burg && n >= LEVA_MAX) { L++; n = 0; }
      if (r.burg) n++;
      const x = lev[L] = lev[L] || nova();
      Object.keys(r).forEach(k => { x[k] += r[k]; });
      (doCard[c.id] = doCard[c.id] || new Set()).add(L);
    }));
  });
  return { lev, doCard };
}
let LEVAS_CARD = {};
function telaLeva(fila, compacta) {
  const { lev, doCard } = levasDaFila(fila); LEVAS_CARD = lev.length > 1 ? doCard : {};
  const a = lev[0]; if (!a) return '';
  const resto = lev.slice(1); const burgResto = resto.reduce((s, x) => s + x.burg, 0);
  const it = (v, t, cls, ic1) => v ? `<span class="lv ${cls || ''}">${ic1 ? ic(ic1) : ''}<b>${v}</b>${t}</span>` : '';
  const its = [
    it(a.gb, 'grão de bico', 'gb', 'grain'), it(a.soja, 'soja', 'soja', 'eco'), it(a.protX, 'proteína extra (ver card)', '', 'add_circle'),
    it(a.isca, a.isca > 1 ? 'recheios de isca' : 'recheio de isca', 'isca', 'set_meal'),
    it(a.oniB, 'onions nos burguers', 'oni', 'donut_large'), it(a.oniP, a.oniP > 1 ? 'porções de onion' : 'porção de onion', 'oni', 'donut_small'),
    it(a.P, 'fritas P', 'fri', 'fastfood'), it(a.M, 'fritas M', 'fri', 'fastfood'), it(a.G, 'fritas G' + (a.meio ? ` <small>(${a.meio} meio a meio)</small>` : ''), 'fri', 'fastfood')
  ].join('');
  return `<div class="leva${compacta ? ' compacta' : ''}"><div class="lv-t"><span class="lv-n">Leva 1</span><b>${a.burg}</b><span>${a.burg === 1 ? 'burguer' : 'burguers'}${a.burg >= LEVA_MAX ? ' (cheia)' : ''}</span></div>
    <div class="lv-its">${its || '<span class="sub">só o que já está nos cards</span>'}</div>
    ${resto.length ? `<div class="lv-prox">${ic('layers')}<span><b>+${resto.length} ${resto.length > 1 ? 'levas' : 'leva'} na fila</b>${burgResto} ${burgResto === 1 ? 'burguer' : 'burguers'}</span></div>` : ''}</div>`;
}
function telaFilaCozinha(compacta) {
  const fila = filaDe('cozinha'); const s = somaFila(fila.filter(c => c.status !== 'aguardando'));
  const leva = telaLeva(fila, compacta);
  return `<div class="tv-topo">${compacta ? '' : `<b style="font-size:20px">Cozinha</b>`}<div class="soma"><div class="s"><b>${s.burguer}</b>hambúrgueres</div><div class="s"><b>${s.quesadilla}</b>quesadillas</div><div class="s"><b>${s.cogumelo}</b>cogumelos</div></div>
    <span class="esp" style="flex:1"></span><span style="font-size:22px;font-weight:700" data-relogio>${hora(agora())}</span>${compacta ? '' : `<button class="bt-ic" data-a="sair" title="Sair">${ic('logout')}</button>`}</div>
    ${leva}
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
    <div class="linha"><button class="bt" data-a="copiar" data-c="${esc(linkPedido)}">${ic('content_copy')} Copiar link</button><button class="bt ton" data-a="link" data-c="${esc(linkPedido)}">${ic('add')} Lançar pedido</button></div></div><div class="kanban" data-rola="kanban">`;
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
// Lê o texto copiado do Gestor de Pedidos do iFood (ou o texto de um print). Formato do gestor (noite teste de 23/11):
// o nº do pedido sozinho na 1ª linha, "Feito às 20:05" e, depois de "Itens no pedido", cada item em 3 linhas
// (nome / R$ preço / quantidade); complemento = nome / R$ preço sem quantidade; texto solto = observação.
function lerIfood(txt) {
  const L = String(txt || '').split(/\r?\n/).map(l => l.replace(/[ \s]+/g, ' ').trim()).filter(l => l && l !== '●' && l !== '•');
  const out = { num: '', hora: '', marca: /lado\s*b/i.test(txt) ? 'ladob' : 'st', itens: [], obs: [] };
  const l0 = L.slice(0, 8).find(l => /^#?\d{3,5}$/.test(l)) || (L.slice(0, 8).join('\n').match(/^#?(\d{3,5}) [A-Za-zÀ-ú]/m) || [])[1];
  if (l0) out.num = String(l0).replace('#', '');
  else { for (const l of L) { const m = l.match(/(?:^|\s)(?:pedido\s*(?:n[ºo°.]?\s*)?#?\s*|#)(\d{3,6})\b/i); if (m && !/^\d+º/.test(l)) { out.num = m[1]; break; } } }
  const mh = txt.match(/feito\s*(?:às|as|a)?\s*([01]?\d|2[0-3])[:h]([0-5]\d)/i) || txt.match(/\b([01]?\d|2[0-3])[:h]([0-5]\d)\b/);
  if (mh) out.hora = mh[1].padStart(2, '0') + ':' + mh[2];
  const ehPreco = l => /^-?\s*R\$\s*[\d.,]+$/.test(l || '');
  const ehQtd = l => /^\d{1,2}x?$/i.test(l || '');
  const fim = /^(taxa de entrega|taxa de servi|subtotal|total\b|incentivos|valores cobrados|pago via|forma de pagamento|cobrar do cliente|troco)/i;
  const lixo = /seu trem|^substituir itens$|^itens no pedido|^observa[cç][aã]o do pedido$/i;
  let ini = L.findIndex(l => /^itens no pedido/i.test(l));
  const sec = []; if (ini >= 0) { for (let i = ini + 1; i < L.length && !fim.test(L[i]); i++) sec.push(L[i]); }
  let ultimo = null;
  const novoItem = (nome, q) => { nome = nome.replace(/R\$\s*[\d.,]+/g, '').replace(/^\d{1,2}\s*x\s+/i, '').trim(); if (!nome) return; const p = melhorProduto(nome); for (let k = 0; k < Math.min(Math.max(1, +q || 1), 20); k++) out.itens.push({ texto: nome, cod: p ? p.cod : null }); ultimo = out.itens.length - 1; };
  const complemento = (nome) => {
    const limpo = nome.replace(/^[-•+*]\s*/, '').replace(/R\$\s*[\d.,]+/g, '').trim(); if (!limpo || ultimo == null) return;
    const a = melhorProduto(limpo, 'adicional'); const base = out.itens.filter(x => x.texto === out.itens[ultimo].texto);
    base.forEach(it => { if (a) it.adds = (it.adds || []).concat(a.cod); else it.obs = [it.obs, limpo].filter(Boolean).join(', '); });
  };
  if (sec.length) {
    for (let i = 0; i < sec.length; i++) {
      const l = sec[i]; if (lixo.test(l) || ehPreco(l) || ehQtd(l)) continue;
      const mq = l.match(/^(\d{1,2})\s*x\s+(.+)$/i);
      if (mq) { const nm = mq[2].replace(/R\$\s*[\d.,]+.*$/, '').trim(); if (ultimo == null || (melhorProduto(nm) && !melhorProduto(nm, 'adicional'))) novoItem(nm, mq[1]); else complemento(nm); continue; }
      if (ehPreco(sec[i + 1]) && ehQtd(sec[i + 2])) { novoItem(l, parseInt(sec[i + 2], 10)); i += 2; continue; }
      if (/R\$\s*[\d.,]+/.test(l) && ehQtd(sec[i + 1])) { novoItem(l, parseInt(sec[i + 1], 10)); i += 1; continue; }
      if (ehPreco(sec[i + 1]) || /R\$\s*[\d.,]+/.test(l)) {
        const nm = l.replace(/R\$\s*[\d.,]+.*$/, '').trim(); const qf = (l.match(/R\$\s*[\d.,]+\s+(\d{1,2})x?$/i) || [])[1];
        if (ultimo == null || (melhorProduto(nm) && !melhorProduto(nm, 'adicional'))) novoItem(nm, qf || 1); else complemento(l);
        if (ehPreco(sec[i + 1])) i += 1; continue;
      }
      if (ultimo != null) complemento(l); else out.obs.push(l);
    }
  } else {
    // Sem a seção "Itens no pedido" (outro formato ou print): "2x Nome", "2 Nome R$ 10,00"; só entra o que parece produto
    // No print, o OCR junta o que está na mesma linha da tela: "1x X-Trem R$ 52,90", "X-Trem R$ 52,90 1".
    const naoItem = /taxa|subtotal|total|incentivo|cobran|pago via|repassar|desconto|entrega|localizador|prepare|cancelar|problemas/i;
    L.forEach(l => {
      if (/seu trem/i.test(l)) return;
      const lim = l.replace(/^[^\wÀ-ú]+/, '');
      const m = lim.match(/^(\d{1,2})\s*x\s*(.{3,})$/i) || lim.match(/^(\d{1,2})\s+(.{3,}?)\s+R\$\s*[\d.,]+$/i);
      if (m) { const nome = m[2].replace(/R\$\s*[\d.,]+.*$/g, '').trim(); if (melhorProduto(nome) || (/R\$/.test(l) && !naoItem.test(l))) novoItem(nome, m[1]); else if (ultimo != null) complemento(nome); return; }
      const mp = lim.match(/^(.{3,}?)\s+R\$\s*[\d.,]+(?:\s+(\d{1,2})x?)?$/i);
      if (mp && !naoItem.test(mp[1])) { if (melhorProduto(mp[1])) { novoItem(mp[1], mp[2] || 1); return; } if (ultimo != null) { complemento(mp[1]); return; } }
      if (ultimo != null && /^[-•+*]|^obs|^observa|^sem |^com |^n[aã]o enviar/i.test(lim)) complemento(lim);
    });
  }
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
  let h = `<h2>iFood na mesma fila</h2><p class="sub">Mais rápido: no gestor do iFood, com o pedido aberto e a lista de itens à vista, tecle <b>Win+Shift+S</b>, recorte o painel do pedido (do número até o subtotal) e cole aqui com <b>Ctrl+V</b>. Também vale colar o texto copiado do pedido. Confira o card e mande para a TV.</p>
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
  if (r.obs.length && r.itens[0]) r.itens[0].obs = [r.itens[0].obs].concat(r.obs).filter(Boolean).join(', ');
  if (!r.itens.length) toast('Não achei itens no texto. Copie o pedido inteiro no gestor (do número até "Pago via iFood") ou lance pela busca.');
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
  if (img) { e.preventDefault(); try { F.ifoodTxt = await lerPrint(img.getAsFile()); prepararIfood(F.ifoodTxt); } catch (x) { toast('Não consegui ler o print'); } return; }
  // Texto colado na caixa do iFood: já lê sozinho (um clique a menos)
  if (e.target && e.target.id === 'ifoodTxt') setTimeout(() => { F.ifoodTxt = e.target.value; if (F.ifoodTxt.trim()) prepararIfood(F.ifoodTxt); }, 0);
});
A.ifMarca = d => { S.ui.ifood.marca = d.c; render(); };
A.ifTirar = d => { S.ui.ifood.itens.splice(+d.i, 1); render(); };
A.ifAdd = d => { const p = P[+d.c]; const add = it => { S.ui.ifood.itens.push({ texto: '(lançado)', item: it }); F.buscaIf = ''; render(); }; if (!precisaModal(p)) add(montarItem(novoMI(p))); else modalItem(p, add, { q: F.buscaIf }); };
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
  const descs = descontosDaNoite(); const totDesc = r2(descs.reduce((s, x) => s + (x.valor || 0), 0));
  let h = `<div class="grade" style="grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))">
    <div class="card"><h3>${ic('smartphone')} Link dos garçons desta noite</h3><div class="qr" data-qr="${esc(linkG)}"></div><div class="copia">${esc(linkG)}</div>
      <div class="linha" style="margin-top:8px"><button class="bt" data-a="copiar" data-c="${esc(linkG)}">${ic('content_copy')} Copiar</button></div><p class="sub">O link muda a cada "Nova noite". Cada um entra com o próprio código.</p></div>
    <div class="card"><h3>${ic('tv')} Cozinha (celular da TV)</h3><div class="qr" data-qr="${esc(linkC)}"></div><div class="copia">${esc(linkC)}</div>
      <p class="sub">Abre no celular da cozinha, entra com um código de cozinha ou gerente e espelha na TV com o celular deitado.</p></div>
    <div class="card"><h3>${ic('dark_mode')} Noite</h3><p>Começou ${dataBR(n.inicio)} às ${hora(n.inicio)}.</p><p class="sub">Nova noite: novo link dos garçons, limpa a fila da cozinha e começa outro relatório. Mesas abertas impedem.</p>
      <button class="bt verm" data-a="novaNoite">${ic('restart_alt')} Nova noite</button></div></div>
    <div class="entre nao-imprimir" style="margin:20px 0 10px"><h2 style="margin:0">Relatório da noite</h2><div class="linha">
      <select class="inp" style="width:auto" data-ch="verNoite">${[n.id].concat((cfg().noites || []).map(x => x.id)).map(id => `<option ${id === S.ui.noiteVer ? 'selected' : ''} value="${id}">${id === n.id ? 'Noite atual' : id}</option>`).join('')}</select>
      <button class="bt" data-a="imprimir">${ic('print')} Imprimir / PDF</button><button class="bt" data-a="csv">${ic('download')} Planilha (CSV)</button></div></div>
    <div class="kpis"><div class="kpi"><div class="v">${R(tot)}</div><div class="l">Total para NFC-e (com 10%)</div></div><div class="kpi"><div class="v">${vs.filter(v => !v.cancelado).length}</div><div class="l">Vendas fechadas</div></div><div class="kpi"><div class="v">${R(dez)}</div><div class="l">10% incluído</div></div>${descs.length ? `<div class="kpi" style="border-color:var(--laranja)"><div class="v" style="color:var(--laranja)">−${R(totDesc)}</div><div class="l">${descs.length} desconto${descs.length > 1 ? 's' : ''} nas contas (pelo cardápio)</div></div>` : ''}
      ${Object.entries(canais).map(([k, v]) => `<div class="kpi"><div class="v">${R(v)}</div><div class="l">${k === 'salao' ? 'Salão' : k === 'ifood' ? 'iFood (pelo cardápio)' : 'WhatsApp'}</div></div>`).join('')}
      ${Object.entries(formas).map(([k, v]) => `<div class="kpi"><div class="v">${R(v)}</div><div class="l">${esc(k)}</div></div>`).join('')}</div>
    <div class="card" style="overflow-x:auto"><table class="tab"><tr><th>Hora</th><th>Venda</th><th>Itens</th><th class="n">Subtotal</th><th class="n">10%</th><th class="n">Total NFC-e</th><th>Pagamentos</th></tr>
    ${vs.map(v => `<tr><td>${hora(v.fechadaEm)}</td><td><span class="tag ${v.canal}">${v.canal === 'salao' ? 'salão' : v.canal}</span>${v.marca === 'ladob' ? ' <span class="tag ladob">Lado B</span>' : ''}<br>${esc(v.ref)}${v.nomes && v.nomes.length ? '<br><span class="sub">' + esc(v.nomes.join(', ')) + '</span>' : ''}</td>
      <td>${v.itens.map(i => `${esc(i.nome)} <span class="sub">${i.descPct ? `<s>${R(i.cheio)}</s> ` : ''}${R(i.preco)}</span>${i.descPct ? ` <span class="tag desc">−${pctTxt(i.descPct)}</span>` : ''}`).join('<br>')}${v.frete ? `<br><span class="sub">frete ${R(v.frete)} (fora da nota)</span>` : ''}</td><td class="n">${R(v.subtotal)}</td><td class="n">${R(v.dez)}</td><td class="n"><b>${R(v.total)}</b></td>
      <td>${(v.pagamentos || []).map(p => `${esc(p.forma)} ${R(p.valor)}`).join('<br>')}${v.comprovante ? '<br><span class="tag ok">comprovante</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="vazio">Nenhuma venda fechada ainda.</td></tr>'}</table></div>
    <p class="sub">iFood entra pelo preço do cardápio (referência); o valor real e as taxas ficam na planilha de Gestão do iFood. O 10% está dentro do total da NFC-e até a contadora responder.</p>`;
  return h + telaRelConsumo() + telaConferencia();
}
// --- relatório: consumo interno e perdas (vai para o fiscal, aba Consumo interno da planilha de controle) ---
function inicioDaNoite(id) {
  const n = cfg().noite || {}; if (!id || id === n.id) return n.inicio || agora();
  const x = (cfg().noites || []).find(y => y.id === id); return (x && x.inicio) || agora();
}
function obsConsumo(c) { return [c.motivo, c.pedido ? 'pedido nº ' + c.pedido : '', c.livre ? 'item livre' : '', 'lançado por ' + c.por + ' às ' + hora(c.ts) + ' (sistema)'].filter(Boolean).join(' · '); }
// Na ordem das colunas da aba Consumo interno: data, item, quantidade, para quem, tipo, observação (separado por tabulação)
function consumoPlanilha(lista, id) { const d = dataBR(inicioDaNoite(id)); return lista.map(c => [d, c.item, c.qtd, paraQuem(c), c.tipo, obsConsumo(c)].map(x => String(x).replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n'); }
// No padrão do grupo do fiscal: CI | item | qtd | para quem | tipo | motivo
function consumoGrupo(lista) { return lista.map(c => ['CI', c.item, c.qtd, paraQuem(c), c.tipo, [c.motivo, c.pedido ? 'pedido ' + c.pedido : ''].filter(Boolean).join(', ') || '—'].join(' | ')).join('\n'); }
function telaRelConsumo() {
  const id = S.ui.noiteVer || noiteId(); const todos = S.consumo || []; const val = todos.filter(c => !c.apagado); const porTipo = contarPorTipo(val);
  // Descontos dados nas contas das mesas também vão ao fiscal (tipo Desconto), com a % e o valor pelo cardápio
  const dsc = descontosDaNoite(); const dData = dataBR(inicioDaNoite(id));
  const paraD = x => 'Cliente · ' + x.ref + (x.nomes && x.nomes.length ? ' (' + x.nomes.join(', ') + ')' : '');
  const obsD = x => [pctTxt(x.pct) + ' na conta, −' + R(x.valor) + ' pelo cardápio', x.motivo, 'autorizou ' + x.autorizou, 'pediu ' + x.pediu + (x.ts ? ' às ' + hora(x.ts) : '') + ' (sistema)'].filter(Boolean).join(' · ');
  const grupo = [consumoGrupo(val)].concat(dsc.map(x => ['CI', x.nome, 1, paraD(x), 'Desconto', pctTxt(x.pct) + (x.motivo ? ', ' + x.motivo : '')].join(' | '))).filter(Boolean).join('\n');
  const plan = [consumoPlanilha(val, id)].concat(dsc.map(x => [dData, x.nome, 1, paraD(x), 'Desconto', obsD(x)].map(y => String(y).replace(/[\t\r\n]+/g, ' ')).join('\t'))).filter(Boolean).join('\n');
  let h = `<div class="entre" style="margin:28px 0 10px"><h2 style="margin:0">${ic('inventory_2')} Consumo interno e perdas</h2><span class="sub">não é venda · o fiscal valora pelo custo (R41)</span></div>
    <div class="kpis">${CI_TIPOS.map(([t]) => `<div class="kpi"><div class="v">${porTipo[t] || 0}</div><div class="l">${t}</div></div>`).join('')}<div class="kpi"><div class="v">${val.reduce((s, c) => s + (+c.qtd || 1), 0)}</div><div class="l">Itens no total (contagem, sem valor)</div></div></div>
    <div class="card" style="overflow-x:auto"><table class="tab"><tr><th>Hora</th><th>Item</th><th class="n">Qtd</th><th>Tipo</th><th>Para quem</th><th>Motivo</th><th>Pedido</th><th>Lançou</th></tr>
    ${todos.map(c => `<tr class="${c.apagado ? 'apagado' : ''}"><td>${hora(c.ts)}</td><td>${esc(c.item)}${c.livre ? ' <span class="tag cinza">livre</span>' : ''}</td><td class="n">${c.qtd}</td><td>${esc(c.tipo)}</td><td>${esc(paraQuem(c))}</td><td>${esc(c.motivo || '')}${c.apagado ? `<br><span class="sub">apagado: pediu ${esc(c.apagado.pediu)}, autorizou ${esc(c.apagado.autorizou)} · ${esc(c.apagado.motivo)}</span>` : ''}</td><td>${esc(c.pedido || '')}</td><td>${esc(c.por)}</td></tr>`).join('') || '<tr><td colspan="8" class="vazio">Nada lançado nesta noite.</td></tr>'}</table></div>`;
  if (dsc.length) h += `<p class="sub" style="margin:8px 0 0">${ic('sell')} Descontos nas contas das mesas: ${dsc.length} (−${R(dsc.reduce((s, x) => s + (x.valor || 0), 0))} pelo cardápio). Entram nas cópias abaixo como tipo Desconto; o detalhe está na Conferência do caixa.</p>`;
  if (val.length || dsc.length) h += `<div class="grade nao-imprimir" style="grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));margin-top:10px">
    <div class="card"><h3>${ic('forum')} Padrão do grupo do fiscal</h3><div class="copia" style="white-space:pre-wrap">${esc(grupo)}</div><button class="bt" style="margin-top:8px" data-a="copiar" data-c="${esc(grupo)}">${ic('content_copy')} Copiar</button></div>
    <div class="card"><h3>${ic('table_view')} Para a planilha (aba Consumo interno)</h3><p class="sub">Data, item, quantidade, para quem, tipo e observação, separados por tabulação. O custo entra no fechamento do fiscal.</p><button class="bt" data-a="copiar" data-c="${esc(plan)}">${ic('content_copy')} Copiar linhas</button></div></div>`;
  return h;
}

// ================= antifraude: conferência do caixa da noite =================
function pagamentosDaNoite() {
  const out = [];
  S.vendas.forEach(v => (v.pagamentos || []).forEach((p, i) => out.push(Object.assign({ venda: v.id, ref: v.ref, canal: v.canal, i }, p))));
  return out.sort((a, b) => (a.ts || 0) - (b.ts || 0));
}
function chavePg(p) { return p.venda + ':' + p.i; }
function descontosDaNoite() { const out = []; S.vendas.forEach(v => (v.descontos || []).forEach(x => out.push(Object.assign({ ref: v.ref, nomes: v.nomes || [] }, x)))); return out.sort((a, b) => (a.ts || 0) - (b.ts || 0)); }
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
  const g = n => (gs[n] = gs[n] || { PIX: 0, 'Crédito': 0, 'Débito': 0, Dinheiro: 0, outros: 0, cancel: 0, cancelV: 0, semDez: 0, estornos: 0, tirados: 0, desc: 0, descV: 0 });
  pgs.forEach(p => { if (!p.por || p.canal === 'ifood') return; const x = g(p.por); if (p.forma === 'PIX' || p.forma === 'Crédito' || p.forma === 'Débito' || p.forma === 'Dinheiro') x[p.forma] = r2(x[p.forma] + p.valor); else x.outros = r2(x.outros + p.valor); });
  S.vendas.forEach(v => {
    (v.cancelados || []).forEach(c => { if (typeof c !== 'object') return; const x = g(c.pediu || v.por || '?'); x.cancel++; x.cancelV = r2(x.cancelV + (c.valor || 0)); });
    if (v.semDez) (v.garcons || [v.por]).forEach(n => { g(n).semDez++; });
    (v.estornos || []).forEach(e => { g(e.tiradoPor || '?').estornos++; });
    if (v.tiradosAntes) g(v.por || '?').tirados += v.tiradosAntes;
    (v.descontos || []).forEach(x => { const y = g(x.pediu || v.por || '?'); y.desc++; y.descV = r2(y.descV + (x.valor || 0)); });
  });
  const descs = descontosDaNoite();
  const cancelados = []; S.vendas.forEach(v => (v.cancelados || []).forEach(c => { if (typeof c === 'object') cancelados.push(Object.assign({ ref: v.ref }, c)); }));
  const estornos = []; S.vendas.forEach(v => (v.estornos || []).forEach(e => estornos.push(Object.assign({ ref: v.ref }, e))));
  const ini = (cfg().noite || {}).inicio || 0;
  const trocaChave = (cfg().logLoja || []).filter(l => l.t >= ini && /chave PIX/.test(l.o));
  const pixOk = pix.filter(p => (cf.pix || {})[chavePg(p)]).length;
  let h = `<div class="entre" style="margin:28px 0 10px"><h2 style="margin:0">${ic('verified_user')} Conferência do caixa</h2><span class="sub">${cf.por ? 'por ' + esc(cf.por) + ' · ' + hora(cf.em) : 'antifraude'}</span></div>
    <p class="sub">Garante que tudo o que os garçons receberam chegou às contas da empresa: cada PIX no extrato, a maquininha e o dinheiro de cada um. Quem conferiu e quando fica registrado.</p>`;
  if (trocaChave.length) h += `<div class="card" style="background:var(--vermelho-cl);border-color:var(--vermelho);margin-bottom:10px"><b>${ic('warning')} A chave PIX foi alterada durante a noite</b>${trocaChave.map(l => `<div class="sub">${hora(l.t)} · ${esc(l.quem)}: ${esc(l.o)}</div>`).join('')}</div>`;
  h += `<div class="card" style="overflow-x:auto;margin-bottom:10px"><h3>Por garçom</h3><table class="tab"><tr><th>Quem</th><th class="n">PIX</th><th class="n">Crédito</th><th class="n">Débito</th><th class="n">Dinheiro</th><th class="n">Dinheiro entregue</th><th>Alertas</th></tr>
    ${Object.entries(gs).map(([n, x]) => { const k = 'din:' + n; const ent = num(k); const al = [x.cancel ? `${x.cancel} cancelamento(s) ${R(x.cancelV)}` : '', x.desc ? `${x.desc} desconto(s) −${R(x.descV)}` : '', x.estornos ? `${x.estornos} pagamento(s) tirado(s)` : '', x.semDez ? `${x.semDez} mesa(s) sem 10%` : '', x.tirados ? `${x.tirados} item(ns) tirado(s) antes de enviar` : ''].filter(Boolean);
      return `<tr><td><b>${esc(n)}</b></td><td class="n">${R(x.PIX)}</td><td class="n">${R(x['Crédito'])}</td><td class="n">${R(x['Débito'])}</td><td class="n">${R(x.Dinheiro)}</td>
      <td class="n">${x.Dinheiro ? `${inputConf(k, 'R$', 'width:110px;min-height:36px')} ${dif(ent, x.Dinheiro)}` : '—'}</td>
      <td>${al.map(a => `<span class="tag aviso">${esc(a)}</span>`).join(' ') || '<span class="sub">nenhum</span>'}</td></tr>`; }).join('') || '<tr><td colspan="7" class="sub">Sem pagamentos ainda.</td></tr>'}</table></div>`;
  h += `<div class="grade" style="grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));margin-bottom:10px"><div class="card"><h3>${ic('point_of_sale')} Maquininha (salão)</h3>
    <div class="total-linha"><span>Crédito no sistema</span><b>${R(sysCred)}</b></div><div class="linha">${inputConf('maqCred', 'Crédito no relatório da maquininha', 'flex:1')}${dif(num('maqCred'), sysCred)}</div>
    <div class="total-linha" style="margin-top:8px"><span>Débito no sistema</span><b>${R(sysDeb)}</b></div><div class="linha">${inputConf('maqDeb', 'Débito no relatório da maquininha', 'flex:1')}${dif(num('maqDeb'), sysDeb)}</div></div>
    <div class="card"><h3>${ic('qr_code')} PIX: ${pixOk} de ${pix.length} achados no extrato</h3><p class="sub">Abra o extrato da conta da empresa e marque cada PIX pelo valor e pela hora. PIX que não aparece = recebido fora da conta da casa.</p>
    ${pix.map(p => `<label class="entre" style="padding:6px 0;border-bottom:1px solid #f1f3f4;cursor:pointer"><span><input type="checkbox" data-ch="confPix" data-k="${esc(chavePg(p))}" ${(cf.pix || {})[chavePg(p)] ? 'checked' : ''}> ${p.ts ? hora(p.ts) : ''} · ${esc(p.ref)} · ${esc(p.por || '')}${p.txid ? `<br><span class="sub">código ${esc(p.txid)}${p.qr ? ' · QR do sistema' : ''}</span>` : ''}</span><b>${R(p.valor)}</b></label>`).join('') || '<div class="sub">Nenhum PIX na noite.</div>'}</div></div>`;
  if (cancelados.length || estornos.length || descs.length) h += `<div class="card" style="margin-bottom:10px"><h3>${ic('gpp_maybe')} Cancelamentos, descontos e pagamentos tirados</h3>
    ${descs.map(x => `<div class="entre" style="padding:4px 0"><span>${esc(x.ref)} · <b>${esc(x.nome)}</b> · desconto de <b>${pctTxt(x.pct)}</b> (de ${R(x.cheio)}) · pediu ${esc(x.pediu || '?')} · autorizou <b>${esc(x.autorizou || '?')}</b>${x.motivo ? ' · ' + esc(x.motivo) : ''}</span><span style="color:var(--laranja)">−${R(x.valor)} ${x.ts ? '<span class="sub">' + hora(x.ts) + '</span>' : ''}</span></div>`).join('')}
    ${cancelados.map(c => `<div class="entre" style="padding:4px 0"><span>${esc(c.ref)} · <b>${esc(c.nome)}</b> · pediu ${esc(c.pediu || '?')} · autorizou <b>${esc(c.autorizou || '?')}</b> · ${esc(c.motivo || '')}</span><span>${c.valor ? R(c.valor) : ''} ${c.ts ? '<span class="sub">' + hora(c.ts) + '</span>' : ''}</span></div>`).join('')}
    ${estornos.map(e => `<div class="entre" style="padding:4px 0"><span>${esc(e.ref)} · pagamento ${esc(e.forma)} tirado por ${esc(e.tiradoPor || '?')} · autorizou <b>${esc(e.autorizou || '?')}</b> · ${esc(e.motivo || '')}</span><span>${R(e.valor)} <span class="sub">${hora(e.tiradoEm)}</span></span></div>`).join('')}</div>`;
  h += `<div class="card sub" style="line-height:1.6"><b style="color:var(--txt)">Regras do antifraude</b><br>
    • O garçom tira um item só antes de enviar. Depois, só gerente ou sócio cancela, com código e motivo.<br>
    • Pagamento registrado só sai com código do gerente; a mesa só fecha quando a soma bate com o total.<br>
    • Desconto no item (d100, d50, d5…) só com código de gerente ou sócio; aparece aqui com a %, o valor, quem pediu, quem autorizou e o motivo.<br>
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
  S.vendas.forEach(v => linhas.push([v.noiteId, hora(v.fechadaEm), v.canal, v.marca, v.ref, v.itens.map(i => i.nome + ' ' + i.preco.toFixed(2) + (i.descPct ? ' (desconto ' + pctTxt(i.descPct) + ' de ' + i.cheio.toFixed(2) + ')' : '')).join(' | '), v.subtotal.toFixed(2), (v.dez || 0).toFixed(2), (v.frete || 0).toFixed(2), v.total.toFixed(2), (v.pagamentos || []).map(p => p.forma + ' ' + p.valor.toFixed(2)).join(' | ')]));
  const ci = (S.consumo || []).filter(c => !c.apagado);
  if (ci.length) {
    linhas.push([], ['consumo interno e perdas (não é venda; custo no fiscal)'], ['data', 'item', 'quantidade', 'para quem', 'tipo', 'observação']);
    const d = dataBR(inicioDaNoite(S.ui.noiteVer || noiteId()));
    ci.forEach(c => linhas.push([d, c.item, String(c.qtd), paraQuem(c), c.tipo, obsConsumo(c)]));
  }
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
  return `<div class="grade" style="grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))"><div class="card"><h2>Equipe</h2>
    <p class="sub">Cada pessoa tem um código de 4 números. Ele identifica quem fez cada mudança (não é senha de banco). Para trocar o código de alguém, toque na chave: só um sócio autoriza.</p>
    <table class="tab"><tr><th>Nome</th><th>Função</th><th class="n">Código</th></tr>${equipeOrdenada().map(p => `<tr><td style="min-width:84px;word-break:normal">${esc(p.nome)}</td><td style="width:100%"><select class="inp" style="min-height:34px;padding:4px 8px;width:100%;min-width:0" data-ch="papelPessoa" data-id="${p.id}">${PAPEIS.map(([k, l]) => `<option value="${k}" ${p.papel === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td><td class="n" style="white-space:nowrap"><button class="bt-ic" data-a="trocarCodigo" data-id="${p.id}" title="Alterar código">${ic('key')}</button><button class="bt-ic" data-a="tirarPessoa" data-id="${p.id}" title="Tirar da equipe">${ic('delete')}</button></td></tr>`).join('')}</table>
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
// Alterar o código de acesso de qualquer pessoa da equipe (JP, 25/11/2026): só com o código de um sócio.
// Primeiro o sócio autoriza; depois digita o código novo duas vezes. Grava só a impressão (SHA-256) e fica no log da loja.
A.trocarCodigo = d => {
  const alvo = (cfg().pessoas || []).find(p => p.id === d.id); if (!alvo) return;
  pedirPIN('Alterar o código de ' + alvo.nome, ['socio'], socio => {
    F.novoPin = ''; F.novoPin2 = '';
    abrirModal({
      foco: 'novoPin',
      render: () => `<h2>Novo código de ${esc(alvo.nome)}</h2><p class="sub">Autorizado por ${esc(socio.nome)}. Escolha 4 números que ninguém da equipe use. O código antigo deixa de valer na hora; avise ${esc(alvo.nome)} do código novo.</p>
        <div class="campo"><label for="novoPin">Código novo (4 números)</label>${inputPin('novoPin', 'okNovo')}</div>
        <div class="campo"><label for="novoPin2">Repita o código novo</label>${inputPin('novoPin2', 'okNovo')}</div>
        <div class="linha"><button class="bt" data-a="fecharModal">Cancelar</button><button class="bt pri" data-a="okNovo">${ic('key')} Salvar código</button></div>`,
      async okNovo() {
        const n = String(F.novoPin || '').trim();
        if (!/^\d{4}$/.test(n)) { toast('O código tem 4 números'); return; }
        if (n !== String(F.novoPin2 || '').trim()) { toast('Os dois códigos não são iguais'); return; }
        const dono = await pessoaPorPin(n);
        if (dono && dono.id !== alvo.id) { toast('Esse código já é de outra pessoa'); return; }
        const h = await hashPin(n);
        await DB.mutate('config', 'main', c => {
          const p = (c.pessoas || []).find(x => x.id === alvo.id); if (!p) return undefined;
          p.h = h; delete p.pin;
          c.logLoja = [{ t: agora(), quem: socio.nome, o: 'código de acesso de ' + p.nome + ' alterado' }].concat(c.logLoja || []).slice(0, 100);
          return c;
        });
        F.novoPin = ''; F.novoPin2 = ''; fecharModal(); toast('Código de ' + alvo.nome + ' alterado por ' + socio.nome);
      }
    });
  });
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
  const fixos = C.fixos;
  const cats = []; fixos.forEach(p => { let c = cats.find(x => x.n === p.cat); if (!c) cats.push(c = { n: p.cat, i: [] }); c.i.push(p); });
  const ex = extrasAtuais();
  const resumoOps = p => (p.grupos || []).map(g => g.t + ': ' + g.ops.map(o => o.n + (o.mais ? ' + ' + Rc(o.mais) : '')).join(', ')).join(' · ');
  let h = `<div class="entre"><h2 style="margin:0">Bebidas e sobremesas</h2><button class="bt pri" data-a="extraNovo">${ic('add')} Novo item</button></div>
    <p class="sub">Você edita aqui: nome, abreviação (o que aparece no painel do bar e vale na busca), código, preço, preço no delivery, ingredientes e opções. ${Array.isArray(EXTRAS_CFG) ? '' : 'Esta é a lista inicial das suas notas de 23/11; ela se grava na primeira edição.'} Itens desligados somem do garçom e da página de pedido, mas ficam aqui.</p>
    <div class="card" style="overflow-x:auto;margin-bottom:18px"><table class="tab"><tr><th>Cód.</th><th>Item</th><th>No bar</th><th>Opções</th><th class="n">Preço</th><th>Ativo</th><th></th></tr>
    ${ex.slice().sort((a, b) => (a.cat || '').localeCompare(b.cat || '') || a.cod - b.cod).map(p => `<tr style="${p.ativo === false ? 'opacity:.5' : ''}"><td><span class="cod">${p.cod}</span></td><td><b>${esc(p.nome)}</b><br><span class="sub">${esc(p.cat)}${p.ingredientes ? ' · ' + esc(p.ingredientes) : ''}</span></td>
      <td>${esc(p.ab || '(nome)')}</td><td class="sub">${esc(resumoOps(p))}${comboDe(p) ? `<br><span class="tag combo" style="margin-top:4px">combo: ${esc(ROT_COMBO[comboDe(p)] || comboDe(p))}</span>` : ''}</td><td class="n">${R(p.preco)}${p.precoDelivery ? `<br><span class="sub">delivery ${R(p.precoDelivery)}</span>` : ''}</td>
      <td><input type="checkbox" class="ck" data-ch="extraAtivo" data-c="${p.cod}" ${p.ativo !== false ? 'checked' : ''}></td><td class="n"><button class="bt-ic" data-a="extraEditar" data-c="${p.cod}" title="Editar">${ic('edit')}</button></td></tr>`).join('')}</table></div>
    <div class="entre"><h2 style="margin:0">Cardápio fixo</h2><button class="bt pri" data-a="fixoNovo">${ic('add')} Novo item</button></div>
    <p class="sub">Burguers, aperitivos, combos, Circuito, adicionais, acompanhamentos e doces. Toque no lápis para mudar nome, preço, descrição, abreviação, glúten e selo; desligue o que saiu do cardápio. Tudo chega na hora ao garçom, à TV e ao link do WhatsApp (R50). O que vem dentro de cada combo e as regras de preço (2 adicionais por R$ 10, Bitrem e CTB nos combos da mesa) seguem fixos: para mudar, peça ao Claude.</p>
    <div class="grade" style="grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))">${cats.map(c => `<div class="card"><h3>${esc(c.n)}</h3><table class="tab">${c.i.map(p => `<tr style="${p.ativo === false ? 'opacity:.5' : ''}"><td><span class="cod">${p.cod}</span></td><td>${esc(p.nome)}${p.ab ? `<br><span class="sub">TV: <b>${esc(p.ab)}</b></span>` : ''}${p.editado ? ' <span class="tag aviso">editado</span>' : ''}${p.novo ? ' <span class="tag ok">novo</span>' : ''}</td><td>${p.setor === 'bar' ? '<span class="tag cinza">bar</span>' : ''}</td><td class="n">${p.precoLivre ? 'R$ 17 a 30' : R(p.preco)}${p.precoDelivery ? `<br><span class="sub">delivery ${R(p.precoDelivery)}</span>` : ''}</td>
      <td><input type="checkbox" class="ck" data-ch="fixoAtivo" data-c="${p.cod}" ${p.ativo !== false ? 'checked' : ''} title="Ligado"></td><td class="n"><button class="bt-ic" data-a="fixoEditar" data-c="${p.cod}" title="Editar">${ic('edit')}</button></td></tr>`).join('')}</table></div>`).join('')}</div>`;
  return h;
}
// --- edição do cardápio fixo (grava em config.fixosCfg; fica registrado no log da loja) ---
async function salvarFixos(fn, log) {
  await DB.mutate('config', 'main', c => {
    const fc = clone(c.fixosCfg || {}); fc.edit = fc.edit || {}; fc.novos = Array.isArray(fc.novos) ? fc.novos : [];
    const r = fn(fc); if (r === false) return undefined;
    c.fixosCfg = fc; c.logLoja = [{ t: agora(), quem: quem(), o: 'cardápio fixo: ' + log }].concat(c.logLoja || []).slice(0, 100); return c;
  });
}
CH.fixoAtivo = async (el, d) => {
  const cod = +d.c; const p = P[cod]; if (!p) return;
  await salvarFixos(fc => { const n = fc.novos.find(x => x.cod === cod); if (n) n.ativo = el.checked; else { fc.edit[cod] = Object.assign(fc.edit[cod] || {}, { ativo: el.checked }); } }, p.nome + (el.checked ? ' ligado' : ' desligado'));
};
A.fixoEditar = d => modalFixo(P[+d.c], null);
A.fixoNovo = () => modalFixo(null, 'Burguers');
// Glúten do prato (o pão brioche de trigo já entra sozinho em todo burguer)
const GL_OPS = [['isca', 'Isca empanada (só no fubá)'], ['onion', 'Onion rings dentro (sai na alergia)'], ['trigo', 'Tortilha de trigo'], ['oniprato', 'O prato é de onion rings']];
// Categorias em que se cria item novo, com o tipo que o sistema entende e a faixa de códigos
const CATS_NOVO = { 'Burguers': { tipo: 'burguer', setor: 'cozinha', chapa: 'burguer', de: 12 }, 'Aperitivos': { tipo: 'aperitivo', setor: 'cozinha', de: 29 }, 'Adicionais': { tipo: 'adicional', setor: 'cozinha', combina: true, de: 74 }, 'Acompanhamentos e sobremesas': { tipo: 'simples', setor: 'cozinha', de: 88 } };
function modalFixo(p, catNova) {
  const novo = !p; const base = p && C.FIXOS_BASE.find(b => b.cod === p.cod);
  let cat = p ? p.cat : catNova;
  const livre = c => { const usados = new Set(C.fixos.map(x => x.cod).concat(extrasAtuais().map(x => x.cod))); let n = CATS_NOVO[c].de; while (usados.has(n)) n++; return n; };
  const num = v => v == null || v === '' ? '' : String(v).replace('.', ',');
  Object.assign(F, { fxNome: p ? p.nome : '', fxAb: p ? p.ab || '' : '', fxCod: String(p ? p.cod : livre(cat)), fxPreco: p ? num(p.preco) : '', fxDel: p ? num(p.precoDelivery) : '', fxDesc: p ? p.desc || '' : '', fxSelo: p ? p.selo || '' : '', fxEco: p ? p.economia || '' : '' });
  let gl = new Set(String((p && p.gl) || '').split(' ').filter(k => GL_OPS.some(o => o[0] === k)));
  let setor = p ? p.setor : (CATS_NOVO[cat] || {}).setor || 'cozinha'; let combina = p ? !!p.combina : true;
  const tipo = () => p ? p.tipo : CATS_NOVO[cat].tipo;
  const temGl = () => setor === 'cozinha' && ['burguer', 'aperitivo', 'simples'].includes(tipo());
  // Leva da TV: a proteína do burguer e o tamanho das fritas da porção (v12)
  let prot = JSON.stringify((p && p.prot) || ['soja']); let fritas = (p && p.fritas) || '';
  const PROT_OPS = [['["soja"]', 'Soja'], ['["gb"]', 'Grão de bico'], ['["soja","gb"]', 'Soja + grão de bico'], ['[]', 'Sem proteína (recheio)']];
  abrirModal({
    foco: 'fxNome',
    render: () => `<div class="entre"><h2>${novo ? 'Novo item do cardápio' : 'Editar ' + esc(p.nome)}</h2><button class="bt-ic" data-a="fecharModal">${ic('close')}</button></div>
      ${novo ? `<div class="chips" style="margin:6px 0 12px">${Object.keys(CATS_NOVO).map(c => `<button class="chip ${cat === c ? 'on' : ''}" data-a="cat" data-c="${c}">${c}</button>`).join('')}</div>` : `<p class="sub" style="margin:2px 0 12px">${esc(p.cat)}${base ? ' · do cardápio A3' : ' · item novo'}</p>`}
      ${campo('Nome', 'fxNome', 'Ex.: Trem Vegano')}
      <div class="linha"><div style="flex:2">${campo('Abreviação na TV (caixa alta)', 'fxAb', 'Ex.: TV')}</div><div style="flex:1">${novo ? campo('Código', 'fxCod', '', 'numeric') : `<div class="campo"><label>Código</label><div class="inp" style="background:#f1f3f4">${p.cod}</div></div>`}</div></div>
      <div class="linha"><div style="flex:1">${campo('Preço (R$)', 'fxPreco', '35', 'decimal')}</div>${tipo() === 'adicional' ? '' : `<div style="flex:1">${campo('Preço no delivery (opcional)', 'fxDel', '', 'decimal')}</div>`}</div>
      ${tipo() === 'adicional' ? `<label class="sub" style="display:flex;gap:8px;align-items:center;margin:0 0 12px"><button class="chip ${combina ? 'on' : ''}" data-a="comb">${ic(combina ? 'check_box' : 'check_box_outline_blank')} Entra no combo de adicionais (2 por R$ 10 · 3 por R$ 12)</button></label>` : `<div class="campo"><label for="fxDesc">Descrição (aparece no link do WhatsApp e no garçom)</label><textarea id="fxDesc" class="inp" data-f="fxDesc" placeholder="Ingredientes, como vem">${esc(F.fxDesc)}</textarea></div>`}
      ${tipo() === 'simples' && novo ? `<div class="campo"><label>Sai de onde</label><div class="chips">${[['cozinha', 'Cozinha (TV)'], ['bar', 'Bar (garçom)']].map(([k, l]) => `<button class="chip ${setor === k ? 'on' : ''}" data-a="set" data-c="${k}">${l}</button>`).join('')}</div></div>` : ''}
      ${tipo() === 'burguer' ? `<div class="campo"><label>Proteína (conta na leva da TV)</label><div class="chips">${PROT_OPS.map(([k, l]) => `<button class="chip ${prot === k ? 'on' : ''}" data-a="prot" data-c='${k}'>${l}</button>`).join('')}</div></div>` : ''}
      ${temGl() && tipo() !== 'burguer' ? `<div class="campo"><label>Fritas que acompanham (contam na leva da TV)</label><div class="chips">${[['', 'Nenhuma'], ['P', 'Fritas P'], ['M', 'Fritas M'], ['G', 'Fritas G']].map(([k, l]) => `<button class="chip ${fritas === k ? 'on' : ''}" data-a="fri" data-c="${k}">${l}</button>`).join('')}</div></div>` : ''}
      ${temGl() ? `<div class="campo"><label>Glúten (o que muda no pedido sem glúten)${tipo() === 'burguer' ? ' · o pão brioche já entra sozinho' : ''}</label><div class="chips">${GL_OPS.map(([k, l]) => `<button class="chip ${gl.has(k) ? 'on verm' : ''}" data-a="gl" data-c="${k}">${ic(gl.has(k) ? 'check_box' : 'check_box_outline_blank')} ${l}</button>`).join('')}</div></div>` : ''}
      ${tipo() === 'adicional' ? '' : `<div class="linha"><div style="flex:1">${campo('Selo (opcional)', 'fxSelo', 'Ex.: Lançamento')}</div><div style="flex:2">${campo('Economia (combos, opcional)', 'fxEco', 'Ex.: Separado R$ 37 · economize R$ 9')}</div></div>`}
      <div class="linha">${novo ? '' : base ? (p.editado ? `<button class="bt txt" data-a="restaurar">${ic('restart_alt')} Voltar ao original</button>` : '') : `<button class="bt txt verm" data-a="tirar">${ic('delete')} Tirar da lista</button>`}<span style="flex:1"></span><button class="bt" data-a="fecharModal">Cancelar</button><button class="bt pri" data-a="ok">${ic('save')} Salvar</button></div>`,
    cat(d) { cat = d.c; setor = CATS_NOVO[cat].setor; F.fxCod = String(livre(cat)); pintarModal(); },
    set(d) { setor = d.c; pintarModal(); },
    gl(d) { if (gl.has(d.c)) gl.delete(d.c); else gl.add(d.c); pintarModal(); },
    comb() { combina = !combina; pintarModal(); },
    prot(d) { prot = d.c; pintarModal(); },
    fri(d) { fritas = d.c; pintarModal(); },
    async restaurar() {
      if (!confirm('Voltar ' + p.nome + ' ao original do cardápio A3?')) return;
      await salvarFixos(fc => { delete fc.edit[p.cod]; }, p.nome + ' voltou ao original');
      fecharModal(); toast(p.nome + ' voltou ao original');
    },
    async tirar() {
      if (!confirm('Tirar ' + p.nome + ' da lista? (Para pausar, é melhor desligar.)')) return;
      await salvarFixos(fc => { const i = fc.novos.findIndex(x => x.cod === p.cod); if (i < 0) return false; fc.novos.splice(i, 1); }, p.nome + ' tirado');
      fecharModal(); toast(p.nome + ' tirado da lista');
    },
    async ok() {
      const nome = (F.fxNome || '').trim(); const preco = r2(parseFloat(String(F.fxPreco || '').replace(',', '.')) || 0);
      const del = r2(parseFloat(String(F.fxDel || '').replace(',', '.')) || 0);
      if (!nome) { toast('Ponha o nome'); return; }
      if (!(preco > 0)) { toast('Ponha o preço'); return; }
      const campos = { nome, ab: (F.fxAb || '').trim().toUpperCase(), preco, precoDelivery: del || null, desc: (F.fxDesc || '').trim(), selo: (F.fxSelo || '').trim(), economia: (F.fxEco || '').trim() };
      if (temGl()) campos.gl = Array.from(gl).join(' ');
      if (tipo() === 'burguer') campos.prot = JSON.parse(prot);
      else if (temGl()) campos.fritas = fritas;
      if (tipo() === 'adicional') { campos.combina = combina; delete campos.desc; delete campos.precoDelivery; }
      if (novo) {
        const cod = parseInt(F.fxCod, 10);
        if (!(cod > 0)) { toast('Código inválido'); return; }
        if (P[cod] || C.fixos.some(x => x.cod === cod) || extrasAtuais().some(x => x.cod === cod)) { toast('O código ' + cod + ' já é de outro item'); return; }
        const k = CATS_NOVO[cat];
        const item = Object.assign({ cod, cat, tipo: k.tipo, setor: k.tipo === 'simples' ? setor : k.setor, ativo: true }, k.chapa ? { chapa: k.chapa } : {}, campos);
        await salvarFixos(fc => { fc.novos.push(item); }, 'novo ' + nome + ' (' + R(preco) + ')');
      } else if (base) {
        // Grava só o que ficou diferente do original do menu.js
        const dif = {}; Object.keys(campos).forEach(k => { const o = base[k] == null ? (k === 'gl' ? '' : k === 'precoDelivery' ? null : '') : base[k]; if (JSON.stringify(campos[k]) !== JSON.stringify(o)) dif[k] = campos[k]; });
        await salvarFixos(fc => { const a = fc.edit[p.cod] || {}; const ativoAntes = a.ativo; fc.edit[p.cod] = Object.assign(dif, ativoAntes === undefined ? {} : { ativo: ativoAntes }); if (!Object.keys(fc.edit[p.cod]).length) delete fc.edit[p.cod]; }, 'editou ' + nome + ' (' + R(preco) + ')');
      } else {
        await salvarFixos(fc => { const n = fc.novos.find(x => x.cod === p.cod); if (!n) return false; Object.assign(n, campos); }, 'editou ' + nome + ' (' + R(preco) + ')');
      }
      fecharModal(); toast(nome + ' salvo');
    }
  });
}
// --- edição das bebidas e sobremesas (grava em config.extras; fica registrado no log da loja) ---
// Opções em texto, uma por linha:  Sabor: Groselha=GRO, Pitanga=PIT   ·   Tamanho: 500 ml, 900 ml=900+15
function opsParaTexto(gs) { return (gs || []).map(g => g.t + ': ' + g.ops.map(o => o.n + (o.ab ? '=' + o.ab : '') + (o.mais ? '+' + String(o.mais).replace('.', ',') : '')).join(', ')).join('\n'); }
function textoParaOps(txt) {
  return String(txt || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
    const i = l.indexOf(':'); if (i < 1) return null;
    const ops = l.slice(i + 1).split(',').map(s => s.trim()).filter(Boolean).map(s => {
      const m = s.match(/^(.*?)(?:\s*\+\s*(\d+(?:[.,]\d+)?))?$/); let corpo = m[1].trim(); const mais = m[2] ? +m[2].replace(',', '.') : 0;
      const k = corpo.indexOf('='); const n = (k >= 0 ? corpo.slice(0, k) : corpo).trim(); const ab = k >= 0 ? corpo.slice(k + 1).trim().toUpperCase() : '';
      return { n, ab, mais };
    }).filter(o => o.n);
    return ops.length ? { t: l.slice(0, i).trim(), ops } : null;
  }).filter(Boolean);
}
async function salvarExtras(fn, log) {
  await DB.mutate('config', 'main', c => {
    const lista = Array.isArray(c.extras) ? aplicarAjustesExtras(c.extras, c.ajustesExtras) : clone(C.EXTRAS);
    const r = fn(lista); if (r === false) return undefined;
    c.extras = lista; c.ajustesExtras = idsAjustesExtras(); c.logLoja = [{ t: agora(), quem: quem(), o: 'cardápio: ' + log }].concat(c.logLoja || []).slice(0, 100); return c;
  });
}
CH.extraAtivo = async (el, d) => {
  const cod = +d.c; const p = extrasAtuais().find(x => x.cod === cod);
  if (el.checked && !(p.preco > 0)) { toast('Ponha o preço antes de ligar'); el.checked = false; return; }
  await salvarExtras(l => { const x = l.find(y => y.cod === cod); if (!x) return false; x.ativo = el.checked; }, p.nome + (el.checked ? ' ligado' : ' desligado'));
};
A.extraNovo = () => modalExtra(null);
A.extraEditar = d => modalExtra(extrasAtuais().find(x => x.cod === +d.c));
function modalExtra(p) {
  const novo = !p;
  const livres = () => { const usados = new Set(C.fixos.map(x => x.cod).concat(extrasAtuais().map(x => x.cod))); let c = 108; while (usados.has(c)) c++; return c; };
  Object.assign(F, { exNome: p ? p.nome : '', exAb: p ? p.ab || '' : '', exCod: String(p ? p.cod : livres()), exPreco: p ? String(p.preco).replace('.', ',') : '', exDel: p && p.precoDelivery ? String(p.precoDelivery).replace('.', ',') : '', exIng: p ? p.ingredientes || '' : '', exOps: p ? opsParaTexto(p.grupos) : '' });
  let cat = p ? p.cat : 'Bebidas'; F.exLiga = p ? p.ativo !== false : true;
  let comboX = p ? comboDe(p) : '';
  abrirModal({
    foco: 'exNome',
    render: () => `<div class="entre"><h2>${novo ? 'Novo item' : 'Editar ' + esc(p.nome)}</h2><button class="bt-ic" data-a="fecharModal">${ic('close')}</button></div>
      <div class="chips" style="margin:6px 0 12px">${['Bebidas', 'Sobremesas', 'Combos do bar'].map(c => `<button class="chip ${cat === c ? 'on' : ''}" data-a="cat" data-c="${c}">${c}</button>`).join('')}</div>
      ${campo('Nome', 'exNome', 'Ex.: Soda italiana')}
      <div class="linha"><div style="flex:2">${campo('Abreviação no bar (caixa alta)', 'exAb', 'Ex.: SODA')}</div><div style="flex:1">${campo('Código', 'exCod', '', 'numeric')}</div></div>
      <div class="linha"><div style="flex:1">${campo('Preço (R$)', 'exPreco', '16', 'decimal')}</div><div style="flex:1">${campo('Preço no delivery (opcional)', 'exDel', '', 'decimal')}</div></div>
      <div class="campo"><label for="exIng">Ingredientes e montagem</label><textarea id="exIng" class="inp" data-f="exIng" placeholder="Ex.: limão espremido, destilado, açúcar, sabor e água com gás">${esc(F.exIng)}</textarea></div>
      <div class="campo"><label for="exOps">Opções (uma por linha; Nome=ABREVIAÇÃO e +valor quando aumenta o preço)</label><textarea id="exOps" class="inp" data-f="exOps" placeholder="Sabor: Groselha=GRO, Pitanga=PIT, Mix=MIX&#10;Tamanho: 500 ml, 900 ml=900+15">${esc(F.exOps)}</textarea>
        <span class="sub">Ex.: Belorihills + Gin + Pitanga sai no bar como BELO GIN PIT. Cada linha vira uma pergunta por toque no link do WhatsApp e no garçom; com Mix, o cliente toca nos sabores.</span></div>
      ${cat === 'Bebidas' ? `<div class="campo"><label>Entra no combo do burguer como</label><div class="chips">${[['', 'Não entra'], ['sucoRefri', 'Suco ou refri'], ['soda', 'Soda italiana'], ['cerveja', 'Cerveja'], ['drink', 'Drink da casa']].map(([k, l]) => `<button class="chip ${comboX === k ? 'on' : ''}" data-a="cmb" data-c="${k}">${l}</button>`).join('')}</div><span class="sub">Aparece como opção por toque na bebida do combo, no link do WhatsApp e no garçom.</span></div>` : ''}
      <label class="sub" style="display:flex;gap:8px;align-items:center;margin:4px 0 12px"><input type="checkbox" class="ck" data-f="exLiga" ${F.exLiga ? 'checked' : ''}> Ativo (aparece no garçom e na página de pedido)</label>
      <div class="linha">${novo ? '' : `<button class="bt txt verm" data-a="tirar">${ic('delete')} Tirar da lista</button>`}<span style="flex:1"></span><button class="bt" data-a="fecharModal">Cancelar</button><button class="bt pri" data-a="ok">${ic('save')} Salvar</button></div>`,
    cat(d) { cat = d.c; pintarModal(); },
    cmb(d) { comboX = d.c; pintarModal(); },
    async tirar() {
      if (!confirm('Tirar ' + p.nome + ' da lista? (Para pausar, é melhor desligar.)')) return;
      await salvarExtras(l => { const i = l.findIndex(y => y.cod === p.cod); if (i < 0) return false; l.splice(i, 1); }, p.nome + ' tirado');
      fecharModal(); toast(p.nome + ' tirado da lista');
    },
    async ok() {
      const nome = (F.exNome || '').trim(); const cod = parseInt(F.exCod, 10); const preco = r2(parseFloat(String(F.exPreco || '').replace(',', '.')) || 0);
      const del = r2(parseFloat(String(F.exDel || '').replace(',', '.')) || 0);
      if (!nome) { toast('Ponha o nome'); return; }
      if (!(cod > 0)) { toast('Código inválido'); return; }
      if (C.fixos.some(x => x.cod === cod) || extrasAtuais().some(x => x.cod === cod && (!p || x.cod !== p.cod))) { toast('O código ' + cod + ' já é de outro item'); return; }
      const liga = !!F.exLiga;
      if (liga && !(preco > 0)) { toast('Ponha o preço (ou desligue o item)'); return; }
      const grupos = textoParaOps(F.exOps);
      const item = { cod, nome, ab: (F.exAb || '').trim().toUpperCase(), preco, cat, ingredientes: (F.exIng || '').trim(), setor: 'bar', tipo: grupos.length || cat === 'Bebidas' ? 'bebida' : 'simples', ativo: liga };
      if (del) item.precoDelivery = del; if (grupos.length) item.grupos = grupos;
      if (cat === 'Bebidas') item.combo = comboX;
      await salvarExtras(l => { const i = p ? l.findIndex(y => y.cod === p.cod) : -1; if (i >= 0) l[i] = item; else l.push(item); }, (novo ? 'novo ' : 'editou ') + nome + ' (' + R(preco) + ')');
      fecharModal(); toast(nome + ' salvo');
    }
  });
}

// ================= ficha técnica (JP, 23 e 24/11/2026) =================
// Em cada produto: ingredientes na ordem de montagem, com quantidade (g, ml ou un: dá o custo pelo preço do mercado) e
// quantidade de montagem (orienta a linha), embalagem do delivery e glúten. Insumos com o preço da compra; preparos da
// casa (maionese, bacon de shitake...) podem ter receita e rendimento, e o custo do grama sai deles. Mora na coleção
// "fichas" (documento "main"); enquanto ninguém editar, vale a lista inicial de fichas.js. Cada gravação guarda também um
// resumo calculado (resumo), que o script ft_build.ps1 do fiscal lê para refazer a planilha espelho e o CMV do ranking.
const FI = window.FICHA_INICIAL || { insumos: [], fichas: {}, partes: [] };
const TIPOS_INS = ['Ingrediente', 'Preparo da casa', 'Embalagem', 'Revenda'];
const GL_ORD = { nao: 0, conferir: 1, sim: 2 };
const GL_NOME = { nao: 'Não tem', conferir: 'A conferir', sim: 'Tem glúten' };
const piorGl = (a, b) => (GL_ORD[b] || 0) > (GL_ORD[a] || 0) ? b : a;
const numBR = v => { const n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
const nBR = (v, d) => String(r2(v)).replace('.', ',') + (d || '');
let FICHA_DB; // undefined = carregando · null = ainda não gravada (vale a inicial)
let fichaOff = null;
function assinarFicha() { if (fichaOff) return; fichaOff = DB.listenDoc('fichas', 'main', d => { FICHA_DB = d; render(); }); }
function fichaAtual() { return FICHA_DB || { insumos: FI.insumos, fichas: FI.fichas }; }
function insMapa(fa) { const m = {}; ((fa || fichaAtual()).insumos || []).forEach(i => { m[i.id] = i; }); return m; }
// R$ por g, ml ou un (null = sem preço). Preparo com receita e rendimento: soma da receita ÷ rendimento.
function custoUn(ins, m, prof) {
  prof = prof || 0;
  if (ins.tipo === 'Preparo da casa' && (ins.receita || []).length && numBR(ins.rende) > 0 && prof < 4) {
    let t = 0, ok = true;
    ins.receita.forEach(l => { const s = m[l.ins]; const q = numBR(l.q); const c = s ? custoUn(s, m, prof + 1) : null; if (c == null || !(q > 0)) ok = false; else t += c * q; });
    return ok ? t / numBR(ins.rende) : null;
  }
  const q = numBR((ins.compra || {}).qtd), p = numBR((ins.compra || {}).preco);
  return q > 0 && p > 0 ? p / q : null;
}
// Glúten do insumo: o preparo com receita herda o pior dos ingredientes dela
function glIns(ins, m, prof) {
  if (ins.tipo === 'Preparo da casa' && (ins.receita || []).length && (prof || 0) < 4) {
    let g = 'nao'; ins.receita.forEach(l => { const s = m[l.ins]; g = piorGl(g, s ? glIns(s, m, (prof || 0) + 1) : 'conferir'); });
    return ins.gl === 'sim' ? 'sim' : g;
  }
  return ins.gl || 'conferir';
}
const precoPorTxt = (ins, cu) => cu == null ? '' : ins.un === 'un' ? R(cu) + ' a unidade' : R(cu * 1000) + (ins.un === 'ml' ? ' o litro' : ' o kg');
function calcFicha(cod, fa) {
  fa = fa || fichaAtual(); const m = insMapa(fa); const fx = (fa.fichas || {})[cod];
  const r = { linhas: [], custo: 0, custoDel: 0, completas: 0, total: 0, gl: 'nao', glIns: [] };
  ((fx && fx.linhas) || []).forEach(l => {
    const ins = m[l.ins]; const q = numBR(l.q); const cu = ins ? custoUn(ins, m) : null;
    const c = cu != null && q > 0 ? cu * q : null;
    r.total++; if (c != null) { r.completas++; if (l.onde !== 'delivery') r.custo += c; if (l.onde !== 'salao') r.custoDel += c; }
    const g = ins ? glIns(ins, m) : 'conferir';
    if (!ins || ins.tipo !== 'Embalagem') { r.gl = piorGl(r.gl, g); if (g !== 'nao' && ins && !r.glIns.some(x => x.id === ins.id)) r.glIns.push({ id: ins.id, nome: ins.nome, gl: g, troca: ins.troca || '' }); }
    r.linhas.push({ l, ins, q, cu, c, g });
  });
  r.vazia = !r.total; if (r.vazia) r.gl = 'conferir';
  // Troca "tirar" não vale quando o ingrediente é o próprio prato (porção de onion, adicional de onion)
  const comida = r.linhas.filter(x => !x.ins || x.ins.tipo !== 'Embalagem');
  if (comida.length === 1) r.glIns.forEach(x => { if (/^tirar/i.test(x.troca)) x.troca = ''; });
  r.completa = r.total > 0 && r.completas === r.total;
  // status: 'tem' (algum com glúten sem troca) · 'conf' (algo a conferir) · 'adapt' (todo glúten tem troca) · 'sem'
  const semTroca = r.glIns.some(x => x.gl === 'sim' && !x.troca);
  r.status = r.vazia ? 'conf' : semTroca ? 'tem' : r.glIns.some(x => x.gl === 'conferir') || r.linhas.some(x => !x.ins) ? 'conf' : r.gl === 'sim' ? 'adapt' : 'sem';
  r.adaptavel = r.status === 'adapt';
  r.custo = r2(r.custo); r.custoDel = r2(r.custoDel);
  return r;
}
function glTag(r) {
  if (r.vazia) return '<span class="tag cinza">sem ficha</span>';
  return { tem: '<span class="tag ifood">tem glúten</span>', adapt: '<span class="tag aviso">adaptável</span>', sem: '<span class="tag ok">sem glúten</span>' }[r.status] || '<span class="tag cinza">glúten a conferir</span>';
}
const glTexto = r => r.vazia ? 'sem ficha' : { tem: 'tem glúten', adapt: 'adaptável', sem: 'sem glúten' }[r.status] || 'a conferir';
function cmvTag(custo, preco) {
  if (!(preco > 0) || !(custo > 0)) return '';
  const p = custo / preco * 100; const cl = p <= 30 ? 'ok' : p <= 35 ? 'aviso' : 'ifood';
  return `<span class="tag ${cl}">${nBR(Math.round(p * 10) / 10, '%')}</span>`;
}
function produtosFicha() {
  const fixos = C.fixos.filter(p => !['comboBurguer', 'comboMesa', 'comboFixo'].includes(p.tipo));
  const ex = extrasAtuais().map(p => Object.assign({ extra: true }, p));
  const partes = (FI.partes || []).map(p => ({ cod: p.cod, nome: p.nome, cat: 'Partes de combo', preco: 0, parte: true }));
  return fixos.concat(ex).concat(partes);
}
// Combos: o custo é a soma das fichas das partes. Onde há escolha (qual burguer, qual doce), mostra do mais barato ao mais caro.
function slotsCombo(p) {
  const burg = C.fixos.filter(x => x.tipo === 'burguer').map(x => x.cod);
  if (p.tipo === 'comboBurguer') { const beb = { sucoRefri: [91, 92], soda: [94], cerveja: [93], drink: [103, 104, 105, 106] }[p.bebida] || []; return [['Fritas', [81]], ['Doce', [83, 84]], ['Bebida', beb]]; }
  if (p.tipo === 'comboFixo') return [['Filezinhos M', ['p-file-m']], ['Burguer Circuito 26', [52]], ['Sobremesa', [53]]];
  if (p.tipo === 'comboMesa') return (p.partes || []).map(x => x.t === 'burguer' ? ['Burguer', p.semPremium ? burg.filter(c => c !== 10 && c !== 11) : burg] : x.t === 'quesadilla' ? ['Quesadilla', ['p-quesa-bol', 'p-quesa-teri']] : x.t === 'espeto' ? ['Espeto', ['p-espeto']] : ['Sobremesa', ['p-sobremesa-fam']]);
  return [];
}
function calcCombo(p, fa) {
  let min = 0, max = 0, ok = true; const falta = [];
  slotsCombo(p).forEach(([nome, cods]) => {
    const v = cods.map(c => calcFicha(c, fa)).filter(r => r.completa).map(r => r.custo);
    if (!v.length) { ok = false; if (!falta.includes(nome)) falta.push(nome); return; }
    min += Math.min(...v); max += Math.max(...v);
  });
  return { min: r2(min), max: r2(max), completo: ok, falta };
}
function resumoFicha(fa) {
  const m = insMapa(fa); const nomeIns = id => (m[id] || {}).nome || id;
  return {
    geradoEm: agora(), loja: LOJA,
    produtos: produtosFicha().map(p => {
      const r = calcFicha(p.cod, fa); const preco = +p.preco || 0;
      return { cod: String(p.cod), nome: p.nome, cat: p.cat, preco, precoDelivery: +p.precoDelivery || 0, custo: r.custo, custoDel: r.custoDel, cmv: preco > 0 && r.completa ? r2(r.custo / preco * 100) : null,
        completa: r.completa, pesadas: r.completas, linhasTotal: r.total, gluten: glTexto(r), trocas: r.glIns.filter(x => x.gl === 'sim').map(x => x.nome + (x.troca ? ' → ' + x.troca : ' (sem troca)')).join('; '),
        linhas: r.linhas.map(x => ({ ins: nomeIns(x.l.ins), q: x.l.q === '' ? '' : numBR(x.l.q), un: (x.ins || {}).un || '', mont: x.l.mont || '', onde: x.l.onde || 'sempre', custo: x.c == null ? null : r2(x.c * 10000) / 10000, gluten: GL_NOME[x.g] })) };
    }),
    insumos: (fa.insumos || []).map(i => { const cu = custoUn(i, m); return { id: i.id, nome: i.nome, tipo: i.tipo, un: i.un, compraQtd: numBR((i.compra || {}).qtd), compraPreco: numBR((i.compra || {}).preco), precoUn: cu == null ? null : cu, gluten: GL_NOME[glIns(i, m)], troca: i.troca || '', receita: (i.receita || []).map(l => nomeIns(l.ins) + ' ' + l.q).join('; '), rende: numBR(i.rende) }; }),
    combos: C.fixos.filter(p => ['comboBurguer', 'comboMesa', 'comboFixo'].includes(p.tipo)).map(p => { const c = calcCombo(p, fa); return { cod: String(p.cod), nome: p.nome, preco: +p.preco || 0, min: c.min, max: c.max, completo: c.completo, falta: c.falta.join(', ') }; })
  };
}
async function salvarFicha(fn, log) {
  await DB.mutate('fichas', 'main', c => {
    const d = c && Array.isArray(c.insumos) ? c : clone({ insumos: FI.insumos, fichas: FI.fichas });
    const r = fn(d); if (r === false) return undefined;
    d.log = [{ t: agora(), quem: quem(), o: log }].concat(d.log || []).slice(0, 200);
    d.atualizadoEm = agora(); d.resumo = resumoFicha(d);
    return d;
  });
}
const slugIns = (nome, lista) => { let b = norm(nome).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'insumo'; let s = b, i = 2; while (lista.some(x => x.id === s)) s = b + '-' + (i++); return s; };
const insPorNome = (nome, lista) => lista.find(x => norm(x.nome) === norm(nome));
// O que a TV avisa hoje no pedido sem glúten (menu.js), para comparar com a ficha
const GL_CHAVE_INS = { 'pao-brioche': ['pao'], 'isca-shimeji': ['isca'], 'onion-rings': ['onion', 'oniprato'], tortilha: ['trigo'] };
function chavesAlerta(p) { return (p.tipo === 'burguer' ? ['pao'] : []).concat(String(p.gl || '').split(' ').filter(Boolean)); }
function alertaTV(p) { return chavesAlerta(p).map(k => k === 'pao' ? 'PÃO BRIOCHE TEM TRIGO' : TXT_GL[k]).filter(Boolean); }
function faltaNaTV(p, r) {
  if (p.setor === 'bar' || p.parte || p.tipo === 'adicional') return []; // adicional: a TV avisa dentro do item (ADICIONAL ONION TEM GLÚTEN)
  const ks = chavesAlerta(p);
  return r.glIns.filter(x => x.gl === 'sim' && !(GL_CHAVE_INS[x.id] || []).some(k => ks.includes(k))).map(x => x.nome);
}

function telaFicha() {
  assinarFicha();
  if (FICHA_DB === undefined) return '<div class="carregando">Carregando a ficha técnica…</div>';
  const vis = S.ui.fVis || 'produtos';
  const fa = fichaAtual(); const m = insMapa(fa);
  const prods = produtosFicha(); const calc = {}; prods.forEach(p => { calc[p.cod] = calcFicha(p.cod, fa); });
  const vendaveis = prods.filter(p => !p.parte);
  const completas = vendaveis.filter(p => calc[p.cod].completa);
  const comPreco = (fa.insumos || []).filter(i => custoUn(i, m) != null).length;
  const aConferir = (fa.insumos || []).filter(i => i.tipo !== 'Embalagem' && glIns(i, m) === 'conferir').length;
  const cmvs = completas.filter(p => p.preco > 0).map(p => calc[p.cod].custo / p.preco * 100);
  let h = `<div class="entre"><h2 style="margin:0">Ficha técnica</h2><div class="linha"><button class="bt" data-a="ftCsv">${ic('download')} Planilha (CSV)</button></div></div>
    <p class="sub">Cada produto com os ingredientes na ordem de montagem: a <b>quantidade</b> (g, ml ou unidade) dá o custo pelo preço do mercado, a <b>montagem</b> orienta a linha (ex.: 2 fatias). ${FICHA_DB ? 'Última mudança ' + dataBR(FICHA_DB.atualizadoEm) + ' ' + hora(FICHA_DB.atualizadoEm) + '.' : 'Esta é a lista inicial (burguers na ordem das fichas de montagem; gramaturas só as do cardápio). Ela se grava na primeira edição.'}</p>
    <div class="kpis" style="margin-top:12px">
      <div class="kpi"><div class="v">${completas.length}/${vendaveis.length}</div><div class="l">produtos com ficha completa</div></div>
      <div class="kpi"><div class="v">${comPreco}/${(fa.insumos || []).length}</div><div class="l">insumos com preço</div></div>
      <div class="kpi"><div class="v">${cmvs.length ? nBR(Math.round(cmvs.reduce((s, x) => s + x, 0) / cmvs.length * 10) / 10, '%') : '—'}</div><div class="l">CMV médio (das completas)</div></div>
      <div class="kpi"><div class="v">${aConferir}</div><div class="l">insumos com glúten a conferir</div></div></div>
    <div class="chips" style="margin-bottom:14px">${[['produtos', 'Produtos'], ['insumos', 'Insumos e preparos'], ['combos', 'Combos'], ['gluten', 'Glúten']].map(([k, l]) => `<button class="chip ${vis === k ? 'on' : ''}" data-a="ftVis" data-c="${k}">${l}</button>`).join('')}</div>`;
  if (vis === 'insumos') return h + telaFichaInsumos(fa, m);
  if (vis === 'combos') return h + telaFichaCombos(fa);
  if (vis === 'gluten') return h + telaFichaGluten(prods, calc, fa, m);
  h += `<p class="sub">CMV = quanto do preço vai para os ingredientes (custo ÷ preço). Referência comum em restaurante: até 30% (verde); 30 a 35% (amarelo); acima, vermelho. O custo é o do salão; a embalagem entra só no custo do delivery.</p>`;
  const cats = []; prods.forEach(p => { let c = cats.find(x => x.n === p.cat); if (!c) cats.push(c = { n: p.cat, i: [] }); c.i.push(p); });
  // Cards por categoria; o toque abre a ficha do produto para ler, com o botão Editar (JP, 24/11/2026)
  h += cats.map(c => `<div class="secao-t">${esc(c.n)}</div><div class="ft-cards">${c.i.map(p => { const r = calc[p.cod];
    return `<button class="ft-card" data-a="ftVer" data-c="${esc(p.cod)}"><div class="entre" style="align-items:flex-start"><span>${p.parte ? '' : `<span class="cod">${p.cod}</span> `}<b>${esc(p.nome)}</b></span>${p.ab ? `<span class="tag cinza">${esc(p.ab)}</span>` : ''}</div>
      <div class="ft-num"><div><small>Custo agora</small><b>${r.completa ? R(r.custo) : r.completas ? R(r.custo) + '<small>parcial</small>' : '—'}</b></div><div><small>Preço</small><b>${p.preco > 0 ? R(p.preco) : '—'}</b></div><div><small>CMV</small><b>${r.completa && p.preco > 0 ? cmvTag(r.custo, p.preco) : '—'}</b></div></div>
      <div class="entre"><span class="sub">${r.vazia ? 'sem ficha' : r.completas + ' de ' + r.total + ' pesados e com preço'}</span>${glTag(r).replace('glúten a conferir', 'glúten?')}</div></button>`; }).join('')}</div>`).join('');
  return h + ultimasMudancasFicha();
}
// Ficha do produto para ler: montagem, custo de agora, CMV e glúten. O custo não se edita aqui: vem do preço das compras.
function modalFichaVer(p) {
  abrirModal({
    largo: true,
    render: () => {
      const r = calcFicha(p.cod); const pr = +p.preco || 0; const tv = alertaTV(p); const falta = faltaNaTV(p, r); const fx = (fichaAtual().fichas || {})[p.cod] || {};
      const qtd = x => x.l.q === '' || x.l.q == null ? '<span class="sub">a pesar</span>' : nBR(numBR(x.l.q)) + ' ' + esc((x.ins || {}).un || '');
      return `<div class="entre"><h2>${p.parte ? '' : `<span class="cod">${p.cod}</span> `}${esc(p.nome)}${p.ab ? ` <span class="tag cinza">${esc(p.ab)}</span>` : ''}</h2><button class="bt-ic" data-a="fecharModal">${ic('close')}</button></div>
      ${p.desc ? `<p class="sub">${esc(p.desc)}</p>` : ''}
      <div class="kpis" style="margin:10px 0">
        <div class="kpi"><div class="v">${r.completas ? R(r.custo) : '—'}</div><div class="l">custo agora (salão)${r.completa ? '' : ' · parcial'}</div></div>
        <div class="kpi"><div class="v">${r.completas ? R(r.custoDel) : '—'}</div><div class="l">custo no delivery (com embalagem)</div></div>
        <div class="kpi"><div class="v">${pr > 0 ? R(pr) : '—'}</div><div class="l">preço${p.precoDelivery ? ' · delivery ' + R(p.precoDelivery) : ''}</div></div>
        <div class="kpi"><div class="v">${r.completa && pr > 0 ? cmvTag(r.custo, pr) : '—'}</div><div class="l">CMV${r.completa && pr > 0 ? ' · sobra ' + R(pr - r.custo) : ''}</div></div></div>
      <p class="sub">Glúten: ${glTag(r)}${r.glIns.filter(x => x.gl === 'sim').length ? ' ' + esc(r.glIns.filter(x => x.gl === 'sim').map(x => x.nome + (x.troca ? ' → ' + x.troca : ' (sem troca)')).join('; ')) : ''}${r.glIns.some(x => x.gl === 'conferir') ? '<br>A conferir: ' + esc(r.glIns.filter(x => x.gl === 'conferir').map(x => x.nome).join(', ')) : ''}${p.setor !== 'bar' && tv.length ? `<br>Na TV, no pedido sem glúten: ${esc(tv.join(' · '))}` : ''}</p>
      ${falta.length ? `<p class="sub" style="color:var(--vermelho)">${ic('warning')} A ficha marca glúten em ${esc(falta.join(', '))} e a TV ainda não avisa.</p>` : ''}
      <div class="secao-t">Montagem, na ordem</div>
      ${r.linhas.length ? `<div style="overflow-x:auto"><table class="tab"><tr><th>#</th><th>Ingrediente</th><th>Quantidade</th><th>Montagem</th><th>Onde</th><th class="n">Custo agora</th></tr>
        ${r.linhas.map((x, i) => `<tr><td class="sub">${i + 1}</td><td><b>${esc((x.ins || {}).nome || x.l.ins)}</b>${x.g === 'sim' ? ' <span class="tag ifood">glúten</span>' : ''}</td><td>${qtd(x)}</td><td>${esc(x.l.mont || '')}</td><td class="sub">${x.l.onde === 'delivery' ? 'só delivery' : x.l.onde === 'salao' ? 'só salão' : 'sempre'}</td>
          <td class="n">${x.c != null ? R(x.c) : x.cu == null ? '<span class="sub">sem preço</span>' : '—'}</td></tr>`).join('')}</table></div>` : '<p class="sub">Ainda sem ingredientes. Toque em Editar para montar a ficha.</p>'}
      ${fx.obs ? `<div class="secao-t">Modo de preparo</div><p style="white-space:pre-wrap">${esc(fx.obs)}</p>` : ''}
      <p class="sub" style="margin-top:12px">${ic('info')} O custo de agora vem do preço das compras de cada insumo; não se edita na ficha. Próximo passo: o fiscal manter esses preços em dia pelas notas dos mercados.</p>
      <div class="linha" style="margin-top:8px"><span style="flex:1"></span><button class="bt" data-a="fecharModal">Fechar</button><button class="bt pri" data-a="editar">${ic('edit')} Editar ficha</button></div>`;
    },
    editar() { modalFicha(p); }
  });
}
function ultimasMudancasFicha() {
  const log = (FICHA_DB && FICHA_DB.log) || []; if (!log.length) return '';
  return `<div class="secao-t">Últimas mudanças</div><div class="card sub" style="line-height:1.7">${log.slice(0, 8).map(l => `${dataBR(l.t)} ${hora(l.t)} · ${esc(l.quem)} · ${esc(l.o)}`).join('<br>')}</div>`;
}
function telaFichaInsumos(fa, m) {
  const q = norm(F.ftBusca || '');
  const uso = {}; Object.entries(fa.fichas || {}).forEach(([cod, fx]) => (fx.linhas || []).forEach(l => { (uso[l.ins] = uso[l.ins] || new Set()).add(cod); }));
  (fa.insumos || []).forEach(i => (i.receita || []).forEach(l => { (uso[l.ins] = uso[l.ins] || new Set()).add('preparo ' + i.nome); }));
  let h = `<div class="entre"><div class="busca" style="flex:1;max-width:420px">${ic('search')}<input id="ftBusca" data-f="ftBusca" data-vivo placeholder="Procurar insumo" autocomplete="off" value="${esc(F.ftBusca || '')}"></div>
    <button class="bt pri" data-a="ftInsNovo">${ic('add')} Novo insumo</button></div>
    <p class="sub" style="margin:10px 0">Preço: o que se paga numa compra e a quantidade que vem (ex.: 1000 g por R$ 32,00). O sistema faz o preço do grama. Preparo da casa (maionese, bacon de shitake…): ou um preço estimado, ou a receita com o rendimento, e o custo sai sozinho.</p>`;
  TIPOS_INS.forEach(t => {
    const lista = (fa.insumos || []).filter(i => i.tipo === t && (!q || norm(i.nome).includes(q))).sort((a, b) => a.nome.localeCompare(b.nome));
    if (!lista.length) return;
    h += `<div class="secao-t">${t === 'Preparo da casa' ? 'Preparos da casa' : t === 'Revenda' ? 'Revenda (vende como compra)' : t + 's'}</div><div class="card" style="overflow-x:auto;padding:4px 8px"><table class="tab"><tr><th>Insumo</th><th>Un.</th><th class="n">Preço</th><th>Glúten</th><th>Usado em</th><th></th></tr>
      ${lista.map(i => { const cu = custoUn(i, m); const g = glIns(i, m); const n = uso[i.id] ? uso[i.id].size : 0; return `<tr><td><b>${esc(i.nome)}</b>${i.troca ? `<br><span class="sub">sem glúten: ${esc(i.troca)}</span>` : ''}${i.obs ? `<br><span class="sub">${esc(i.obs)}</span>` : ''}</td>
        <td>${esc(i.un)}</td><td class="n">${cu == null ? '<span class="sub">sem preço</span>' : precoPorTxt(i, cu)}${(i.receita || []).length ? '<br><span class="sub">pela receita</span>' : ''}</td>
        <td>${i.tipo === 'Embalagem' ? '' : g === 'sim' ? '<span class="tag ifood">tem</span>' : g === 'nao' ? '<span class="tag ok">não tem</span>' : '<span class="tag cinza">a conferir</span>'}</td>
        <td class="sub">${n ? n + (n === 1 ? ' ficha' : ' fichas') : '—'}</td><td class="n"><button class="bt-ic" data-a="ftInsEditar" data-c="${esc(i.id)}" title="Editar">${ic('edit')}</button></td></tr>`; }).join('')}</table></div>`;
  });
  return h;
}
function telaFichaCombos(fa) {
  const combos = C.fixos.filter(p => ['comboBurguer', 'comboMesa', 'comboFixo'].includes(p.tipo));
  return `<p class="sub">O custo do combo é a soma das fichas das partes. Onde há escolha (qual burguer, qual doce, qual bebida), aparece do mais barato ao mais caro. Nos combos do burguer, o preço é o acréscimo (+R$ 28…), e o custo é só do que vem junto: o burguer tem a ficha dele. Nos combos 41 e 42, o Bitrem e o CTB pagam acréscimo; o CMV aqui usa o preço base.</p>
    <div class="card" style="overflow-x:auto;padding:4px 8px;margin-top:10px"><table class="tab"><tr><th>Cód.</th><th>Combo</th><th>Partes</th><th class="n">Custo</th><th class="n">Preço</th><th class="n">CMV</th></tr>
    ${combos.map(p => { const c = calcCombo(p, fa); const fx = c.min === c.max ? R(c.min) : R(c.min) + ' a ' + R(c.max);
      return `<tr><td><span class="cod">${p.cod}</span></td><td><b>${esc(p.nome)}</b></td><td class="sub">${esc(slotsCombo(p).map(s => s[0]).join(' + '))}</td>
      <td class="n">${c.completo ? fx : `<span class="sub">falta a ficha de: ${esc(c.falta.join(', '))}</span>`}</td><td class="n">${p.tipo === 'comboBurguer' ? '+' : ''}${R(p.preco)}</td>
      <td class="n">${c.completo ? cmvTag(c.min, p.preco) + (c.max !== c.min ? ' a ' + cmvTag(c.max, p.preco) : '') : ''}</td></tr>`; }).join('')}</table></div>`;
}
function telaFichaGluten(prods, calc, fa, m) {
  const vend = prods.filter(p => !p.parte);
  const grupos = [['sem', 'Sem glúten', 'ok'], ['adapt', 'Adaptável (tem troca)', 'aviso'], ['tem', 'Tem glúten (sem troca)', 'ifood'], ['conf', 'A conferir', 'cinza']];
  const de = p => calc[p.cod].status;
  const diverg = vend.map(p => ({ p, f: faltaNaTV(p, calc[p.cod]) })).filter(x => x.f.length);
  let h = `<p class="sub">Vem dos ingredientes de cada ficha: um ingrediente com glúten basta para o prato ter glúten; se todos os que têm glúten têm troca (pão sem glúten, empanar só no fubá, tirar o onion), o prato é adaptável. Serve para os ícones do cardápio (tem, não tem, adaptável). Enquanto houver insumo "a conferir", o prato fica a conferir.</p>`;
  h += diverg.length ? `<div class="card" style="border-color:var(--vermelho);background:var(--vermelho-cl);margin:10px 0"><b>${ic('warning')} A ficha diz que tem glúten e a TV não avisa</b><div class="sub" style="margin-top:6px;line-height:1.7">${diverg.map(x => `<b>${x.p.cod} ${esc(x.p.nome)}</b>: ${esc(x.f.join(', '))}`).join('<br>')}</div><div class="sub" style="margin-top:6px">Hoje o aviso da TV vem do cardápio do sistema; peça ao Claude para incluir (ou para o alerta passar a vir da ficha).</div></div>`
    : `<div class="card" style="margin:10px 0"><span class="tag ok">confere</span> <span class="sub">Tudo o que a ficha marca com glúten na cozinha já tem aviso na TV.</span></div>`;
  h += `<div class="grade" style="grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))">${grupos.map(([k, t, cl]) => { const l = vend.filter(p => de(p) === k); return `<div class="card"><h3><span class="tag ${cl}">${l.length}</span> ${t}</h3><div class="sub" style="line-height:1.7">${l.map(p => { const r = calc[p.cod];
      const tr = k === 'adapt' ? ' · ' + r.glIns.filter(x => x.gl === 'sim').map(x => x.troca).join('; ') : k === 'tem' ? ' · ' + r.glIns.filter(x => x.gl === 'sim' && !x.troca).map(x => x.nome).join(', ') : k === 'conf' && !r.vazia ? ' · ' + r.glIns.filter(x => x.gl === 'conferir').map(x => x.nome).slice(0, 4).join(', ') + (r.glIns.filter(x => x.gl === 'conferir').length > 4 ? '…' : '') : '';
      return `<b>${p.cod.toString().startsWith('p-') ? '' : p.cod + ' '}${esc(p.nome)}</b>${esc(tr)}`; }).join('<br>') || '—'}</div></div>`; }).join('')}</div>`;
  const conf = (fa.insumos || []).filter(i => i.tipo !== 'Embalagem' && glIns(i, m) === 'conferir');
  if (conf.length) h += `<div class="secao-t">Insumos a conferir (receita ou rótulo)</div><div class="card sub" style="line-height:1.7">${conf.map(i => `<b>${esc(i.nome)}</b>${i.obs ? ' · ' + esc(i.obs) : ''}`).join('<br>')}</div>`;
  return h;
}
A.ftVis = d => { S.ui.fVis = d.c; render(); };
A.ftEditar = d => { const p = produtosFicha().find(x => String(x.cod) === d.c); if (p) modalFicha(p); };
A.ftVer = d => { const p = produtosFicha().find(x => String(x.cod) === d.c); if (p) modalFichaVer(p); };
A.ftInsNovo = () => modalInsumo(null);
A.ftInsEditar = d => modalInsumo((fichaAtual().insumos || []).find(i => i.id === d.c));
A.ftCsv = () => {
  const r = resumoFicha(fichaAtual()); const num = v => v == null || v === '' ? '' : String(v).replace('.', ',');
  const L = [['Ficha técnica · Seu Trem · ' + dataBR(agora())], [], ['Código', 'Produto', 'Categoria', 'Preço', 'Custo (salão)', 'Custo (delivery)', 'CMV %', 'Completa', 'Glúten', 'Ingrediente', 'Quantidade', 'Un.', 'Montagem', 'Onde', 'Custo da linha']];
  r.produtos.forEach(p => { (p.linhas.length ? p.linhas : [{}]).forEach((l, i) => L.push(i ? ['', '', '', '', '', '', '', '', '', l.ins, num(l.q), l.un, l.mont, l.onde, num(l.custo)] : [p.cod, p.nome, p.cat, num(p.preco), num(p.custo), num(p.custoDel), num(p.cmv), p.completa ? 'sim' : 'não', p.gluten, l.ins || '', num(l.q), l.un || '', l.mont || '', l.onde || '', num(l.custo)])); });
  L.push([], ['Insumo', 'Tipo', 'Un.', 'Compra (qtd)', 'Compra (R$)', 'Preço por kg, L ou un', 'Glúten', 'Troca sem glúten']);
  r.insumos.forEach(i => L.push([i.nome, i.tipo, i.un, num(i.compraQtd), num(i.compraPreco), i.precoUn == null ? '' : num(r2(i.un === 'un' ? i.precoUn : i.precoUn * 1000)), i.gluten, i.troca]));
  const csv = '﻿' + L.map(l => l.map(x => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"').join(';')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'Ficha tecnica - Seu Trem ' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
};
// --- edição da ficha de um produto ---
function modalFicha(p) {
  const fa = fichaAtual(); const fx = (fa.fichas || {})[p.cod] || { linhas: [], obs: '' };
  const m0 = insMapa(fa);
  const M = { linhas: (fx.linhas || []).map(l => ({ nome: (m0[l.ins] || {}).nome || l.ins, q: l.q === '' || l.q == null ? '' : String(l.q).replace('.', ','), mont: l.mont || '', onde: l.onde || 'sempre' })), obs: fx.obs || '' };
  F.ftObs = M.obs;
  const listaIns = () => fichaAtual().insumos || [];
  const linhaCalc = l => { const m = insMapa(); const ins = insPorNome(l.nome, listaIns()); const cu = ins ? custoUn(ins, m) : null; const q = numBR(l.q); return { ins, cu, c: cu != null && q > 0 ? cu * q : null }; };
  const totais = () => { let s = 0, d = 0, ok = 0; M.linhas.forEach(l => { const x = linhaCalc(l); if (x.c != null) { ok++; if (l.onde !== 'delivery') s += x.c; if (l.onde !== 'salao') d += x.c; } });
    const pr = +p.preco || 0; const comp = M.linhas.length && ok === M.linhas.length;
    return `<b>Custo no salão: ${R(s)}</b>${comp ? '' : ` <span class="sub">(parcial: ${ok} de ${M.linhas.length} linhas com quantidade e preço)</span>`} · delivery ${R(d)}${pr > 0 && s > 0 ? ` · CMV ${cmvTag(s, pr)} de ${R(pr)} · sobra ${R(pr - s)}` : ''}`; };
  const custoTxt = l => { const x = linhaCalc(l); return x.c != null ? R(x.c) : x.ins ? (x.cu == null ? '<span class="sub">sem preço</span>' : '') : (l.nome ? '<span class="sub">insumo novo</span>' : ''); };
  const atualizar = () => { M.linhas.forEach((l, i) => { const e = document.getElementById('ftc-' + i); if (e) e.innerHTML = custoTxt(l); const u = document.getElementById('ftu-' + i); if (u) { const ins = insPorNome(l.nome, listaIns()); u.textContent = ins ? ins.un : ''; } }); const t = document.getElementById('ftTot'); if (t) t.innerHTML = totais(); };
  const r0 = calcFicha(p.cod); const tv = alertaTV(p); const falta = faltaNaTV(p, r0);
  abrirModal({
    largo: true,
    render: () => `<div class="entre"><h2>${p.parte ? '' : `<span class="cod">${p.cod}</span> `}${esc(p.nome)}</h2><button class="bt-ic" data-a="fecharModal">${ic('close')}</button></div>
      <p class="sub">${p.preco > 0 ? 'Preço ' + R(p.preco) + (p.precoDelivery ? ' · delivery ' + R(p.precoDelivery) : '') + ' · ' : ''}Glúten pela ficha: ${glTag(r0)}${r0.glIns.filter(x => x.gl === 'sim').length ? ' (' + esc(r0.glIns.filter(x => x.gl === 'sim').map(x => x.nome + (x.troca ? ' → ' + x.troca : '')).join('; ')) + ')' : ''}${p.setor === 'bar' ? '' : tv.length ? `<br>Na TV, no pedido sem glúten: ${esc(tv.join(' · '))}` : ''}</p>
      ${falta.length ? `<p class="sub" style="color:var(--vermelho)">${ic('warning')} A ficha marca glúten em ${esc(falta.join(', '))} e a TV ainda não avisa.</p>` : ''}
      <p class="sub">Uma linha por ingrediente, na ordem de montagem. <b>Quantidade</b> na unidade do insumo (g, ml ou un). <b>Montagem</b> é o que a linha lê (ex.: 2 fatias, na tampa). Ingrediente novo: escreva o nome; ele entra nos insumos ao salvar.</p>
      <datalist id="dl-ins">${listaIns().slice().sort((a, b) => a.nome.localeCompare(b.nome)).map(i => `<option value="${esc(i.nome)}">`).join('')}</datalist>
      <div style="overflow-x:auto"><table class="tab ft-linhas"><tr><th>#</th><th>Ingrediente</th><th>Qtd.</th><th></th><th>Montagem</th><th>Onde</th><th class="n">Custo</th><th></th></tr>
      ${M.linhas.map((l, i) => `<tr><td class="sub">${i + 1}</td>
        <td><input id="fl-${i}-nome" class="inp" list="dl-ins" data-f="fl-${i}-nome" value="${esc(l.nome)}" autocomplete="off" style="min-width:200px"></td>
        <td><input id="fl-${i}-q" class="inp" data-f="fl-${i}-q" inputmode="decimal" value="${esc(l.q)}" placeholder="?" style="width:78px"></td><td class="sub" id="ftu-${i}">${esc((insPorNome(l.nome, listaIns()) || {}).un || '')}</td>
        <td><input id="fl-${i}-mont" class="inp" data-f="fl-${i}-mont" value="${esc(l.mont)}" placeholder="Ex.: 2 fatias" style="min-width:150px"></td>
        <td><select id="fl-${i}-onde" class="inp" data-f="fl-${i}-onde" style="width:auto">${[['sempre', 'Sempre'], ['delivery', 'Só delivery'], ['salao', 'Só salão']].map(([k, t]) => `<option value="${k}" ${l.onde === k ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
        <td class="n" id="ftc-${i}">${custoTxt(l)}</td>
        <td class="n" style="white-space:nowrap"><button class="bt-ic" data-a="sobe" data-i="${i}" title="Subir">${ic('arrow_upward')}</button><button class="bt-ic" data-a="desce" data-i="${i}" title="Descer">${ic('arrow_downward')}</button><button class="bt-ic" data-a="tira" data-i="${i}" title="Tirar">${ic('close')}</button></td></tr>`).join('')}</table></div>
      <button class="bt" style="margin:8px 0 12px" data-a="mais">${ic('add')} Ingrediente ou embalagem</button>
      <div class="card" id="ftTot" style="margin-bottom:12px">${totais()}</div>
      <div class="campo"><label for="ftObs">Modo de preparo e observações</label><textarea id="ftObs" class="inp" data-f="ftObs" placeholder="Ex.: proteína na chapa 2 min de cada lado; queijo derrete na chapa">${esc(F.ftObs || '')}</textarea></div>
      <div class="linha"><span style="flex:1"></span><button class="bt" data-a="fecharModal">Cancelar</button><button class="bt pri" data-a="ok">${ic('save')} Salvar</button></div>`,
    campo(k, v) { const mm = /^fl-(\d+)-(nome|q|mont|onde)$/.exec(k); if (!mm) return; const l = M.linhas[+mm[1]]; if (!l) return; l[mm[2]] = v; if (mm[2] !== 'mont') atualizar(); },
    mais() { M.linhas.push({ nome: '', q: '', mont: '', onde: 'sempre' }); pintarModal(); const e = document.getElementById('fl-' + (M.linhas.length - 1) + '-nome'); if (e) e.focus(); },
    tira(d) { M.linhas.splice(+d.i, 1); pintarModal(); },
    sobe(d) { const i = +d.i; if (i > 0) { [M.linhas[i - 1], M.linhas[i]] = [M.linhas[i], M.linhas[i - 1]]; pintarModal(); } },
    desce(d) { const i = +d.i; if (i < M.linhas.length - 1) { [M.linhas[i + 1], M.linhas[i]] = [M.linhas[i], M.linhas[i + 1]]; pintarModal(); } },
    async ok() {
      const linhas = M.linhas.filter(l => (l.nome || '').trim());
      const ruim = linhas.find(l => String(l.q).trim() && !(numBR(l.q) > 0)); if (ruim) { toast('Quantidade inválida em ' + ruim.nome); return; }
      const novos = [];
      await salvarFicha(d => {
        d.fichas = d.fichas || {};
        const out = linhas.map(l => {
          let ins = insPorNome(l.nome, d.insumos);
          if (!ins) { ins = { id: slugIns(l.nome, d.insumos), nome: l.nome.trim(), tipo: 'Ingrediente', un: 'g', gl: 'conferir', troca: '', obs: '', compra: { qtd: 1000, preco: 0 } }; d.insumos.push(ins); novos.push(ins.nome); }
          return { ins: ins.id, q: String(l.q).trim() ? numBR(l.q) : '', mont: (l.mont || '').trim(), onde: l.onde || 'sempre' };
        });
        d.fichas[p.cod] = { linhas: out, obs: (F.ftObs || '').trim() };
      }, 'ficha de ' + p.nome + ' (' + linhas.length + ' linhas)');
      modalFichaVer(p); toast('Ficha de ' + p.nome + ' salva' + (novos.length ? ' · insumo novo: ' + novos.join(', ') + ' (confira unidade, preço e glúten)' : ''));
    }
  });
}
// --- edição de um insumo (preço da compra, glúten, troca, receita do preparo) ---
function modalInsumo(ins) {
  const novo = !ins; const fa = fichaAtual();
  Object.assign(F, { inNome: ins ? ins.nome : '', inQtd: ins ? String(numBR((ins.compra || {}).qtd) || '').replace('.', ',') : '1000', inPreco: ins && numBR((ins.compra || {}).preco) ? String(numBR(ins.compra.preco)).replace('.', ',') : '', inTroca: ins ? ins.troca || '' : '', inObs: ins ? ins.obs || '' : '', inRende: ins && ins.rende ? String(ins.rende).replace('.', ',') : '' });
  const M = { tipo: ins ? ins.tipo : 'Ingrediente', un: ins ? ins.un : 'g', gl: ins ? ins.gl || 'conferir' : 'conferir', rec: ((ins && ins.receita) || []).map(l => ({ nome: (insMapa(fa)[l.ins] || {}).nome || l.ins, q: String(l.q).replace('.', ',') })) };
  const usoEm = ins ? produtosFicha().filter(p => (((fa.fichas || {})[p.cod] || {}).linhas || []).some(l => l.ins === ins.id)).map(p => p.nome) : [];
  const usoPrep = ins ? (fa.insumos || []).filter(i => (i.receita || []).some(l => l.ins === ins.id)).map(i => i.nome) : [];
  const precoTxt = () => { const q = numBR(F.inQtd), pr = numBR(F.inPreco); if (!(q > 0 && pr > 0)) return 'Preencha a quantidade e o preço da compra.'; const cu = pr / q; return '= ' + (M.un === 'un' ? R(cu) + ' a unidade' : R(cu * 1000) + (M.un === 'ml' ? ' o litro' : ' o kg') + ' · ' + R(cu) + ' por ' + M.un); };
  const recTxt = () => { const m = insMapa(); let t = 0, ok = M.rec.length > 0; M.rec.forEach(l => { const s = insPorNome(l.nome, fichaAtual().insumos || []); const c = s ? custoUn(s, m) : null; const q = numBR(l.q); if (c == null || !(q > 0)) ok = false; else t += c * q; });
    const rd = numBR(F.inRende); if (!M.rec.length) return 'Sem receita: vale o preço estimado acima.'; if (!ok) return 'Receita incompleta: falta quantidade ou preço de algum ingrediente (custo parcial ' + R(t) + ').'; return 'Receita custa ' + R(t) + (rd > 0 ? ' e rende ' + nBR(rd) + ' ' + M.un + ' = ' + (M.un === 'un' ? R(t / rd) + ' a unidade' : R(t / rd * 1000) + (M.un === 'ml' ? ' o litro' : ' o kg')) : ' · ponha o rendimento'); };
  const atualizar = () => { const a = document.getElementById('inPrecoTxt'); if (a) a.textContent = precoTxt(); const b = document.getElementById('inRecTxt'); if (b) b.textContent = recTxt(); };
  abrirModal({
    foco: novo ? 'inNome' : null, largo: true,
    render: () => `<div class="entre"><h2>${novo ? 'Novo insumo' : esc(ins.nome)}</h2><button class="bt-ic" data-a="fecharModal">${ic('close')}</button></div>
      ${campo('Nome', 'inNome', 'Ex.: Maionese da casa')}
      <div class="campo"><label>Tipo</label><div class="chips">${TIPOS_INS.map(t => `<button class="chip ${M.tipo === t ? 'on' : ''}" data-a="tipo" data-c="${t}">${t}</button>`).join('')}</div></div>
      <div class="campo"><label>Unidade em que entra na ficha</label><div class="chips">${[['g', 'gramas (g)'], ['ml', 'mililitros (ml)'], ['un', 'unidade (un)']].map(([k, t]) => `<button class="chip ${M.un === k ? 'on' : ''}" data-a="un" data-c="${k}">${t}</button>`).join('')}</div></div>
      <div class="linha"><div style="flex:1">${campo('Compra: quantidade que vem (' + M.un + ')', 'inQtd', M.un === 'un' ? '1' : '1000', 'decimal')}</div><div style="flex:1">${campo(M.tipo === 'Preparo da casa' ? 'Preço estimado dessa quantidade (R$)' : 'Preço pago (R$)', 'inPreco', '0,00', 'decimal')}</div></div>
      <p class="sub" id="inPrecoTxt" style="margin:-4px 0 12px">${precoTxt()}</p>
      ${M.tipo === 'Preparo da casa' ? `<div class="card" style="margin-bottom:12px"><b>Receita (opcional)</b><p class="sub">Ingredientes de uma leva e quanto ela rende. Com tudo preenchido, o custo do preparo sai da receita e o preço estimado deixa de valer.</p>
        <datalist id="dl-ins2">${(fichaAtual().insumos || []).filter(i => !ins || i.id !== ins.id).map(i => `<option value="${esc(i.nome)}">`).join('')}</datalist>
        ${M.rec.map((l, i) => `<div class="linha" style="margin-bottom:6px"><input id="rc-${i}-nome" class="inp" style="flex:2" list="dl-ins2" data-f="rc-${i}-nome" value="${esc(l.nome)}" placeholder="Ingrediente" autocomplete="off"><input id="rc-${i}-q" class="inp" style="width:90px" data-f="rc-${i}-q" inputmode="decimal" value="${esc(l.q)}" placeholder="Qtd."><button class="bt-ic" data-a="rcTira" data-i="${i}">${ic('close')}</button></div>`).join('')}
        <button class="bt" data-a="rcMais">${ic('add')} Ingrediente da receita</button>
        <div style="margin-top:10px">${campo('A leva rende (' + M.un + ')', 'inRende', 'Ex.: 1200', 'decimal')}</div><p class="sub" id="inRecTxt">${recTxt()}</p></div>` : ''}
      ${M.tipo === 'Embalagem' ? '' : `<div class="campo"><label>Tem glúten?</label><div class="chips">${[['nao', 'Não tem'], ['sim', 'Tem'], ['conferir', 'A conferir']].map(([k, t]) => `<button class="chip ${M.gl === k ? (k === 'sim' ? 'on verm' : 'on') : ''}" data-a="gl" data-c="${k}">${t}</button>`).join('')}</div></div>
      ${M.gl === 'sim' ? campo('Troca no pedido sem glúten (vazio = não tem troca)', 'inTroca', 'Ex.: pão sem glúten; empanar só no fubá; tirar') : ''}`}
      <div class="campo"><label for="inObs">Observação</label><input id="inObs" class="inp" data-f="inObs" value="${esc(F.inObs)}" placeholder="Ex.: fornecedor, marca, rótulo conferido em…"></div>
      ${usoEm.length || usoPrep.length ? `<p class="sub">Usado em: ${esc(usoEm.concat(usoPrep.map(x => 'preparo ' + x)).join(', '))}.</p>` : ''}
      <div class="linha">${novo || usoEm.length || usoPrep.length ? '' : `<button class="bt txt verm" data-a="tirar">${ic('delete')} Tirar</button>`}<span style="flex:1"></span><button class="bt" data-a="fecharModal">Cancelar</button><button class="bt pri" data-a="ok">${ic('save')} Salvar</button></div>`,
    campo(k, v) { const mm = /^rc-(\d+)-(nome|q)$/.exec(k); if (mm && M.rec[+mm[1]]) M.rec[+mm[1]][mm[2]] = v; atualizar(); },
    tipo(d) { M.tipo = d.c; pintarModal(); }, un(d) { M.un = d.c; if (d.c === 'un' && F.inQtd === '1000') F.inQtd = '1'; if (d.c !== 'un' && F.inQtd === '1') F.inQtd = '1000'; pintarModal(); }, gl(d) { M.gl = d.c; pintarModal(); },
    rcMais() { M.rec.push({ nome: '', q: '' }); pintarModal(); }, rcTira(d) { M.rec.splice(+d.i, 1); pintarModal(); },
    async tirar() { if (!confirm('Tirar ' + ins.nome + ' dos insumos?')) return; await salvarFicha(d => { const i = d.insumos.findIndex(x => x.id === ins.id); if (i < 0) return false; d.insumos.splice(i, 1); }, 'tirou o insumo ' + ins.nome); fecharModal(); toast(ins.nome + ' tirado'); },
    async ok() {
      const nome = (F.inNome || '').trim(); if (!nome) { toast('Ponha o nome'); return; }
      const outro = insPorNome(nome, fichaAtual().insumos || []); if (outro && (!ins || outro.id !== ins.id)) { toast('Já existe um insumo com esse nome'); return; }
      const rec = M.rec.filter(l => (l.nome || '').trim()); const semIns = rec.find(l => !insPorNome(l.nome, fichaAtual().insumos || [])); if (semIns) { toast('Cadastre primeiro o insumo ' + semIns.nome); return; }
      const antes = ins ? numBR((ins.compra || {}).preco) : 0; const depois = numBR(F.inPreco);
      await salvarFicha(d => {
        let x = ins ? d.insumos.find(y => y.id === ins.id) : null;
        if (!x) { x = { id: slugIns(nome, d.insumos) }; d.insumos.push(x); }
        Object.assign(x, { nome, tipo: M.tipo, un: M.un, gl: M.tipo === 'Embalagem' ? 'nao' : M.gl, troca: M.gl === 'sim' ? (F.inTroca || '').trim() : '', obs: (F.inObs || '').trim(), compra: { qtd: numBR(F.inQtd), preco: depois } });
        if (M.tipo === 'Preparo da casa' && rec.length) { x.receita = rec.map(l => ({ ins: insPorNome(l.nome, d.insumos).id, q: numBR(l.q) })); x.rende = numBR(F.inRende); } else { delete x.receita; delete x.rende; }
      }, (novo ? 'novo insumo ' : 'insumo ') + nome + (antes !== depois ? ' (preço ' + R(antes) + ' → ' + R(depois) + ')' : ''));
      fecharModal(); toast(nome + ' salvo');
    }
  });
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
  // No celular, a base completa é só para o sócio (JP, 23/11/2026)
  if (!S.eu) return telaLogin('Plataforma base', CELULAR ? ['socio'] : ACESSO_TOTAL, CELULAR ? '<p class="sub" style="color:var(--azul-esc)">No celular, a base completa abre só com código de sócio.</p>' : '');
  if (CELULAR && S.eu.papel !== 'socio') return `<div class="pag-estreita" style="padding-top:48px"><div class="card plano" style="text-align:center"><h1>${ic('smartphone')} Base no celular: só sócio</h1><p class="sub">Use a base no computador ou o app do garçom pelo link da noite.</p><button class="bt" data-a="sair">${ic('logout')} Trocar de pessoa</button></div></div>`;
  const aba = S.ui.aba || 'mesas';
  const nPg = S.delivery.filter(d => ['frete', 'pagamento'].includes(colunaPedido(d))).length;
  const abas = [['mesas', 'table_restaurant', 'Mesas ao vivo'], ['cozinha', 'skillet', 'Cozinha'], ['bebidas', 'local_bar', 'Bebidas', filaDe('bar').length], ['whatsapp', 'chat', 'WhatsApp do dia', nPg], ['ifood', 'delivery_dining', 'iFood'], ['noite', 'dark_mode', 'Noite e relatório'], ['cardapio', 'menu_book', 'Cardápio'], ['ficha', 'receipt_long', 'Ficha técnica'], ['equipe', 'group', 'Equipe e loja']];
  let corpo;
  if (aba !== 'noite') assinarConsumo(noiteId());
  if (aba === 'mesas') corpo = S.ui.mesa ? `<div class="pag-estreita" style="padding:0">${S.ui.mesa === CI_ID ? telaConsumo() : telaMesa(S.ui.mesa)}</div>` : `<div class="entre"><h2>Mesas ao vivo</h2><span class="sub">Acesso total: abra qualquer mesa. Tudo fica registrado com o seu nome.</span></div>` + telaSlots();
  else if (aba === 'cozinha') return topoBase(abas, aba) + `<div class="tv" style="min-height:0">${telaFilaCozinha(true)}</div>`;
  // Bebidas na base (JP, 24/11/2026): a mesma fila do bar do app do garçom, para o sócio ver e ajudar a preparar
  else if (aba === 'bebidas') corpo = `<div class="pag-estreita" style="padding:0;max-width:900px"><p class="sub" style="margin:0 0 8px">A mesma fila do app do garçom. Fez a bebida? Toque Feito: some para todos.</p>${telaBebidas()}</div>`;
  else if (aba === 'whatsapp') corpo = telaWhatsApp();
  else if (aba === 'ifood') corpo = `<div class="pag-estreita" style="padding:0;max-width:760px">${telaIfood()}</div>`;
  else if (aba === 'noite') { if (!S.ui.noiteVer) { S.ui.noiteVer = noiteId(); } assinarVendas(S.ui.noiteVer); assinarConf(S.ui.noiteVer); assinarConsumo(S.ui.noiteVer); corpo = telaNoite(); }
  else if (aba === 'cardapio') corpo = telaCardapio();
  else if (aba === 'ficha') corpo = telaFicha();
  else corpo = telaEquipe();
  return topoBase(abas, aba) + `<div class="pag">${corpo}</div>`;
};
function topoBase(abas, aba) {
  return `<div class="topo"><div class="marca"><span class="logo">ST</span><b>${esc(NOME_CURTO)}</b><span class="longo">· base</span></div>
    <nav class="abas" data-rola="abas">${abas.map(([k, i, l, b]) => `<button class="${k === aba ? 'on' : ''}" data-a="aba" data-c="${k}">${ic(i)} ${l}${b ? ` <span class="badge">${b}</span>` : ''}</button>`).join('')}</nav>
    <span class="esp"></span>${MODO_TESTE ? '' : `<button class="bt bt-teste" data-a="modoTeste" title="Modo de teste (código de sócio)">${ic('science')}<span>Modo de teste</span></button>`}<span class="quem">${ic('account_circle')} ${esc(S.eu.nome)} <button class="bt-ic" data-a="sair" title="Trocar de pessoa">${ic('logout')}</button></span></div>`;
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
  assinarConsumo(noiteId());
  let corpo = aba === 'bebidas' ? telaBebidas() : aba === 'estudo' ? telaEstudo() : aba === 'caixa' ? telaCaixa() : (S.ui.mesa ? (S.ui.mesa === CI_ID ? telaConsumo() : telaMesa(S.ui.mesa)) : `<div class="entre"><h2>Mesas</h2><span class="sub">${esc(S.eu.nome)}</span></div>` + telaSlots());
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
  'Sobremesas': { ic: 'cake', cor: '#d01884', bg: '#fde7f3', titulo: 'Sobremesas da casa' },
  'Bebidas': { ic: 'local_bar', cor: '#007b83', bg: '#e4f7fb' },
  'Combos do bar': { ic: 'liquor', cor: '#007b83', bg: '#e4f7fb', titulo: 'Combos do bar', sub: 'Para a mesa: sai mais em conta que separado.' }
};
const ORDEM_CATS = ['Circuito 2026', 'Burguers', 'Combo do burguer', 'Aperitivos', 'Combos da mesa', 'Acompanhamentos e sobremesas', 'Sobremesas', 'Bebidas', 'Combos do bar'];
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
  if (p.cod === 89) return 'cookie';
  if (p.cat === 'Sobremesas') return 'cake';
  if (p.cod === 108) return 'sports_bar';
  if (p.cat === 'Combos do bar') return 'liquor';
  const ic1 = { 91: 'local_drink', 92: 'water_full', 93: 'sports_bar', 94: 'glass_cup', 95: 'local_bar', 96: 'water_full', 97: 'water_drop', 98: 'water_drop', 99: 'local_drink', 100: 'sports_bar', 101: 'sports_bar', 102: 'sports_bar', 107: 'liquor' }[p.cod];
  return ic1 || (p.cat === 'Bebidas' ? 'local_bar' : 'restaurant');
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
  if (p.grupos && p.grupos.some(g => g.ops.some(o => o.mais))) return 'a partir de ' + R(p.precoDelivery || p.preco);
  return R(p.precoDelivery || p.preco);
}
function cardProduto(p) {
  const k = CATS_PEDIDO[p.cat] || {}; const inc = inclusosDe(p);
  const n = CARRINHO.filter(i => i.cod === p.cod).length;
  return `<button class="pc" data-a="cliProd" data-c="${p.cod}">
    <div class="pc-img${p.foto ? ' foto' : ''}" style="background:${k.bg};color:${k.cor}">${p.foto ? `<img src="${esc(p.foto)}" alt="" loading="lazy">` : ic(icProd(p))}${p.selo ? `<span class="selo">${esc(p.selo)}</span>` : ''}${n ? `<span class="qtd">${n}</span>` : ''}</div>
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
// Cardápio original na página de pedido (JP, 24/11/2026): prévia do verso no alto; o toque abre o cardápio completo
// (frente e verso, o mesmo PDF do WhatsApp) para ler com calma e voltar ao pedido.
const CARDAPIO_IMG = { previa: 'img/cardapio-verso.jpg', completo: 'img/cardapio-completo.jpg', pdf: 'img/cardapio-seu-trem.pdf' };
const MSG_DUVIDA = 'Ei Trem, tô olhando o cardápio e me bateu uma dúvida: ';
const waCasa = () => cfg().whatsapp || '31993096150';
function previaCardapio() {
  return `<div class="cp">
    <button class="cp-img" data-a="verCardapio" aria-label="Abrir o cardápio completo"><img src="${CARDAPIO_IMG.previa}" alt="Cardápio Seu Trem"><span class="cp-selo">${ic('menu_book')} Toque para ver o cardápio completo</span></button>
    <p class="cp-txt">Se preferir, leia o cardápio original e depois volte para selecionar seu pedido: fica mais gostoso de ler.</p>
    <a class="bt verde bloco cp-wa" href="${wa(waCasa(), MSG_DUVIDA)}" target="_blank" rel="noopener">${ic('chat')} Qualquer dúvida toque aqui</a></div>`;
}
function telaCardapioCompleto() {
  return `<div class="cc-topo"><button class="bt pri" data-a="fecharCardapio">${ic('arrow_back')} Voltar para o pedido</button><span class="esp"></span><a class="bt txt" href="${CARDAPIO_IMG.pdf}" target="_blank" rel="noopener">${ic('picture_as_pdf')} PDF</a></div>
    <div class="cc"><p class="sub" style="text-align:center;margin:10px 16px">Afaste dois dedos na tela para ampliar.</p><img src="${CARDAPIO_IMG.completo}" alt="Cardápio Seu Trem completo, frente e verso">
    <div style="padding:16px"><button class="bt verde grande bloco" data-a="fecharCardapio">${ic('shopping_bag')} Voltar e fazer o pedido</button>
    <a class="bt bloco" style="margin-top:10px" href="${wa(waCasa(), MSG_DUVIDA)}" target="_blank" rel="noopener">${ic('chat')} Qualquer dúvida toque aqui</a></div></div>`;
}
A.verCardapio = () => { S.ui.rolPedido = window.scrollY; S.ui.verCardapio = true; try { history.pushState({ cardapio: 1 }, ''); } catch (e) {} window.scrollTo(0, 0); render(); };
A.fecharCardapio = () => { if (history.state && history.state.cardapio) { history.back(); return; } fecharCardapio(); };
function fecharCardapio() { if (!S.ui.verCardapio) return; S.ui.verCardapio = false; pintar(); window.scrollTo(0, S.ui.rolPedido || 0); }
window.addEventListener('popstate', () => { if (VIEW === 'pedido') fecharCardapio(); });
TELAS.pedido = () => {
  if (S.cfg === undefined) return '<div class="carregando">Carregando…</div>';
  if (S.ui.pedidoFeito) return topoPedido(true) + telaPedidoFeito();
  if (S.ui.checkout) return topoPedido(true) + telaCheckout();
  if (S.ui.verCardapio) return telaCardapioCompleto();
  const lista = C.itens.filter(p => p.tipo !== 'adicional' && !(p.tipo === 'comboMesa' && p.partes.length === 1));
  const q = norm(F.buscaCli || '');
  const filtra = p => !q || norm(p.nome + ' ' + (p.desc || '')).includes(q);
  const cats = ORDEM_CATS.map(n => ({ n, i: lista.filter(p => p.cat === n && filtra(p)) })).filter(c => c.i.length);
  const tot = subtotal(CARRINHO);
  let h = topoPedido(false);
  h += `<div class="pag-estreita pedido" style="padding-bottom:0">${previaCardapio()}</div>`;
  h += `<div class="cats-nav" data-rola="cats">${cats.map(c => `<button class="cat-chip" data-a="irCat" data-c="${esc(c.n)}">${ic(CATS_PEDIDO[c.n].ic)} ${esc(c.n)}</button>`).join('')}</div>`;
  h += `<div class="pag-estreita pedido" style="padding-bottom:110px">
    <div class="busca" style="margin:4px 0 14px">${ic('search')}<input id="buscaCli" data-f="buscaCli" data-vivo placeholder="Buscar no cardápio" value="${esc(F.buscaCli || '')}" autocomplete="off"></div>`;
  if (!q) h += `<div class="sec-t">Destaques da casa</div><div class="destaques" data-rola="destaques">${[P[50], P[30], P[43]].map(p => { const k = CATS_PEDIDO[p.cat]; return `<button class="dq${p.foto ? ' com-foto' : ''}" data-a="cliProd" data-c="${p.cod}" style="background:${k.bg}">${p.foto ? `<div class="dq-foto"><img src="${esc(p.foto)}" alt=""></div>` : `<div class="dq-ic" style="color:${k.cor}">${ic(icProd(p))}</div>`}${p.selo ? `<span class="selo-in">${esc(p.selo)}</span>` : ''}<b class="dq-n">${esc(p.cod === 30 ? 'Combo do burguer' : p.nome)}</b>${htmlInclusos(inclusosDe(p))}${p.economia ? `<div class="pc-eco">${esc(p.economia)}</div>` : ''}<div class="dq-p">${precoCard(p)}</div></button>`; }).join('')}</div>`;
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
  const sug = [].concat(tem(/fritas|onion/i) ? [] : [P[81]], tem(/suco|refri|cerveja|soda|drink|pilsen|água|agua/i) ? [] : [P[91], P[92]], tem(/brownie|alfajor|sobremesa/i) ? [] : [P[83], P[84]]).filter(ativo).slice(0, 4);
  return `<div class="pag-estreita pedido" style="padding-bottom:40px"><button class="bt txt" data-a="voltarCardapio">${ic('arrow_back')} Voltar ao cardápio</button>
    <div class="etapa"><div class="etapa-t"><span class="etapa-n">1</span> Sua sacola</div>
      <div class="itens">${CARRINHO.map((it, i) => { const p = P[it.cod] || {}; const k = CATS_PEDIDO[p.cat] || {}; return `<div class="item"><span class="it-ic" style="background:${k.bg};color:${k.cor}">${ic(icProd(p))}</span><div class="corpo"><div class="nm">${esc(it.nome)}</div>${descItem(it).map(l => `<div class="troca">${esc(l)}</div>`).join('')}</div><div class="pr">${R(precoItem(it))}<div class="qtd-bt"><button class="bt-ic" data-a="tirarCarrinho" data-i="${i}" title="Tirar">${ic('remove_circle_outline')}</button><button class="bt-ic" data-a="repetirItem" data-i="${i}" title="Mais um igual">${ic('add_circle_outline')}</button></div></div></div>`; }).join('') || '<div class="vazio">Sua sacola está vazia.</div>'}</div>
      ${sug.length && CARRINHO.length ? `<div class="sub" style="margin:14px 0 8px">Peça também</div><div class="sugs" data-rola="sugs">${sug.map(p => `<button class="sug" data-a="cliProd" data-c="${p.cod}"><span class="sug-ic" style="background:${CATS_PEDIDO[p.cat].bg};color:${CATS_PEDIDO[p.cat].cor}">${ic(icProd(p))}</span><span class="sug-n">${esc(p.nome.replace(' (acompanha)', ''))}</span><b>${R(p.preco)}</b></button>`).join('')}</div>` : ''}</div>
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
  document.body.classList.toggle('teste', MODO_TESTE); document.documentElement.classList.toggle('teste', MODO_TESTE);
  if (MODO_TESTE) { try { await chegadaTeste(); } catch (e) { toast('Modo de teste: ' + (e.message || e)); } }
  if (VIEW === 'base') { assinar(['config', 'mesas', 'cards', 'delivery', 'fretes']); }
  else if (VIEW === 'garcom') { assinar(['config', 'mesas', 'cards']); }
  else if (VIEW === 'cozinha') { assinar(['config', 'cards']); }
  else if (VIEW === 'mesa') { assinar(['config']); DB.listenDoc('mesas', PARAMS.get('m'), m => { S.mesaCli = m; render(); }); }
  else if (VIEW === 'pedido') { assinar(['config']); }
  else if (VIEW === 'pago') { assinar(['config']); iniciarPago(); }
  // Relógios no lugar, a cada 15 s, só nas telas da equipe; nada se redesenha por tempo (ver tique)
  if (['base', 'garcom', 'cozinha'].includes(VIEW)) setInterval(tique, 15000);
  render();
}
function tentarEu() {
  if (S.cfg && S.eu) { const p = (cfg().pessoas || []).find(x => x.id === S.eu.id); if (!p) S.eu = null; }
  if (!S.eu && S.cfg) { S.eu = carregarEu(); if (S.eu && VIEW === 'cozinha') telaLigada(); }
}
iniciar();
})();
