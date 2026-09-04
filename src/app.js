import { aplicarFiltroPeriodo, convertirCSVaObjetos, prepararDatos } from './datos.js';
import {
  abrirModalImportacion,
  mostrarEstadoImportacion
} from './importacion.js';
import {
  cambiarSeccion,
  conectarEventos,
  estabilizarPosicionInicial,
  iniciarTema
} from './interfaz.js';
import { obtenerElemento } from './utilidades.js';
import { pintarTableroCompleto } from './vistas/index.js';

function pintarFechaActual() {
  const formatoFechaActual = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  obtenerElemento('todayLabel').textContent = formatoFechaActual
    .format(new Date())
    .toUpperCase();
}

function finalizarCargaInicial() {
  obtenerElemento('resumen').setAttribute('aria-busy', 'false');

  requestAnimationFrame(function () {
    document.body.classList.remove('is-loading');
  });
}

async function descargarArchivoCSV(rutaArchivo, esObligatorio) {
  const respuestaArchivo = await fetch(rutaArchivo, {
    cache: 'no-store'
  });

  if (respuestaArchivo.ok) {
    return respuestaArchivo.text();
  }

  if (esObligatorio) {
    throw new Error('No se pudo cargar el archivo: ' + rutaArchivo);
  }

  return '';
}

async function cargarDatosPublicados() {
  try {
    const contenidoEntrenamientos = await descargarArchivoCSV(
      './data/workout_data.csv',
      true
    );

    const contenidoMediciones = await descargarArchivoCSV(
      './data/measurement_data.csv',
      false
    );

    const filasEntrenamiento = convertirCSVaObjetos(contenidoEntrenamientos);
    let filasMediciones = [];

    if (contenidoMediciones) {
      filasMediciones = convertirCSVaObjetos(contenidoMediciones);
    }

    prepararDatos(filasEntrenamiento, filasMediciones);
    aplicarFiltroPeriodo();
    pintarTableroCompleto({ modo: 'inicial' });
  } catch (errorLectura) {
    console.error(errorLectura);

    prepararDatos([], []);
    pintarTableroCompleto({ modo: 'inicial' });
    mostrarEstadoImportacion(
      'No encontré datos iniciales. Selecciona tus archivos CSV.',
      'error'
    );
    abrirModalImportacion();
  } finally {
    finalizarCargaInicial();
  }
}

async function iniciarAplicacion() {
  estabilizarPosicionInicial();
  iniciarTema();
  conectarEventos();
  cambiarSeccion(location.hash.slice(1), { inmediato: true });
  pintarFechaActual();
  await cargarDatosPublicados();
  estabilizarPosicionInicial();
}

try {
  await iniciarAplicacion();
} catch (errorInicio) {
  console.error('No se pudo iniciar la aplicación.', errorInicio);
}
