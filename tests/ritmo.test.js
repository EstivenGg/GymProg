import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calcularRitmoDeSeries,
  calcularRitmoMinutosPorKm,
  formatearRitmo,
  obtenerMejorRitmo
} from '../src/ritmo.js';

function serie(distanciaKm, duracionSegundos) {
  return { distanciaKm: distanciaKm, duracionSegundos: duracionSegundos };
}

test('calcula minutos por kilómetro', function () {
  // 4,1 km en 1140 s son 19 minutos: 4,634 min/km.
  assert.equal(
    Math.round(calcularRitmoMinutosPorKm(4.1, 1140) * 1000) / 1000,
    4.634
  );
});

test('sin distancia o sin duración no hay ritmo', function () {
  assert.equal(calcularRitmoMinutosPorKm(0, 1140), null);
  assert.equal(calcularRitmoMinutosPorKm(4.1, 0), null);
  assert.equal(calcularRitmoMinutosPorKm(null, null), null);
});

test('lo escribe en minutos y segundos, no en decimales', function () {
  assert.equal(formatearRitmo(4.634), '4:38');
  assert.equal(formatearRitmo(5), '5:00');
  assert.equal(formatearRitmo(6.5), '6:30');
});

test('sin dato es una raya, pero el cero del eje es 0:00', function () {
  assert.equal(formatearRitmo(null), '—');
  assert.equal(formatearRitmo(NaN), '—');
  assert.equal(formatearRitmo(0), '0:00');
});

test('el ritmo de varias series son los km totales contra el tiempo total', function () {
  // Promediar los dos ritmos daría 5:00; lo correcto es 9 km en 40 min.
  const ritmo = calcularRitmoDeSeries([serie(1, 360), serie(8, 2040)]);

  assert.equal(formatearRitmo(ritmo), '4:27');
});

test('ignora las series que no son de carrera', function () {
  const ritmo = calcularRitmoDeSeries([
    serie(4, 1200),
    {
      pesoLibras: 100,
      repeticiones: 5,
      distanciaKm: null,
      duracionSegundos: null
    }
  ]);

  assert.equal(formatearRitmo(ritmo), '5:00');
  assert.equal(calcularRitmoDeSeries([]), null);
});

test('el mejor ritmo es el número más bajo, no el más alto', function () {
  const mejor = obtenerMejorRitmo([
    serie(4, 1200),
    serie(4, 1000),
    serie(4, 1400)
  ]);

  assert.equal(formatearRitmo(mejor.minutosPorKm), '4:10');
});
