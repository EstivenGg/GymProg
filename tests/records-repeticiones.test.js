import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  crearRecordsDeRepeticiones,
  esEjercicioDePesoCorporal
} from '../src/records-repeticiones.js';

function serie(ejercicio, fecha, peso, repeticiones, esfuerzo) {
  return {
    ejercicio: ejercicio,
    inicio: new Date(fecha + 'T10:00:00'),
    pesoLibras: peso,
    repeticiones: repeticiones,
    esfuerzoPercibido: esfuerzo === undefined ? null : esfuerzo
  };
}

test('reconoce un ejercicio de peso corporal por la ausencia de carga', function () {
  assert.equal(esEjercicioDePesoCorporal([
    serie('Dominadas', '2026-03-02', null, 10)
  ]), true);

  // En cuanto aparece lastre, su marca vuelve a ser de carga.
  assert.equal(esEjercicioDePesoCorporal([
    serie('Dominadas', '2026-03-02', null, 10),
    serie('Dominadas', '2026-03-09', 25, 8)
  ]), false);
});

test('solo incluye los ejercicios sin carga, del récord mayor al menor', function () {
  const records = crearRecordsDeRepeticiones([
    serie('Dominadas', '2026-03-02', null, 10),
    serie('Fondos en paralelas', '2026-03-02', null, 14),
    serie('Press banca', '2026-03-02', 100, 5)
  ]);

  assert.deepEqual(
    records.map(function (record) {
      return record.ejercicio;
    }),
    ['Fondos en paralelas', 'Dominadas']
  );
});

test('el récord es la mejor serie, con su fecha', function () {
  const records = crearRecordsDeRepeticiones([
    serie('Dominadas', '2026-03-02', null, 8),
    serie('Dominadas', '2026-03-09', null, 12),
    serie('Dominadas', '2026-03-16', null, 9)
  ]);

  assert.equal(records[0].repeticiones, 12);
  assert.equal(records[0].fecha.getDate(), 9);
  assert.equal(records[0].repeticionesTotales, 29);
  assert.equal(records[0].cantidadSeries, 3);
  assert.equal(records[0].cantidadSesiones, 3);
});

test('varias series el mismo día son una sola sesión', function () {
  const records = crearRecordsDeRepeticiones([
    serie('Dominadas', '2026-03-02', null, 8),
    serie('Dominadas', '2026-03-02', null, 7)
  ]);

  assert.equal(records[0].cantidadSeries, 2);
  assert.equal(records[0].cantidadSesiones, 1);
});

test('arrastra el RPE con su cobertura', function () {
  const records = crearRecordsDeRepeticiones([
    serie('Dominadas', '2026-03-02', null, 8, 9),
    serie('Dominadas', '2026-03-02', null, 7)
  ]);

  assert.equal(records[0].esfuerzo.promedio, 9);
  assert.equal(records[0].esfuerzo.seriesConEsfuerzo, 1);
  assert.equal(records[0].esfuerzo.seriesTotales, 2);
});

test('sin ejercicios de peso corporal no hay récords', function () {
  assert.deepEqual(crearRecordsDeRepeticiones([
    serie('Press banca', '2026-03-02', 100, 5)
  ]), []);
});
