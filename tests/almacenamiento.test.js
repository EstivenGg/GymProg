import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
  borrarDatosLocales,
  deserializarDatos,
  guardarDatosLocales,
  hayDatosLocales,
  leerDatosLocales,
  serializarDatos
} from '../src/almacenamiento.js';

function crearAlmacenFalso(fallaAlEscribir) {
  const valores = new Map();

  return {
    getItem: function (clave) {
      return valores.has(clave) ? valores.get(clave) : null;
    },
    setItem: function (clave, valor) {
      if (fallaAlEscribir) {
        throw new DOMException('sin espacio', 'QuotaExceededError');
      }

      valores.set(clave, valor);
    },
    removeItem: function (clave) {
      valores.delete(clave);
    }
  };
}

function usarAlmacen(almacen) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: almacen,
    configurable: true,
    writable: true
  });
}

function crearSerie(inicio) {
  return {
    tituloSesion: 'Tirón',
    inicio: new Date(inicio),
    fin: new Date(inicio),
    descripcionSesion: '',
    ejercicio: 'Peso muerto (barra)',
    notasEjercicio: 'Sin impulso',
    indiceSerie: 0,
    tipoSerie: 'normal',
    pesoLibras: 225,
    repeticiones: 4,
    distanciaKm: null,
    duracionSegundos: null,
    esfuerzoPercibido: 9
  };
}

function crearMedicion(fecha) {
  return {
    fecha: new Date(fecha),
    pesoLibras: 181.4,
    porcentajeGrasa: 21.2
  };
}

beforeEach(function () {
  usarAlmacen(crearAlmacenFalso(false));
});

test('conserva series y mediciones al guardar y volver a leer', function () {
  const serie = crearSerie('2026-03-01T10:00:00');
  const medicion = crearMedicion('2026-03-01T08:00:00');

  assert.deepEqual(guardarDatosLocales([serie], [medicion]), {
    guardado: true,
    motivo: null
  });

  const recuperado = leerDatosLocales();

  assert.deepEqual(recuperado.series, [serie]);
  assert.deepEqual(recuperado.mediciones, [medicion]);
  assert.equal(typeof recuperado.guardadoEn, 'string');
});

test('conserva las fechas como fechas y no como texto', function () {
  guardarDatosLocales([crearSerie('2026-03-01T10:00:00')], []);

  const recuperado = leerDatosLocales();

  assert.ok(recuperado.series[0].inicio instanceof Date);
  assert.equal(recuperado.series[0].inicio.getTime(), new Date('2026-03-01T10:00:00').getTime());
});

test('guarda las series sin repetir el nombre de cada campo', function () {
  const contenido = serializarDatos([crearSerie('2026-03-01T10:00:00')], []);

  assert.ok(Array.isArray(contenido.series.filas[0]));
  assert.equal(contenido.series.filas[0].length, contenido.series.campos.length);
});

test('descarta un historial de otra versión del formato', function () {
  const contenido = serializarDatos([crearSerie('2026-03-01T10:00:00')], []);

  contenido.version = 99;

  assert.equal(deserializarDatos(contenido), null);
});

test('descarta un historial vacío o corrupto en vez de romper el arranque', function () {
  assert.equal(deserializarDatos(null), null);
  assert.equal(deserializarDatos(serializarDatos([], [])), null);
  assert.equal(deserializarDatos({ version: 1, series: 'nada' }), null);
});

test('olvida el historial cuando el texto guardado no es JSON', function () {
  globalThis.localStorage.setItem('hevy-progress-datos', '{roto');

  assert.equal(leerDatosLocales(), null);
  assert.equal(hayDatosLocales(), false);
});

test('avisa cuando el navegador no deja escribir', function () {
  usarAlmacen(crearAlmacenFalso(true));

  assert.deepEqual(guardarDatosLocales([crearSerie('2026-03-01T10:00:00')], []), {
    guardado: false,
    motivo: 'sin-espacio'
  });
});

test('funciona sin almacenamiento disponible', function () {
  usarAlmacen(null);

  assert.deepEqual(guardarDatosLocales([], []), {
    guardado: false,
    motivo: 'sin-almacen'
  });
  assert.equal(leerDatosLocales(), null);
  assert.equal(hayDatosLocales(), false);
});

test('borra el historial guardado', function () {
  guardarDatosLocales([crearSerie('2026-03-01T10:00:00')], []);
  assert.equal(hayDatosLocales(), true);

  borrarDatosLocales();
  assert.equal(hayDatosLocales(), false);
  assert.equal(leerDatosLocales(), null);
});
