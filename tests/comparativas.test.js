import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crearComparativasResumen } from '../src/comparativas.js';

function crearSesion(fecha, peso, repeticiones, duracionMinutos) {
  const inicio = new Date(fecha + 'T10:00:00');
  const fin = new Date(inicio.getTime() + duracionMinutos * 60_000);

  return {
    inicio: inicio,
    fin: fin,
    series: [{
      tipoSerie: 'normal',
      pesoLibras: peso,
      repeticiones: repeticiones,
      ejercicio: 'Ejercicio'
    }]
  };
}

test('compara un periodo numerico con el bloque anterior equivalente', function () {
  const sesiones = [
    crearSesion('2026-01-03', 100, 5, 30),
    crearSesion('2026-01-06', 100, 5, 40),
    crearSesion('2026-01-10', 120, 5, 50),
    crearSesion('2026-01-14', 120, 5, 60)
  ];
  const resultado = crearComparativasResumen(
    sesiones,
    new Date('2026-01-14T10:00:00'),
    '7'
  );

  assert.equal(resultado.hayHistorialAnterior, true);
  assert.equal(resultado.actual.entrenamientos, 2);
  assert.equal(resultado.anterior.entrenamientos, 2);
  assert.equal(resultado.actual.volumen, 1200);
  assert.equal(resultado.anterior.volumen, 1000);
  assert.equal(resultado.actual.duracion, 110);
  assert.equal(resultado.anterior.duracion, 70);
});

test('divide todo el historial en dos mitades temporales', function () {
  const sesiones = [
    crearSesion('2026-01-01', 100, 5, 30),
    crearSesion('2026-01-03', 100, 5, 30),
    crearSesion('2026-01-10', 120, 5, 45),
    crearSesion('2026-01-14', 120, 5, 45)
  ];
  const resultado = crearComparativasResumen(
    sesiones,
    new Date('2026-01-14T10:00:00'),
    'all'
  );

  assert.equal(resultado.descripcion, 'vs. mitad anterior');
  assert.equal(
    resultado.comparadoCon,
    'Comparado con la mitad anterior del historial'
  );
  assert.equal(resultado.hayHistorialAnterior, true);
  assert.equal(resultado.actual.entrenamientos, 2);
  assert.equal(resultado.anterior.entrenamientos, 2);
});

test('no inventa una comparacion cuando no existe historial anterior', function () {
  const sesiones = [crearSesion('2026-01-14', 100, 5, 30)];
  const resultado = crearComparativasResumen(
    sesiones,
    new Date('2026-01-14T10:00:00'),
    '30'
  );

  assert.equal(resultado.hayHistorialAnterior, false);
  assert.equal(resultado.anterior.entrenamientos, 0);
  assert.equal(
    resultado.comparadoCon,
    'Comparado con el periodo anterior equivalente'
  );
});
