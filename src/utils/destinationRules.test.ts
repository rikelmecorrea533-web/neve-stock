import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDestination,
  detectMaterialType,
  resolveItemType,
  getDifferenceDestination,
  sortItemsBySectionAndNart,
  OFFICIAL_NEVE_MAP,
  OFFICIAL_NEVE_FABRICS_TABLE,
} from './destinationRules';
import {
  parseBrazilianNumber,
  detectColumnsHeuristic,
  buildPreviewRowsFromMapping,
  preserveLotAsString,
} from './excelService';

test('Regra de Detecção por Descrição: Tem CAMPO = CAMPO; Não tem CAMPO = COMPRESSA', () => {
  assert.equal(detectMaterialType('CAMPO CIRURGICO SIMPLES 50X50'), 'CAMPO');
  assert.equal(detectMaterialType('TECIDO CROCHE CAMPO 34CM INA'), 'CAMPO');
  assert.equal(detectMaterialType('TECIDO CROCHE CAMPO 50CM'), 'CAMPO');
  assert.equal(detectMaterialType('TECIDO CROCHE CAMPO 20CM ALVEJADO'), 'CAMPO');

  // Sem a palavra CAMPO -> COMPRESSA
  assert.equal(detectMaterialType('TECIDO CROCHE 7,5CM VISCOSE RX INA'), 'COMPRESSA');
  assert.equal(detectMaterialType('TECIDO CROCHE 7,5CM VISCOSE'), 'COMPRESSA');
  assert.equal(detectMaterialType('TECIDO CROCHE 7,5CM 13 FIOS INA'), 'COMPRESSA');
  assert.equal(detectMaterialType('TECIDO CROCHE 7,5CM 09 FIOS INA'), 'COMPRESSA');
  assert.equal(detectMaterialType('TECIDO CROCHE 7,5CM 11 FIOS INA'), 'COMPRESSA');
  assert.equal(detectMaterialType('TECIDO CROCHE 7,5CM ALVEJADO'), 'COMPRESSA');
  assert.equal(detectMaterialType('TECIDO CROCHE 10CM ALVEJADO'), 'COMPRESSA');
  assert.equal(detectMaterialType('TECIDO CROCHE 10CM RX ALVEJADO'), 'COMPRESSA');
  assert.equal(detectMaterialType('TECIDO CROCHE 7,5CM RX ALVEJADO'), 'COMPRESSA');
  assert.equal(detectMaterialType('TECIDO CROCHE 7,5CM 11 FIOS ALVEJADO'), 'COMPRESSA');
  assert.equal(detectMaterialType('TECIDO CROCHE 5CM ALVEJADO'), 'COMPRESSA');

  // Vazio -> REVISAR
  assert.equal(detectMaterialType(''), 'REVISAR');
  assert.equal(detectMaterialType('   '), 'REVISAR');
});

test('Busca NART no Catálogo Oficial (13 tecidos) tem precedência sobre descrição', () => {
  // Mesmo se a descrição vier trocada, prevalece a tabela oficial do NART
  const res1 = resolveItemType('79092-50040-01', 'DESCRICAO QUALQUER');
  assert.equal(res1.type, 'CAMPO');
  assert.equal(res1.fromCatalog, true);
  assert.equal(res1.destIfMatches, 'ARMAZÉM 01');
  assert.equal(res1.destIfDifferenceOrNotFound, 'ARMAZÉM 04');

  const res2 = resolveItemType('79092-50119-00', 'QUALQUER TEXTO');
  assert.equal(res2.type, 'COMPRESSA');
  assert.equal(res2.fromCatalog, true);
  assert.equal(res2.destIfMatches, 'ARMAZÉM 01');
  assert.equal(res2.destIfDifferenceOrNotFound, 'ARMAZÉM 06');
});

test('1. Teste Mandatório: 79092-50040-01, sistema 500, físico 500 -> 500 no 01', () => {
  const item = resolveItemType('79092-50040-01');
  assert.equal(item.type, 'CAMPO');

  const result = computeDestination(500, true, 500, item.type);
  assert.equal(result.status, 'CONFERIDO');
  assert.equal(result.difference, 0);
  assert.equal(result.allocations.length, 1);
  assert.equal(result.allocations[0].warehouse, 'ARMAZÉM 01');
  assert.equal(result.allocations[0].quantity, 500);
  assert.equal(result.summaryText, '500,00 kg vai para o ARMAZÉM 01.');
});

test('2. Teste Mandatório: 79092-50040-01, sistema 500, físico 450 -> 450 no 01 e 50 no 04', () => {
  const item = resolveItemType('79092-50040-01');
  assert.equal(item.type, 'CAMPO');

  const result = computeDestination(500, true, 450, item.type);
  assert.equal(result.status, 'CONFERIDO');
  assert.equal(result.difference, -50);
  const arm01 = result.allocations.find((a) => a.warehouse === 'ARMAZÉM 01');
  const arm04 = result.allocations.find((a) => a.warehouse === 'ARMAZÉM 04');
  assert.ok(arm01, 'Deve conter alocação para ARMAZÉM 01');
  assert.ok(arm04, 'Deve conter alocação para ARMAZÉM 04');
  assert.equal(arm01.quantity, 450);
  assert.equal(arm04.quantity, 50);
  assert.equal(result.summaryText, '450,00 kg vai para o ARMAZÉM 01 e 50,00 kg vai para o ARMAZÉM 04.');
});

test('3. Teste Mandatório: 79092-50223-00, não encontrado, saldo 4 -> 4 no 04', () => {
  const item = resolveItemType('79092-50223-00');
  assert.equal(item.type, 'CAMPO');

  const result = computeDestination(4, false, 0, item.type);
  assert.equal(result.status, 'NAO_ENCONTRADO');
  assert.equal(result.difference, -4);
  assert.equal(result.allocations.length, 1);
  assert.equal(result.allocations[0].warehouse, 'ARMAZÉM 04');
  assert.equal(result.allocations[0].quantity, 4);
  assert.equal(result.summaryText, '4,00 kg vai para o ARMAZÉM 04.');
});

test('4. Teste Mandatório: 79092-50222-00, sistema 800, físico 700 -> 700 no 01 e 100 no 06', () => {
  const item = resolveItemType('79092-50222-00');
  assert.equal(item.type, 'COMPRESSA');

  const result = computeDestination(800, true, 700, item.type);
  assert.equal(result.status, 'CONFERIDO');
  assert.equal(result.difference, -100);
  const arm01 = result.allocations.find((a) => a.warehouse === 'ARMAZÉM 01');
  const arm06 = result.allocations.find((a) => a.warehouse === 'ARMAZÉM 06');
  assert.ok(arm01, 'Deve conter alocação para ARMAZÉM 01');
  assert.ok(arm06, 'Deve conter alocação para ARMAZÉM 06');
  assert.equal(arm01.quantity, 700);
  assert.equal(arm06.quantity, 100);
  assert.equal(result.summaryText, '700,00 kg vai para o ARMAZÉM 01 e 100,00 kg vai para o ARMAZÉM 06.');
});

test('5. Teste Mandatório: 79092-50220-00, sistema 1200, físico 1200 -> 1200 no 01', () => {
  const item = resolveItemType('79092-50220-00');
  assert.equal(item.type, 'COMPRESSA');

  const result = computeDestination(1200, true, 1200, item.type);
  assert.equal(result.status, 'CONFERIDO');
  assert.equal(result.difference, 0);
  assert.equal(result.allocations.length, 1);
  assert.equal(result.allocations[0].warehouse, 'ARMAZÉM 01');
  assert.equal(result.allocations[0].quantity, 1200);
  assert.equal(result.summaryText, '1.200,00 kg vai para o ARMAZÉM 01.');
});

test('6. Teste Mandatório: 79092-50119-01, não encontrado -> tudo no 06', () => {
  const item = resolveItemType('79092-50119-01');
  assert.equal(item.type, 'COMPRESSA');

  const result = computeDestination(600, false, 0, item.type);
  assert.equal(result.status, 'NAO_ENCONTRADO');
  assert.equal(result.difference, -600);
  assert.equal(result.allocations.length, 1);
  assert.equal(result.allocations[0].warehouse, 'ARMAZÉM 06');
  assert.equal(result.allocations[0].quantity, 600);
  assert.equal(result.summaryText, '600,00 kg vai para o ARMAZÉM 06.');
});

test('7. Teste Mandatório: Código novo com descrição "TECIDO CROCHE CAMPO 50CM" -> CAMPO, diferença no 04', () => {
  const resolved = resolveItemType('99999-00001-00', 'TECIDO CROCHE CAMPO 50CM');
  assert.equal(resolved.isNewCode, true);
  assert.equal(resolved.type, 'CAMPO');
  assert.equal(resolved.destIfDifferenceOrNotFound, 'ARMAZÉM 04');
  assert.equal(resolved.needsConfirmation, false); // Não pede para o operador escolher tipo!

  // Se faltar material: físico 400, sistema 500 -> 400 no 01 e 100 no 04
  const resultDiff = computeDestination(500, true, 400, resolved.type);
  assert.equal(resultDiff.difference, -100);
  const arm04 = resultDiff.allocations.find((a) => a.warehouse === 'ARMAZÉM 04');
  assert.ok(arm04);
  assert.equal(arm04.quantity, 100);

  // Se não encontrado: tudo no 04
  const resultNotFound = computeDestination(500, false, 0, resolved.type);
  assert.equal(resultNotFound.allocations[0].warehouse, 'ARMAZÉM 04');
  assert.equal(resultNotFound.allocations[0].quantity, 500);
});

test('8. Teste Mandatório: Código novo com descrição "TECIDO CROCHE 5CM ALVEJADO" -> COMPRESSA, diferença no 06', () => {
  const resolved = resolveItemType('99999-00002-00', 'TECIDO CROCHE 5CM ALVEJADO');
  assert.equal(resolved.isNewCode, true);
  assert.equal(resolved.type, 'COMPRESSA');
  assert.equal(resolved.destIfDifferenceOrNotFound, 'ARMAZÉM 06');
  assert.equal(resolved.needsConfirmation, false); // Não pede para o operador escolher tipo!

  // Se faltar material: físico 300, sistema 350 -> 300 no 01 e 50 no 06
  const resultDiff = computeDestination(350, true, 300, resolved.type);
  assert.equal(resultDiff.difference, -50);
  const arm06 = resultDiff.allocations.find((a) => a.warehouse === 'ARMAZÉM 06');
  assert.ok(arm06);
  assert.equal(arm06.quantity, 50);

  // Se não encontrado: tudo no 06
  const resultNotFound = computeDestination(350, false, 0, resolved.type);
  assert.equal(resultNotFound.allocations[0].warehouse, 'ARMAZÉM 06');
  assert.equal(resultNotFound.allocations[0].quantity, 350);
});

test('Código novo sem descrição: marca código novo e pede descrição (uma vez)', () => {
  const resolved = resolveItemType('99999-99999-99', '');
  assert.equal(resolved.isNewCode, true);
  assert.equal(resolved.needsDescription, true);
  assert.equal(resolved.needsConfirmation, true);
});

test('Regra de Ouro: Nunca mandar para o 04 ou 06 um item que bateu 100%', () => {
  const resCampo = computeDestination(100, true, 100, 'CAMPO');
  assert.equal(resCampo.allocations.some((a) => a.warehouse === 'ARMAZÉM 04' || a.warehouse === 'ARMAZÉM 06'), false);

  const resCompressa = computeDestination(250, true, 250, 'COMPRESSA');
  assert.equal(resCompressa.allocations.some((a) => a.warehouse === 'ARMAZÉM 04' || a.warehouse === 'ARMAZÉM 06'), false);
});

test('Conversão de Números: Padrão Brasileiro e Internacional', () => {
  assert.equal(parseBrazilianNumber('423,86'), 423.86);
  assert.equal(parseBrazilianNumber('208,34'), 208.34);
  assert.equal(parseBrazilianNumber('1.200'), 1200);
  assert.equal(parseBrazilianNumber('1.200,50'), 1200.5);
  assert.equal(parseBrazilianNumber('7,427.18'), 7427.18);
  assert.equal(parseBrazilianNumber(500), 500);
  assert.equal(parseBrazilianNumber(null), 0);
});

test('Detecção de Colunas: Uma coluna com a palavra Saldo NUNCA é Lote', () => {
  // Cenário 1: "Saldo Lote" antes de "Lote"
  const m1 = detectColumnsHeuristic(['Produto', 'Saldo Lote', 'Lote']);
  assert.equal(m1.nartColumn, 'Produto');
  assert.equal(m1.qtyColumn, 'Saldo Lote');
  assert.equal(m1.lotColumn, 'Lote');
  assert.notEqual(m1.lotColumn, 'Saldo Lote', 'Lote nunca pode ser a coluna com a palavra Saldo');

  // Cenário 2: "Lote" antes de "Saldo Lote"
  const m2 = detectColumnsHeuristic(['Produto', 'Lote', 'Saldo Lote']);
  assert.equal(m2.nartColumn, 'Produto');
  assert.equal(m2.qtyColumn, 'Saldo Lote');
  assert.equal(m2.lotColumn, 'Lote');

  // Cenário 3: "Cadastro", "Saldo", "Lote"
  const m3 = detectColumnsHeuristic(['Cadastro', 'Saldo', 'Lote']);
  assert.equal(m3.nartColumn, 'Cadastro');
  assert.equal(m3.qtyColumn, 'Saldo');
  assert.equal(m3.lotColumn, 'Lote');

  // Cenário 4: "Código", "Lote/Serie", "Saldo do Lote"
  const m4 = detectColumnsHeuristic(['Código', 'Lote/Serie', 'Saldo do Lote']);
  assert.equal(m4.nartColumn, 'Código');
  assert.equal(m4.qtyColumn, 'Saldo do Lote');
  assert.equal(m4.lotColumn, 'Lote/Serie');
});

test('Teste Mandatório da Planilha Real: 79092-50118-00 -> Saldo 208,34 e Lote 2611010107', () => {
  const headers = ['Produto', 'Saldo Lote', 'Lote'];
  const mapping = detectColumnsHeuristic(headers);

  assert.equal(mapping.qtyColumn, 'Saldo Lote');
  assert.equal(mapping.lotColumn, 'Lote');

  const rawMatrix = [
    headers,
    ['79092-50118-00', '208,34', '2611010107'],
  ];

  const result = buildPreviewRowsFromMapping(rawMatrix, mapping, []);
  assert.equal(result.rows.length, 1);

  const row = result.rows[0];
  assert.equal(row.nart, '79092-50118-00');
  assert.equal(row.lot, '2611010107', 'Lote deve ser 2611010107 e NUNCA 20834 ou 208,34');
  assert.equal(row.systemQty, 208.34, 'Saldo deve ser 208.34 e NUNCA 20834 ou 20.834 ou lote');
  assert.equal(row.type, 'COMPRESSA', '79092-50118-00 é COMPRESSA no catálogo oficial Neve Medical');
});

test('Conferência Automática: Inversão acidental de Lote e Saldo é restaurada da célula original', () => {
  // Simulando que o mapeamento trocou as colunas: Lote apontando para '208,34' e Saldo apontando para '2611010107'
  const headers = ['Produto', 'ColunaA', 'ColunaB'];
  const invertedMapping = {
    nartColumn: 'Produto',
    lotColumn: 'ColunaA', // Contém '208,34'
    qtyColumn: 'ColunaB', // Contém '2611010107'
    method: 'manual' as const,
  };

  const rawMatrix = [
    headers,
    ['79092-50118-00', '208,34', '2611010107'],
  ];

  const result = buildPreviewRowsFromMapping(rawMatrix, invertedMapping, []);
  assert.equal(result.rows.length, 1);

  const row = result.rows[0];
  assert.equal(row.nart, '79092-50118-00');
  assert.equal(row.lot, '2611010107', 'Conferência automática deve restaurar lote como texto do lote');
  assert.equal(row.systemQty, 208.34, 'Conferência automática deve restaurar saldo com vírgula decimal');
  assert.ok(row.auditNotice && row.auditNotice.includes('Conferência automática'));
});

test('12. Teste Obrigatório Completo da Atualização: Planilha Real com 7 tecidos (Normais e Alvejados)', () => {
  // Planilha real de entrada (com ordem mista para testar ordenação e alvejados embaixo):
  const headers = ['Produto', 'Armazem', 'Saldo Lote', 'Lote'];
  const rawMatrix = [
    headers,
    ['79092-50223-00', '12', '1.525,20', '3782 ao 3789'], // Alvejado (CAMPO)
    ['79092-50118-00', '12', '208,34', '2611010107'],       // Não alvejado (COMPRESSA)
    ['79092-50228-00', '12', '419,40', '11491'],            // Alvejado (COMPRESSA)
    ['79092-50040-01', '12', '370,76', '2611010111'],       // Não alvejado (CAMPO)
    ['79092-50119-11', '12', '201,22', '2611010109'],       // Não alvejado (COMPRESSA)
    ['79092-50220-00', '12', '237,75', '2611010096'],       // Alvejado (COMPRESSA)
    ['79092-50119-01', '12', '280,22', '2611010108'],       // Não alvejado (COMPRESSA)
  ];

  const mapping = detectColumnsHeuristic(headers);
  assert.equal(mapping.nartColumn, 'Produto');
  assert.equal(mapping.qtyColumn, 'Saldo Lote');
  assert.equal(mapping.lotColumn, 'Lote');

  const { rows } = buildPreviewRowsFromMapping(rawMatrix, mapping, []);
  assert.equal(rows.length, 7);

  // 1. Quantidades exatas convertidas com 2 casas decimais
  const findByNart = (code: string) => rows.find((r) => r.nart === code)!;
  assert.equal(findByNart('79092-50040-01').systemQty, 370.76);
  assert.equal(findByNart('79092-50118-00').systemQty, 208.34);
  assert.equal(findByNart('79092-50119-01').systemQty, 280.22);
  assert.equal(findByNart('79092-50119-11').systemQty, 201.22);
  assert.equal(findByNart('79092-50220-00').systemQty, 237.75);
  assert.equal(findByNart('79092-50223-00').systemQty, 1525.20);
  assert.equal(findByNart('79092-50228-00').systemQty, 419.40);

  // 2. Alvejados marcados com alvejado: true e não alvejados com alvejado: false
  assert.equal(findByNart('79092-50040-01').alvejado, false);
  assert.equal(findByNart('79092-50118-00').alvejado, false);
  assert.equal(findByNart('79092-50119-01').alvejado, false);
  assert.equal(findByNart('79092-50119-11').alvejado, false);

  assert.equal(findByNart('79092-50220-00').alvejado, true);
  assert.equal(findByNart('79092-50223-00').alvejado, true);
  assert.equal(findByNart('79092-50228-00').alvejado, true);

  // 3. Lote como Ciclo preservado como texto exato
  assert.equal(findByNart('79092-50223-00').lot, '3782 ao 3789');
  assert.equal(findByNart('79092-50228-00').lot, '11491');
  assert.equal(findByNart('79092-50118-00').lot, '2611010107');

  // 4. Ordenação oficial: Não alvejados primeiro (por NART), depois ALVEJADOS embaixo (por NART)
  const sorted = sortItemsBySectionAndNart(rows);
  const nartsInOrder = sorted.map((r) => r.nart);
  assert.deepEqual(nartsInOrder, [
    // Seção Normais (não alvejados) em ordem crescente:
    '79092-50040-01',
    '79092-50118-00',
    '79092-50119-01',
    '79092-50119-11',
    // Seção ALVEJADOS (sempre embaixo) em ordem crescente:
    '79092-50220-00',
    '79092-50223-00',
    '79092-50228-00',
  ]);

  // 5. Destinações dos materiais conferidos ou com falta
  // O 79092-50040-01 (CAMPO) conferido 370,76 kg vai para o 01. Se faltar, vai para o 04.
  const d1Ok = computeDestination(370.76, true, 370.76, 'CAMPO');
  assert.equal(d1Ok.allocations[0].warehouse, 'ARMAZÉM 01');
  assert.equal(d1Ok.allocations[0].quantity, 370.76);
  const d1Falta = computeDestination(370.76, true, 300.76, 'CAMPO');
  assert.equal(d1Falta.allocations.find((a) => a.warehouse === 'ARMAZÉM 04')?.quantity, 70);

  // O 79092-50118-00 (COMPRESSA) conferido 208,34 kg vai para o 01. Se faltar, vai para o 06.
  const d2Ok = computeDestination(208.34, true, 208.34, 'COMPRESSA');
  assert.equal(d2Ok.allocations[0].warehouse, 'ARMAZÉM 01');
  assert.equal(d2Ok.allocations[0].quantity, 208.34);
  const d2Falta = computeDestination(208.34, true, 108.34, 'COMPRESSA');
  assert.equal(d2Falta.allocations.find((a) => a.warehouse === 'ARMAZÉM 06')?.quantity, 100);

  // O 79092-50223-00 (CAMPO ALVEJADO) conferido 1.525,20 kg vai para o 01. Se faltar, vai para o 04.
  const d3Ok = computeDestination(1525.20, true, 1525.20, 'CAMPO');
  assert.equal(d3Ok.allocations[0].warehouse, 'ARMAZÉM 01');
  assert.equal(d3Ok.allocations[0].quantity, 1525.20);
  const d3Falta = computeDestination(1525.20, true, 1000, 'CAMPO');
  assert.equal(d3Falta.allocations.find((a) => a.warehouse === 'ARMAZÉM 04')?.quantity, 525.20);

  // O 79092-50228-00 (COMPRESSA ALVEJADO) conferido 419,40 kg vai para o 01. Se faltar, vai para o 06.
  const d4Ok = computeDestination(419.40, true, 419.40, 'COMPRESSA');
  assert.equal(d4Ok.allocations[0].warehouse, 'ARMAZÉM 01');
  assert.equal(d4Ok.allocations[0].quantity, 419.40);
  const d4Falta = computeDestination(419.40, true, 400, 'COMPRESSA');
  assert.equal(d4Falta.allocations.find((a) => a.warehouse === 'ARMAZÉM 06')?.quantity, 19.40);

  // 6. Mapa de Alvejados: Total Geral de 2.182,35 kg (237,75 + 1525,20 + 419,40)
  const alvejadosOnly = sorted.filter((r) => r.alvejado);
  assert.equal(alvejadosOnly.length, 3);
  const totalAlvejados = alvejadosOnly.reduce((acc, r) => acc + r.systemQty, 0);
  assert.equal(Math.round(totalAlvejados * 100) / 100, 2182.35);
});

