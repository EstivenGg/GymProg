import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  crearEsfuerzoPorEjercicio,
  crearResumenEsfuerzo,
  mereceMostrarse
} from '../src/esfuerzo.js';

function serie(ejercicio, esfuerzo) {
  return { ejercicio: ejercicio, esfuerzoPercibido: esfuerzo };
}

test('el promedio viene siempre con las series sobre las que se calculó', function () {
  const resumen = crearResumenEsfuerzo([
    serie('Banca', 8),
    serie('Banca', 9),
    serie('Banca', null),
    serie('Banca', null)
  ]);

  assert.equal(resumen.promedio, 8.5);
  assert.equal(resumen.maximo, 9);
  assert.equal(resumen.seriesConEsfuerzo, 2);
  assert.equal(resumen.seriesTotales, 4);
  assert.equal(resumen.cobertura, 0.5);
});

test('sin ningún RPE no hay resumen que enseñar', function () {
  assert.equal(crearResumenEsfuerzo([serie('Banca', null)]), null);
  assert.equal(crearResumenEsfuerzo([]), null);
});

test('un RPE de cero o negativo no cuenta como dato', function () {
  assert.equal(crearResumenEsfuerzo([serie('Banca', 0), serie('Banca', -1)]), null);
});

test('agrupa por ejercicio y ordena del más duro al más suave', function () {
  const resumenes = crearEsfuerzoPorEjercicio([
    serie('Remo', 6),
    serie('Sentadilla', 9),
    serie('Sentadilla', 9),
    serie('Banca', 8),
    serie('Cardio', null)
  ]);

  assert.deepEqual(
    resumenes.map(function (resumen) {
      return resumen.ejercicio;
    }),
    ['Sentadilla', 'Banca', 'Remo']
  );
  assert.equal(resumenes[0].seriesConEsfuerzo, 2);
});

test('con menos de tres series el promedio no se considera mostrable', function () {
  assert.equal(mereceMostrarse(crearResumenEsfuerzo([serie('Banca', 8)])), false);
  assert.equal(mereceMostrarse(crearResumenEsfuerzo([
    serie('Banca', 8),
    serie('Banca', 8),
    serie('Banca', 9)
  ])), true);
  assert.equal(mereceMostrarse(null), false);
});
