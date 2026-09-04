import {
  estadoAplicacion,
  formatoFechaCompleta,
  formatoNumero,
  NOMBRES_DIAS
} from '../configuracion.js';
import { calcular1RMEstimado, calcularMetricasSesion, esSerieEfectiva, obtenerInicioDeSemana } from '../metricas.js';
import {
  clonarElementoDePlantilla,
  crearClaveDeFecha,
  obtenerClaveDeUltimaSesion,
  obtenerElemento,
  sumarDias
} from '../utilidades.js';

function pintarCalendarioActividad(configuracion) {
  const anioCalendario = estadoAplicacion.fechaMasReciente.getFullYear();
  const fechaInicialDelAnio = new Date(anioCalendario, 0, 1);
  const fechaLimiteDelAnio = new Date(anioCalendario + 1, 0, 1);
  const fechaFinalDelAnio = new Date(anioCalendario, 11, 31);
  const fechaInicial = obtenerInicioDeSemana(fechaInicialDelAnio);
  const fechaFinal = sumarDias(obtenerInicioDeSemana(fechaFinalDelAnio), 6);
  const entrenamientosPorDia = new Map();

  estadoAplicacion.sesiones.forEach(function (sesion) {
    if (sesion.inicio < fechaInicialDelAnio || sesion.inicio >= fechaLimiteDelAnio) {
      return;
    }

    const claveDia = crearClaveDeFecha(sesion.inicio);
    let cantidadActual = 0;

    if (entrenamientosPorDia.has(claveDia)) {
      cantidadActual = entrenamientosPorDia.get(claveDia);
    }

    entrenamientosPorDia.set(claveDia, cantidadActual + 1);
  });

  const fechasCalendario = [];

  for (
    let fechaActual = new Date(fechaInicial);
    fechaActual <= fechaFinal;
    fechaActual = sumarDias(fechaActual, 1)
  ) {
    fechasCalendario.push(new Date(fechaActual));
  }

  let cantidadMaxima = 1;

  entrenamientosPorDia.forEach(function (cantidadEntrenamientos) {
    cantidadMaxima = Math.max(cantidadMaxima, cantidadEntrenamientos);
  });

  const celdasCalendario = document.createDocumentFragment();
  const claveHoy = crearClaveDeFecha(new Date());
  const cantidadSemanas = Math.ceil(fechasCalendario.length / 7);

  fechasCalendario.forEach(function (fecha, indiceFecha) {
    const claveDia = crearClaveDeFecha(fecha);
    const perteneceAlAnio = fecha >= fechaInicialDelAnio && fecha < fechaLimiteDelAnio;
    let cantidadEntrenamientos = 0;

    if (entrenamientosPorDia.has(claveDia)) {
      cantidadEntrenamientos = entrenamientosPorDia.get(claveDia);
    }

    let nivelActividad = 0;

    if (cantidadEntrenamientos > 0) {
      nivelActividad = Math.max(
        1,
        Math.ceil(cantidadEntrenamientos / cantidadMaxima * 4)
      );
    }

    let palabraEntrenamiento = 'entrenamientos';

    if (cantidadEntrenamientos === 1) {
      palabraEntrenamiento = 'entrenamiento';
    }

    const descripcionCelda = formatoFechaCompleta.format(fecha)
      + ': '
      + cantidadEntrenamientos
      + ' '
      + palabraEntrenamiento;

    const celdaCalendario = clonarElementoDePlantilla('heatmapCellTemplate');
    const indiceFila = indiceFecha % 7;
    const indiceColumna = Math.floor(indiceFecha / 7);
    const esHoy = crearClaveDeFecha(fecha) === claveHoy;

    celdaCalendario.dataset.level = perteneceAlAnio ? String(nivelActividad) : '0';
    celdaCalendario.classList.toggle(
      'no-entry-animation',
      !configuracion.animarEntrada
    );
    celdaCalendario.classList.toggle('is-outside-year', !perteneceAlAnio);
    celdaCalendario.classList.toggle('is-today', perteneceAlAnio && esHoy);

    if (perteneceAlAnio) {
      celdaCalendario.dataset.label = descripcionCelda;
      celdaCalendario.tabIndex = 0;
      celdaCalendario.setAttribute('aria-describedby', 'heatmapTooltip');
    } else {
      celdaCalendario.tabIndex = -1;
      celdaCalendario.setAttribute('aria-hidden', 'true');
    }
    celdaCalendario.style.setProperty(
      '--cell-delay',
      Math.min(indiceColumna, 24) * 6 + indiceFila * 10 + 'ms'
    );
    celdasCalendario.appendChild(celdaCalendario);
  });

  const elementoCalendario = obtenerElemento('heatmap');
  const grillaCalendario = elementoCalendario.querySelector('.heatmap');
  const mesesCalendario = elementoCalendario.querySelector('.heatmap-months');
  const nombresMeses = new Intl.DateTimeFormat('es', { month: 'short' });
  const columnasMeses = Array.from({ length: 12 }, function (_, indiceMes) {
    const fechaMes = new Date(anioCalendario, indiceMes, 1);
    const claveMes = crearClaveDeFecha(fechaMes);
    const indiceFechaMes = fechasCalendario.findIndex(function (fecha) {
      return crearClaveDeFecha(fecha) === claveMes;
    });

    return {
      columna: Math.floor(indiceFechaMes / 7) + 1,
      nombre: nombresMeses.format(fechaMes).replace('.', '')
    };
  });

  const etiquetasMeses = document.createDocumentFragment();

  columnasMeses.forEach(function (mes, indiceMes) {
    const etiquetaMes = document.createElement('span');
    const siguienteMes = columnasMeses[indiceMes + 1];
    const columnaFinal = siguienteMes ? siguienteMes.columna : cantidadSemanas + 1;

    etiquetaMes.textContent = mes.nombre;
    etiquetaMes.style.gridColumn = mes.columna + ' / ' + columnaFinal;
    etiquetasMeses.appendChild(etiquetaMes);
  });

  elementoCalendario.style.setProperty('--heatmap-weeks', String(cantidadSemanas));
  grillaCalendario.replaceChildren(celdasCalendario);
  mesesCalendario.replaceChildren(etiquetasMeses);

  const sesionesEnCalendario = estadoAplicacion.sesiones.filter(function (sesion) {
    return sesion.inicio >= fechaInicialDelAnio && sesion.inicio < fechaLimiteDelAnio;
  }).length;

  obtenerElemento('heatmapLabel').textContent = sesionesEnCalendario
    + ' sesiones · '
    + anioCalendario;

  const elementoPista = obtenerElemento('heatmapHint');
  const esActividadDispersa = sesionesEnCalendario > 0 && sesionesEnCalendario < 5;

  elementoPista.hidden = !esActividadDispersa;

  if (esActividadDispersa) {
    elementoPista.textContent = 'Aún hay pocas sesiones en este rango — sigue registrando '
      + 'entrenamientos para ver tu patrón completo.';
  }
}

function obtenerFranjaHoraria(horaPromedio) {
  if (horaPromedio < 12) {
    return 'mañana';
  }

  if (horaPromedio < 18) {
    return 'tarde';
  }

  return 'noche';
}

function pintarPatronesDeEntrenamiento() {
  const sesiones = estadoAplicacion.sesionesFiltradas;
  const cantidadesPorDia = [0, 0, 0, 0, 0, 0, 0];

  sesiones.forEach(function (sesion) {
    cantidadesPorDia[sesion.inicio.getDay()] += 1;
  });

  const mayorCantidadDia = Math.max.apply(null, cantidadesPorDia);
  const indiceDiaFavorito = cantidadesPorDia.indexOf(mayorCantidadDia);

  let duracionAcumulada = 0;
  let horasAcumuladas = 0;

  sesiones.forEach(function (sesion) {
    duracionAcumulada += calcularMetricasSesion(sesion).duracionMinutos;
    horasAcumuladas += sesion.inicio.getHours();
  });

  let duracionPromedio = 0;
  let horaPromedio = 0;

  if (sesiones.length > 0) {
    duracionPromedio = Math.round(duracionAcumulada / sesiones.length);
    horaPromedio = Math.round(horasAcumuladas / sesiones.length);
  }

  let nombreDiaFavorito = '—';
  let textoHorario = '—';

  if (sesiones.length > 0) {
    nombreDiaFavorito = NOMBRES_DIAS[indiceDiaFavorito];
    textoHorario = 'Por la ' + obtenerFranjaHoraria(horaPromedio);
  }

  const patrones = [
    {
      rutaIcono: 'M7 4v3m10-3v3M5 9h14v11H5V9Z',
      valor: nombreDiaFavorito,
      etiqueta: 'Día más frecuente'
    },
    {
      rutaIcono: 'M12 7v5l3 2M12 3a9 9 0 1 1-9 9',
      valor: duracionPromedio + ' min',
      etiqueta: 'Duración promedio'
    },
    {
      rutaIcono: 'M12 3v2m0 14v2M5.6 5.6 7 7',
      valor: textoHorario,
      etiqueta: 'Horario habitual'
    }
  ];

  const elementosPatron = document.createDocumentFragment();

  patrones.forEach(function (patron) {
    const elementoPatron = clonarElementoDePlantilla('patternItemTemplate');
    elementoPatron.querySelector('path').setAttribute('d', patron.rutaIcono);
    elementoPatron.querySelector('[data-field="value"]').textContent = patron.valor;
    elementoPatron.querySelector('[data-field="label"]').textContent = patron.etiqueta;
    elementosPatron.appendChild(elementoPatron);
  });

  obtenerElemento('patternList').replaceChildren(elementosPatron);

  const elementoInsight = obtenerElemento('patternInsight');

  if (sesiones.length === 0) {
    elementoInsight.textContent = 'Importa tu historial para descubrir tu patrón de entrenamiento.';
    return;
  }

  elementoInsight.textContent = 'Sueles entrenar los '
    + nombreDiaFavorito
    + ', con sesiones de '
    + duracionPromedio
    + ' min '
    + textoHorario.toLowerCase()
    + '.';
}

function obtenerMejoresSeriesPorEjercicio() {
  const mejoresSeries = new Map();

  estadoAplicacion.seriesFiltradas
    .filter(function (serie) {
      return esSerieEfectiva(serie)
        && Boolean(serie.pesoLibras)
        && Boolean(serie.repeticiones);
    })
    .forEach(function (serie) {
      const mejorSerieActual = mejoresSeries.get(serie.ejercicio);

      if (!mejorSerieActual) {
        mejoresSeries.set(serie.ejercicio, serie);
        return;
      }

      if (calcular1RMEstimado(serie) > calcular1RMEstimado(mejorSerieActual)) {
        mejoresSeries.set(serie.ejercicio, serie);
      }
    });

  return mejoresSeries;
}

function pintarTablaDeRecords(configuracion) {
  const tablaRecords = obtenerElemento('recordsTable');
  const mejoresSeries = obtenerMejoresSeriesPorEjercicio();
  const recordsOrdenados = Array.from(mejoresSeries.entries());

  recordsOrdenados.sort(function (primerRecord, segundoRecord) {
    return calcular1RMEstimado(segundoRecord[1])
      - calcular1RMEstimado(primerRecord[1]);
  });

  if (recordsOrdenados.length === 0) {
    tablaRecords.replaceChildren(
      clonarElementoDePlantilla('recordEmptyRowTemplate')
    );
    return;
  }

  const claveUltimaSesion = obtenerClaveDeUltimaSesion(estadoAplicacion.sesionesFiltradas);
  const filasRecords = document.createDocumentFragment();

  recordsOrdenados.forEach(function (informacionRecord, indiceRecord) {
    const nombreEjercicio = informacionRecord[0];
    const mejorSerie = informacionRecord[1];
    const esRecordReciente = claveUltimaSesion !== null
      && crearClaveDeFecha(mejorSerie.inicio) === claveUltimaSesion;
    const filaRecord = clonarElementoDePlantilla('recordRowTemplate');

    if (configuracion.animarEntrada) {
      filaRecord.classList.add('record-row-enter');
      filaRecord.style.setProperty('--row-delay', indiceRecord * 40 + 'ms');
    } else {
      filaRecord.classList.add('no-entry-animation');
    }
    filaRecord.classList.toggle('record-new', esRecordReciente);
    filaRecord.querySelector('.record-badge').hidden = !esRecordReciente;
    filaRecord.querySelector('.record-badge-best').hidden = indiceRecord !== 0;
    filaRecord.querySelector('[data-field="exercise"]').textContent = nombreEjercicio;
    filaRecord.querySelector('[data-field="set"]').textContent = formatoNumero
      .format(mejorSerie.pesoLibras) + ' lb × ' + mejorSerie.repeticiones;
    filaRecord.querySelector('[data-field="estimated-1rm"]').textContent = formatoNumero
      .format(calcular1RMEstimado(mejorSerie)) + ' lb';
    filaRecord.querySelector('[data-field="date"]').textContent = formatoFechaCompleta
      .format(mejorSerie.inicio);
    filasRecords.appendChild(filaRecord);
  });

  tablaRecords.replaceChildren(filasRecords);
}

export function pintarProgreso(configuracionOriginal) {
  const configuracion = configuracionOriginal || { animarEntrada: true };

  pintarCalendarioActividad(configuracion);
  pintarPatronesDeEntrenamiento();
  pintarTablaDeRecords(configuracion);
}
