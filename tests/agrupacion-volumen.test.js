import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  agruparVolumen,
  contarSesionesSinCarga,
  filtrarSesionesPorRutina,
  obtenerAgrupacion,
  RUTINA_TODAS
} from '../src/agrupacion-volumen.js';

function crearSesion(titulo, fecha, series) {
  return {
    titulo: titulo,
    inicio: new Date(fecha + 'T10:00:00'),
    fin: new Date(fecha + 'T11:00:00'),
    series: series.map(function (serie) {
      return {
        tipoSerie: 'normal',
        ejercicio: 'Sentadilla',
        pesoLibras: serie[0],
        repeticiones: serie[1]
      };
    })
  };
}

// Lunes 2026-03-02 a domingo 2026-03-08; el 9 ya es la semana siguiente.
const SESIONES = [
  crearSesion('Empuje', '2026-03-02', [[100, 5]]),
  crearSesion('Tirón', '2026-03-05', [[100, 10]]),
  crearSesion('Empuje', '2026-03-09', [[200, 5]]),
  crearSesion('Empuje', '2026-04-06', [[50, 4]])
];

test('la vista por sesión deja una barra por entrenamiento', function () {
  const puntos = agruparVolumen(SESIONES, 'sesion');

  assert.equal(puntos.length, 4);
  assert.deepEqual(
    puntos.map(function (punto) {
      return punto.volumenLibras;
    }),
    [500, 1000, 1000, 200]
  );
  assert.equal(puntos[0].rutina, 'Empuje');
  assert.equal(puntos[0].cantidadSesiones, 1);
});

test('la vista semanal suma las sesiones de la misma semana', function () {
  const puntos = agruparVolumen(SESIONES, 'semana');

  assert.equal(puntos.length, 3);
  assert.equal(puntos[0].volumenLibras, 1500);
  assert.equal(puntos[0].cantidadSesiones, 2);
  assert.equal(puntos[0].fecha.getDate(), 2);
  assert.equal(puntos[0].fin.getDate(), 8);
});

test('la vista mensual agrupa por mes natural', function () {
  const puntos = agruparVolumen(SESIONES, 'mes');

  assert.equal(puntos.length, 2);
  assert.equal(puntos[0].volumenLibras, 2500);
  assert.equal(puntos[0].cantidadSesiones, 3);
  assert.equal(puntos[1].volumenLibras, 200);
});

test('un bloque solo hereda la rutina si todas sus sesiones la comparten', function () {
  const puntos = agruparVolumen(SESIONES, 'semana');

  // Semana mixta: Empuje y Tirón, así que no puede pintarse de ninguna.
  assert.equal(puntos[0].rutina, null);
  assert.deepEqual(puntos[0].rutinas, ['Empuje', 'Tirón']);

  // Semana de una sola rutina: conserva el color.
  assert.equal(puntos[1].rutina, 'Empuje');
});

test('las sesiones sin carga no generan barra en ninguna agrupación', function () {
  const sesiones = SESIONES.concat([
    crearSesion('Cardio', '2026-03-03', [[null, null]])
  ]);

  assert.equal(contarSesionesSinCarga(sesiones), 1);
  assert.equal(agruparVolumen(sesiones, 'sesion').length, 4);
  assert.equal(agruparVolumen(sesiones, 'semana')[0].cantidadSesiones, 2);
});

test('filtrar por rutina deja solo esa rutina y «todas» no filtra nada', function () {
  assert.equal(filtrarSesionesPorRutina(SESIONES, 'Empuje').length, 3);
  assert.equal(filtrarSesionesPorRutina(SESIONES, RUTINA_TODAS).length, 4);
  assert.equal(filtrarSesionesPorRutina(SESIONES, null).length, 4);
});

test('al filtrar por rutina las semanas mixtas recuperan su color', function () {
  const sesionesDeEmpuje = filtrarSesionesPorRutina(SESIONES, 'Empuje');
  const puntos = agruparVolumen(sesionesDeEmpuje, 'semana');

  assert.ok(puntos.every(function (punto) {
    return punto.rutina === 'Empuje';
  }));
});

test('los puntos siempre salen ordenados por fecha', function () {
  const desordenadas = [SESIONES[3], SESIONES[1], SESIONES[0]];

  ['sesion', 'semana', 'mes'].forEach(function (agrupacion) {
    const fechas = agruparVolumen(desordenadas, agrupacion).map(function (punto) {
      return punto.fecha.getTime();
    });

    assert.deepEqual(fechas, fechas.slice().sort(function (a, b) {
      return a - b;
    }));
  });
});

test('solo se reconocen las tres agrupaciones previstas', function () {
  assert.equal(obtenerAgrupacion('semana').descripcion, 'por semana');
  assert.equal(obtenerAgrupacion('trimestre'), null);
  assert.equal(obtenerAgrupacion(null), null);
});

test('una barra solo lleva clave de sesión si representa exactamente una', function () {
  const porSesion = agruparVolumen(SESIONES, 'sesion');
  const porSemana = agruparVolumen(SESIONES, 'semana');

  assert.ok(porSesion.every(function (punto) {
    return typeof punto.claveSesion === 'string';
  }));

  // Semana mixta de dos sesiones: no hay un entrenamiento al que ir.
  assert.equal(porSemana[0].cantidadSesiones, 2);
  assert.equal(porSemana[0].claveSesion, null);

  // Semana de una sola sesión: sí lo hay.
  assert.equal(porSemana[1].cantidadSesiones, 1);
  assert.equal(typeof porSemana[1].claveSesion, 'string');
});
