import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crearUltimasSesionesDelEjercicio } from '../src/detalle-sesiones-ejercicio.js';
import { obtenerMetricaPorClave } from '../src/metricas-ejercicio.js';

const METRICA_1RM = obtenerMetricaPorClave('1rm');
const METRICA_REPS = obtenerMetricaPorClave('reps');

function serie(fecha, peso, repeticiones, esfuerzo) {
  return {
    tituloSesion: 'Empuje',
    inicio: new Date(fecha + 'T10:00:00'),
    ejercicio: 'Press banca',
    tipoSerie: 'normal',
    pesoLibras: peso,
    repeticiones: repeticiones,
    distanciaKm: null,
    duracionSegundos: null,
    esfuerzoPercibido: esfuerzo === undefined ? null : esfuerzo
  };
}

test('devuelve las sesiones de la más reciente hacia atrás', function () {
  const series = [
    serie('2026-03-02', 100, 5),
    serie('2026-03-09', 105, 5),
    serie('2026-03-16', 110, 5)
  ];

  const filas = crearUltimasSesionesDelEjercicio(series, METRICA_1RM);

  assert.deepEqual(
    filas.map(function (fila) {
      return fila.fecha.getDate();
    }),
    [16, 9, 2]
  );
});

test('se queda con las últimas cinco', function () {
  const series = [];

  for (let dia = 1; dia <= 8; dia += 1) {
    series.push(serie('2026-03-0' + dia, 100 + dia, 5));
  }

  const filas = crearUltimasSesionesDelEjercicio(series, METRICA_1RM);

  assert.equal(filas.length, 5);
  assert.equal(filas[0].fecha.getDate(), 8);
  assert.equal(filas[4].fecha.getDate(), 4);
});

test('compara con la sesión anterior aunque quede fuera de las mostradas', function () {
  const series = [];

  for (let dia = 1; dia <= 6; dia += 1) {
    series.push(serie('2026-03-0' + dia, 100, 5));
  }

  const filas = crearUltimasSesionesDelEjercicio(series, METRICA_1RM);
  const masAntiguaMostrada = filas[filas.length - 1];

  // Es el día 2: su comparación sale del día 1, que ya no se muestra.
  assert.equal(masAntiguaMostrada.fecha.getDate(), 2);
  assert.equal(masAntiguaMostrada.porcentaje, 0);
  assert.notEqual(masAntiguaMostrada.valorAnterior, null);
});

test('la primera sesión del historial no tiene con qué compararse', function () {
  const filas = crearUltimasSesionesDelEjercicio(
    [serie('2026-03-02', 100, 5)],
    METRICA_1RM
  );

  assert.equal(filas[0].porcentaje, null);
  assert.equal(filas[0].diferencia, null);
  assert.equal(filas[0].valorAnterior, null);
});

test('el porcentaje describe el salto de la métrica que pinta la línea', function () {
  const series = [
    serie('2026-03-02', 100, 5),
    serie('2026-03-09', 110, 5)
  ];

  const porUnRM = crearUltimasSesionesDelEjercicio(series, METRICA_1RM);
  const porReps = crearUltimasSesionesDelEjercicio(series, METRICA_REPS);

  // El 1RM sube un 10 %, pero las repeticiones son las mismas.
  assert.equal(Math.round(porUnRM[0].porcentaje), 10);
  assert.equal(porReps[0].porcentaje, 0);
});

test('resume el día con la mejor serie y el RPE más alto', function () {
  const series = [
    serie('2026-03-02', 100, 5, 7),
    serie('2026-03-02', 130, 3, 9),
    serie('2026-03-02', 110, 5, 8)
  ];

  const filas = crearUltimasSesionesDelEjercicio(series, METRICA_1RM);

  assert.equal(filas[0].cantidadSeries, 3);
  assert.equal(filas[0].mejorSerie.pesoLibras, 130);
  assert.equal(filas[0].esfuerzo.maximo, 9);
  assert.equal(filas[0].esfuerzo.seriesConEsfuerzo, 3);
});

test('sin ningún RPE registrado el esfuerzo queda vacío, no en cero', function () {
  const filas = crearUltimasSesionesDelEjercicio(
    [serie('2026-03-02', 100, 5)],
    METRICA_1RM
  );

  assert.equal(filas[0].esfuerzo, null);
});

test('el esfuerzo de la sesion dice sobre cuantas series se calculo', function () {
  const filas = crearUltimasSesionesDelEjercicio([
    serie('2026-03-02', 100, 5, 8),
    serie('2026-03-02', 100, 5),
    serie('2026-03-02', 100, 5)
  ], METRICA_1RM);

  assert.equal(filas[0].esfuerzo.promedio, 8);
  assert.equal(filas[0].esfuerzo.seriesConEsfuerzo, 1);
  assert.equal(filas[0].esfuerzo.seriesTotales, 3);
});

test('sin carga elige la serie de más repeticiones', function () {
  const series = [
    serie('2026-03-02', null, 8),
    serie('2026-03-02', null, 12)
  ];

  const filas = crearUltimasSesionesDelEjercicio(series, METRICA_REPS);

  assert.equal(filas[0].mejorSerie.repeticiones, 12);
});

test('cada fila sabe a qué entrenamiento pertenece', function () {
  const filas = crearUltimasSesionesDelEjercicio(
    [serie('2026-03-02', 100, 5)],
    METRICA_1RM
  );

  assert.equal(
    filas[0].claveSesion,
    new Date('2026-03-02T10:00:00').getTime() + '|Empuje'
  );
  assert.equal(filas[0].tituloSesion, 'Empuje');
});

test('sin sesiones del ejercicio no hay filas', function () {
  assert.deepEqual(crearUltimasSesionesDelEjercicio([], METRICA_1RM), []);
});
