import { estadoAplicacion } from './configuracion.js';
import {
  convertirFechaHevy,
  convertirNumero,
  obtenerInicioDelDia,
  sumarDias
} from './utilidades.js';

function crearEstadoLecturaCSV() {
  return {
    filas: [],
    filaActual: [],
    contenidoCelda: '',
    dentroDeComillas: false
  };
}

function guardarCeldaActual(estadoLectura) {
  estadoLectura.filaActual.push(estadoLectura.contenidoCelda);
  estadoLectura.contenidoCelda = '';
}

function guardarFilaActual(estadoLectura) {
  const contenidoSinRetorno = estadoLectura.contenidoCelda.replace(/\r$/, '');

  estadoLectura.filaActual.push(contenidoSinRetorno);
  estadoLectura.filas.push(estadoLectura.filaActual);
  estadoLectura.filaActual = [];
  estadoLectura.contenidoCelda = '';
}

function procesarCaracterEntreComillas(
  estadoLectura,
  caracterActual,
  siguienteCaracter
) {
  const encontroComillaEscapada = caracterActual === '"'
    && siguienteCaracter === '"';

  if (encontroComillaEscapada) {
    estadoLectura.contenidoCelda += '"';
    return 1;
  }

  if (caracterActual === '"') {
    estadoLectura.dentroDeComillas = false;
    return 0;
  }

  estadoLectura.contenidoCelda += caracterActual;
  return 0;
}

function procesarCaracterFueraDeComillas(estadoLectura, caracterActual) {
  if (caracterActual === '"') {
    estadoLectura.dentroDeComillas = true;
    return;
  }

  if (caracterActual === ',') {
    guardarCeldaActual(estadoLectura);
    return;
  }

  if (caracterActual === '\n') {
    guardarFilaActual(estadoLectura);
    return;
  }

  estadoLectura.contenidoCelda += caracterActual;
}

function procesarCaracterCSV(
  estadoLectura,
  caracterActual,
  siguienteCaracter
) {
  if (estadoLectura.dentroDeComillas) {
    return procesarCaracterEntreComillas(
      estadoLectura,
      caracterActual,
      siguienteCaracter
    );
  }

  procesarCaracterFueraDeComillas(estadoLectura, caracterActual);
  return 0;
}

function guardarUltimaFilaSiExiste(estadoLectura) {
  const existeContenidoPendiente = estadoLectura.contenidoCelda.length > 0;
  const existeFilaPendiente = estadoLectura.filaActual.length > 0;

  if (existeContenidoPendiente || existeFilaPendiente) {
    guardarFilaActual(estadoLectura);
  }
}

export function convertirCSVaObjetos(textoCSVOriginal) {
  const estadoLectura = crearEstadoLecturaCSV();
  let textoCSV = String(textoCSVOriginal || '');

  textoCSV = textoCSV.replace(/^\uFEFF/, '');

  for (let indiceCaracter = 0; indiceCaracter < textoCSV.length; indiceCaracter += 1) {
    const caracterActual = textoCSV[indiceCaracter];
    const siguienteCaracter = textoCSV[indiceCaracter + 1];

    const caracteresAdicionalesConsumidos = procesarCaracterCSV(
      estadoLectura,
      caracterActual,
      siguienteCaracter
    );

    indiceCaracter += caracteresAdicionalesConsumidos;
  }

  guardarUltimaFilaSiExiste(estadoLectura);

  const filasCSV = estadoLectura.filas;

  if (filasCSV.length === 0) {
    return [];
  }

  const primeraFila = filasCSV.shift();
  const encabezados = primeraFila.map(function (encabezado) {
    return encabezado.trim();
  });

  const filasConContenido = filasCSV.filter(function (celdas) {
    return celdas.some(function (celda) {
      return celda.trim() !== '';
    });
  });

  return filasConContenido.map(function (celdas) {
    const filaConvertida = {};

    encabezados.forEach(function (encabezado, indiceEncabezado) {
      let valorCelda = '';

      if (celdas[indiceEncabezado] !== undefined) {
        valorCelda = celdas[indiceEncabezado];
      }

      filaConvertida[encabezado] = valorCelda;
    });

    return filaConvertida;
  });
}

function convertirFilaEnSerie(filaCSV) {
  let indiceSerie = convertirNumero(filaCSV.set_index);

  if (indiceSerie === null) {
    indiceSerie = 0;
  }

  return {
    tituloSesion: filaCSV.title || 'Entrenamiento',
    inicio: convertirFechaHevy(filaCSV.start_time),
    fin: convertirFechaHevy(filaCSV.end_time),
    descripcionSesion: filaCSV.description || '',
    ejercicio: filaCSV.exercise_title || 'Ejercicio',
    notasEjercicio: filaCSV.exercise_notes || '',
    indiceSerie: indiceSerie,
    tipoSerie: filaCSV.set_type || 'normal',
    pesoLibras: convertirNumero(filaCSV.weight_lbs),
    repeticiones: convertirNumero(filaCSV.reps),
    distanciaKm: convertirNumero(filaCSV.distance_km),
    duracionSegundos: convertirNumero(filaCSV.duration_seconds),
    esfuerzoPercibido: convertirNumero(filaCSV.rpe)
  };
}

function convertirFilaEnMedicion(filaCSV) {
  return {
    fecha: convertirFechaHevy(filaCSV.date),
    pesoLibras: convertirNumero(filaCSV.weight_lbs),
    porcentajeGrasa: convertirNumero(filaCSV.fat_percent)
  };
}

function compararMedicionesPorFecha(primeraMedicion, segundaMedicion) {
  return primeraMedicion.fecha - segundaMedicion.fecha;
}

function compararSesionesPorFecha(primeraSesion, segundaSesion) {
  return primeraSesion.inicio - segundaSesion.inicio;
}

function actualizarFechaMasReciente() {
  const fechasDisponibles = [];

  estadoAplicacion.sesiones.forEach(function (sesion) {
    fechasDisponibles.push(sesion.inicio);
  });

  estadoAplicacion.mediciones.forEach(function (medicion) {
    fechasDisponibles.push(medicion.fecha);
  });

  if (fechasDisponibles.length === 0) {
    estadoAplicacion.fechaMasReciente = new Date();
    return;
  }

  const marcasDeTiempo = fechasDisponibles.map(function (fecha) {
    return fecha.getTime();
  });

  const marcaMasReciente = Math.max.apply(null, marcasDeTiempo);
  estadoAplicacion.fechaMasReciente = new Date(marcaMasReciente);
}

export function prepararDatos(filasEntrenamiento, filasMediciones) {
  const seriesConvertidas = filasEntrenamiento.map(convertirFilaEnSerie);

  estadoAplicacion.todasLasSeries = seriesConvertidas.filter(function (serie) {
    return serie.inicio instanceof Date && !Number.isNaN(serie.inicio.getTime());
  });

  const medicionesConvertidas = filasMediciones.map(convertirFilaEnMedicion);

  estadoAplicacion.mediciones = medicionesConvertidas
    .filter(function (medicion) {
      const tieneFecha = medicion.fecha instanceof Date;
      const tienePeso = medicion.pesoLibras !== null;
      const tieneGrasa = medicion.porcentajeGrasa !== null;

      return tieneFecha && (tienePeso || tieneGrasa);
    })
    .sort(compararMedicionesPorFecha);

  const sesionesAgrupadas = new Map();

  estadoAplicacion.todasLasSeries.forEach(function (serie) {
    const claveSesion = serie.inicio.getTime() + '|' + serie.tituloSesion;

    if (!sesionesAgrupadas.has(claveSesion)) {
      sesionesAgrupadas.set(claveSesion, {
        titulo: serie.tituloSesion,
        inicio: serie.inicio,
        fin: serie.fin,
        descripcion: serie.descripcionSesion,
        series: []
      });
    }

    sesionesAgrupadas.get(claveSesion).series.push(serie);
  });

  estadoAplicacion.sesiones = Array.from(sesionesAgrupadas.values())
    .sort(compararSesionesPorFecha);

  actualizarFechaMasReciente();
}

export function aplicarFiltroPeriodo() {
  const selectorPeriodo = document.getElementById('periodSelect');
  estadoAplicacion.periodoSeleccionado = selectorPeriodo.value;

  let fechaLimite = null;

  if (estadoAplicacion.periodoSeleccionado !== 'all') {
    const cantidadDias = Number(estadoAplicacion.periodoSeleccionado);
    const inicioFechaReciente = obtenerInicioDelDia(estadoAplicacion.fechaMasReciente);

    fechaLimite = sumarDias(inicioFechaReciente, -cantidadDias + 1);
  }

  if (fechaLimite) {
    estadoAplicacion.sesionesFiltradas = estadoAplicacion.sesiones.filter(function (sesion) {
      return sesion.inicio >= fechaLimite;
    });
  } else {
    estadoAplicacion.sesionesFiltradas = estadoAplicacion.sesiones.slice();
  }

  const seriesPermitidas = new Set();

  estadoAplicacion.sesionesFiltradas.forEach(function (sesion) {
    sesion.series.forEach(function (serie) {
      seriesPermitidas.add(serie);
    });
  });

  estadoAplicacion.seriesFiltradas = estadoAplicacion.todasLasSeries.filter(function (serie) {
    return seriesPermitidas.has(serie);
  });
}
