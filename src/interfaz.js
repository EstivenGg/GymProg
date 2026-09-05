import { aplicarFiltroPeriodo } from './datos.js';
import {
  establecerUnidadPeso,
  obtenerUnidadPeso
} from './configuracion.js';
import {
  abrirModalImportacion,
  cancelarImportacion,
  cerrarModalImportacion,
  importarArchivos,
  restaurarDatosIniciales
} from './importacion.js';
import { cambiarSeccion } from './navegacion.js';
import { inicializarSelectoresPersonalizados } from './selector-personalizado.js';
import { obtenerElemento } from './utilidades.js';
import { pintarDetalleEjercicio, pintarTableroCompleto } from './vistas/index.js';
import {
  seleccionarAgrupacionVolumen,
  seleccionarMetricaCorporal,
  seleccionarRutinaVolumen
} from './vistas/resumen.js';
import {
  conectarEventosDeEjercicios,
  seleccionarMetricaEjercicio
} from './vistas/ejercicios.js';

export { cambiarSeccion } from './navegacion.js';

const CLAVE_META_SEMANAL = 'hevy-progress-weekly-goal';
const CLAVE_UNIDAD_PESO = 'hevy-progress-weight-unit';
const META_SEMANAL_MINIMA = 1;
const META_SEMANAL_MAXIMA = 14;

export function estabilizarPosicionInicial() {
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  window.scrollTo({ top: 0, behavior: 'auto' });

  requestAnimationFrame(function () {
    window.scrollTo({ top: 0, behavior: 'auto' });
  });
}

export function iniciarTema() {
  const temaGuardado = localStorage.getItem('hevy-progress-theme');
  let temaInicial = temaGuardado;

  if (!temaInicial) {
    const sistemaUsaTemaClaro = matchMedia('(prefers-color-scheme: light)').matches;
    temaInicial = 'dark';

    if (sistemaUsaTemaClaro) {
      temaInicial = 'light';
    }
  }

  document.documentElement.dataset.theme = temaInicial;
}

function alternarTema() {
  const temaActual = document.documentElement.dataset.theme;
  let siguienteTema = 'light';

  if (temaActual === 'light') {
    siguienteTema = 'dark';
  }

  document.documentElement.dataset.theme = siguienteTema;
  localStorage.setItem('hevy-progress-theme', siguienteTema);

  pintarTableroCompleto({ modo: 'tema' });
}

function manejarCambioPeriodo() {
  aplicarFiltroPeriodo();
  pintarTableroCompleto({ modo: 'periodo' });
}

function normalizarMetaSemanal(valorOriginal) {
  const valor = Number.parseInt(valorOriginal, 10);

  if (!Number.isFinite(valor)) {
    return 4;
  }

  return Math.min(
    META_SEMANAL_MAXIMA,
    Math.max(META_SEMANAL_MINIMA, valor)
  );
}

function manejarCambioMetaSemanal(evento) {
  const metaSemanal = normalizarMetaSemanal(evento.target.value);

  evento.target.value = String(metaSemanal);
  localStorage.setItem(CLAVE_META_SEMANAL, String(metaSemanal));
  pintarTableroCompleto({ modo: 'interaccion' });
}

function conectarMetaSemanal() {
  const entradaMetaSemanal = obtenerElemento('weeklyGoalInput');
  const metaGuardada = localStorage.getItem(CLAVE_META_SEMANAL);

  entradaMetaSemanal.value = String(normalizarMetaSemanal(
    metaGuardada === null ? entradaMetaSemanal.value : metaGuardada
  ));
  entradaMetaSemanal.addEventListener('change', manejarCambioMetaSemanal);
}

function actualizarBotonesUnidad() {
  const unidadActiva = obtenerUnidadPeso();

  document.querySelectorAll('[data-weight-unit]').forEach(function (boton) {
    const estaActivo = boton.dataset.weightUnit === unidadActiva;

    boton.classList.toggle('active', estaActivo);
    boton.setAttribute('aria-pressed', String(estaActivo));
  });
}

function cambiarUnidadPeso(unidad) {
  if (unidad === obtenerUnidadPeso()) {
    return;
  }

  establecerUnidadPeso(unidad);
  localStorage.setItem(CLAVE_UNIDAD_PESO, obtenerUnidadPeso());
  actualizarBotonesUnidad();
  pintarTableroCompleto({ modo: 'unidad' });
}

function conectarSelectorUnidad() {
  establecerUnidadPeso(localStorage.getItem(CLAVE_UNIDAD_PESO));
  actualizarBotonesUnidad();

  document.querySelectorAll('[data-weight-unit]').forEach(function (boton) {
    boton.addEventListener('click', function () {
      cambiarUnidadPeso(boton.dataset.weightUnit);
    });
  });
}

function manejarArchivosSeleccionados(evento) {
  const archivosSeleccionados = evento.target.files;

  // Se limpia el input para que volver a elegir el mismo archivo dispare el
  // evento otra vez, por ejemplo tras cancelar la vista previa.
  importarArchivos(archivosSeleccionados).finally(function () {
    evento.target.value = '';
  });
}

function manejarArchivosSoltados(evento) {
  evento.preventDefault();
  obtenerElemento('dropZone').classList.remove('dragging');
  importarArchivos(evento.dataTransfer.files);
}

function activarZonaDeArrastre(evento) {
  evento.preventDefault();
  obtenerElemento('dropZone').classList.add('dragging');
}

function desactivarZonaDeArrastre(evento) {
  evento.preventDefault();
  obtenerElemento('dropZone').classList.remove('dragging');
}

function manejarClicFueraDelModal(evento) {
  if (evento.target === obtenerElemento('importModal')) {
    cerrarModalImportacion();
  }
}

// Cerrar el modal, con la X o con Escape, descarta la importación pendiente:
// no debe quedar una confirmación a medias esperando en segundo plano.
function manejarCierreDelModal() {
  cancelarImportacion();
}

function manejarCambioDeSeccion() {
  cambiarSeccion(location.hash.slice(1));
}

function mostrarTooltipHeatmap(celda) {
  const tooltip = obtenerElemento('heatmapTooltip');
  const limitesCelda = celda.getBoundingClientRect();
  const margenVentana = 12;

  tooltip.textContent = celda.dataset.label;
  tooltip.hidden = false;

  const mitadTooltip = tooltip.offsetWidth / 2;
  const posicionHorizontal = Math.min(
    window.innerWidth - mitadTooltip - margenVentana,
    Math.max(mitadTooltip + margenVentana, limitesCelda.left + limitesCelda.width / 2)
  );

  tooltip.style.left = posicionHorizontal + 'px';
  tooltip.style.top = limitesCelda.top - 8 + 'px';
}

function ocultarTooltipHeatmap() {
  obtenerElemento('heatmapTooltip').hidden = true;
}

function obtenerCeldaHeatmap(evento) {
  if (!(evento.target instanceof Element)) {
    return null;
  }

  const celda = evento.target.closest('.heat-cell');
  const calendario = obtenerElemento('heatmap');

  if (!celda || !calendario.contains(celda)) {
    return null;
  }

  return celda;
}

function manejarEntradaHeatmap(evento) {
  const celda = obtenerCeldaHeatmap(evento);

  if (celda) {
    mostrarTooltipHeatmap(celda);
  }
}

function manejarSalidaHeatmap(evento) {
  const siguienteElemento = evento.relatedTarget;

  if (!(siguienteElemento instanceof Element)
    || !siguienteElemento.closest('.heat-cell')) {
    ocultarTooltipHeatmap();
  }
}

let actualizacionParallaxPendiente = false;

function actualizarParallaxConstancia() {
  const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desplazamiento = reducirMovimiento ? 0 : Math.min(18, window.scrollY * 0.035);

  document.documentElement.style.setProperty(
    '--consistency-drift',
    desplazamiento + 'px'
  );
  actualizacionParallaxPendiente = false;
}

function manejarScroll() {
  ocultarTooltipHeatmap();

  if (actualizacionParallaxPendiente) {
    return;
  }

  actualizacionParallaxPendiente = true;
  requestAnimationFrame(actualizarParallaxConstancia);
}

export function conectarEventos() {
  conectarSelectorUnidad();
  inicializarSelectoresPersonalizados();
  conectarMetaSemanal();
  conectarEventosDeEjercicios();

  document.querySelectorAll('[data-body-metric]').forEach(function (boton) {
    boton.addEventListener('click', function () {
      seleccionarMetricaCorporal(boton.dataset.bodyMetric);
    });
  });

  obtenerElemento('exerciseMetricToggle').addEventListener('click', function (evento) {
    const boton = evento.target.closest('[data-exercise-metric]');

    if (boton) {
      seleccionarMetricaEjercicio(boton.dataset.exerciseMetric);
    }
  });

  obtenerElemento('volumeGroupToggle').addEventListener('click', function (evento) {
    const boton = evento.target.closest('[data-volume-group]');

    if (boton) {
      seleccionarAgrupacionVolumen(boton.dataset.volumeGroup);
    }
  });

  obtenerElemento('routineSelect').addEventListener('change', function (evento) {
    seleccionarRutinaVolumen(evento.target.value);
  });

  obtenerElemento('periodSelect').addEventListener('change', manejarCambioPeriodo);
  obtenerElemento('exerciseSelect').addEventListener('change', function () {
    pintarDetalleEjercicio();
  });
  obtenerElemento('themeButton').addEventListener('click', alternarTema);
  obtenerElemento('importButton').addEventListener('click', abrirModalImportacion);
  obtenerElemento('modalClose').addEventListener('click', cerrarModalImportacion);
  obtenerElemento('importModal').addEventListener('click', manejarClicFueraDelModal);
  obtenerElemento('importModal').addEventListener('close', manejarCierreDelModal);
  obtenerElemento('fileInput').addEventListener('change', manejarArchivosSeleccionados);
  obtenerElemento('resetDataButton').addEventListener('click', restaurarDatosIniciales);

  const zonaDeArrastre = obtenerElemento('dropZone');

  zonaDeArrastre.addEventListener('dragenter', activarZonaDeArrastre);
  zonaDeArrastre.addEventListener('dragover', activarZonaDeArrastre);
  zonaDeArrastre.addEventListener('dragleave', desactivarZonaDeArrastre);
  zonaDeArrastre.addEventListener('drop', manejarArchivosSoltados);

  const calendarioActividad = obtenerElemento('heatmap');
  calendarioActividad.addEventListener('mouseover', manejarEntradaHeatmap);
  calendarioActividad.addEventListener('mouseout', manejarSalidaHeatmap);
  calendarioActividad.addEventListener('focusin', manejarEntradaHeatmap);
  calendarioActividad.addEventListener('focusout', ocultarTooltipHeatmap);

  window.addEventListener('hashchange', manejarCambioDeSeccion);
  window.addEventListener('scroll', manejarScroll, { passive: true });
  actualizarParallaxConstancia();
}
