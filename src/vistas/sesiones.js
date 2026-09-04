import {
  estadoAplicacion,
  formatoNumero,
  formatoNumeroCompacto
} from '../configuracion.js';
import { calcularMetricasSesion } from '../metricas.js';
import {
  clonarElementoDePlantilla,
  crearEstadoVacio,
  normalizarTexto,
  obtenerElemento
} from '../utilidades.js';

function compararSesionesMasRecientesPrimero(primeraSesion, segundaSesion) {
  return segundaSesion.inicio - primeraSesion.inicio;
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
      principal: formatoNumero.format(serie.pesoLibras) + ' lb',
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

function crearDetalleDeEjercicio(nombreEjercicio, series) {
  const detalleEjercicio = clonarElementoDePlantilla('sessionExerciseTemplate');
  const etiquetasSeries = document.createDocumentFragment();

  series.forEach(function (serie) {
    etiquetasSeries.appendChild(crearEtiquetaDeSerie(serie));
  });

  detalleEjercicio.querySelector('[data-field="name"]').textContent = nombreEjercicio;
  detalleEjercicio.querySelector('.set-pills').replaceChildren(etiquetasSeries);

  return detalleEjercicio;
}

function crearDetalleDeSesion(sesion) {
  const seriesPorEjercicio = agruparSeriesPorEjercicio(sesion.series);
  const detallesEjercicios = document.createDocumentFragment();

  seriesPorEjercicio.forEach(function (seriesEjercicio, nombreEjercicio) {
    detallesEjercicios.appendChild(
      crearDetalleDeEjercicio(nombreEjercicio, seriesEjercicio)
    );
  });

  return detallesEjercicios;
}

function crearTarjetaDeSesion(sesion, indiceSesion, animarEntrada) {
  const metricasSesion = calcularMetricasSesion(sesion);
  const detalleSesion = crearDetalleDeSesion(sesion);
  const tarjetaSesion = clonarElementoDePlantilla('sessionCardTemplate');
  const numeroDia = sesion.inicio.getDate();

  const nombreMes = sesion.inicio
    .toLocaleDateString('es-CO', { month: 'short' })
    .toUpperCase()
    .replace('.', '');

  const horaSesion = sesion.inicio.toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit'
  });

  const elementoTitulo = tarjetaSesion.querySelector('[data-field="title"]');

  tarjetaSesion.querySelector('.session-summary').dataset.session = String(indiceSesion);
  tarjetaSesion.querySelector('[data-field="day"]').textContent = String(numeroDia);
  tarjetaSesion.querySelector('[data-field="month"]').textContent = nombreMes;
  elementoTitulo.textContent = sesion.titulo;
  elementoTitulo.title = sesion.titulo;
  tarjetaSesion.querySelector('[data-field="subtitle"]').textContent = horaSesion
    + ' · ' + metricasSesion.nombresEjercicios.size + ' ejercicios';
  tarjetaSesion.querySelector('[data-field="sets"]').textContent = String(
    metricasSesion.seriesEfectivas.length
  );
  tarjetaSesion.querySelector('[data-field="volume"]').textContent = formatoNumeroCompacto
    .format(metricasSesion.volumenLibras) + ' lb';
  tarjetaSesion.querySelector('[data-field="duration"]').textContent = metricasSesion
    .duracionMinutos + ' min';
  tarjetaSesion.querySelector('.session-detail-inner').replaceChildren(detalleSesion);
  if (animarEntrada) {
    tarjetaSesion.style.setProperty(
      '--stagger-delay',
      Math.min(indiceSesion, 10) * 40 + 'ms'
    );
    tarjetaSesion.classList.add('is-entering');
  }

  return tarjetaSesion;
}

function alternarDetalleDeSesion(botonSesion) {
  const tarjetaSesion = botonSesion.closest('.session-card');
  tarjetaSesion.classList.toggle('open');

  const estaAbierta = tarjetaSesion.classList.contains('open');
  botonSesion.setAttribute('aria-expanded', String(estaAbierta));
}

function conectarEventosDeSesiones() {
  const botonesSesiones = document.querySelectorAll('.session-summary');

  botonesSesiones.forEach(function (botonSesion) {
    botonSesion.addEventListener('click', function () {
      alternarDetalleDeSesion(botonSesion);
    });
  });
}

export function pintarSesiones(configuracionOriginal) {
  const configuracion = configuracionOriginal || { animarEntrada: true };
  const sesionesOrdenadas = estadoAplicacion.sesionesFiltradas
    .slice()
    .sort(compararSesionesMasRecientesPrimero);

  let palabraEntrenamiento = 'entrenamientos';

  if (sesionesOrdenadas.length === 1) {
    palabraEntrenamiento = 'entrenamiento';
  }

  obtenerElemento('sessionCount').textContent = sesionesOrdenadas.length
    + ' '
    + palabraEntrenamiento;

  if (sesionesOrdenadas.length === 0) {
    obtenerElemento('sessionList').replaceChildren(
      crearEstadoVacio('No hay sesiones en este periodo.', ['panel'])
    );
    return;
  }

  const tarjetasSesiones = document.createDocumentFragment();

  sesionesOrdenadas.forEach(function (sesion, indiceSesion) {
    tarjetasSesiones.appendChild(
      crearTarjetaDeSesion(sesion, indiceSesion, configuracion.animarEntrada)
    );
  });

  obtenerElemento('sessionList').replaceChildren(tarjetasSesiones);

  conectarEventosDeSesiones();
}
