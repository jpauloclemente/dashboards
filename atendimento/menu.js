// Cardápio do sistema · Seu Trem (loja st1)
// Fonte: Cardápio Seu Trem A3 FINAL (21/11/2026) + códigos confirmados por JP em 23/11/2026.
// setor: 'cozinha' ou 'bar' (bar = bebidas, brownie e alfajor).
// chapa: o que entra na faixa de soma da TV (burguer, quesadilla, cogumelo).
// ab: abreviação da linha de produção (como nas fichas de montagem), mostrada na TV e aceita na busca (JP, 23/11/2026).
// gl: o que tem glúten e o que muda no pedido sem glúten (alergia): 'isca' = isca de shimeji empanada só no fubá; 'onion' = sem onion rings;
// 'trigo' = tortilha de trigo (quesadilla); 'oniprato' = o prato é de onion rings. O pão brioche (trigo) entra sozinho em todo burguer.
window.CARDAPIO = (function () {
  const B = (cod, nome, preco, ab, desc, gl) => ({ cod, nome, preco, ab, cat: 'Burguers', setor: 'cozinha', tipo: 'burguer', chapa: 'burguer', desc, gl });
  const itens = [
    B(1, 'Trem Vegano', 35, 'TV', 'Maionese verde cremosa, tomate, cebola roxa, mussarela veg especial, proteína de grão de bico artesanal e couve crispy.'),
    B(2, 'Classic Surreal', 36, 'CLASS', 'Maionese da casa, cebola caramelizada, picles especial, mussarela veg especial e proteína de soja artesanal.'),
    B(3, 'Coguporó', 39, 'COGU', 'Maionese verde de ervas, alface, cebola roxa, proteína de grão de bico artesanal coberta com mussarela veg especial e cogumelos shimeji salteados com alho-poró.'),
    B(4, 'Tôsurreal', 39, 'TÔSU', 'Maionese da casa, cebola caramelizada, bacon de shitake defumado e frito, mussarela veg especial, proteína de soja artesanal e geleia de damasco.'),
    B(5, 'Futurístico', 40, 'FUT', 'Maionese da casa, cebola roxa, alface, tomate, picles, mussarela veg especial, 2 onion rings crocantes, barbecue e proteína de soja artesanal.', 'onion'),
    B(6, '3 Queijos', 41, '3Q', 'Maionese defumada, cebola roxa, rúcula, mussarela veg especial, cheddar cremoso, cream cheese de castanha de caju e proteína de grão de bico artesanal.'),
    B(7, 'X-Bacon', 42, 'XB', 'Maionese defumada, cebola roxa, picles, proteína de soja artesanal, cream cheese especial e coberto com bacon de shitake defumado e frito.'),
    B(8, 'Circuito 2023', 42, 'C23', 'Maionese da casa, rúcula e tomate-cereja, recheado com cogumelos shimeji empanados e fritos, bem crocantes. Sucesso no circuito vegano de 2023.', 'isca'),
    B(9, 'X-Trem', 45, 'XT', 'Maionese da casa, alface, tomate, picles, cebola roxa, cebola caramelizada, couve crispy, bacon de shitake, coguporó, proteína de soja artesanal, mussarela veg especial, 2 onion rings e barbecue.', 'onion'),
    B(10, 'CTB', 47, 'CTB', 'Cheddar Trem Bacon: mostarda sem mel, rúcula e tomate-cereja, proteína de grão de bico artesanal, cheddar cremoso veg coberto com bacon de shitake, finalizado com 2 onion rings.', 'onion'),
    Object.assign(B(11, 'Bitrem 2.4', 55, 'B24', 'Duas proteínas: soja artesanal com cream cheese e couve crispy e, por cima, grão de bico artesanal com mais cream cheese. Maionese da casa e barbecue, alface, tomate-cereja, cebola roxa, picles, rúcula, cebola caramelizada, coguporó, bacon de shitake e 2 onion rings.', 'onion'), { discos: 2 }),

    { cod: 21, nome: 'Iscas de shimeji + fritas', ab: 'ISCA + FRI', gl: 'isca', preco: 59, desc: '200 g de shimeji empanado com 200 g de fritas. Crocante!', cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo', chapa: 'cogumelo' },
    { cod: 22, nome: 'Fritas + bacon + cheddar', ab: 'FBC', preco: 45, desc: '300 g de fritas com cheddar veg e bacon de shitake defumado e frito.', cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo' },
    { cod: 23, nome: 'Fritas + onion + coguporó', ab: 'FOC', preco: 45, desc: '300 g de fritas ou onion rings (meio a meio também rola) com coguporó: shimeji salteado com alho-poró.', cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo',
      escolha: { titulo: 'Base', opcoes: ['Fritas', 'Onion rings', 'Meio a meio'] }, glEscolha: { 'Onion rings': 'oniprato', 'Meio a meio': 'oniprato' } },
    { cod: 24, nome: 'Shimentinha + fritas', ab: 'SHIMI + FRI', preco: 37, desc: '150 g de shimeji temperado e frito, com 300 g de fritas e farofinha especial.', cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo', chapa: 'cogumelo' },
    { cod: 25, nome: 'Fritas ou onions 400 g', ab: 'FRI 400g', preco: 35, desc: '400 g de fritas ou de onion rings. Se preferir, fazemos um mix.', cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo',
      escolha: { titulo: 'Qual?', opcoes: ['Fritas', 'Onions', 'Mix'] }, abEscolha: { Fritas: 'FRI 400g', Onions: 'ONI 400g', Mix: 'MIX FRI/ONI 400g' }, glEscolha: { Onions: 'oniprato', Mix: 'oniprato' } },
    { cod: 26, nome: 'Quesadilla Bolonhesa + fritas', ab: 'QS + FRI', gl: 'trigo', preco: 37, desc: '4 fatias. Molho de tomate especial, soja moída, salsinha, cebolinha, pimentão e alho torrado. Com fritas.', cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo', chapa: 'quesadilla' },
    { cod: 27, nome: 'Quesadilla Shimeji Teriyaki + fritas', ab: 'QD + FRI', gl: 'trigo', preco: 37, desc: '4 fatias. Shimentinha (shimeji com páprica e lemon pepper), cebola roxa, tomate-cereja, rúcula e molho teriyaki. Com fritas.', cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo', chapa: 'quesadilla' },
    { cod: 28, nome: 'Espetinho + fritas', ab: 'E1 + FRI', gl: 'isca', preco: 35, desc: 'Iscas de shimeji empanadas e tomate seco no espeto, com fritas. No espeto: 3 adicionais por R$ 10.', cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo', chapa: 'cogumelo', espeto: true },

    // Combo do burguer: abre a escolha do burguer + o que vem no combo
    { cod: 30, nome: 'Combo: fritas + doce + suco/refri', ab: 'COMBO 1', preco: 28, desc: 'Escolha o burguer e leve junto fritas + super brownie ou alfajor da Atelier + suco 500 ml ou refri 600 ml.', economia: 'Separado R$ 37 · economize R$ 9', cat: 'Combo do burguer', setor: 'cozinha', tipo: 'comboBurguer', bebida: 'sucoRefri' },
    { cod: 31, nome: 'Combo com soda italiana', ab: 'COMBO ITALIANO', preco: 30, desc: 'Escolha o burguer e leve junto fritas + brownie ou alfajor + soda italiana.', economia: 'Separado R$ 42 · economize R$ 12', cat: 'Combo do burguer', setor: 'cozinha', tipo: 'comboBurguer', bebida: 'soda' },
    { cod: 32, nome: 'Combo com cerveja', ab: 'COMBO CERVEJA', preco: 36, desc: 'Escolha o burguer e leve junto fritas + brownie ou alfajor + cerveja.', economia: 'Separado R$ 41 · economize R$ 5', cat: 'Combo do burguer', setor: 'cozinha', tipo: 'comboBurguer', bebida: 'cerveja' },
    { cod: 33, nome: 'Combo com drink da casa', ab: 'COMBO DRINK', preco: 37, desc: 'Escolha o burguer e leve junto fritas + brownie ou alfajor + qualquer drink da casa.', economia: 'Separado R$ 43 a 56 · economize até R$ 19', cat: 'Combo do burguer', setor: 'cozinha', tipo: 'comboBurguer', bebida: 'drink' },

    // Combos da mesa
    { cod: 41, nome: 'Burguer + quesadilla', ab: 'BURGUER + QUESA', preco: 60, desc: 'Qualquer burguer do cardápio + 1 quesadilla de 4 fatias (sem fritas). Com o Bitrem 2.4, R$ 75; com o CTB, R$ 65.', cat: 'Combos da mesa', setor: 'cozinha', tipo: 'comboMesa',
      partes: [{ t: 'burguer' }, { t: 'quesadilla' }] },
    { cod: 42, nome: 'Burguer + quesadilla + espeto', ab: 'BURG + QUESA + E1', preco: 75, desc: 'Burguer + quesadilla de 4 fatias + espetinho de shimeji e tomate seco (sem fritas). Com o Bitrem 2.4, R$ 90; com o CTB, R$ 80.', cat: 'Combos da mesa', setor: 'cozinha', tipo: 'comboMesa',
      partes: [{ t: 'burguer' }, { t: 'quesadilla' }, { t: 'espeto' }] },
    // semPremium: Bitrem 2.4 e CTB não entram (JP, 23/11/2026)
    { cod: 43, nome: 'Combo Família', ab: 'COMBO FAM', preco: 160, desc: '2 burguers, 2 quesadillas, 2 espetos e 1 sobremesa brownie & açaí. R$ 40 por pessoa numa mesa de 4.', cat: 'Combos da mesa', setor: 'cozinha', tipo: 'comboMesa', semPremium: true,
      partes: [{ t: 'burguer' }, { t: 'burguer' }, { t: 'quesadilla' }, { t: 'quesadilla' }, { t: 'espeto' }, { t: 'espeto' }, { t: 'sobremesaFamilia' }] },
    { cod: 44, nome: '+ burguer (combo da mesa)', preco: 38, cat: 'Combos da mesa', setor: 'cozinha', tipo: 'comboMesa', semPremium: true, partes: [{ t: 'burguer' }] },
    { cod: 45, nome: '+ quesadilla (combo da mesa)', preco: 20, cat: 'Combos da mesa', setor: 'cozinha', tipo: 'comboMesa', partes: [{ t: 'quesadilla' }] },
    { cod: 46, nome: '+ espeto (combo da mesa)', preco: 15, cat: 'Combos da mesa', setor: 'cozinha', tipo: 'comboMesa', partes: [{ t: 'espeto' }] },

    // Circuito 2026
    { cod: 50, nome: 'Combo Circuito 2026', ab: 'CIRCUITO 26', preco: 79.9, selo: 'Lançamento', desc: 'Filezinhos acebolados com fritas (porção M) + Burguer Circuito 26 + sobremesa Leite condensado & Ovomaltine.', economia: 'Separado R$ 116,70 · economize R$ 36,80', cat: 'Circuito 2026', setor: 'cozinha', tipo: 'comboFixo',
      fixas: [
        { nome: 'Filezinhos acebolados + fritas (M)', ab: '1/2 FILÉ + FRI', setor: 'cozinha', chapa: 'cogumelo' },
        { nome: 'Burguer Circuito 26', ab: 'B. VINHO', gl: 'pao isca', setor: 'cozinha', chapa: 'burguer', burguer: true },
        { nome: 'Sobremesa Leite cond. & Ovomaltine', setor: 'bar' }
      ] },
    { cod: 51, nome: 'Filezinhos acebolados + fritas (G)', ab: 'FILÉ G + FRI', preco: 49.9, selo: 'Lançamento', desc: 'Shimeji acebolado ao tempero do chef, servido com fritas. Porção G.', cat: 'Circuito 2026', setor: 'cozinha', tipo: 'aperitivo', chapa: 'cogumelo' },
    { cod: 52, nome: 'Burguer Circuito 26', ab: 'B. VINHO', gl: 'isca', preco: 41.9, selo: 'Lançamento', desc: 'Molho branco, couve crispy, cebola roxa, iscas de shimeji empanadas, cream cheese e shimeji acebolado finalizado ao vinho branco.', cat: 'Circuito 2026', setor: 'cozinha', tipo: 'burguer', chapa: 'burguer' },
    { cod: 53, nome: 'Sobremesa Leite cond. & Ovomaltine', preco: 25, selo: 'Lançamento', desc: 'Alfajor fatiado, açaí, leite condensado veg, Ovomaltine e coco ralado.', cat: 'Circuito 2026', setor: 'bar', tipo: 'simples' },

    // Adicionais (entram dentro de um item; avulsos só se a mesa pedir)
    { cod: 61, nome: 'Cream cheese', preco: 8, cat: 'Adicionais', setor: 'cozinha', tipo: 'adicional', combina: true },
    { cod: 62, nome: 'Cheddar cremoso', preco: 8, cat: 'Adicionais', setor: 'cozinha', tipo: 'adicional', combina: true },
    { cod: 63, nome: 'Bacon de shitake', preco: 8, cat: 'Adicionais', setor: 'cozinha', tipo: 'adicional', combina: true },
    { cod: 64, nome: '2 onion rings', preco: 8, cat: 'Adicionais', setor: 'cozinha', tipo: 'adicional', combina: true },
    { cod: 65, nome: 'Shimentinha', preco: 8, cat: 'Adicionais', setor: 'cozinha', tipo: 'adicional', combina: true },
    { cod: 66, nome: 'Coguporó', preco: 8, cat: 'Adicionais', setor: 'cozinha', tipo: 'adicional', combina: true },
    { cod: 67, nome: 'Geleia de damasco', preco: 8, cat: 'Adicionais', setor: 'cozinha', tipo: 'adicional', combina: true },
    { cod: 68, nome: 'Catchup de goiabada', preco: 8, cat: 'Adicionais', setor: 'cozinha', tipo: 'adicional', combina: true },
    { cod: 69, nome: 'Mostarda de maracujá', preco: 8, cat: 'Adicionais', setor: 'cozinha', tipo: 'adicional', combina: true },
    { cod: 70, nome: 'Couve crispy', preco: 5, cat: 'Adicionais', setor: 'cozinha', tipo: 'adicional', combina: true },
    { cod: 71, nome: 'Alface e tomate', preco: 5, cat: 'Adicionais', setor: 'cozinha', tipo: 'adicional', combina: true },
    { cod: 72, nome: 'Proteína em dobro', preco: 10, cat: 'Adicionais', setor: 'cozinha', tipo: 'adicional', disco: 1 },
    { cod: 73, nome: 'Pão sem glúten', preco: 5, cat: 'Adicionais', setor: 'cozinha', tipo: 'adicional' },

    // Acompanhamentos e sobremesas
    { cod: 81, nome: 'Fritas (acompanha)', ab: 'FRI 100g', preco: 13, desc: 'Porção de fritas para acompanhar.', cat: 'Acompanhamentos e sobremesas', setor: 'cozinha', tipo: 'simples' },
    { cod: 82, nome: 'Onions (acompanha)', ab: '6x ONI', gl: 'oniprato', preco: 13, desc: 'Porção de onion rings para acompanhar.', cat: 'Acompanhamentos e sobremesas', setor: 'cozinha', tipo: 'simples' },
    { cod: 83, nome: 'Super brownie', preco: 13, desc: 'O nosso super brownie.', cat: 'Acompanhamentos e sobremesas', setor: 'bar', tipo: 'simples' },
    { cod: 84, nome: 'Alfajor Atelier', preco: 13, desc: 'Alfajor da Atelier Gourmet.', cat: 'Acompanhamentos e sobremesas', setor: 'bar', tipo: 'simples' }
    // Bebidas e sobremesas novas: lista editável na base (aba Cardápio), com os valores iniciais abaixo (EXTRAS)
  ];

  // Produção por leva na TV (JP, 24/11/2026). prot: as proteínas de cada burguer (gb = grão de bico, soja), pelas
  // descrições de montagem; o Circuito 2023 e o Burguer Circuito 26 são recheados de iscas, sem proteína. O recheio de
  // iscas e os 2 onion rings do burguer saem do glúten (gl 'isca' e 'onion'). fritas: o tamanho da porção que acompanha
  // (P no combo do burguer e no acompanhamento; M na shimentinha, quesadillas, espeto e filé do combo do Circuito;
  // G nas porções de iscas, cheddar e bacon, onion e coguporó, fritas ou onions e filé G).
  const PROT = { 1: ['gb'], 2: ['soja'], 3: ['gb'], 4: ['soja'], 5: ['soja'], 6: ['gb'], 7: ['soja'], 8: [], 9: ['soja'], 10: ['gb'], 11: ['soja', 'gb'], 52: [] };
  const FRITAS = { 21: 'G', 22: 'G', 23: 'G', 24: 'M', 25: 'G', 26: 'M', 27: 'M', 28: 'M', 51: 'G', 81: 'P' };
  itens.forEach(i => { if (PROT[i.cod]) i.prot = PROT[i.cod]; if (FRITAS[i.cod]) i.fritas = FRITAS[i.cod]; });
  const fx50 = itens.find(i => i.cod === 50).fixas; fx50[0].fritas = 'M'; fx50[1].cod = 52;

  // Bebidas e sobremesas da casa (JP, 23/11/2026, grupo Sistema). Editáveis na base: nome, abreviação, preço,
  // preço no delivery, ingredientes e opções. Cada opção soma a abreviação e, se tiver, o acréscimo no preço.
  // Ex.: Belorihills + Gin + Pitanga = BELO GIN PIT; 900 ml = +R$ 15. O cardápio impresso de bebidas e
  // sobremesas será refeito em ST - Cardapios e, com ele, esta lista se confirma.
  const SABORES = [['Groselha', 'GRO'], ['Pitanga', 'PIT'], ['Graviola', 'GRA'], ['Goiaba', 'GOI'], ['Morango', 'MORA'], ['Mix', 'MIX']];
  const sab = () => ({ t: 'Sabor', ops: SABORES.map(([n, ab]) => ({ n, ab, mais: 0 })) });
  const tam = () => ({ t: 'Tamanho', ops: [{ n: '500 ml', ab: '', mais: 0 }, { n: '900 ml', ab: '900', mais: 15 }] });
  const BAR = { setor: 'bar', tipo: 'bebida', ativo: true };
  const DESTILADOS = () => [{ n: 'Rum', ab: 'RUM', mais: 0 }, { n: 'Gin', ab: 'GIN', mais: 0 }, { n: 'Vodka', ab: 'VODK', mais: 0 }, { n: '51', ab: '51', mais: 0 }, { n: 'Conhaque', ab: 'CONH', mais: 0 }, { n: 'Whisky', ab: 'WHIS', mais: 10 }];
  // Na dupla, o Mix fica de fora: a escolha dos sabores do Mix só funciona com um grupo de sabor por item
  const SAB_SEM_MIX = () => SABORES.filter(([n]) => n !== 'Mix').map(([n, ab]) => ({ n, ab, mais: 0 }));
  const EXTRAS = [
    Object.assign({ cod: 91, nome: 'Suco de limão 500 ml', ab: 'SUCO', preco: 11, precoDelivery: 12, cat: 'Bebidas', ingredientes: 'Suco de limão, 500 ml. No delivery, R$ 12 por causa da embalagem.' }, BAR),
    Object.assign({ cod: 92, nome: 'Refrigerante 600 ml', ab: '', preco: 11, cat: 'Bebidas', ingredientes: 'Coca, Coca zero ou Guaraná 600 ml.', grupos: [{ t: 'Qual', ops: [{ n: 'Coca', ab: 'COCA 600', mais: 0 }, { n: 'Coca zero', ab: 'ZERO 600', mais: 0 }, { n: 'Guaraná', ab: 'GUA 600', mais: 0 }] }] }, BAR),
    Object.assign({ cod: 93, nome: 'Verace Pilsen 600 ml', ab: 'PILSEN', preco: 15, cat: 'Bebidas', ingredientes: 'Cerveja Verace Pilsen, garrafa de 600 ml.' }, BAR),
    Object.assign({ cod: 94, nome: 'Soda italiana', ab: 'SODA', preco: 16, cat: 'Bebidas', ingredientes: 'Limão, xarope do sabor e água com gás. No Mix, anote quais sabores se misturam.', grupos: [sab()] }, BAR),
    Object.assign({ cod: 95, nome: 'Drink especial da semana', ab: 'DRINK ESP', preco: 0, cat: 'Bebidas', ingredientes: 'Defina na base, toda semana: nome, ingredientes e preço.' }, BAR, { ativo: false }),
    Object.assign({ cod: 96, nome: 'Refrigerante 200 ml', ab: '', preco: 5, cat: 'Bebidas', ingredientes: 'Coca, Coca zero ou Guaraná 200 ml.', grupos: [{ t: 'Qual', ops: [{ n: 'Coca', ab: 'COCA 200', mais: 0 }, { n: 'Coca zero', ab: 'ZERO 200', mais: 0 }, { n: 'Guaraná', ab: 'GUA 200', mais: 0 }] }] }, BAR),
    Object.assign({ cod: 97, nome: 'Água', ab: 'H2O', preco: 5, cat: 'Bebidas', ingredientes: 'Água sem gás.' }, BAR),
    Object.assign({ cod: 98, nome: 'Água com gás', ab: 'HGÁS', preco: 5, cat: 'Bebidas', ingredientes: 'Água com gás.' }, BAR),
    Object.assign({ cod: 99, nome: 'Suco de caixinha', ab: 'CX', preco: 5, cat: 'Bebidas', ingredientes: 'Suco de caixinha.' }, BAR),
    Object.assign({ cod: 100, nome: 'Verace Balance 355 ml', ab: 'LOW', preco: 13, cat: 'Bebidas', ingredientes: 'Long neck low carb e sem glúten.' }, BAR),
    Object.assign({ cod: 101, nome: 'Heineken zero lata', ab: '0.0', preco: 13, cat: 'Bebidas', ingredientes: 'Heineken lata sem álcool.' }, BAR),
    Object.assign({ cod: 102, nome: 'Cerveja especial da semana', ab: 'CERV ESP', preco: 0, cat: 'Bebidas', ingredientes: 'Defina na base, toda semana: nome e preço.' }, BAR, { ativo: false }),
    Object.assign({ cod: 103, nome: 'Caipirinha', ab: 'CAIP', preco: 18, cat: 'Bebidas', ingredientes: 'Nosso diferencial: finalizada com água com gás, para um efeito refrescante.' }, BAR),
    Object.assign({ cod: 104, nome: 'Caipi vodka', ab: 'CVODK', preco: 20, cat: 'Bebidas', ingredientes: 'Caipirinha com vodka, finalizada com água com gás.' }, BAR),
    Object.assign({ cod: 105, nome: 'Belorihills', ab: 'BELO', preco: 23, cat: 'Bebidas', ingredientes: 'Montagem: limão espremido, destilado, açúcar, sabor e água com gás. Qualquer destilado com qualquer sabor; 900 ml +R$ 15; com whisky +R$ 10.',
      grupos: [{ t: 'Destilado', ops: [{ n: 'Rum', ab: 'RUM', mais: 0 }, { n: 'Gin', ab: 'GIN', mais: 0 }, { n: 'Vodka', ab: 'VODK', mais: 0 }, { n: '51', ab: '51', mais: 0 }, { n: 'Conhaque', ab: 'CONH', mais: 0 }, { n: 'Whisky', ab: 'WHIS', mais: 10 }] }, sab(), tam()] }, BAR),
    Object.assign({ cod: 106, nome: 'Jorge Amado', ab: 'JORGE', preco: 26, cat: 'Bebidas', ingredientes: 'Maracujá, cravo e canela, cachaça de jambu, açúcar e água com gás. 900 ml +R$ 15.', grupos: [tam()] }, BAR),
    Object.assign({ cod: 107, nome: 'Dose', ab: 'DOSE', preco: 10, cat: 'Bebidas', ingredientes: '51, vodka, rum ou conhaque R$ 10; gin ou cachaça de jambu R$ 15; whisky R$ 20.',
      grupos: [{ t: 'Destilado', ops: [{ n: '51', ab: '51', mais: 0 }, { n: 'Vodka', ab: 'VODK', mais: 0 }, { n: 'Rum', ab: 'RUM', mais: 0 }, { n: 'Conhaque', ab: 'CONH', mais: 0 }, { n: 'Gin', ab: 'GIN', mais: 5 }, { n: 'Cachaça de jambu', ab: 'JAMBU', mais: 5 }, { n: 'Whisky', ab: 'WHIS', mais: 10 }] }] }, BAR),
    Object.assign({ cod: 85, nome: 'Brownie e doce de leite', ab: '', preco: 28, cat: 'Sobremesas', ingredientes: 'Brownie, açaí, doce de leite, Ovomaltine e coco ralado.' }, BAR, { tipo: 'simples' }),
    Object.assign({ cod: 86, nome: 'Brownie e café', ab: '', preco: 28, cat: 'Sobremesas', ingredientes: 'Brownie, açaí, caramelo, cravo e canela + café.' }, BAR, { tipo: 'simples' }),
    Object.assign({ cod: 87, nome: 'As duas sobremesas', ab: '', preco: 50, cat: 'Sobremesas', ingredientes: 'Brownie e doce de leite + brownie e café. Separado R$ 56, economize R$ 6.' }, BAR, { tipo: 'simples' }),
    // Cardápio de Bebidas e Sobremesas A3 (JP, 24/11/2026): adicionais da sobremesa e combos do bar
    Object.assign({ cod: 88, nome: '+ Super brownie na sobremesa', ab: '+BROWNIE', preco: 10, cat: 'Sobremesas', ingredientes: 'Adicional na compra de uma sobremesa. Avulso R$ 13, economize R$ 3.' }, BAR, { tipo: 'simples' }),
    Object.assign({ cod: 89, nome: '+ Alfajor Atelier na sobremesa', ab: '+ALFAJOR', preco: 10, cat: 'Sobremesas', ingredientes: 'Adicional na compra de uma sobremesa. Avulso R$ 13, economize R$ 3.' }, BAR, { tipo: 'simples' }),
    Object.assign({ cod: 108, nome: 'Combo Verace', ab: '5x PILSEN', preco: 65, cat: 'Combos do bar', ingredientes: '5 Verace Pilsen de 600 ml. Separado R$ 75, economize R$ 10.' }, BAR),
    Object.assign({ cod: 109, nome: 'Dupla de 900 ml', ab: 'DUPLA 900', preco: 70, cat: 'Combos do bar', ingredientes: '2 drinks de 900 ml, iguais ou diferentes: Belorihills ou Jorge Amado (whisky + R$ 10 cada). No Belorihills, anote destilado e sabor. Separado R$ 76 a 82.',
      grupos: [{ t: 'Qual o 1º drink?', ops: [{ n: 'Belorihills', ab: 'BELO', mais: 0 }, { n: 'Jorge Amado', ab: 'JORGE', mais: 0 }] }, { t: 'Qual o 2º drink?', ops: [{ n: 'Belorihills', ab: 'BELO', mais: 0 }, { n: 'Jorge Amado', ab: 'JORGE', mais: 0 }] }, { t: 'Algum com whisky?', ops: [{ n: 'Nenhum', ab: '', mais: 0 }, { n: '1 com whisky', ab: 'WHIS', mais: 10 }, { n: '2 com whisky', ab: '2WHIS', mais: 20 }] }] }, BAR),
    Object.assign({ cod: 110, nome: 'Dupla de Belorihills', ab: 'DUPLA BELO', preco: 40, cat: 'Combos do bar', ingredientes: '2 Belorihills de 500 ml, cada um com o destilado e o sabor que quiser. Separado R$ 46, economize R$ 6.',
      grupos: [{ t: '1º Belorihills: qual destilado?', ops: DESTILADOS() }, { t: '1º Belorihills: qual sabor?', ops: SAB_SEM_MIX() }, { t: '2º Belorihills: qual destilado?', ops: DESTILADOS() }, { t: '2º Belorihills: qual sabor?', ops: SAB_SEM_MIX() }] }, BAR)
  ];
  // Ajustes de 24/11/2026 (cardápio de Bebidas e Sobremesas A3). Se a base já gravou a própria lista (config.extras),
  // o app aplica estes ajustes por cima dela até a próxima edição na base, que os grava de vez (app.js, aplicarAjustesExtras).
  // set: campos que mudam num item existente; novo: item que entra se ainda não houver o código.
  const EXTRAS_AJUSTES = [{ id: 'bebidas-a3-2026-11-24', set: { 91: ['nome', 'ingredientes'], 93: ['nome', 'ingredientes'], 107: ['ingredientes', 'grupos'], 85: ['ingredientes'], 86: ['ingredientes'], 87: ['ingredientes'] }, novo: [88, 89, 108, 109, 110] }];

  const QUESADILLAS = ['Bolonhesa', 'Shimeji Teriyaki'];
  const AB_QUESA = { Bolonhesa: 'QS', 'Shimeji Teriyaki': 'QD' };
  const DOCES = ['Super brownie', 'Alfajor Atelier'];
  // Acréscimo dos burguers mais caros nos combos 41 e 42: Bitrem +15, CTB +5. No 43 e no 44 eles não entram.
  const ACRESCIMO_COMBO_MESA = { 11: 15, 10: 5 };
  // Bebida do combo do burguer (v10, JP 24/11/2026: tudo por toque, vindo da lista da base). Padrão por código;
  // na base, cada bebida pode mudar em "Entra no combo do burguer como". Combo 30 = suco 500 ml ou refri 600 ml;
  // 31 = soda italiana; 32 = cerveja; 33 = qualquer drink da casa (cardápio A3 FINAL).
  const COMBO_BEBIDA = { 91: 'sucoRefri', 92: 'sucoRefri', 94: 'soda', 93: 'cerveja', 102: 'cerveja', 95: 'drink', 103: 'drink', 104: 'drink', 105: 'drink', 106: 'drink' };
  // Fotos dos produtos (JP, 24/11/2026: "com o tempo vamos colocar uma foto para cada produto"). Arquivo em fotos/<código>.jpg.
  const FOTOS = { 50: 'fotos/50.jpg' };

  return { itens, fixos: itens.slice(), EXTRAS, EXTRAS_AJUSTES, QUESADILLAS, AB_QUESA, DOCES, ACRESCIMO_COMBO_MESA, COMBO_BEBIDA, FOTOS };
})();
