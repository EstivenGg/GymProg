import { esFechaValida, esMedicionUtil } from './datos.js';

const CLAVE_DATOS = 'hevy-progress-datos';
const VERSION_ALMACEN = 1;

// Se guarda cada serie como una lista de valores en vez de un objeto: el
// historial de un año son decenas de miles de series y repetir el nombre de
// cada campo multiplicaría por cuatro lo que ocupa en localStorage.
const CAMPOS_SERIE = [
  'tituloSesion',
  'inicio',
  'fin',
  'descripcionSesion',
  'ejercicio',
  'notasEjercicio',
  'indiceSerie',
  'tipoSerie',
  'pesoLibras',
  'repeticiones',
  'distanciaKm',
  'duracionSegundos',
  'esfuerzoPercibido'
];

const CAMPOS_MEDICION = [
  'fecha',
  'pesoLibras',
  'porcentajeGrasa'
];

const CAMPOS_DE_FECHA = new Set(['inicio', 'fin', 'fecha']);

function convertirValorAGuardado(nombreCampo, valor) {
  if (!CAMPOS_DE_FECHA.has(nombreCampo)) {
    return valor === undefined ? null : valor;
  }

  if (!esFechaValida(valor)) {
    return null;
  }

  return valor.getTime();
}

function convertirValorLeido(nombreCampo, valor) {
  if (!CAMPOS_DE_FECHA.has(nombreCampo)) {
    return valor === undefined ? null : valor;
  }

  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    return null;
  }

  return new Date(valor);
}

function convertirRegistroAFila(registro, campos) {
  return campos.map(function (nombreCampo) {
    return convertirValorAGuardado(nombreCampo, registro[nombreCampo]);
  });
}

function convertirFilaARegistro(fila, campos) {
  const registro = {};

  campos.forEach(function (nombreCampo, indiceCampo) {
    registro[nombreCampo] = convertirValorLeido(nombreCampo, fila[indiceCampo]);
  });

  return registro;
}

export function serializarDatos(series, mediciones) {
  return {
    version: VERSION_ALMACEN,
    guardadoEn: new Date().toISOString(),
    series: {
      campos: CAMPOS_SERIE,
      filas: series.map(function (serie) {
        return convertirRegistroAFila(serie, CAMPOS_SERIE);
      })
    },
    mediciones: {
      campos: CAMPOS_MEDICION,
      filas: mediciones.map(function (medicion) {
        return convertirRegistroAFila(medicion, CAMPOS_MEDICION);
      })
    }
  };
}

function leerTabla(tabla, camposEsperados) {
  if (!tabla || !Array.isArray(tabla.filas)) {
    return [];
  }

  const campos = Array.isArray(tabla.campos) ? tabla.campos : camposEsperados;

  return tabla.filas
    .filter(Array.isArray)
    .map(function (fila) {
      return convertirFilaARegistro(fila, campos);
    });
}

// Un historial corrupto o de una versión anterior no debe romper el arranque:
// se descarta y el tablero vuelve a los archivos publicados.
export function deserializarDatos(contenido) {
  if (!contenido || contenido.version !== VERSION_ALMACEN) {
    return null;
  }

  const series = leerTabla(contenido.series, CAMPOS_SERIE)
    .filter(function (serie) {
      return esFechaValida(serie.inicio);
    });

  const mediciones = leerTabla(contenido.mediciones, CAMPOS_MEDICION)
    .filter(esMedicionUtil);

  if (series.length === 0 && mediciones.length === 0) {
    return null;
  }

  return {
    series: series,
    mediciones: mediciones,
    guardadoEn: contenido.guardadoEn || null
  };
}

function obtenerAlmacen() {
  try {
    return globalThis.localStorage || null;
  } catch (errorAcceso) {
    // Safari en modo privado y algunos navegadores con cookies bloqueadas
    // lanzan al tocar localStorage en lugar de devolver null.
    return null;
  }
}

export function guardarDatosLocales(series, mediciones) {
  const almacen = obtenerAlmacen();

  if (!almacen) {
    return { guardado: false, motivo: 'sin-almacen' };
  }

  try {
    almacen.setItem(
      CLAVE_DATOS,
      JSON.stringify(serializarDatos(series, mediciones))
    );

    return { guardado: true, motivo: null };
  } catch (errorEscritura) {
    return { guardado: false, motivo: 'sin-espacio' };
  }
}

export function leerDatosLocales() {
  const almacen = obtenerAlmacen();

  if (!almacen) {
    return null;
  }

  let contenidoGuardado = null;

  try {
    contenidoGuardado = almacen.getItem(CLAVE_DATOS);
  } catch (errorLectura) {
    return null;
  }

  if (!contenidoGuardado) {
    return null;
  }

  try {
    return deserializarDatos(JSON.parse(contenidoGuardado));
  } catch (errorFormato) {
    borrarDatosLocales();
    return null;
  }
}

export function hayDatosLocales() {
  const almacen = obtenerAlmacen();

  if (!almacen) {
    return false;
  }

  try {
    return almacen.getItem(CLAVE_DATOS) !== null;
  } catch (errorLectura) {
    return false;
  }
}

export function borrarDatosLocales() {
  const almacen = obtenerAlmacen();

  if (!almacen) {
    return;
  }

  try {
    almacen.removeItem(CLAVE_DATOS);
  } catch (errorBorrado) {
    // Sin almacenamiento disponible no hay nada que borrar.
  }
}
