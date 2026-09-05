import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  analizarEntrenamientos,
  analizarMediciones,
  identificarTipoDeArchivo
} from '../src/analisis-importacion.js';
import { convertirFilasEnMediciones, convertirFilasEnSeries } from '../src/datos.js';

function crearFilaEntrenamiento(inicio, ejercicio, extras) {
  return Object.assign({
    title: 'Tirón',
    start_time: inicio,
    end_time: inicio,
    exercise_title: ejercicio,
    set_index: '0',
    set_type: 'normal',
    weight_lbs: '100',
    reps: '5'
  }, extras || {});
}

function crearColumnas(nombres) {
  return new Set(nombres);
}

test('reconoce el tipo de archivo por sus columnas antes que por el nombre', function () {
  assert.equal(
    identificarTipoDeArchivo('export.csv', crearColumnas(['start_time', 'exercise_title'])),
    'entrenamiento'
  );
  assert.equal(
    identificarTipoDeArchivo('export.csv', crearColumnas(['date', 'weight_kg'])),
    'mediciones'
  );
  assert.equal(
    identificarTipoDeArchivo('measurement_data.csv', crearColumnas(['date', 'fat_percent'])),
    'mediciones'
  );
});

test('cae al nombre del archivo cuando el encabezado no dice nada', function () {
  assert.equal(
    identificarTipoDeArchivo('workout_data.csv', crearColumnas(['columna_rara'])),
    'entrenamiento'
  );
  assert.equal(identificarTipoDeArchivo('notas.csv', crearColumnas(['a', 'b'])), null);
});

test('separa sesiones nuevas de las que ya estaban', function () {
  const seriesActuales = convertirFilasEnSeries([
    crearFilaEntrenamiento('1 mar 2026, 10:00', 'Peso muerto (barra)')
  ]);

  const resultado = analizarEntrenamientos([
    crearFilaEntrenamiento('1 mar 2026, 10:00', 'Peso muerto (barra)'),
    crearFilaEntrenamiento('1 mar 2026, 10:00', 'Dominadas', { set_index: '1' }),
    crearFilaEntrenamiento('8 mar 2026, 10:00', 'Remo')
  ], seriesActuales);

  assert.equal(resultado.sesionesDuplicadas.length, 1);
  assert.equal(resultado.sesionesDuplicadas[0].cantidadSeries, 2);
  assert.equal(resultado.sesionesNuevas.length, 1);
  assert.equal(resultado.sesionesNuevas[0].titulo, 'Tirón');
  assert.equal(resultado.seriesNuevas.length, 1);
  assert.equal(resultado.seriesTotales.length, 3);
});

test('lista las filas sin fecha usable con su motivo y su número de fila', function () {
  const resultado = analizarEntrenamientos([
    crearFilaEntrenamiento('1 mar 2026, 10:00', 'Sentadilla'),
    crearFilaEntrenamiento('', 'Prensa'),
    crearFilaEntrenamiento('2026-03-08', 'Remo')
  ], []);

  assert.equal(resultado.filasInvalidas.length, 2);
  assert.deepEqual(
    resultado.filasInvalidas.map(function (fila) {
      return fila.numeroFila;
    }),
    [3, 4]
  );
  assert.equal(resultado.filasInvalidas[0].motivo, 'Sin fecha de inicio');
  assert.equal(resultado.filasInvalidas[1].motivo, 'Fecha ilegible: 2026-03-08');
  assert.equal(resultado.filasInvalidas[1].descripcion, 'Remo');
  assert.equal(resultado.seriesTotales.length, 1);
});

test('convierte a libras el peso de un CSV exportado en kilos', function () {
  const resultado = analizarEntrenamientos([
    crearFilaEntrenamiento('1 mar 2026, 10:00', 'Sentadilla', {
      weight_lbs: undefined,
      weight_kg: '100'
    })
  ], []);

  assert.equal(Math.round(resultado.seriesTotales[0].pesoLibras), 220);
});

test('prefiere weight_lbs cuando el CSV trae las dos columnas', function () {
  const resultado = analizarEntrenamientos([
    crearFilaEntrenamiento('1 mar 2026, 10:00', 'Sentadilla', { weight_kg: '100' })
  ], []);

  assert.equal(resultado.seriesTotales[0].pesoLibras, 100);
});

test('separa mediciones nuevas, repetidas e inservibles', function () {
  const medicionesActuales = convertirFilasEnMediciones([
    { date: '1 mar 2026, 08:00', weight_lbs: '180', fat_percent: '20' }
  ]);

  const resultado = analizarMediciones([
    { date: '1 mar 2026, 08:00', weight_lbs: '180', fat_percent: '20' },
    { date: '8 mar 2026, 08:00', weight_lbs: '179', fat_percent: '' },
    { date: '15 mar 2026, 08:00', weight_lbs: '', fat_percent: '' },
    { date: '', weight_lbs: '178', fat_percent: '19' }
  ], medicionesActuales);

  assert.equal(resultado.medicionesNuevas.length, 1);
  assert.equal(resultado.medicionesDuplicadas.length, 1);
  assert.deepEqual(
    resultado.filasInvalidas.map(function (fila) {
      return fila.motivo;
    }),
    ['Sin peso ni % de grasa', 'Sin fecha']
  );
});

test('no cuenta dos veces una fecha repetida dentro del mismo archivo', function () {
  const resultado = analizarMediciones([
    { date: '8 mar 2026, 08:00', weight_lbs: '179' },
    { date: '8 mar 2026, 08:00', weight_lbs: '179' }
  ], []);

  assert.equal(resultado.medicionesNuevas.length, 1);
  assert.equal(resultado.medicionesDuplicadas.length, 1);
  assert.equal(resultado.medicionesTotales.length, 1);
});

test('convierte a libras las mediciones exportadas en kilos', function () {
  const resultado = analizarMediciones([
    { date: '8 mar 2026, 08:00', weight_kg: '82', fat_percent: '20' }
  ], []);

  assert.equal(Math.round(resultado.medicionesTotales[0].pesoLibras), 181);
});
