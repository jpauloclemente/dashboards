/* Seu Trem · conversa semanal entre o fiscal e o sistema de atendimento (R60, JP 25/11/2026)
   Lógica comum à base (navegador) e ao script de terça do fiscal (Node: conversa_semanal.js), para os dois lados
   fazerem exatamente a mesma conta:
   - catalogoAchar / insumoPeloFiscal: o preço de compra de um insumo da ficha técnica pela última nota do fiscal;
   - montarRelatorioSistema: o "Relatório do sistema para o fiscal" da semana.
   Formatos: dossiê do ST - Fiscal e controle financeiro e Documentos\Conversa fiscal e sistema - formato dos relatórios semanais.txt */
(function (raiz) {
  'use strict';
  const FISCAL_TIPO = 'seu-trem/fiscal-para-sistema', SISTEMA_TIPO = 'seu-trem/sistema-para-fiscal';
  const r2 = v => Math.round((+v || 0) * 100) / 100;
  const numBR = v => { const n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const FORA = ['de', 'da', 'do', 'das', 'dos', 'e', 'com', 'o', 'a', 'os', 'as', 'p', 'para'];
  function sing(w) { if (w.length <= 3 || /\d/.test(w)) return w; if (/[oa]es$/.test(w)) return w.slice(0, -3) + 'ao'; if (/[^s]s$/.test(w)) return w.slice(0, -1); return w; }
  function tokens(s) { return norm(s).replace(/(\d)\s+(ml|g|kg|l)\b/g, '$1$2').replace(/[^a-z0-9.,°\s]/g, ' ').split(/\s+/).map(w => w.replace(/^[.,]+|[.,]+$/g, '')).filter(Boolean).map(sing).filter(w => !FORA.includes(w)); }
  const pesoNome = nome => { const m = norm(nome).match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/); if (!m) return null; let q = numBR(m[1]); if (m[2] === 'kg' || m[2] === 'l') q *= 1000; return { q, u: (m[2] === 'kg' || m[2] === 'g') ? 'g' : 'ml' }; };
  const qtdPacote = nome => { const m = norm(nome).match(/\((?:pacote |pct |cx |caixa |fardo )?(\d+)(?: un)?\)/); return m ? +m[1] : null; };

  // O item do catálogo do fiscal com as palavras do nome (o mesmo critério da lista de compras)
  function catalogoAchar(nome, doc) {
    const tk = tokens(nome); if (!tk.length) return null; let best = null, bs = 0;
    ((doc && doc.itens) || []).forEach(it => (it.apelidos || []).concat([it.nome]).forEach(a => { const at = tokens(a); if (!at.length || !at.every(w => tk.includes(w))) return; const s = at.length * 10 + (at[0] === tk[0] ? 5 : 0); if (s > bs) { bs = s; best = it; } }));
    return best;
  }
  // Preço de compra de um insumo pela última nota do item, na unidade do insumo (g, ml ou un).
  // Volta null (preparo da casa ou sem item no catálogo), { cat, sem: motivo } ou { cat, p, compra: { qtd, preco } }.
  function insumoPeloFiscal(ins, doc) {
    if (ins.tipo === 'Preparo da casa') return null;
    const cat = (ins.catalogo && ((doc.itens || []).find(x => x.nome === ins.catalogo))) || catalogoAchar(ins.nome, doc);
    if (!cat) return null;
    const txtCat = norm(cat.nome + ' ' + (cat.apelidos || []).join(' ')); const txtIns = norm(ins.nome);
    const marca = ['com gas', 'sem gluten', 'zero', 'diet', 'integral'].find(f => txtIns.includes(f) && !txtCat.includes(f));
    if (marca && !ins.catalogo) return { cat, sem: 'produto diferente (' + marca + ')' };
    const tI = pesoNome(ins.nome), tC = pesoNome(cat.nome);
    if (tI && tC && tI.u === tC.u && tI.q !== tC.q && !ins.catalogo) return { cat, sem: 'tamanho diferente' };
    const ps = (cat.precos || []).slice().sort((a, b) => String(b.data).localeCompare(String(a.data)));
    if (!ps.length) return { cat, sem: 'sem nota ainda' };
    const p = ps[0]; let compra = null; const pac = qtdPacote(cat.nome) || 1; const embSemQtd = /pacote|\bpct\b|caixa|\bcx\b|fardo|bandeja/.test(norm(cat.nome)) && !qtdPacote(cat.nome);
    if (ins.un === 'g' && cat.un === 'kg') compra = { qtd: 1000, preco: p.preco };
    else if (ins.un === 'g' && cat.peso > 0) compra = { qtd: Math.round(cat.peso * 1000), preco: p.preco };
    else if ((ins.un === 'g' || ins.un === 'ml') && tC && tC.u === ins.un) compra = { qtd: tC.q * pac, preco: p.preco };
    else if (ins.un === 'un' && cat.un === 'un' && !tC && !embSemQtd) compra = { qtd: 1, preco: p.preco };
    else if (ins.un === 'un' && qtdPacote(cat.nome)) compra = { qtd: qtdPacote(cat.nome), preco: p.preco };
    if (!compra) return { cat, sem: embSemQtd || (ins.un === 'un' && tC) ? 'embalagem sem a quantidade de unidades' : 'unidade diferente (' + cat.un + ' x ' + ins.un + ')' };
    return { cat, p, compra: { qtd: compra.qtd, preco: r2(compra.preco) } };
  }
  // Insumos que mudam de preço com um relatório do fiscal (só os de compra direta; preparo da casa vai pela receita)
  function trocasDoFiscal(insumos, doc) {
    return (insumos || []).map(ins => { const r = insumoPeloFiscal(ins, doc); if (!r) return null;
      const q0 = numBR((ins.compra || {}).qtd), p0 = numBR((ins.compra || {}).preco);
      const antes = q0 > 0 && p0 > 0 ? p0 / q0 : null; const depois = r.compra ? r.compra.preco / r.compra.qtd : null;
      const igual = !!r.compra && q0 === r.compra.qtd && Math.abs(p0 - r.compra.preco) < 0.005;
      return Object.assign({ ins, antes, depois, igual }, r); }).filter(Boolean);
  }
  function aplicarTroca(ins, x, quando) { ins.compra = { qtd: x.compra.qtd, preco: x.compra.preco }; ins.compraFonte = { item: x.cat.nome, local: x.p.local, data: x.p.data, nota: x.p.nota || '', importadoEm: quando }; }

  // --- a semana do sistema para o fiscal ---
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const diaOperacao = ts => ymd(new Date(ts - 6 * 3600000)); // a noite que passa da meia-noite conta no dia em que começou
  function somaDias(id, n) { const d = new Date(id + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); }
  // A semana de quarta a segunda que acabou (o Seu Trem fecha na terça)
  function semanaPassada(agora) { const d = new Date((agora || Date.now()) - 6 * 3600000); const dow = d.getDay(); const ate = new Date(d); ate.setDate(d.getDate() - ((dow + 6) % 7 || 7)); const de = new Date(ate); de.setDate(ate.getDate() - 5); return { de: ymd(de), ate: ymd(ate) }; }
  function noitesDoPeriodo(cfg, de, ate) {
    const c = cfg || {}; return [{ id: (c.noite || {}).id, inicio: (c.noite || {}).inicio }].concat(c.noites || []).filter(n => n.id && n.inicio).filter(n => { const d = diaOperacao(n.inicio); return d >= de && d <= ate; });
  }
  // dados: { loja, de, ate, noites, vendas, consumo, conferencias, compras, fichas, geradoEm, geradoPor }
  function montarRelatorioSistema(o) {
    const vendas = o.vendas || [], consumo = o.consumo || [], compras = (o.compras || []).map(x => { const y = JSON.parse(JSON.stringify(x)); delete y.chave; return y; });
    const ok = vendas.filter(v => !v.cancelado); const formas = {}, canais = {};
    ok.forEach(v => { (v.pagamentos || []).forEach(p => { formas[p.forma] = r2((formas[p.forma] || 0) + p.valor); }); canais[v.canal] = r2((canais[v.canal] || 0) + (v.total || 0)); });
    const descontos = []; ok.forEach(v => (v.itens || []).forEach(i => { if (i.descPct) descontos.push({ noiteId: v.noiteId, venda: v.ref, item: i.nome, pct: i.descPct, cheio: i.cheio, preco: i.preco, valor: r2((i.cheio || 0) - (i.preco || 0)) }); }));
    const listas = compras.reduce((a, x) => { (x.locais || []).forEach(l => { a.previsto = r2(a.previsto + (l.previsto || 0)); a.real = r2(a.real + numBR(l.real)); (l.itens || []).forEach(i => { if (i.falta) a.faltas.push({ dia: x.id, local: l.nome, item: i.txt }); }); }); return a; }, { previsto: 0, real: 0, faltas: [] });
    const fr = o.fichas && o.fichas.resumo;
    return { tipo: SISTEMA_TIPO, versao: 1, loja: o.loja, geradoEm: o.geradoEm || Date.now(), geradoPor: o.geradoPor || '', periodo: { de: o.de, ate: o.ate },
      resumo: { noites: (o.noites || []).length, vendas: ok.length, canceladas: vendas.length - ok.length, total: r2(ok.reduce((s, v) => s + (v.total || 0), 0)), dez: r2(ok.reduce((s, v) => s + (v.dez || 0), 0)), frete: r2(ok.reduce((s, v) => s + (v.frete || 0), 0)), porForma: formas, porCanal: canais,
        descontos: { n: descontos.length, valor: r2(descontos.reduce((s, x) => s + x.valor, 0)) }, consumo: consumo.filter(x => !x.apagado).length, listas: { dias: compras.length, previsto: listas.previsto, real: listas.real, naoTinha: listas.faltas.length } },
      noites: (o.noites || []).map(n => ({ id: n.id, inicio: n.inicio, dia: diaOperacao(n.inicio) })), vendas, descontos, consumo, conferencias: o.conferencias || [], compras, faltasNasCompras: listas.faltas,
      fichaTecnica: fr ? { geradoEm: fr.geradoEm, produtos: (fr.produtos || []).map(p => ({ cod: p.cod, nome: p.nome, preco: p.preco, custo: p.custo, cmv: p.cmv, completa: p.completa })) } : null };
  }

  const API = { FISCAL_TIPO, SISTEMA_TIPO, norm, tokens, pesoNome, qtdPacote, catalogoAchar, insumoPeloFiscal, trocasDoFiscal, aplicarTroca, ymd, diaOperacao, somaDias, semanaPassada, noitesDoPeriodo, montarRelatorioSistema };
  if (typeof module === 'object' && module.exports) module.exports = API; else raiz.ConversaFiscal = API;
})(typeof window !== 'undefined' ? window : globalThis);
