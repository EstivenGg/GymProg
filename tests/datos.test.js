import assert from 'node:assert/strict';
import { test } from 'node:test';
import { convertirCSVaObjetos } from '../src/datos.js';

test('convierte un CSV sencillo', function () {
  const textoCSV = 'nombre,repeticiones\nSentadilla,10\nPress,8';
  const resultado = convertirCSVaObjetos(textoCSV);

  assert.deepEqual(resultado, [
    { nombre: 'Sentadilla', repeticiones: '10' },
    { nombre: 'Press', repeticiones: '8' }
  ]);
});

test('conserva comas dentro de valores entre comillas', function () {
  const textoCSV = 'ejercicio,nota\nRemo,"Controlado, sin impulso"';
  const resultado = convertirCSVaObjetos(textoCSV);

  assert.equal(resultado[0].nota, 'Controlado, sin impulso');
});

test('interpreta comillas dobles escapadas', function () {
  const textoCSV = 'ejercicio,nota\nPress,"Serie ""pesada"""';
  const resultado = convertirCSVaObjetos(textoCSV);

  assert.equal(resultado[0].nota, 'Serie "pesada"');
});

test('conserva saltos de línea dentro de una celda', function () {
  const textoCSV = 'ejercicio,nota\nPeso muerto,"Primera línea\nSegunda línea"';
  const resultado = convertirCSVaObjetos(textoCSV);

  assert.equal(resultado[0].nota, 'Primera línea\nSegunda línea');
});

test('acepta BOM, finales CRLF y filas vacías', function () {
  const textoCSV = '\uFEFFejercicio,repeticiones\r\nDominadas,6\r\n\r\n';
  const resultado = convertirCSVaObjetos(textoCSV);

  assert.deepEqual(resultado, [
    { ejercicio: 'Dominadas', repeticiones: '6' }
  ]);
});
