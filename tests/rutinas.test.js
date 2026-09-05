import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  contarSesionesPorRutina,
  crearColoresDeRutina,
  crearVariablesDeRutina,
  VARIABLE_OTRAS_RUTINAS
} from '../src/rutinas.js';

function sesiones(titulos) {
  return titulos.map(function (titulo) {
    return { titulo: titulo };
  });
}

test('ordena las rutinas de la más frecuente a la menos', function () {
  const rutinas = contarSesionesPorRutina(sesiones([
    'Tirón', 'Empuje', 'Empuje', 'Pierna', 'Empuje', 'Tirón'
  ]));

  assert.deepEqual(rutinas, [
    { titulo: 'Empuje', cantidad: 3 },
    { titulo: 'Tirón', cantidad: 2 },
    { titulo: 'Pierna', cantidad: 1 }
  ]);
});

test('con el mismo número de sesiones desempata por nombre', function () {
  const rutinas = contarSesionesPorRutina(sesiones(['Zancadas', 'Abdomen']));

  assert.deepEqual(rutinas.map(function (rutina) {
    return rutina.titulo;
  }), ['Abdomen', 'Zancadas']);
});

test('las cuatro rutinas más frecuentes reciben color propio', function () {
  const variables = crearVariablesDeRutina(sesiones([
    'A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', 'E'
  ]));

  assert.deepEqual(
    ['A', 'B', 'C', 'D'].map(function (titulo) {
      return variables.get(titulo);
    }),
    ['--orange', '--blue', '--violet', '--green']
  );
  assert.equal(variables.get('E'), VARIABLE_OTRAS_RUTINAS);
});

test('el color de una rutina no depende de qué sesiones se estén viendo', function () {
  const historial = sesiones(['Empuje', 'Empuje', 'Tirón']);
  const colores = crearColoresDeRutina(historial);

  assert.equal(colores.get('Empuje'), 'var(--orange)');
  assert.equal(colores.get('Tirón'), 'var(--blue)');
});
