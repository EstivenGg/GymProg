import { abrirEjercicio } from './ejercicios.js';
import { crearRecordsDeRepeticiones } from '../records-repeticiones.js';
import {
  estadoAplicacion,
  formatearCarga,
  formatoFechaCompleta,
  formatoNumero,
  NOMBRES_DIAS
} from '../configuracion.js';
import { calcular1RMEstimado, calcularMetricasSesion, esSerieEfectiva, obtenerInicioDeSemana } from '../metricas.js';
import { crearProgresionFuerza, obtenerMayoresCambios } from '../progresion.js';
import {
  clonarElementoDePlantilla,
  crearClaveDeFecha,
  obtenerClaveDeUltimaSesion,
  obtenerElemento,
  obtenerInicioDelDia,
  sumarDias
} from '../utilidades.js';

// El calendario es una ventana movil de 12 meses: asi siempre esta lleno, en vez
// de vaciarse cada 1 de enero como haria un ano natural.
const SEMANAS_CALENDARIO = 52;
const CAMBIOS_POR_GRUPO = 4;

function crearTextoDelta(cambio) {
  const porcentaje = Math.round(Math.abs(cambio.porcentaje) * 100);

  if (porcentaje === 0) {
    return '0%';
  }

  return (cambio.diferencia > 0 ? '+' : '-') + porcentaje + '%';
}

function pintarCalendarioActividad(configuracion) {
  const finVentana = sumarDias(
    obtenerInicioDeSemana(estadoAplicacion.fechaMasReciente),
    6
  );
  const inicioVentana = sumarDias(finVentana, -(SEMANAS_CALENDARIO * 7) + 1);
  const ultimoDiaConDatos = obtenerInicioDelDia(estadoAplicacion.fechaMasReciente);
  const entrenamientosPorDia = new Map();

  estadoAplicacion.sesiones.forEach(function (sesion) {
    if (sesion.inicio < inicioVentana || sesion.inicio > finVentana) {
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
    let fechaActual = new Date(inicioVentana);
    fechaActual <= finVentana;
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

  fechasCalendario.forEach(function (fecha, indiceFecha) {
    const claveDia = crearClaveDeFecha(fecha);
    const estaEnLaVentana = fecha <= ultimoDiaConDatos;
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

    celdaCalendario.dataset.level = estaEnLaVentana ? String(nivelActividad) : '0';
    celdaCalendario.classList.toggle(
      'no-entry-animation',
      !configuracion.animarEntrada
    );
    celdaCalendario.classList.toggle('is-outside-range', !estaEnLaVentana);
    celdaCalendario.classList.toggle('is-today', estaEnLaVentana && claveDia === claveHoy);

    if (estaEnLaVentana) {
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
  const columnasDeMes = [];
  let mesAnterior = -1;

  for (let indiceSemana = 0; indiceSemana < SEMANAS_CALENDARIO; indiceSemana += 1) {
    const lunesDeLaSemana = fechasCalendario[indiceSemana * 7];
    const mesDeLaSemana = lunesDeLaSemana.getMonth();

    if (mesDeLaSemana !== mesAnterior) {
      mesAnterior = mesDeLaSemana;
      columnasDeMes.push({
        columna: indiceSemana + 1,
        nombre: nombresMeses.format(lunesDeLaSemana).replace('.', '')
      });
    }
  }

  const etiquetasMeses = document.createDocumentFragment();

  columnasDeMes.forEach(function (mes, indiceMes) {
    const siguienteMes = columnasDeMes[indiceMes + 1];
    const columnaFinal = siguienteMes
      ? siguienteMes.columna
      : SEMANAS_CALENDARIO + 1;

    // Un mes que solo ocupa una columna no cabe: quedaria recortado a una letra
    if (columnaFinal - mes.columna < 2) {
      return;
    }

    const etiquetaMes = document.createElement('span');

    etiquetaMes.textContent = mes.nombre;
    etiquetaMes.style.gridColumn = mes.columna + ' / ' + columnaFinal;
    etiquetasMeses.appendChild(etiquetaMes);
  });

  elementoCalendario.style.setProperty(
    '--heatmap-weeks',
    String(SEMANAS_CALENDARIO)
  );
  grillaCalendario.replaceChildren(celdasCalendario);
  mesesCalendario.replaceChildren(etiquetasMeses);

  const sesionesEnCalendario = estadoAplicacion.sesiones.filter(function (sesion) {
    return sesion.inicio >= inicioVentana && sesion.inicio <= finVentana;
  }).length;

  obtenerElemento('heatmapLabel').textContent = sesionesEnCalendario
    + ' sesiones · últimos 12 meses';

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

function pintarDistribucionSemanal(cantidadesPorDia) {
  const ordenDeDias = [1, 2, 3, 4, 5, 6, 0];
  const inicialesDeDias = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const mayorCantidad = Math.max(1, Math.max.apply(null, cantidadesPorDia));
  const barrasSemanales = document.createDocumentFragment();

  ordenDeDias.forEach(function (indiceDia, posicion) {
    const cantidad = cantidadesPorDia[indiceDia];
    const palabraSesion = cantidad === 1 ? 'sesión' : 'sesiones';
    const barraSemanal = clonarElementoDePlantilla('weekdayBarTemplate');

    barraSemanal.classList.toggle(
      'is-top',
      cantidad > 0 && cantidad === mayorCantidad
    );
    barraSemanal.querySelector('.weekday-fill').style.height = cantidad
      / mayorCantidad * 100 + '%';
    barraSemanal.querySelector('[data-field="day"]').textContent = inicialesDeDias[posicion];
    barraSemanal.title = NOMBRES_DIAS[indiceDia]
      + ': '
      + cantidad
      + ' '
      + palabraSesion;
    barrasSemanales.appendChild(barraSemanal);
  });

  obtenerElemento('weekdayChart').replaceChildren(barrasSemanales);
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
      rutaIcono: 'M12 2v2m0 16v2m10-10h-2M4 12H2m15.07-7.07-1.42 1.42M6.35 17.65l-1.42 1.42'
        + 'm12.14 0-1.42-1.42M6.35 6.35 4.93 4.93M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
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
  pintarDistribucionSemanal(cantidadesPorDia);
}

function crearGrupoDeCambios(titulo, ejercicios, mensajeVacio) {
  const grupo = clonarElementoDePlantilla('moverGroupTemplate');

  grupo.querySelector('[data-field="title"]').textContent = titulo;

  const lista = grupo.querySelector('.mover-list');

  if (ejercicios.length === 0) {
    const mensaje = clonarElementoDePlantilla('moverEmptyTemplate');

    mensaje.textContent = mensajeVacio;
    lista.replaceWith(mensaje);
  } else {
    ejercicios.forEach(function (ejercicio) {
      const elemento = clonarElementoDePlantilla('moverItemTemplate');
      const nombre = elemento.querySelector('[data-field="name"]');
      const insignia = elemento.querySelector('[data-field="badge"]');

      nombre.textContent = ejercicio.ejercicio;
      nombre.title = ejercicio.ejercicio;
      elemento.querySelector('[data-field="from"]').textContent = formatearCarga(
        ejercicio.anterior
      );
      elemento.querySelector('[data-field="to"]').textContent = formatearCarga(
        ejercicio.actual
      );
      insignia.classList.add(ejercicio.diferencia > 0 ? 'increase' : 'decrease');
      insignia.querySelector('[data-field="delta"]').textContent = crearTextoDelta(ejercicio);
      lista.appendChild(elemento);
    });
  }

  return grupo;
}

function pintarProgresionFuerza(progresion) {
  obtenerElemento('strengthPeriod').textContent = progresion.hayHistorialAnterior
    ? progresion.comparadoCon
    : 'Sin historial anterior para comparar';

  obtenerElemento('strengthUp').textContent = String(progresion.subieron);
  obtenerElemento('strengthFlat').textContent = String(progresion.mantienen);
  obtenerElemento('strengthDown').textContent = String(progresion.bajaron);
  obtenerElemento('strengthNew').textContent = String(progresion.nuevos);

  const mayoresCambios = obtenerMayoresCambios(progresion, CAMBIOS_POR_GRUPO);
  const grupos = document.createDocumentFragment();

  grupos.appendChild(crearGrupoDeCambios(
    'Más subieron',
    mayoresCambios.subieron,
    progresion.hayHistorialAnterior
      ? 'Ningún ejercicio subió en este periodo.'
      : 'Necesitas un periodo anterior con datos para comparar.'
  ));
  grupos.appendChild(crearGrupoDeCambios(
    'Más bajaron',
    mayoresCambios.bajaron,
    progresion.hayHistorialAnterior
      ? 'Ningún ejercicio bajó en este periodo.'
      : 'Necesitas un periodo anterior con datos para comparar.'
  ));

  obtenerElemento('strengthMovers').replaceChildren(grupos);
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

// El cambio compara el mejor 1RM de cada bloque de periodo, no la marca de la
// fila (que es la mejor del filtro entero); el title de la insignia lo aclara.
function pintarCambioDelRecord(filaRecord, cambio) {
  const insignia = filaRecord.querySelector('[data-field="change"]');
  const valorCambio = filaRecord.querySelector('[data-field="change-value"]');

  insignia.classList.remove('increase', 'decrease', 'neutral');

  if (!cambio || cambio.estado === 'nuevo') {
    insignia.classList.add('neutral');
    valorCambio.textContent = '—';
    insignia.title = 'Sin marca en el periodo anterior';
    return;
  }

  if (cambio.estado === 'mantiene') {
    insignia.classList.add('neutral');
  } else {
    insignia.classList.add(cambio.diferencia > 0 ? 'increase' : 'decrease');
  }

  valorCambio.textContent = crearTextoDelta(cambio);
  insignia.title = 'Mejor 1RM del periodo: '
    + formatearCarga(cambio.actual)
    + ' · anterior: '
    + formatearCarga(cambio.anterior);
}

// El escalonado sugiere orden; pasado un puñado de filas solo hace esperar.
const ESCALONES_MAXIMOS = 8;
const MILISEGUNDOS_POR_ESCALON = 34;

let eventosRecordsConectados = false;

function manejarClicEnRecords(evento) {
  const boton = evento.target.closest('.link-cell[data-exercise]');

  if (boton) {
    abrirEjercicio(boton.dataset.exercise);
  }
}

function crearContextoDeRecord(record) {
  const palabraSerie = record.cantidadSeries === 1 ? 'serie' : 'series';
  const palabraSesion = record.cantidadSesiones === 1 ? 'sesión' : 'sesiones';

  return formatoFechaCompleta.format(record.fecha)
    + ' · '
    + record.repeticionesTotales
    + ' reps en '
    + record.cantidadSeries
    + ' '
    + palabraSerie
    + ' y '
    + record.cantidadSesiones
    + ' '
    + palabraSesion;
}

function crearFilaDeRecordDeReps(record) {
  const elemento = clonarElementoDePlantilla('repRecordTemplate');
  const etiquetaEsfuerzo = elemento.querySelector('[data-field="effort"]');

  elemento.dataset.exercise = record.ejercicio;
  elemento.querySelector('[data-field="exercise"]').textContent = record.ejercicio;
  elemento.querySelector('[data-field="reps"]').textContent = String(record.repeticiones);
  elemento.querySelector('[data-field="context"]').textContent =
    crearContextoDeRecord(record);

  if (record.esfuerzo) {
    etiquetaEsfuerzo.textContent = 'RPE '
      + formatoNumero.format(record.esfuerzo.promedio)
      + ' · '
      + record.esfuerzo.seriesConEsfuerzo
      + '/'
      + record.esfuerzo.seriesTotales;
  } else {
    etiquetaEsfuerzo.textContent = 'Sin RPE';
    etiquetaEsfuerzo.classList.add('is-missing');
  }

  return elemento;
}

// Dominadas y fondos no tienen 1RM, así que la tabla de récords estimados los
// dejaba fuera pese a ser de lo más repetido del historial.
function pintarRecordsDeRepeticiones() {
  const panel = obtenerElemento('repRecordsPanel');
  const lista = obtenerElemento('repRecords');
  const records = crearRecordsDeRepeticiones(estadoAplicacion.seriesFiltradas);

  panel.hidden = records.length === 0;

  if (records.length === 0) {
    lista.replaceChildren();
    return;
  }

  const elementos = document.createDocumentFragment();

  records.forEach(function (record) {
    elementos.appendChild(crearFilaDeRecordDeReps(record));
  });

  lista.replaceChildren(elementos);
}

function manejarClicEnRecordsDeReps(evento) {
  const fila = evento.target.closest('.rep-record[data-exercise]');

  if (fila) {
    abrirEjercicio(fila.dataset.exercise);
  }
}

function pintarTablaDeRecords(configuracion, progresion) {
  const tablaRecords = obtenerElemento('recordsTable');

  if (!eventosRecordsConectados) {
    tablaRecords.addEventListener('click', manejarClicEnRecords);
    obtenerElemento('repRecords')
      .addEventListener('click', manejarClicEnRecordsDeReps);
    eventosRecordsConectados = true;
  }

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

  const cambiosPorEjercicio = new Map(progresion.ejercicios.map(function (ejercicio) {
    return [ejercicio.ejercicio, ejercicio];
  }));
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
      filaRecord.style.setProperty(
        '--row-delay',
        Math.min(indiceRecord, ESCALONES_MAXIMOS) * MILISEGUNDOS_POR_ESCALON + 'ms'
      );
    }

    filaRecord.classList.toggle('record-new', esRecordReciente);
    filaRecord.classList.toggle(
      'record-new-flash',
      esRecordReciente && configuracion.animarDatosNuevos
    );
    filaRecord.querySelector('.record-badge').hidden = !esRecordReciente;
    filaRecord.querySelector('.record-badge-best').hidden = indiceRecord !== 0;
    const botonEjercicio = filaRecord.querySelector('[data-field="exercise"]');

    botonEjercicio.textContent = nombreEjercicio;
    botonEjercicio.dataset.exercise = nombreEjercicio;
    filaRecord.querySelector('[data-field="set"]').textContent = formatearCarga(
      mejorSerie.pesoLibras
    ) + ' × ' + mejorSerie.repeticiones;
    filaRecord.querySelector('[data-field="estimated-1rm"]').textContent = formatearCarga(
      calcular1RMEstimado(mejorSerie)
    );
    pintarCambioDelRecord(filaRecord, cambiosPorEjercicio.get(nombreEjercicio));
    filaRecord.querySelector('[data-field="date"]').textContent = formatoFechaCompleta
      .format(mejorSerie.inicio);
    filasRecords.appendChild(filaRecord);
  });

  tablaRecords.replaceChildren(filasRecords);
}

export function pintarProgreso(configuracionOriginal) {
  const configuracion = configuracionOriginal
    || { animarEntrada: true, animarDatosNuevos: true };
  const progresion = crearProgresionFuerza(
    estadoAplicacion.sesiones,
    estadoAplicacion.fechaMasReciente,
    estadoAplicacion.periodoSeleccionado
  );

  pintarProgresionFuerza(progresion);
  pintarCalendarioActividad(configuracion);
  pintarPatronesDeEntrenamiento();
  pintarRecordsDeRepeticiones();
  pintarTablaDeRecords(configuracion, progresion);
}
