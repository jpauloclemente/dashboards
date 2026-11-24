// Ficha técnica · Seu Trem (loja st1) · lista inicial, 24/11/2026
// Pedido de JP (23 e 24/11/2026): em cada produto, os ingredientes com gramatura (para o custo) e quantidade de montagem
// (para a linha de produção), a embalagem e se o ingrediente tem glúten. Editável na base (aba Ficha técnica);
// esta lista só vale até a primeira edição, depois tudo mora na nuvem (coleção "fichas", documento "main").
// Ordem dos burguers: a das fichas de montagem (ST - Cardapios, 15/11/2026), de baixo para cima.
// Gramaturas já preenchidas: só as que o cardápio A3 diz (200 g de isca, 300 g de fritas...). O resto, JP pesa.
// Glúten: 'sim' (tem), 'nao' (não tem) ou 'conferir' (preparo ou industrializado: olhar a receita ou o rótulo).
window.FICHA_INICIAL = (function () {
  const I = (id, nome, tipo, un, gl, troca, obs) => ({ id, nome, tipo, un, gl, troca: troca || '', obs: obs || '', compra: { qtd: un === 'un' ? 1 : 1000, preco: 0 } });
  const ING = 'Ingrediente', PREP = 'Preparo da casa', EMB = 'Embalagem', REV = 'Revenda';
  const insumos = [
    // pães e massas
    I('pao-brioche', 'Pão brioche', ING, 'un', 'sim', 'Pão sem glúten (adicional 73, +R$ 5)'),
    I('pao-sem-gluten', 'Pão sem glúten', ING, 'un', 'nao'),
    I('tortilha', 'Tortilha de trigo', ING, 'un', 'sim', '', 'A quesadilla não tem troca sem glúten.'),
    // proteínas e queijos
    I('prot-soja', 'Proteína de soja artesanal', PREP, 'g', 'conferir', '', 'Conferir se a liga leva farinha de trigo ou pão.'),
    I('prot-grao', 'Proteína de grão de bico artesanal', PREP, 'g', 'conferir', '', 'Conferir se a liga leva farinha de trigo ou pão.'),
    I('mussarela', 'Mussarela veg especial', ING, 'g', 'conferir'),
    I('cheddar', 'Cheddar cremoso veg', PREP, 'g', 'conferir'),
    I('cream-cheese', 'Cream cheese (castanha de caju)', PREP, 'g', 'conferir'),
    // molhos
    I('maionese-casa', 'Maionese da casa', PREP, 'g', 'conferir'),
    I('maionese-verde', 'Maionese verde de ervas', PREP, 'g', 'conferir'),
    I('maionese-defumada', 'Maionese defumada', PREP, 'g', 'conferir'),
    I('mostarda', 'Mostarda sem mel', ING, 'g', 'conferir'),
    I('barbecue', 'Barbecue', ING, 'g', 'conferir'),
    I('geleia-damasco', 'Geleia de damasco', ING, 'g', 'conferir'),
    I('catchup-goiabada', 'Catchup de goiabada', PREP, 'g', 'conferir'),
    I('mostarda-maracuja', 'Mostarda de maracujá', PREP, 'g', 'conferir'),
    I('molho-branco', 'Molho branco', PREP, 'g', 'conferir', '', 'Molho branco costuma levar farinha de trigo: conferir a receita.'),
    I('molho-teriyaki', 'Molho teriyaki', PREP, 'g', 'conferir', '', 'Shoyu comum tem trigo: conferir qual shoyu entra.'),
    // vegetais e frescos
    I('tomate', 'Tomate', ING, 'g', 'nao'),
    I('tomate-cereja', 'Tomate-cereja', ING, 'g', 'nao'),
    I('cebola-roxa', 'Cebola roxa', ING, 'g', 'nao'),
    I('alface', 'Alface', ING, 'g', 'nao'),
    I('rucula', 'Rúcula', ING, 'g', 'nao'),
    I('picles', 'Picles especial', PREP, 'g', 'conferir'),
    I('tomate-seco', 'Tomate seco', ING, 'g', 'nao'),
    // preparos quentes e crocantes
    I('cebola-caramelizada', 'Cebola caramelizada', PREP, 'g', 'conferir'),
    I('couve-crispy', 'Couve crispy', PREP, 'g', 'conferir', '', 'Conferir se vai empanada e se frita no mesmo óleo dos empanados.'),
    I('bacon-shitake', 'Bacon de shitake', PREP, 'g', 'conferir', '', 'Bacon de shitake costuma levar shoyu: conferir (shoyu comum tem trigo).'),
    I('coguporo', 'Coguporó (shimeji com alho-poró)', PREP, 'g', 'conferir'),
    I('shimentinha', 'Shimentinha (shimeji com páprica e lemon pepper)', PREP, 'g', 'conferir'),
    I('shimeji-acebolado', 'Shimeji acebolado (filezinhos)', PREP, 'g', 'conferir'),
    I('isca-shimeji', 'Iscas de shimeji empanadas', PREP, 'g', 'sim', 'Empanar só no fubá', 'O empanado comum leva trigo.'),
    I('onion-rings', 'Onion rings', ING, 'g', 'sim', 'Tirar (sai sem onion)'),
    I('fritas', 'Batata frita', ING, 'g', 'conferir', '', 'Batata não tem glúten, mas conferir se frita no mesmo óleo dos empanados (contaminação).'),
    I('farofinha', 'Farofinha especial', PREP, 'g', 'conferir'),
    I('recheio-bolonhesa', 'Recheio bolonhesa (molho de tomate, soja moída, temperos)', PREP, 'g', 'conferir'),
    I('palito-espeto', 'Palito de espeto', ING, 'un', 'nao'),
    // sobremesas
    I('brownie', 'Super brownie', ING, 'un', 'conferir', '', 'Brownie costuma levar farinha de trigo.'),
    I('alfajor', 'Alfajor Atelier', REV, 'un', 'conferir', '', 'Alfajor costuma levar farinha de trigo: ver o rótulo.'),
    I('acai', 'Açaí', ING, 'g', 'nao'),
    I('leite-condensado', 'Leite condensado veg', ING, 'g', 'conferir'),
    I('ovomaltine', 'Ovomaltine', ING, 'g', 'sim', '', 'Tem malte de cevada (glúten).'),
    I('coco-ralado', 'Coco ralado', ING, 'g', 'nao'),
    I('doce-de-leite', 'Doce de leite veg', ING, 'g', 'conferir'),
    I('cafe', 'Café', ING, 'ml', 'nao'),
    // bar
    I('limao', 'Limão', ING, 'un', 'nao'),
    I('acucar', 'Açúcar', ING, 'g', 'nao'),
    I('agua-gas-drink', 'Água com gás (para drinks e soda)', ING, 'ml', 'nao'),
    I('xarope', 'Xarope do sabor', ING, 'ml', 'conferir'),
    I('cachaca', 'Cachaça', ING, 'ml', 'nao'),
    I('vodka', 'Vodka', ING, 'ml', 'nao'),
    I('rum', 'Rum', ING, 'ml', 'nao'),
    I('cachaca-jambu', 'Cachaça de jambu', ING, 'ml', 'nao'),
    I('maracuja', 'Maracujá', ING, 'g', 'nao'),
    I('cravo-canela', 'Cravo e canela', ING, 'g', 'nao'),
    I('refri-600', 'Refrigerante 600 ml', REV, 'un', 'nao'),
    I('refri-200', 'Refrigerante 200 ml', REV, 'un', 'nao'),
    I('pilsen-600', 'Cerveja Pilsen 600 ml', REV, 'un', 'sim', '', 'Cerveja de cevada tem glúten.'),
    I('verace-balance', 'Verace Balance 355 ml', REV, 'un', 'nao', '', 'Sem glúten, segundo o cardápio.'),
    I('heineken-zero', 'Heineken zero lata', REV, 'un', 'sim', '', 'Cerveja de cevada tem glúten.'),
    I('agua', 'Água sem gás (garrafa)', REV, 'un', 'nao'),
    I('agua-gas', 'Água com gás (garrafa)', REV, 'un', 'nao'),
    I('suco-cx', 'Suco de caixinha', REV, 'un', 'nao'),
    // embalagens
    I('emb-burguer', 'Caixa do burguer (delivery)', EMB, 'un', 'nao'),
    I('emb-porcao', 'Embalagem de porção (delivery)', EMB, 'un', 'nao'),
    I('emb-sobremesa', 'Pote de sobremesa (delivery)', EMB, 'un', 'nao'),
    I('emb-copo', 'Copo com tampa (suco e drinks no delivery)', EMB, 'un', 'nao'),
    I('sache', 'Sachê de molho', EMB, 'un', 'conferir'),
    I('guardanapo', 'Guardanapo', EMB, 'un', 'nao')
  ];

  // linha: [insumo, quantidade (g, ml ou un; vazio = JP pesa), montagem, onde ('sempre' | 'delivery' | 'salao')]
  const L = (ins, q, mont, onde) => ({ ins, q: q == null ? '' : q, mont: mont || '', onde: onde || 'sempre' });
  const PAO = L('pao-brioche', 1, 'Pão de baixo primeiro; a tampa fecha'), CX = L('emb-burguer', 1, '', 'delivery'), PORC = L('emb-porcao', 1, '', 'delivery');
  const MUS = L('mussarela', '', '1 fatia derretida sobre a proteína'), ONI = L('onion-rings', '', '2 anéis');
  const f = linhas => ({ linhas, obs: '' });
  const fichas = {
    1: f([PAO, L('maionese-verde'), L('tomate'), L('cebola-roxa'), L('prot-grao', '', '1 disco'), MUS, L('couve-crispy'), CX]),
    2: f([PAO, L('maionese-casa'), L('picles'), L('prot-soja', '', '1 disco'), MUS, L('cebola-caramelizada'), CX]),
    3: f([PAO, L('maionese-verde'), L('alface'), L('cebola-roxa'), L('prot-grao', '', '1 disco'), MUS, L('coguporo'), CX]),
    4: f([PAO, L('maionese-casa'), L('prot-soja', '', '1 disco'), MUS, L('cebola-caramelizada'), L('bacon-shitake'), L('geleia-damasco', '', 'Na tampa'), CX]),
    5: f([PAO, L('maionese-casa'), L('alface'), L('tomate'), L('cebola-roxa'), L('picles'), L('prot-soja', '', '1 disco'), MUS, ONI, L('barbecue', '', 'Na tampa'), CX]),
    6: f([PAO, L('maionese-defumada'), L('rucula'), L('cebola-roxa'), L('prot-grao', '', '1 disco'), L('mussarela', '', 'Junto com o cheddar, sobre a proteína'), L('cheddar'), L('cream-cheese', '', 'Na tampa'), CX]),
    7: f([PAO, L('maionese-defumada'), L('cebola-roxa'), L('picles'), L('prot-soja', '', '1 disco'), L('cream-cheese'), L('bacon-shitake', '', 'Cobrindo'), CX]),
    8: f([PAO, L('maionese-casa'), L('rucula'), L('tomate-cereja'), L('isca-shimeji', '', 'Recheio'), CX]),
    9: f([PAO, L('maionese-casa'), L('alface'), L('tomate'), L('picles'), L('cebola-roxa'), L('prot-soja', '', '1 disco'), MUS, L('cebola-caramelizada'), L('coguporo'), L('bacon-shitake'), ONI, L('barbecue'), L('couve-crispy'), CX]),
    10: f([PAO, L('mostarda'), L('rucula'), L('tomate-cereja'), L('prot-grao', '', '1 disco'), L('cheddar'), L('bacon-shitake'), ONI, CX]),
    11: f([PAO, L('maionese-casa'), L('barbecue'), L('alface'), L('tomate-cereja'), L('cebola-roxa'), L('picles'), L('prot-soja', '', '1 disco (de baixo)'), L('cream-cheese', '', 'Sobre a soja'), L('couve-crispy'),
      L('prot-grao', '', '1 disco (de cima)'), L('cream-cheese', '', 'Sobre o grão de bico'), L('rucula'), L('cebola-caramelizada'), L('coguporo'), L('bacon-shitake'), ONI, CX]),
    52: f([PAO, L('molho-branco'), L('couve-crispy'), L('cebola-roxa'), L('isca-shimeji', '', 'Recheio'), L('cream-cheese'), L('shimeji-acebolado', '', 'Finalizado ao vinho branco'), CX]),

    21: f([L('isca-shimeji', 200), L('fritas', 200), PORC]),
    22: f([L('fritas', 300), L('cheddar', '', 'Por cima'), L('bacon-shitake', '', 'Por cima'), PORC]),
    23: f([L('fritas', 300, 'Ou onion rings, ou meio a meio'), L('coguporo', '', 'Por cima'), PORC]),
    24: f([L('shimentinha', 150), L('fritas', 300), L('farofinha'), PORC]),
    25: f([L('fritas', 400, 'Ou 400 g de onion rings, ou mix'), PORC]),
    26: f([L('tortilha', 1, '4 fatias'), L('recheio-bolonhesa'), L('fritas'), PORC]),
    27: f([L('tortilha', 1, '4 fatias'), L('shimentinha'), L('cebola-roxa'), L('tomate-cereja'), L('rucula'), L('molho-teriyaki'), L('fritas'), PORC]),
    28: f([L('isca-shimeji'), L('tomate-seco'), L('palito-espeto', 1), L('fritas'), PORC]),
    51: f([L('shimeji-acebolado', '', 'Porção G'), L('fritas'), PORC]),
    53: f([L('alfajor', 1, 'Fatiado'), L('acai'), L('leite-condensado'), L('ovomaltine'), L('coco-ralado'), L('emb-sobremesa', 1, '', 'delivery')]),

    61: f([L('cream-cheese')]), 62: f([L('cheddar')]), 63: f([L('bacon-shitake')]), 64: f([ONI]), 65: f([L('shimentinha')]), 66: f([L('coguporo')]),
    67: f([L('geleia-damasco')]), 68: f([L('catchup-goiabada')]), 69: f([L('mostarda-maracuja')]), 70: f([L('couve-crispy')]), 71: f([L('alface'), L('tomate')]),
    72: f([L('prot-soja', '', '1 disco a mais (soja ou grão de bico, a do burguer)')]), 73: f([L('pao-sem-gluten', 1, 'No lugar do brioche')]),

    81: f([L('fritas', 100), PORC]), 82: f([L('onion-rings', '', '6 anéis'), PORC]), 83: f([L('brownie', 1)]), 84: f([L('alfajor', 1)]),
    85: f([L('brownie', 1), L('doce-de-leite')]), 86: f([L('brownie', 1), L('cafe')]), 87: f([L('brownie', 2), L('doce-de-leite'), L('cafe')]),

    91: f([L('limao'), L('acucar'), L('emb-copo', 1, '', 'delivery')]),
    92: f([L('refri-600', 1)]), 93: f([L('pilsen-600', 1)]), 96: f([L('refri-200', 1)]), 97: f([L('agua', 1)]), 98: f([L('agua-gas', 1)]), 99: f([L('suco-cx', 1)]),
    100: f([L('verace-balance', 1)]), 101: f([L('heineken-zero', 1)]),
    94: f([L('limao'), L('xarope'), L('agua-gas-drink')]),
    103: f([L('limao'), L('acucar'), L('cachaca'), L('agua-gas-drink', '', 'Finaliza')]),
    104: f([L('limao'), L('acucar'), L('vodka'), L('agua-gas-drink', '', 'Finaliza')]),
    105: f([L('limao', '', 'Espremido'), L('rum', '', 'Ou o destilado escolhido'), L('acucar'), L('xarope'), L('agua-gas-drink')]),
    106: f([L('maracuja'), L('cravo-canela'), L('cachaca-jambu'), L('acucar'), L('agua-gas-drink')]),
    107: f([L('cachaca', '', '1 dose (ou o destilado escolhido)')]),

    // Partes de combo: o que vai dentro dos combos e não é vendido sozinho do mesmo jeito (sem fritas, porção M...)
    'p-quesa-bol': f([L('tortilha', 1, '4 fatias'), L('recheio-bolonhesa')]),
    'p-quesa-teri': f([L('tortilha', 1, '4 fatias'), L('shimentinha'), L('cebola-roxa'), L('tomate-cereja'), L('rucula'), L('molho-teriyaki')]),
    'p-espeto': f([L('isca-shimeji'), L('tomate-seco'), L('palito-espeto', 1)]),
    'p-file-m': f([L('shimeji-acebolado', '', 'Porção M'), L('fritas')]),
    'p-sobremesa-fam': f([L('brownie', 1), L('acai')])
  };
  const partes = [
    { cod: 'p-quesa-bol', nome: 'Quesadilla Bolonhesa (no combo, sem fritas)' },
    { cod: 'p-quesa-teri', nome: 'Quesadilla Shimeji Teriyaki (no combo, sem fritas)' },
    { cod: 'p-espeto', nome: 'Espeto de shimeji e tomate seco (no combo, sem fritas)' },
    { cod: 'p-file-m', nome: 'Filezinhos acebolados + fritas (M, do Combo Circuito)' },
    { cod: 'p-sobremesa-fam', nome: 'Sobremesa brownie & açaí (do Combo Família)' }
  ];
  return { insumos, fichas, partes };
})();
