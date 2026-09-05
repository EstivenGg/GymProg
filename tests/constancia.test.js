import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crearResumenConstancia } from '../src/constancia.js';

function sesion(fecha) {
  return { inicio: new Date(fecha + 'T10:00:00') };
}

test('excluye las semanas sin historial del porcentaje de constancia', function () {
  const sesiones = [
    sesion('2026-08-27'),
    sesion('2026-08-29'),
    sesion('2026-09-02')
  ];
  const resumen = crearResumenConstancia(
    sesiones,
    new Date('2026-09-02T10:00:00'),
    12,
    4
  );

  assert.equal(resumen.semanasConDatos, 2);
  assert.equal(resumen.semanasActivas, 2);
  assert.equal(resumen.porcentajeActivo, 100);
  assert.equal(resumen.semanas.filter(function (semana) {
    return semana.estado === 'sin-datos';
  }).length, 10);
  assert.equal(resumen.sesionesSemanaActual, 1);
  assert.equal(resumen.progresoMeta, 25);
});

test('distingue una semana observada sin entrenamientos', function () {
  const sesiones = [sesion('2026-08-10'), sesion('2026-08-24')];
  const resumen = crearResumenConstancia(
    sesiones,
    new Date('2026-08-24T10:00:00'),
    3,
    4
  );

  assert.deepEqual(
    resumen.semanas.map(function (semana) {
      return semana.estado;
    }),
    ['activa', 'sin-entrenamiento', 'activa']
  );
  assert.equal(resumen.porcentajeActivo, 67);
});

test('compara dos bloques completos de cuatro semanas', function () {
  const sesiones = [
    sesion('2026-01-05'),
    sesion('2026-01-12'),
    sesion('2026-01-19'),
    sesion('2026-01-26'),
    sesion('2026-02-02'), sesion('2026-02-03'),
    sesion('2026-02-09'), sesion('2026-02-10'),
    sesion('2026-02-16'), sesion('2026-02-17'),
    sesion('2026-02-23'), sesion('2026-02-24')
  ];
  const resumen = crearResumenConstancia(
    sesiones,
    new Date('2026-02-24T10:00:00'),
    12,
    4
  );

  assert.equal(resumen.comparacion.disponible, true);
  assert.equal(resumen.comparacion.anterior, 4);
  assert.equal(resumen.comparacion.actual, 8);
  assert.equal(resumen.comparacion.diferencia, 4);
});

test('separa las semanas activas de las que llegaron a la meta', function () {
  // Tres semanas seguidas: una con 1 sesión, otra con 3, otra con 2.
  const sesiones = [
    sesion('2026-08-10'),
    sesion('2026-08-17'), sesion('2026-08-18'), sesion('2026-08-19'),
    sesion('2026-08-24'), sesion('2026-08-25')
  ];
  const resumen = crearResumenConstancia(
    sesiones,
    new Date('2026-08-25T10:00:00'),
    3,
    3
  );

  assert.equal(resumen.semanasConDatos, 3);
  assert.equal(resumen.semanasActivas, 3);
  assert.equal(resumen.porcentajeActivo, 100);
  assert.equal(resumen.semanasEnMeta, 1);
});

test('una semana sin entrenamientos nunca cuenta como semana en meta', function () {
  const sesiones = [sesion('2026-08-10'), sesion('2026-08-24')];
  const resumen = crearResumenConstancia(
    sesiones,
    new Date('2026-08-24T10:00:00'),
    3,
    1
  );

  assert.equal(resumen.semanasActivas, 2);
  assert.equal(resumen.semanasEnMeta, 2);
});
