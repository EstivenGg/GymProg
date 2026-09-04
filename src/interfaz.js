import { aplicarFiltroPeriodo } from './datos.js';
import {
  abrirModalImportacion,
  cerrarModalImportacion,
  importarArchivos
} from './importacion.js';
import { inicializarSelectoresPersonalizados } from './selector-personalizado.js';
import { obtenerElemento } from './utilidades.js';
import { pintarDetalleEjercicio, pintarTableroCompleto } from './vistas/index.js';

export function cambiarSeccion(seccionSolicitada, opciones) {
  const configuracion = opciones || {};
  const seccionesPermitidas = ['resumen', 'progreso', 'ejercicios', 'sesiones'];
  let seccionActiva = 'resumen';

  if (seccionesPermitidas.includes(seccionSolicitada)) {
    seccionActiva = seccionSolicitada;
  }

  document.querySelectorAll('.view').forEach(function (vista) {
    vista.classList.toggle('active', vista.id === seccionActiva);
  });

  document.querySelectorAll('.nav-item').forEach(function (enlaceNavegacion) {
    const correspondeASeccion = enlaceNavegacion.dataset.section === seccionActiva;
    enlaceNavegacion.classList.toggle('active', correspondeASeccion);
  });

  const barraLateral = document.querySelector('.sidebar');

  if (barraLateral) {
    barraLateral.classList.remove('open');
  }

  const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const comportamiento = configuracion.inmediato || reducirMovimiento
    ? 'auto'
    : 'smooth';

  window.scrollTo({ top: 0, behavior: comportamiento });
}

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

function alternarMenuMovil() {
  const barraLateral = document.querySelector('.sidebar');

  if (barraLateral) {
    barraLateral.classList.toggle('open');
  }
}

let temporizadorCambioPeriodo = null;

function manejarCambioPeriodo() {
  aplicarFiltroPeriodo();
  const vistaActiva = document.querySelector('.view.active');
  const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;

  clearTimeout(temporizadorCambioPeriodo);

  if (!vistaActiva || reducirMovimiento) {
    pintarTableroCompleto({ modo: 'periodo' });
    return;
  }

  vistaActiva.classList.add('is-period-updating');

  temporizadorCambioPeriodo = window.setTimeout(function () {
    pintarTableroCompleto({ modo: 'periodo' });

    requestAnimationFrame(function () {
      vistaActiva.classList.remove('is-period-updating');
    });
  }, 70);
}

function manejarArchivosSeleccionados(evento) {
  importarArchivos(evento.target.files);
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
  inicializarSelectoresPersonalizados();

  obtenerElemento('periodSelect').addEventListener('change', manejarCambioPeriodo);
  obtenerElemento('exerciseSelect').addEventListener('change', function () {
    pintarDetalleEjercicio();
  });
  obtenerElemento('themeButton').addEventListener('click', alternarTema);
  obtenerElemento('menuButton').addEventListener('click', alternarMenuMovil);
  obtenerElemento('importButton').addEventListener('click', abrirModalImportacion);
  obtenerElemento('modalClose').addEventListener('click', cerrarModalImportacion);
  obtenerElemento('importModal').addEventListener('click', manejarClicFueraDelModal);
  obtenerElemento('fileInput').addEventListener('change', manejarArchivosSeleccionados);

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
