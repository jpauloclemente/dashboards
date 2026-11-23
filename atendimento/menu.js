// Cardápio do sistema · Seu Trem (loja st1)
// Fonte: Cardápio Seu Trem A3 FINAL (21/11/2026) + códigos confirmados por JP em 23/11/2026.
// setor: 'cozinha' ou 'bar' (bar = bebidas, brownie e alfajor).
// chapa: o que entra na faixa de soma da TV (burguer, quesadilla, cogumelo).
window.CARDAPIO = (function () {
  const B = (cod, nome, preco, desc) => ({ cod, nome, preco, cat: 'Burguers', setor: 'cozinha', tipo: 'burguer', chapa: 'burguer', desc });
  const itens = [
    B(1, 'Trem Vegano', 35, 'Maionese verde cremosa, tomate, cebola roxa, mussarela veg especial, proteína de grão de bico artesanal e couve crispy.'),
    B(2, 'Classic Surreal', 36, 'Maionese da casa, cebola caramelizada, picles especial, mussarela veg especial e proteína de soja artesanal.'),
    B(3, 'Coguporó', 39, 'Maionese verde de ervas, alface, cebola roxa, proteína de grão de bico artesanal coberta com mussarela veg especial e cogumelos shimeji salteados com alho-poró.'),
    B(4, 'Tôsurreal', 39, 'Maionese da casa, cebola caramelizada, bacon de shitake defumado e frito, mussarela veg especial, proteína de soja artesanal e geleia de damasco.'),
    B(5, 'Futurístico', 40, 'Maionese da casa, cebola roxa, alface, tomate, picles, mussarela veg especial, 2 onion rings crocantes, barbecue e proteína de soja artesanal.'),
    B(6, '3 Queijos', 41, 'Maionese defumada, cebola roxa, rúcula, mussarela veg especial, cheddar cremoso, cream cheese de castanha de caju e proteína de grão de bico artesanal.'),
    B(7, 'X-Bacon', 42, 'Maionese defumada, cebola roxa, picles, proteína de soja artesanal, cream cheese especial e coberto com bacon de shitake defumado e frito.'),
    B(8, 'Circuito 2023', 42, 'Maionese da casa, rúcula e tomate-cereja, recheado com cogumelos shimeji empanados e fritos, bem crocantes. Sucesso no circuito vegano de 2023.'),
    B(9, 'X-Trem', 45, 'Maionese da casa, alface, tomate, picles, cebola roxa, cebola caramelizada, couve crispy, bacon de shitake, coguporó, proteína de soja artesanal, mussarela veg especial, 2 onion rings e barbecue.'),
    B(10, 'CTB', 47, 'Cheddar Trem Bacon: mostarda sem mel, rúcula e tomate-cereja, proteína de grão de bico artesanal, cheddar cremoso veg coberto com bacon de shitake, finalizado com 2 onion rings.'),
    Object.assign(B(11, 'Bitrem 2.4', 55, 'Duas proteínas: soja artesanal com cream cheese e couve crispy e, por cima, grão de bico artesanal com mais cream cheese. Maionese da casa e barbecue, alface, tomate-cereja, cebola roxa, picles, rúcula, cebola caramelizada, coguporó, bacon de shitake e 2 onion rings.'), { discos: 2 }),

    { cod: 21, nome: 'Iscas de shimeji + fritas', preco: 59, desc: '200 g de shimeji empanado com 200 g de fritas. Crocante!', cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo', chapa: 'cogumelo' },
    { cod: 22, nome: 'Fritas + bacon + cheddar', preco: 45, desc: '300 g de fritas com cheddar veg e bacon de shitake defumado e frito.', cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo' },
    { cod: 23, nome: 'Fritas + onion + coguporó', preco: 45, desc: '300 g de fritas ou onion rings (meio a meio também rola) com coguporó: shimeji salteado com alho-poró.', cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo',
      escolha: { titulo: 'Base', opcoes: ['Fritas', 'Onion rings', 'Meio a meio'] } },
    { cod: 24, nome: 'Shimentinha + fritas', preco: 37, desc: '150 g de shimeji temperado e frito, com 300 g de fritas e farofinha especial.', cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo', chapa: 'cogumelo' },
    { cod: 25, nome: 'Fritas ou onions 400 g', preco: 35, desc: '400 g de fritas ou de onion rings. Se preferir, fazemos um mix.', cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo',
      escolha: { titulo: 'Qual?', opcoes: ['Fritas', 'Onions', 'Mix'] } },
    { cod: 26, nome: 'Quesadilla Bolonhesa + fritas', preco: 37, desc: '4 fatias. Molho de tomate especial, soja moída, salsinha, cebolinha, pimentão e alho torrado. Com fritas.', cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo', chapa: 'quesadilla' },
    { cod: 27, nome: 'Quesadilla Shimeji Teriyaki + fritas', preco: 37, desc: '4 fatias. Shimentinha (shimeji com páprica e lemon pepper), cebola roxa, tomate-cereja, rúcula e molho teriyaki. Com fritas.', cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo', chapa: 'quesadilla' },
    { cod: 28, nome: 'Espetinho + fritas', preco: 35, desc: 'Iscas de shimeji empanadas e tomate seco no espeto, com fritas. No espeto: 3 adicionais por R$ 10.', cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo', chapa: 'cogumelo', espeto: true },

    // Combo do burguer: abre a escolha do burguer + o que vem no combo
    { cod: 30, nome: 'Combo: fritas + doce + suco/refri', preco: 28, desc: 'Escolha o burguer e leve junto fritas + super brownie ou alfajor da Atelier + suco 500 ml ou refri 600 ml.', economia: 'Separado R$ 37 · economize R$ 9', cat: 'Combo do burguer', setor: 'cozinha', tipo: 'comboBurguer', bebida: 'sucoRefri' },
    { cod: 31, nome: 'Combo com soda italiana', preco: 30, desc: 'Escolha o burguer e leve junto fritas + brownie ou alfajor + soda italiana.', economia: 'Separado R$ 42 · economize R$ 12', cat: 'Combo do burguer', setor: 'cozinha', tipo: 'comboBurguer', bebida: 'soda' },
    { cod: 32, nome: 'Combo com cerveja', preco: 36, desc: 'Escolha o burguer e leve junto fritas + brownie ou alfajor + cerveja.', economia: 'Separado R$ 41 · economize R$ 5', cat: 'Combo do burguer', setor: 'cozinha', tipo: 'comboBurguer', bebida: 'cerveja' },
    { cod: 33, nome: 'Combo com drink da casa', preco: 37, desc: 'Escolha o burguer e leve junto fritas + brownie ou alfajor + qualquer drink da casa.', economia: 'Separado R$ 43 a 56 · economize até R$ 19', cat: 'Combo do burguer', setor: 'cozinha', tipo: 'comboBurguer', bebida: 'drink' },

    // Combos da mesa
    { cod: 41, nome: 'Burguer + quesadilla', preco: 60, desc: 'Qualquer burguer do cardápio + 1 quesadilla de 4 fatias (sem fritas). Com o Bitrem 2.4, R$ 75; com o CTB, R$ 65.', cat: 'Combos da mesa', setor: 'cozinha', tipo: 'comboMesa',
      partes: [{ t: 'burguer' }, { t: 'quesadilla' }] },
    { cod: 42, nome: 'Burguer + quesadilla + espeto', preco: 75, desc: 'Burguer + quesadilla de 4 fatias + espetinho de shimeji e tomate seco (sem fritas). Com o Bitrem 2.4, R$ 90; com o CTB, R$ 80.', cat: 'Combos da mesa', setor: 'cozinha', tipo: 'comboMesa',
      partes: [{ t: 'burguer' }, { t: 'quesadilla' }, { t: 'espeto' }] },
    // semPremium: Bitrem 2.4 e CTB não entram (JP, 23/11/2026)
    { cod: 43, nome: 'Combo Família', preco: 160, desc: '2 burguers, 2 quesadillas, 2 espetos e 1 sobremesa brownie & açaí. R$ 40 por pessoa numa mesa de 4.', cat: 'Combos da mesa', setor: 'cozinha', tipo: 'comboMesa', semPremium: true,
      partes: [{ t: 'burguer' }, { t: 'burguer' }, { t: 'quesadilla' }, { t: 'quesadilla' }, { t: 'espeto' }, { t: 'espeto' }, { t: 'sobremesaFamilia' }] },
    { cod: 44, nome: '+ burguer (combo da mesa)', preco: 38, cat: 'Combos da mesa', setor: 'cozinha', tipo: 'comboMesa', semPremium: true, partes: [{ t: 'burguer' }] },
    { cod: 45, nome: '+ quesadilla (combo da mesa)', preco: 20, cat: 'Combos da mesa', setor: 'cozinha', tipo: 'comboMesa', partes: [{ t: 'quesadilla' }] },
    { cod: 46, nome: '+ espeto (combo da mesa)', preco: 15, cat: 'Combos da mesa', setor: 'cozinha', tipo: 'comboMesa', partes: [{ t: 'espeto' }] },

    // Circuito 2026
    { cod: 50, nome: 'Combo Circuito 2026', preco: 79.9, selo: 'Lançamento', desc: 'Filezinhos acebolados com fritas (porção M) + Burguer Circuito 26 + sobremesa Leite condensado & Ovomaltine.', economia: 'Separado R$ 116,70 · economize R$ 36,80', cat: 'Circuito 2026', setor: 'cozinha', tipo: 'comboFixo',
      fixas: [
        { nome: 'Filezinhos acebolados + fritas (M)', setor: 'cozinha', chapa: 'cogumelo' },
        { nome: 'Burguer Circuito 26', setor: 'cozinha', chapa: 'burguer', burguer: true },
        { nome: 'Sobremesa Leite cond. & Ovomaltine', setor: 'bar' }
      ] },
    { cod: 51, nome: 'Filezinhos acebolados + fritas (G)', preco: 49.9, selo: 'Lançamento', desc: 'Shimeji acebolado ao tempero do chef, servido com fritas. Porção G.', cat: 'Circuito 2026', setor: 'cozinha', tipo: 'aperitivo', chapa: 'cogumelo' },
    { cod: 52, nome: 'Burguer Circuito 26', preco: 41.9, selo: 'Lançamento', desc: 'Molho branco, couve crispy, cebola roxa, iscas de shimeji empanadas, cream cheese e shimeji acebolado finalizado ao vinho branco.', cat: 'Circuito 2026', setor: 'cozinha', tipo: 'burguer', chapa: 'burguer' },
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
    { cod: 81, nome: 'Fritas (acompanha)', preco: 13, desc: 'Porção de fritas para acompanhar.', cat: 'Acompanhamentos e sobremesas', setor: 'cozinha', tipo: 'simples' },
    { cod: 82, nome: 'Onions (acompanha)', preco: 13, desc: 'Porção de onion rings para acompanhar.', cat: 'Acompanhamentos e sobremesas', setor: 'cozinha', tipo: 'simples' },
    { cod: 83, nome: 'Super brownie', preco: 13, desc: 'O nosso super brownie.', cat: 'Acompanhamentos e sobremesas', setor: 'bar', tipo: 'simples' },
    { cod: 84, nome: 'Alfajor Atelier', preco: 13, desc: 'Alfajor da Atelier Gourmet.', cat: 'Acompanhamentos e sobremesas', setor: 'bar', tipo: 'simples' },

    // Bebidas (o sabor/nome vai na observação até o cardápio de bebidas A3 ficar pronto)
    { cod: 91, nome: 'Suco 500 ml', preco: 11, desc: 'Suco de 500 ml. Escolha o sabor.', cat: 'Bebidas', setor: 'bar', tipo: 'bebida', pedeSabor: 'Sabor' },
    { cod: 92, nome: 'Refrigerante 600 ml', preco: 11, desc: 'Refrigerante de 600 ml.', cat: 'Bebidas', setor: 'bar', tipo: 'bebida', pedeSabor: 'Qual refri' },
    { cod: 93, nome: 'Cerveja', preco: 15, desc: 'Diga qual cerveja você quer.', cat: 'Bebidas', setor: 'bar', tipo: 'bebida', pedeSabor: 'Qual cerveja' },
    { cod: 94, nome: 'Soda italiana', preco: 16, desc: 'Escolha o sabor.', cat: 'Bebidas', setor: 'bar', tipo: 'bebida', pedeSabor: 'Sabor' },
    { cod: 95, nome: 'Drink da casa', preco: 0, desc: 'Os drinks da casa, de R$ 17 a R$ 30. Diga qual você quer.', cat: 'Bebidas', setor: 'bar', tipo: 'bebida', pedeSabor: 'Qual drink', precoLivre: [17, 30] }
  ];

  const QUESADILLAS = ['Bolonhesa', 'Shimeji Teriyaki'];
  const DOCES = ['Super brownie', 'Alfajor Atelier'];
  // Acréscimo dos burguers mais caros nos combos 41 e 42: Bitrem +15, CTB +5. No 43 e no 44 eles não entram.
  const ACRESCIMO_COMBO_MESA = { 11: 15, 10: 5 };

  return { itens, QUESADILLAS, DOCES, ACRESCIMO_COMBO_MESA };
})();
