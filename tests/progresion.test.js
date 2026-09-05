import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crearComparacionCargas, crearProgresionFuerza, obtenerMayoresCambios } from '../src/progresion.js';

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

test('compara pesos registrados aunque el mejor 1RM corresponda a otra serie', function () {
  const sesiones = [
    crearSesion('2026-01-02', [['Banca', 100, 20], ['Banca', 110, 3]]),
    crearSesion('2026-01-09', [['Banca', 120, 5]])
  ];
  const fechaReferencia = new Date('2026-01-14T10:00:00');
  const comparacion = crearComparacionCargas(sesiones, fechaReferencia, '7');
  const cambioBanca = comparacion.ejercicios[0];

  assert.equal(cambioBanca.anterior, 110);
  assert.equal(cambioBanca.actual, 120);
  assert.equal(cambioBanca.estado, 'subio');
  assert.equal(cambioBanca.serieAnterior.repeticiones, 3);
  assert.equal(cambioBanca.serieActual.repeticiones, 5);
  assert.equal(cambioBanca.serieActual.fecha, sesiones[1].inicio);
  assert.equal(cambioBanca.porcentaje, 10 / 110);
  assert.equal(crearProgresionFuerza(sesiones, fechaReferencia, '7').ejercicios[0].estado, 'bajo');
});

test('más repeticiones con el mismo peso mantienen la categoría de carga', function () {
  const comparacion = crearComparacionCargas([
    crearSesion('2026-01-02', [['Banca', 100, 5]]),
    crearSesion('2026-01-09', [['Banca', 100, 12]])
  ], new Date('2026-01-14T10:00:00'), '7');

  assert.equal(comparacion.mantienen, 1);
  assert.equal(comparacion.ejercicios[0].porcentaje, 0);
  assert.equal(comparacion.ejercicios[0].serieActual.repeticiones, 12);
});

test('conserva la serie de más repeticiones y la fecha más reciente en empates', function () {
  const sesiones = [
    crearSesion('2026-01-02', [['Banca', 100, 5]]),
    crearSesion('2026-01-09', [['Banca', 120, 5], ['Banca', 120, 8]]),
    crearSesion('2026-01-12', [['Banca', 120, 8]])
  ];
  const comparacion = crearComparacionCargas(
    [sesiones[0], sesiones[2], sesiones[1]], new Date('2026-01-14T10:00:00'), '7'
  );

  assert.equal(comparacion.ejercicios[0].serieActual.repeticiones, 8);
  assert.equal(comparacion.ejercicios[0].serieActual.fecha, sesiones[2].inicio);
});

test('la comparación de cargas excluye calentamientos y datos inválidos', function () {
  const sesion = crearSesion('2026-01-09', [
    ['Banca', 100, 5], ['Cinta', null, null], ['Carga inválida', -10, 5],
    ['Sin repeticiones', 100, 0], ['Infinito', Infinity, 5]
  ]);
  sesion.series.push({ tipoSerie: 'warmup', ejercicio: 'Banca', pesoLibras: 500, repeticiones: 5 });
  const comparacion = crearComparacionCargas([sesion], new Date('2026-01-14T10:00:00'), '7');

  assert.equal(comparacion.ejercicios.length, 1);
  assert.equal(comparacion.nuevos, 1);
  assert.equal(comparacion.hayHistorialAnterior, false);
  assert.equal(comparacion.ejercicios[0].actual, 100);
  assert.equal(comparacion.ejercicios[0].serieAnterior, null);
});

test('detecta cambios pequeños de carga y ordena aumentos y descensos', function () {
  const comparacion = crearComparacionCargas([
    crearSesion('2026-01-02', [['Banca', 100, 5], ['Remo', 100, 5], ['Curl', 100, 5]]),
    crearSesion('2026-01-09', [['Banca', 101, 5], ['Remo', 80, 5], ['Curl', 110, 5]])
  ], new Date('2026-01-14T10:00:00'), '7');
  const mayoresCambios = obtenerMayoresCambios(comparacion, 4);

  assert.equal(comparacion.subieron, 2);
  assert.equal(comparacion.bajaron, 1);
  assert.deepEqual(mayoresCambios.subieron.map(function (ejercicio) {
    return ejercicio.ejercicio;
  }), ['Curl', 'Banca']);
  assert.equal(mayoresCambios.bajaron[0].ejercicio, 'Remo');
});

test('todo el historial compara las cargas máximas de sus dos mitades', function () {
  const comparacion = crearComparacionCargas([
    crearSesion('2026-01-01', [['Banca', 100, 5]]),
    crearSesion('2026-01-14', [['Banca', 120, 5]])
  ], new Date('2026-01-14T10:00:00'), 'all');

  assert.equal(comparacion.ejercicios[0].anterior, 100);
  assert.equal(comparacion.ejercicios[0].actual, 120);
  assert.match(comparacion.comparadoCon, /mitad anterior/);
});

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
