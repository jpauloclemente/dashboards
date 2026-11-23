// Cardápio do sistema · Seu Trem (loja st1)
// Fonte: Cardápio Seu Trem A3 FINAL (21/11/2026) + códigos confirmados por JP em 23/11/2026.
// setor: 'cozinha' ou 'bar' (bar = bebidas, brownie e alfajor).
// chapa: o que entra na faixa de soma da TV (burguer, quesadilla, cogumelo).
window.CARDAPIO = (function () {
  const B = (cod, nome, preco, desc) => ({ cod, nome, preco, cat: 'Burguers', setor: 'cozinha', tipo: 'burguer', chapa: 'burguer', desc });
  const itens = [
    B(1, 'Trem Vegano', 35, 'Maionese verde, tomate, cebola roxa, mussarela veg, grão de bico, couve crispy'),
    B(2, 'Classic Surreal', 36, 'Maionese da casa, cebola caramelizada, picles, mussarela veg, soja'),
    B(3, 'Coguporó', 39, 'Maionese verde de ervas, alface, cebola roxa, grão de bico, mussarela, shimeji com alho-poró'),
    B(4, 'Tôsurreal', 39, 'Maionese da casa, cebola caramelizada, bacon de shitake, mussarela, soja, geleia de damasco'),
    B(5, 'Futurístico', 40, 'Maionese, cebola roxa, alface, tomate, picles, mussarela, 2 onion rings, barbecue, soja'),
    B(6, '3 Queijos', 41, 'Maionese defumada, cebola roxa, rúcula, mussarela, cheddar, cream cheese, grão de bico'),
    B(7, 'X-Bacon', 42, 'Maionese defumada, cebola roxa, picles, soja, cream cheese, bacon de shitake'),
    B(8, 'Circuito 2023', 42, 'Maionese da casa, rúcula, tomate-cereja, shimeji empanado'),
    B(9, 'X-Trem', 45, 'O mais completo: bacon de shitake, coguporó, 2 onion rings, barbecue, soja'),
    B(10, 'CTB', 47, 'Cheddar Trem Bacon: mostarda, rúcula, tomate-cereja, grão de bico, cheddar, bacon, 2 onion rings'),
    Object.assign(B(11, 'Bitrem 2.4', 55, 'Duas proteínas (soja + grão de bico), cream cheese 2x e tudo'), { discos: 2 }),

    { cod: 21, nome: 'Iscas de shimeji + fritas', preco: 59, cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo', chapa: 'cogumelo' },
    { cod: 22, nome: 'Fritas + bacon + cheddar', preco: 45, cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo' },
    { cod: 23, nome: 'Fritas + onion + coguporó', preco: 45, cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo',
      escolha: { titulo: 'Base', opcoes: ['Fritas', 'Onion rings', 'Meio a meio'] } },
    { cod: 24, nome: 'Shimentinha + fritas', preco: 37, cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo', chapa: 'cogumelo' },
    { cod: 25, nome: 'Fritas ou onions 400 g', preco: 35, cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo',
      escolha: { titulo: 'Qual?', opcoes: ['Fritas', 'Onions', 'Mix'] } },
    { cod: 26, nome: 'Quesadilla Bolonhesa + fritas', preco: 37, cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo', chapa: 'quesadilla' },
    { cod: 27, nome: 'Quesadilla Shimeji Teriyaki + fritas', preco: 37, cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo', chapa: 'quesadilla' },
    { cod: 28, nome: 'Espetinho + fritas', preco: 35, cat: 'Aperitivos', setor: 'cozinha', tipo: 'aperitivo', chapa: 'cogumelo', espeto: true },

    // Combo do burguer: abre a escolha do burguer + o que vem no combo
    { cod: 30, nome: 'Combo: fritas + doce + suco/refri', preco: 28, cat: 'Combo do burguer', setor: 'cozinha', tipo: 'comboBurguer', bebida: 'sucoRefri' },
    { cod: 31, nome: 'Combo com soda italiana', preco: 30, cat: 'Combo do burguer', setor: 'cozinha', tipo: 'comboBurguer', bebida: 'soda' },
    { cod: 32, nome: 'Combo com cerveja', preco: 36, cat: 'Combo do burguer', setor: 'cozinha', tipo: 'comboBurguer', bebida: 'cerveja' },
    { cod: 33, nome: 'Combo com drink da casa', preco: 37, cat: 'Combo do burguer', setor: 'cozinha', tipo: 'comboBurguer', bebida: 'drink' },

    // Combos da mesa
    { cod: 41, nome: 'Burguer + quesadilla', preco: 60, cat: 'Combos da mesa', setor: 'cozinha', tipo: 'comboMesa',
      partes: [{ t: 'burguer' }, { t: 'quesadilla' }] },
    { cod: 42, nome: 'Burguer + quesadilla + espeto', preco: 75, cat: 'Combos da mesa', setor: 'cozinha', tipo: 'comboMesa',
      partes: [{ t: 'burguer' }, { t: 'quesadilla' }, { t: 'espeto' }] },
    // semPremium: Bitrem 2.4 e CTB não entram (JP, 23/11/2026)
    { cod: 43, nome: 'Combo Família', preco: 160, cat: 'Combos da mesa', setor: 'cozinha', tipo: 'comboMesa', semPremium: true,
      partes: [{ t: 'burguer' }, { t: 'burguer' }, { t: 'quesadilla' }, { t: 'quesadilla' }, { t: 'espeto' }, { t: 'espeto' }, { t: 'sobremesaFamilia' }] },
    { cod: 44, nome: '+ burguer (combo da mesa)', preco: 38, cat: 'Combos da mesa', setor: 'cozinha', tipo: 'comboMesa', semPremium: true, partes: [{ t: 'burguer' }] },
    { cod: 45, nome: '+ quesadilla (combo da mesa)', preco: 20, cat: 'Combos da mesa', setor: 'cozinha', tipo: 'comboMesa', partes: [{ t: 'quesadilla' }] },
    { cod: 46, nome: '+ espeto (combo da mesa)', preco: 15, cat: 'Combos da mesa', setor: 'cozinha', tipo: 'comboMesa', partes: [{ t: 'espeto' }] },

    // Circuito 2026
    { cod: 50, nome: 'Combo Circuito 2026', preco: 79.9, cat: 'Circuito 2026', setor: 'cozinha', tipo: 'comboFixo',
      fixas: [
        { nome: 'Filezinhos acebolados + fritas (M)', setor: 'cozinha', chapa: 'cogumelo' },
        { nome: 'Burguer Circuito 26', setor: 'cozinha', chapa: 'burguer', burguer: true },
        { nome: 'Sobremesa Leite cond. & Ovomaltine', setor: 'bar' }
      ] },
    { cod: 51, nome: 'Filezinhos acebolados + fritas (G)', preco: 49.9, cat: 'Circuito 2026', setor: 'cozinha', tipo: 'aperitivo', chapa: 'cogumelo' },
    { cod: 52, nome: 'Burguer Circuito 26', preco: 41.9, cat: 'Circuito 2026', setor: 'cozinha', tipo: 'burguer', chapa: 'burguer' },
    { cod: 53, nome: 'Sobremesa Leite cond. & Ovomaltine', preco: 25, cat: 'Circuito 2026', setor: 'bar', tipo: 'simples' },

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
    { cod: 81, nome: 'Fritas (acompanha)', preco: 13, cat: 'Acompanhamentos e sobremesas', setor: 'cozinha', tipo: 'simples' },
    { cod: 82, nome: 'Onions (acompanha)', preco: 13, cat: 'Acompanhamentos e sobremesas', setor: 'cozinha', tipo: 'simples' },
    { cod: 83, nome: 'Super brownie', preco: 13, cat: 'Acompanhamentos e sobremesas', setor: 'bar', tipo: 'simples' },
    { cod: 84, nome: 'Alfajor Atelier', preco: 13, cat: 'Acompanhamentos e sobremesas', setor: 'bar', tipo: 'simples' },

    // Bebidas (o sabor/nome vai na observação até o cardápio de bebidas A3 ficar pronto)
    { cod: 91, nome: 'Suco 500 ml', preco: 11, cat: 'Bebidas', setor: 'bar', tipo: 'bebida', pedeSabor: 'Sabor' },
    { cod: 92, nome: 'Refrigerante 600 ml', preco: 11, cat: 'Bebidas', setor: 'bar', tipo: 'bebida', pedeSabor: 'Qual refri' },
    { cod: 93, nome: 'Cerveja', preco: 15, cat: 'Bebidas', setor: 'bar', tipo: 'bebida', pedeSabor: 'Qual cerveja' },
    { cod: 94, nome: 'Soda italiana', preco: 16, cat: 'Bebidas', setor: 'bar', tipo: 'bebida', pedeSabor: 'Sabor' },
    { cod: 95, nome: 'Drink da casa', preco: 0, cat: 'Bebidas', setor: 'bar', tipo: 'bebida', pedeSabor: 'Qual drink', precoLivre: [17, 30] }
  ];

  const QUESADILLAS = ['Bolonhesa', 'Shimeji Teriyaki'];
  const DOCES = ['Super brownie', 'Alfajor Atelier'];
  // Acréscimo dos burguers mais caros nos combos 41 e 42: Bitrem +15, CTB +5. No 43 e no 44 eles não entram.
  const ACRESCIMO_COMBO_MESA = { 11: 15, 10: 5 };

  return { itens, QUESADILLAS, DOCES, ACRESCIMO_COMBO_MESA };
})();
