import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crearProgresionFuerza, obtenerMayoresCambios } from '../src/progresion.js';

function crearSesion(fecha, series) {
  const inicio = new Date(fecha + 'T10:00:00');

  return {
    inicio: inicio,
    fin: new Date(inicio.getTime() + 60 * 60_000),
    series: series.map(function (serie) {
      return {
        tipoSerie: 'normal',
        ejercicio: serie[0],
        pesoLibras: serie[1],
        repeticiones: serie[2]
      };
    })
  };
}

test('clasifica cada ejercicio segun su mejor 1RM entre periodos', function () {
  const sesiones = [
    // Bloque anterior: del 1 al 7 de enero
    crearSesion('2026-01-02', [['Banca', 100, 5], ['Sentadilla', 200, 5], ['Remo', 100, 5]]),
    // Bloque actual: del 8 al 14 de enero
    crearSesion('2026-01-09', [['Banca', 120, 5], ['Sentadilla', 201, 5], ['Remo', 80, 5]]),
    crearSesion('2026-01-13', [['Dominadas', 50, 8]])
  ];

  const progresion = crearProgresionFuerza(
    sesiones,
    new Date('2026-01-14T10:00:00'),
    '7'
  );

  assert.equal(progresion.hayHistorialAnterior, true);
  assert.equal(progresion.subieron, 1);
  assert.equal(progresion.bajaron, 1);
  assert.equal(progresion.mantienen, 1);
  assert.equal(progresion.nuevos, 1);

  const porNombre = new Map(progresion.ejercicios.map(function (ejercicio) {
    return [ejercicio.ejercicio, ejercicio];
  }));

  assert.equal(porNombre.get('Banca').estado, 'subio');
  assert.equal(porNombre.get('Remo').estado, 'bajo');
  // 201x5 sobre 200x5 es medio punto porcentual: no cuenta como progreso
  assert.equal(porNombre.get('Sentadilla').estado, 'mantiene');
  assert.equal(porNombre.get('Dominadas').estado, 'nuevo');
  assert.equal(porNombre.get('Dominadas').anterior, null);
});

test('ordena los ejercicios del que mas subio al que mas bajo', function () {
  const sesiones = [
    crearSesion('2026-01-02', [['Banca', 100, 5], ['Remo', 100, 5], ['Curl', 100, 5]]),
    crearSesion('2026-01-09', [['Banca', 130, 5], ['Remo', 60, 5], ['Curl', 110, 5]])
  ];

  const progresion = crearProgresionFuerza(
    sesiones,
    new Date('2026-01-14T10:00:00'),
    '7'
  );

  assert.deepEqual(
    progresion.ejercicios.map(function (ejercicio) {
      return ejercicio.ejercicio;
    }),
    ['Banca', 'Curl', 'Remo']
  );

  const mayores = obtenerMayoresCambios(progresion, 2);

  assert.deepEqual(
    mayores.subieron.map(function (ejercicio) {
      return ejercicio.ejercicio;
    }),
    ['Banca', 'Curl']
  );
  assert.deepEqual(
    mayores.bajaron.map(function (ejercicio) {
      return ejercicio.ejercicio;
    }),
    ['Remo']
  );
});

test('sin bloque anterior todos los ejercicios quedan sin comparacion', function () {
  const sesiones = [crearSesion('2026-01-12', [['Banca', 100, 5]])];
  const progresion = crearProgresionFuerza(
    sesiones,
    new Date('2026-01-14T10:00:00'),
    '7'
  );

  assert.equal(progresion.hayHistorialAnterior, false);
  assert.equal(progresion.nuevos, 1);
  assert.equal(progresion.subieron, 0);
  assert.equal(progresion.bajaron, 0);
});

test('ignora las series de calentamiento y las que no tienen carga', function () {
  const sesionAnterior = crearSesion('2026-01-02', [['Banca', 100, 5]]);
  const sesionActual = crearSesion('2026-01-09', [['Banca', 100, 5]]);

  sesionActual.series.push(
    {
      tipoSerie: 'warmup',
      ejercicio: 'Banca',
      pesoLibras: 400,
      repeticiones: 5
    },
    {
      tipoSerie: 'normal',
      ejercicio: 'Cinta',
      pesoLibras: null,
      repeticiones: null
    }
  );

  const progresion = crearProgresionFuerza(
    [sesionAnterior, sesionActual],
    new Date('2026-01-14T10:00:00'),
    '7'
  );

  assert.equal(progresion.ejercicios.length, 1);
  assert.equal(progresion.ejercicios[0].ejercicio, 'Banca');
  assert.equal(progresion.ejercicios[0].estado, 'mantiene');
});
