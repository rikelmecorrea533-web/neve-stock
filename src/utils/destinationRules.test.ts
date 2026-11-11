import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDestination,
  detectMaterialType,
  resolveItemType,
  getDifferenceDestination,
  OFFICIAL_NEVE_MAP,
  OFFICIAL_NEVE_FABRICS_TABLE,
} from './destinationRules';
import { parseBrazilianNumber } from './excelService';

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
  assert.equal(result.summaryText, '500 vai para o ARMAZÉM 01.');
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
  assert.equal(result.summaryText, '450 vai para o ARMAZÉM 01 e 50 vai para o ARMAZÉM 04.');
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
  assert.equal(result.summaryText, '4 vai para o ARMAZÉM 04.');
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
  assert.equal(result.summaryText, '700 vai para o ARMAZÉM 01 e 100 vai para o ARMAZÉM 06.');
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
  assert.equal(result.summaryText, '1200 vai para o ARMAZÉM 01.');
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
  assert.equal(result.summaryText, '600 vai para o ARMAZÉM 06.');
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
  assert.equal(parseBrazilianNumber('1.200'), 1200);
  assert.equal(parseBrazilianNumber('1.200,50'), 1200.5);
  assert.equal(parseBrazilianNumber('7,427.18'), 7427.18);
  assert.equal(parseBrazilianNumber(500), 500);
  assert.equal(parseBrazilianNumber(null), 0);
});
