import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBrazilianNumber, preserveLotAsString, detectColumnsHeuristic } from './excelService';

test('parseBrazilianNumber correctly parses Brazilian comma decimals', () => {
  assert.equal(parseBrazilianNumber('423,86'), 423.86);
  assert.equal(parseBrazilianNumber('12,5'), 12.5);
  assert.equal(parseBrazilianNumber('0,99'), 0.99);
  assert.equal(parseBrazilianNumber(500), 500);
});

test('parseBrazilianNumber correctly parses thousands with dot and comma', () => {
  assert.equal(parseBrazilianNumber('1.200'), 1200);
  assert.equal(parseBrazilianNumber('1.200,50'), 1200.5);
  assert.equal(parseBrazilianNumber('10.500,75'), 10500.75);
});

test('preserveLotAsString keeps leading zeros and full string without loss', () => {
  assert.equal(preserveLotAsString('000123'), '000123');
  assert.equal(preserveLotAsString(2607010089), '2607010089');
  assert.equal(preserveLotAsString('LT-260101'), 'LT-260101');
  assert.equal(preserveLotAsString(null), 'S/L');
  assert.equal(preserveLotAsString(''), 'S/L');
});

test('detectColumnsHeuristic correctly matches real-world warehouse variations', () => {
  const headers = ['Armazem', 'Produto', 'Lote', 'Saldo Lote'];
  const mapping = detectColumnsHeuristic(headers);
  assert.equal(mapping.nartColumn, 'Produto');
  assert.equal(mapping.lotColumn, 'Lote');
  assert.equal(mapping.qtyColumn, 'Saldo Lote');
  assert.equal(mapping.warehouseColumn, 'Armazem');
});

test('detectColumnsHeuristic matches Código and Saldo do Lote', () => {
  const headers = ['Código', 'Lote', 'Saldo do Lote', 'Descrição'];
  const mapping = detectColumnsHeuristic(headers);
  assert.equal(mapping.nartColumn, 'Código');
  assert.equal(mapping.lotColumn, 'Lote');
  assert.equal(mapping.qtyColumn, 'Saldo do Lote');
});
