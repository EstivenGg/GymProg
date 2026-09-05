import {
  convertirFilaEnMedicion,
  convertirFilaEnSerie,
  crearClaveSesion,
  esFechaValida,
  esMedicionUtil
} from './datos.js';

export function obtenerColumnasDelEncabezado(contenidoArchivo) {
  const primeraLinea = contenidoArchivo.split(/\r?\n/, 1)[0];

  const nombresColumnas = primeraLinea.split(',').map(function (nombreColumna) {
    return nombreColumna
      .replace(/^\uFEFF/, '')
      .trim()
      .replace(/^"|"$/g, '');
  });

  return new Set(nombresColumnas);
}

export function tieneColumnaDePeso(columnas) {
  return columnas.has('weight_lbs') || columnas.has('weight_kg');
}

// El encabezado manda sobre el nombre del archivo: quien renombra el export de
// Hevy sigue teniendo las columnas, pero quien exporta desde otra app puede
// tener el nombre correcto y columnas distintas.
export function identificarTipoDeArchivo(nombreArchivo, columnas) {
  const pareceEntrenamiento = columnas.has('exercise_title')
    || (columnas.has('start_time') && columnas.has('set_index'));

  if (pareceEntrenamiento) {
    return 'entrenamiento';
  }

  const pareceMedicion = columnas.has('fat_percent')
    || (columnas.has('date') && tieneColumnaDePeso(columnas));

  if (pareceMedicion) {
    return 'mediciones';
  }

  const nombre = String(nombreArchivo || '').toLowerCase();

  if (nombre.includes('workout')) {
    return 'entrenamiento';
  }

  if (nombre.includes('measurement')) {
    return 'mediciones';
  }

  return null;
}

function describirValorDeFecha(valorFecha) {
  const textoFecha = String(valorFecha === undefined ? '' : valorFecha).trim();

  if (textoFecha === '') {
    return { vacia: true, texto: '' };
  }

  return { vacia: false, texto: textoFecha };
}

function crearFilaInvalida(numeroFila, motivo, descripcion) {
  return {
    numeroFila: numeroFila,
    motivo: motivo,
    descripcion: descripcion
  };
}

function describirSesion(clave, serie, cantidadSeries) {
  return {
    clave: clave,
    titulo: serie.tituloSesion,
    inicio: serie.inicio,
    cantidadSeries: cantidadSeries
  };
}

function ordenarPorInicioDescendente(primerElemento, segundoElemento) {
  return segundoElemento.inicio - primerElemento.inicio;
}

export function analizarEntrenamientos(filasCSV, seriesActuales) {
  const clavesExistentes = new Set();

  seriesActuales.forEach(function (serie) {
    clavesExistentes.add(crearClaveSesion(serie.inicio, serie.tituloSesion));
  });

  const filasInvalidas = [];
  const sesionesPorClave = new Map();
  const seriesTotales = [];

  filasCSV.forEach(function (filaCSV, indiceFila) {
    const numeroFila = indiceFila + 2;
    const serie = convertirFilaEnSerie(filaCSV);

    if (!esFechaValida(serie.inicio)) {
      const fecha = describirValorDeFecha(filaCSV.start_time);
      const motivo = fecha.vacia
        ? 'Sin fecha de inicio'
        : 'Fecha ilegible: ' + fecha.texto;

      filasInvalidas.push(crearFilaInvalida(numeroFila, motivo, serie.ejercicio));
      return;
    }

    seriesTotales.push(serie);

    const claveSesion = crearClaveSesion(serie.inicio, serie.tituloSesion);
    let sesion = sesionesPorClave.get(claveSesion);

    if (!sesion) {
      sesion = {
        clave: claveSesion,
        yaExistia: clavesExistentes.has(claveSesion),
        series: []
      };
      sesionesPorClave.set(claveSesion, sesion);
    }

    sesion.series.push(serie);
  });

  const sesionesNuevas = [];
  const sesionesDuplicadas = [];
  const seriesNuevas = [];

  sesionesPorClave.forEach(function (sesion) {
    const resumen = describirSesion(
      sesion.clave,
      sesion.series[0],
      sesion.series.length
    );

    if (sesion.yaExistia) {
      sesionesDuplicadas.push(resumen);
      return;
    }

    sesionesNuevas.push(resumen);
    seriesNuevas.push(...sesion.series);
  });

  sesionesNuevas.sort(ordenarPorInicioDescendente);
  sesionesDuplicadas.sort(ordenarPorInicioDescendente);

  return {
    sesionesNuevas: sesionesNuevas,
    sesionesDuplicadas: sesionesDuplicadas,
    filasInvalidas: filasInvalidas,
    seriesNuevas: seriesNuevas,
    seriesTotales: seriesTotales
  };
}

export function analizarMediciones(filasCSV, medicionesActuales) {
  const fechasExistentes = new Set();

  medicionesActuales.forEach(function (medicion) {
    fechasExistentes.add(medicion.fecha.getTime());
  });

  const filasInvalidas = [];
  const medicionesNuevas = [];
  const medicionesDuplicadas = [];
  const medicionesTotales = [];
  const fechasVistasEnElArchivo = new Set();

  filasCSV.forEach(function (filaCSV, indiceFila) {
    const numeroFila = indiceFila + 2;
    const medicion = convertirFilaEnMedicion(filaCSV);

    if (!esFechaValida(medicion.fecha)) {
      const fecha = describirValorDeFecha(filaCSV.date);
      const motivo = fecha.vacia
        ? 'Sin fecha'
        : 'Fecha ilegible: ' + fecha.texto;

      filasInvalidas.push(crearFilaInvalida(numeroFila, motivo, 'Medición'));
      return;
    }

    if (!esMedicionUtil(medicion)) {
      filasInvalidas.push(crearFilaInvalida(
        numeroFila,
        'Sin peso ni % de grasa',
        'Medición'
      ));
      return;
    }

    const marcaDeTiempo = medicion.fecha.getTime();
    const repetidaEnElArchivo = fechasVistasEnElArchivo.has(marcaDeTiempo);

    // Una fecha repetida dentro del propio archivo no se cuenta dos veces, ni
    // siquiera al reemplazar el historial completo.
    if (!repetidaEnElArchivo) {
      medicionesTotales.push(medicion);
      fechasVistasEnElArchivo.add(marcaDeTiempo);
    }

    if (repetidaEnElArchivo || fechasExistentes.has(marcaDeTiempo)) {
      medicionesDuplicadas.push(medicion);
      return;
    }

    medicionesNuevas.push(medicion);
  });

  return {
    medicionesNuevas: medicionesNuevas,
    medicionesDuplicadas: medicionesDuplicadas,
    filasInvalidas: filasInvalidas,
    medicionesTotales: medicionesTotales
  };
}
