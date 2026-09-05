import {
  estadoAplicacion,
  formatearCarga,
  formatoNumero
} from '../configuracion.js';
import { crearClaveSesion } from '../datos.js';
import { crearResumenEsfuerzo, mereceMostrarse } from '../esfuerzo.js';
import { calcularMetricasSesion } from '../metricas.js';
import {
  cambiarSeccion,
  desplazarHastaElemento,
  resaltarElemento
} from '../navegacion.js';
import { crearColoresDeRutina } from '../rutinas.js';
import {
  clonarElementoDePlantilla,
  crearEstadoVacio,
  normalizarTexto,
  obtenerElemento
} from '../utilidades.js';

const SESIONES_POR_BLOQUE = 25;

// El color no decora: identifica la rutina, para poder distinguir Tiron de
// Pierna de un vistazo al recorrer el historial. El reparto vive en rutinas.js
// porque la grafica de volumen tiene que usar exactamente el mismo.
const formatoMesLargo = new Intl.DateTimeFormat('es-CO', {
  month: 'long',
  year: 'numeric'
});
const sesionesPorTarjeta = new WeakMap();
const textosBusquedaPorSesion = new WeakMap();
let cantidadSesionesVisibles = SESIONES_POR_BLOQUE;
let eventosSesionesConectados = false;

function compararSesionesMasRecientesPrimero(primeraSesion, segundaSesion) {
  return segundaSesion.inicio - primeraSesion.inicio;
}

function agruparSesionesPorMes(sesiones) {
  const grupos = [];
  let grupoActual = null;

  sesiones.forEach(function (sesion) {
    const claveMes = sesion.inicio.getFullYear() + '-' + sesion.inicio.getMonth();

    if (!grupoActual || grupoActual.clave !== claveMes) {
      const nombreMes = formatoMesLargo.format(sesion.inicio);

      grupoActual = {
        clave: claveMes,
        nombre: (nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1))
          .replace(' de ', ' '),
        sesiones: []
      };
      grupos.push(grupoActual);
    }

    grupoActual.sesiones.push(sesion);
  });

  return grupos;
}

function agruparSeriesPorEjercicio(series) {
  const seriesPorEjercicio = new Map();

  series.forEach(function (serie) {
    if (!seriesPorEjercicio.has(serie.ejercicio)) {
      seriesPorEjercicio.set(serie.ejercicio, []);
    }

    seriesPorEjercicio.get(serie.ejercicio).push(serie);
  });

  return seriesPorEjercicio;
}

function crearDescripcionDeSerie(serie) {
  const tienePeso = serie.pesoLibras !== null;
  const tieneRepeticiones = serie.repeticiones !== null;

  if (tienePeso && tieneRepeticiones) {
    return {
      principal: formatearCarga(serie.pesoLibras),
      secundaria: ' × ' + serie.repeticiones
    };
  }

  if (serie.distanciaKm !== null) {
    let detalleDuracion = '';

    if (serie.duracionSegundos) {
      detalleDuracion = ' · '
        + Math.round(serie.duracionSegundos / 60)
        + ' min';
    }

    return {
      principal: formatoNumero.format(serie.distanciaKm) + ' km',
      secundaria: detalleDuracion
    };
  }

  if (tieneRepeticiones) {
    return {
      principal: serie.repeticiones + ' reps',
      secundaria: ''
    };
  }

  return {
    principal: '',
    secundaria: 'Registrada'
  };
}

function crearEtiquetaDeSerie(serie) {
  const etiquetaSerie = clonarElementoDePlantilla('setPillTemplate');
  const descripcion = crearDescripcionDeSerie(serie);
  const valorPrincipal = etiquetaSerie.querySelector('[data-field="primary"]');

  if (normalizarTexto(serie.tipoSerie) === 'warmup') {
    etiquetaSerie.classList.add('set-pill-warmup');
    etiquetaSerie.querySelector('[data-field="prefix"]').textContent = 'Cal. · ';
  }

  valorPrincipal.textContent = descripcion.principal;
  valorPrincipal.hidden = descripcion.principal === '';
  etiquetaSerie.querySelector('[data-field="secondary"]').textContent = descripcion.secundaria;

  return etiquetaSerie;
}

// El RPE se muestra con su cobertura: sin saber sobre cuántas series se calcula,
// un 8 de una serie suelta parece lo mismo que un 8 de cuatro.
function pintarEsfuerzoDelEjercicio(elemento, series) {
  const etiqueta = elemento.querySelector('[data-field="effort"]');
  const esfuerzo = crearResumenEsfuerzo(series);

  if (!esfuerzo) {
    etiqueta.hidden = true;
    return;
  }

  etiqueta.hidden = false;
  etiqueta.textContent = 'RPE '
    + formatoNumero.format(esfuerzo.promedio)
    + ' · '
    + esfuerzo.seriesConEsfuerzo
    + '/'
    + esfuerzo.seriesTotales;
  etiqueta.title = 'RPE medio de '
    + esfuerzo.seriesConEsfuerzo
    + ' de '
    + esfuerzo.seriesTotales
    + ' series · máximo '
    + formatoNumero.format(esfuerzo.maximo);
}

function crearDetalleDeEjercicio(nombreEjercicio, series) {
  const detalleEjercicio = clonarElementoDePlantilla('sessionExerciseTemplate');
  const etiquetasSeries = document.createDocumentFragment();

  series.forEach(function (serie) {
    etiquetasSeries.appendChild(crearEtiquetaDeSerie(serie));
  });

  detalleEjercicio.querySelector('[data-field="name"]').textContent = nombreEjercicio;
  pintarEsfuerzoDelEjercicio(detalleEjercicio, series);
  const notasEjercicio = series.find(function (serie) {
    return serie.notasEjercicio.trim() !== '';
  });

  if (notasEjercicio) {
    const elementoNotas = detalleEjercicio.querySelector('[data-field="notes"]');

    elementoNotas.textContent = notasEjercicio.notasEjercicio;
    elementoNotas.hidden = false;
  }

  detalleEjercicio.querySelector('.set-pills').replaceChildren(etiquetasSeries);

  return detalleEjercicio;
}

function crearDetalleDeSesion(sesion) {
  const seriesPorEjercicio = agruparSeriesPorEjercicio(sesion.series);
  const detallesSesion = document.createDocumentFragment();

  if (sesion.descripcion.trim() !== '') {
    const descripcionSesion = document.createElement('p');

    descripcionSesion.className = 'session-note';
    descripcionSesion.textContent = sesion.descripcion;
    detallesSesion.appendChild(descripcionSesion);
  }

  seriesPorEjercicio.forEach(function (seriesEjercicio, nombreEjercicio) {
    detallesSesion.appendChild(
      crearDetalleDeEjercicio(nombreEjercicio, seriesEjercicio)
    );
  });

  return detallesSesion;
}

function pintarEsfuerzoDeLaSesion(tarjetaSesion, seriesEfectivas) {
  const celda = tarjetaSesion.querySelector('[data-field="effort-cell"]');
  const esfuerzo = crearResumenEsfuerzo(seriesEfectivas);

  if (!mereceMostrarse(esfuerzo)) {
    celda.hidden = true;
    return;
  }

  celda.hidden = false;
  tarjetaSesion.querySelector('[data-field="effort"]').textContent =
    formatoNumero.format(esfuerzo.promedio);
  tarjetaSesion.querySelector('[data-field="effort-note"]').textContent = 'RPE en '
    + esfuerzo.seriesConEsfuerzo
    + '/'
    + esfuerzo.seriesTotales;
}

function crearTarjetaDeSesion(sesion, indiceSesion, animarEntrada, colorRutina) {
  const metricasSesion = calcularMetricasSesion(sesion);
  const tarjetaSesion = clonarElementoDePlantilla('sessionCardTemplate');
  const numeroDia = sesion.inicio.getDate();

  const diaSemana = sesion.inicio
    .toLocaleDateString('es-CO', { weekday: 'short' })
    .replace('.', '');

  const horaSesion = sesion.inicio.toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit'
  });

  const elementoTitulo = tarjetaSesion.querySelector('[data-field="title"]');

  tarjetaSesion.style.setProperty('--session-accent', colorRutina);
  tarjetaSesion.querySelector('[data-field="day"]').textContent = String(numeroDia);
  elementoTitulo.textContent = sesion.titulo;
  elementoTitulo.title = sesion.titulo;
  tarjetaSesion.querySelector('[data-field="subtitle"]').textContent = diaSemana
    + ' · ' + horaSesion
    + ' · ' + metricasSesion.nombresEjercicios.size + ' ejercicios';
  tarjetaSesion.querySelector('[data-field="sets"]').textContent = String(
    metricasSesion.seriesEfectivas.length
  );
  tarjetaSesion.querySelector('[data-field="volume"]').textContent = formatearCarga(
    metricasSesion.volumenLibras,
    true
  );
  tarjetaSesion.querySelector('[data-field="duration"]').textContent = metricasSesion
    .duracionMinutos + ' min';
  pintarEsfuerzoDeLaSesion(tarjetaSesion, metricasSesion.seriesEfectivas);
  sesionesPorTarjeta.set(tarjetaSesion, sesion);
  tarjetaSesion.dataset.sessionKey = crearClaveSesion(sesion.inicio, sesion.titulo);
  if (animarEntrada) {
    tarjetaSesion.style.setProperty(
      '--stagger-delay',
      Math.min(indiceSesion, 8) * 34 + 'ms'
    );
    tarjetaSesion.classList.add('is-entering');
  }

  return tarjetaSesion;
}

function alternarDetalleDeSesion(botonSesion) {
  const tarjetaSesion = botonSesion.closest('.session-card');
  const vaAAbrirse = !tarjetaSesion.classList.contains('open');

  if (vaAAbrirse && tarjetaSesion.dataset.detailLoaded !== 'true') {
    const sesion = sesionesPorTarjeta.get(tarjetaSesion);

    if (sesion) {
      tarjetaSesion.querySelector('.session-detail-body').replaceChildren(
        crearDetalleDeSesion(sesion)
      );
      tarjetaSesion.dataset.detailLoaded = 'true';
    }
  }

  tarjetaSesion.classList.toggle('open', vaAAbrirse);

  botonSesion.setAttribute('aria-expanded', String(vaAAbrirse));
}

function coincideConBusqueda(sesion, terminoNormalizado) {
  if (terminoNormalizado === '') {
    return true;
  }

  let textoSesion = textosBusquedaPorSesion.get(sesion);

  if (!textoSesion) {
    const nombresEjercicios = sesion.series.map(function (serie) {
      return serie.ejercicio;
    });

    textoSesion = normalizarTexto(
      [sesion.titulo].concat(nombresEjercicios).join(' ')
    );
    textosBusquedaPorSesion.set(sesion, textoSesion);
  }

  return textoSesion.includes(terminoNormalizado);
}

function crearConfiguracionInteraccion(modo) {
  return {
    animarEntrada: false,
    modo: modo
  };
}

function manejarClicEnListado(evento) {
  if (!(evento.target instanceof Element)) {
    return;
  }

  const botonSesion = evento.target.closest('.session-summary');

  if (obtenerElemento('sessionList')?.contains(botonSesion)) {
    alternarDetalleDeSesion(botonSesion);
  }
}

function manejarBusquedaSesiones() {
  cantidadSesionesVisibles = SESIONES_POR_BLOQUE;
  pintarSesiones(crearConfiguracionInteraccion('busqueda'));
}

function mostrarMasSesiones() {
  cantidadSesionesVisibles += SESIONES_POR_BLOQUE;
  pintarSesiones(crearConfiguracionInteraccion('paginacion'));
}

function conectarEventosDeSesiones() {
  if (eventosSesionesConectados) {
    return;
  }

  obtenerElemento('sessionList').addEventListener('click', manejarClicEnListado);
  obtenerElemento('sessionSearch').addEventListener('input', manejarBusquedaSesiones);
  obtenerElemento('loadMoreSessions').addEventListener('click', mostrarMasSesiones);
  eventosSesionesConectados = true;
}

function buscarTarjetaDeSesion(claveSesion) {
  const tarjetas = document.querySelectorAll('#sessionList .session-card');

  return Array.from(tarjetas).find(function (tarjeta) {
    return tarjeta.dataset.sessionKey === claveSesion;
  }) || null;
}

// Punto de entrada desde las gráficas: deja la sesión visible, abierta y con el
// foco puesto, aunque estuviera escondida tras la búsqueda o la paginación.
export function abrirSesion(claveSesion) {
  const sesionesOrdenadas = estadoAplicacion.sesionesFiltradas
    .slice()
    .sort(compararSesionesMasRecientesPrimero);
  const posicionSesion = sesionesOrdenadas.findIndex(function (sesion) {
    return crearClaveSesion(sesion.inicio, sesion.titulo) === claveSesion;
  });

  if (posicionSesion === -1) {
    return Promise.resolve(false);
  }

  obtenerElemento('sessionSearch').value = '';
  cantidadSesionesVisibles = Math.max(
    cantidadSesionesVisibles,
    Math.ceil((posicionSesion + 1) / SESIONES_POR_BLOQUE) * SESIONES_POR_BLOQUE
  );

  pintarSesiones(crearConfiguracionInteraccion('navegacion'));

  return cambiarSeccion('sesiones', { conservarDesplazamiento: true })
    .then(function () {
      const tarjeta = buscarTarjetaDeSesion(claveSesion);

      if (!tarjeta) {
        return false;
      }

      const botonSesion = tarjeta.querySelector('.session-summary');

      if (!tarjeta.classList.contains('open')) {
        alternarDetalleDeSesion(botonSesion);
      }

      desplazarHastaElemento(tarjeta, { bloque: 'center' });
      botonSesion.focus({ preventScroll: true });
      resaltarElemento(tarjeta);

      return true;
    });
}

export function pintarSesiones(configuracionOriginal) {
  const configuracion = configuracionOriginal || {
    animarEntrada: true,
    modo: 'interaccion'
  };

  conectarEventosDeSesiones();

  if (['inicial', 'datos', 'periodo'].includes(configuracion.modo)) {
    cantidadSesionesVisibles = SESIONES_POR_BLOQUE;
  }

  const sesionesOrdenadas = estadoAplicacion.sesionesFiltradas
    .slice()
    .sort(compararSesionesMasRecientesPrimero);
  const terminoBusqueda = normalizarTexto(obtenerElemento('sessionSearch').value.trim());
  const sesionesEncontradas = sesionesOrdenadas.filter(function (sesion) {
    return coincideConBusqueda(sesion, terminoBusqueda);
  });
  const sesionesVisibles = sesionesEncontradas.slice(0, cantidadSesionesVisibles);
  const botonMostrarMas = obtenerElemento('loadMoreSessions');

  let palabraEntrenamiento = 'entrenamientos';

  if (sesionesEncontradas.length === 1) {
    palabraEntrenamiento = 'entrenamiento';
  }

  if (sesionesVisibles.length < sesionesEncontradas.length) {
    obtenerElemento('sessionCount').textContent = sesionesVisibles.length
      + ' de '
      + sesionesEncontradas.length
      + ' '
      + palabraEntrenamiento;
  } else {
    obtenerElemento('sessionCount').textContent = sesionesEncontradas.length
      + ' '
      + palabraEntrenamiento;
  }

  botonMostrarMas.hidden = sesionesVisibles.length >= sesionesEncontradas.length;

  if (!botonMostrarMas.hidden) {
    const cantidadRestante = sesionesEncontradas.length - sesionesVisibles.length;
    const cantidadSiguiente = Math.min(SESIONES_POR_BLOQUE, cantidadRestante);

    botonMostrarMas.textContent = 'Mostrar '
      + cantidadSiguiente
      + ' '
      + (cantidadSiguiente === 1 ? 'entrenamiento más' : 'entrenamientos más');
  }

  if (sesionesEncontradas.length === 0) {
    const mensajeVacio = sesionesOrdenadas.length === 0
      ? 'No hay sesiones en este periodo.'
      : 'No hay rutinas ni ejercicios que coincidan con la búsqueda.';

    obtenerElemento('sessionList').replaceChildren(
      crearEstadoVacio(mensajeVacio, ['panel'])
    );
    return;
  }

  const coloresPorRutina = crearColoresDeRutina(estadoAplicacion.sesiones);
  const gruposDeMes = document.createDocumentFragment();
  let indiceSesion = 0;

  agruparSesionesPorMes(sesionesVisibles).forEach(function (grupo) {
    const elementoGrupo = clonarElementoDePlantilla('sessionMonthTemplate');
    const tarjetasDelMes = document.createDocumentFragment();
    const palabraDelGrupo = grupo.sesiones.length === 1
      ? 'entrenamiento'
      : 'entrenamientos';

    grupo.sesiones.forEach(function (sesion) {
      tarjetasDelMes.appendChild(crearTarjetaDeSesion(
        sesion,
        indiceSesion,
        configuracion.animarEntrada,
        coloresPorRutina.get(sesion.titulo) || 'var(--muted)'
      ));
      indiceSesion += 1;
    });

    elementoGrupo.querySelector('[data-field="month"]').textContent = grupo.nombre;
    elementoGrupo.querySelector('[data-field="count"]').textContent = grupo.sesiones.length
      + ' ' + palabraDelGrupo;
    elementoGrupo.querySelector('.session-month-list').replaceChildren(tarjetasDelMes);
    gruposDeMes.appendChild(elementoGrupo);
  });

  obtenerElemento('sessionList').replaceChildren(gruposDeMes);
}
