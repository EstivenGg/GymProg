import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  crearSerieTemporal,
  obtenerMetricaPorClave,
  obtenerMetricasDisponibles
} from '../src/metricas-ejercicio.js';

function crearSerie(fecha, campos) {
  return Object.assign({
    inicio: new Date(fecha + 'T10:00:00'),
    ejercicio: 'Ejercicio',
    tipoSerie: 'normal',
    pesoLibras: null,
    repeticiones: null,
    distanciaKm: null,
    duracionSegundos: null
  }, campos);
}

const clavesDe = (metricas) => metricas.map((metrica) => metrica.clave);

test('un ejercicio con carga ofrece las cuatro metricas de fuerza', function () {
  const series = [crearSerie('2026-01-05', { pesoLibras: 100, repeticiones: 5 })];

  assert.deepEqual(
    clavesDe(obtenerMetricasDisponibles(series)),
    ['1rm', 'peso', 'volumen', 'reps']
  );
});

test('un ejercicio de peso corporal solo ofrece repeticiones', function () {
  const series = [crearSerie('2026-01-05', { repeticiones: 12 })];

  assert.deepEqual(clavesDe(obtenerMetricasDisponibles(series)), ['reps']);
});

test('un ejercicio de cardio ofrece distancia, ritmo y duracion', function () {
  const series = [crearSerie('2026-01-05', { distanciaKm: 5.2, duracionSegundos: 1800 })];

  assert.deepEqual(
    clavesDe(obtenerMetricasDisponibles(series)),
    ['distancia', 'ritmo', 'duracion']
  );
});

test('el ritmo solo aparece si hay distancia y duracion a la vez', function () {
  const soloDistancia = [crearSerie('2026-01-05', { distanciaKm: 5.2 })];
  const soloDuracion = [crearSerie('2026-01-05', { duracionSegundos: 1800 })];

  assert.equal(clavesDe(obtenerMetricasDisponibles(soloDistancia)).includes('ritmo'), false);
  assert.equal(clavesDe(obtenerMetricasDisponibles(soloDuracion)).includes('ritmo'), false);
});

test('agrupa por dia: maximo para el pico, suma para el acumulado', function () {
  const series = [
    crearSerie('2026-01-05', { pesoLibras: 100, repeticiones: 5 }),
    crearSerie('2026-01-05', { pesoLibras: 120, repeticiones: 3 }),
    crearSerie('2026-01-12', { pesoLibras: 110, repeticiones: 4 })
  ];

  const peso = crearSerieTemporal(series, obtenerMetricaPorClave('peso'));
  const volumen = crearSerieTemporal(series, obtenerMetricaPorClave('volumen'));
  const reps = crearSerieTemporal(series, obtenerMetricaPorClave('reps'));

  assert.deepEqual(peso.map((punto) => punto.valor), [120, 110]);
  assert.deepEqual(volumen.map((punto) => punto.valor), [100 * 5 + 120 * 3, 440]);
  assert.deepEqual(reps.map((punto) => punto.valor), [8, 4]);
});

test('cada metrica ignora las series que no sabe leer', function () {
  const series = [
    crearSerie('2026-01-05', { pesoLibras: 100, repeticiones: 5 }),
    // Una serie de cardio colada en el mismo ejercicio no debe crear un punto a cero
    crearSerie('2026-01-06', { distanciaKm: 3 })
  ];

  const volumen = crearSerieTemporal(series, obtenerMetricaPorClave('volumen'));
  const distancia = crearSerieTemporal(series, obtenerMetricaPorClave('distancia'));

  assert.equal(volumen.length, 1);
  assert.equal(volumen[0].valor, 500);
  assert.equal(distancia.length, 1);
  assert.equal(distancia[0].valor, 3);
});

test('la duracion se devuelve en minutos', function () {
  const series = [
    crearSerie('2026-01-05', { duracionSegundos: 900 }),
    crearSerie('2026-01-05', { duracionSegundos: 300 })
  ];

  const duracion = crearSerieTemporal(series, obtenerMetricaPorClave('duracion'));

  assert.deepEqual(duracion.map((punto) => punto.valor), [20]);
});

test('los puntos salen ordenados por fecha', function () {
  const series = [
    crearSerie('2026-03-01', { repeticiones: 8 }),
    crearSerie('2026-01-01', { repeticiones: 5 }),
    crearSerie('2026-02-01', { repeticiones: 6 })
  ];

  const reps = crearSerieTemporal(series, obtenerMetricaPorClave('reps'));

  assert.deepEqual(reps.map((punto) => punto.valor), [5, 6, 8]);
});
