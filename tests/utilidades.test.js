import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describirRangoDeFechas } from '../src/utilidades.js';

test('muestra los dos años cuando el rango los cruza', function () {
  const texto = describirRangoDeFechas(
    new Date(2025, 8, 8),
    new Date(2026, 8, 4)
  );

  assert.match(texto, /2025/);
  assert.match(texto, /2026/);
});

test('con un solo año lo muestra una vez, al final', function () {
  const texto = describirRangoDeFechas(
    new Date(2026, 0, 8),
    new Date(2026, 8, 4)
  );

  assert.equal(texto.match(/2026/g).length, 1);
  assert.ok(texto.endsWith('2026'));
});

test('un rango de un solo día sigue diciendo el año', function () {
  const dia = new Date(2026, 8, 4);
  const texto = describirRangoDeFechas(dia, dia);

  assert.match(texto, /2026/);
});
