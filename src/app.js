import { leerDatosLocales } from './almacenamiento.js';
import { leerFilasPublicadas } from './carga-inicial.js';
import {
  aplicarFiltroPeriodo,
  convertirFilasEnMediciones,
  convertirFilasEnSeries,
  establecerDatos
} from './datos.js';
import {
  abrirModalImportacion,
  actualizarPieDeAlmacenamiento,
  mostrarEstadoImportacion,
  registrarOrigenLocal,
  registrarOrigenPublicado,
  registrarSiHayDatosPublicados
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

// Lo que la persona importó manda sobre los CSV publicados: si hay historial
// guardado, el tablero ni siquiera pide los archivos iniciales.
function restaurarDatosGuardados() {
  const datosGuardados = leerDatosLocales();

  if (!datosGuardados) {
    return false;
  }

  establecerDatos(datosGuardados.series, datosGuardados.mediciones);

  let fechaDeGuardado = null;

  if (datosGuardados.guardadoEn) {
    const fechaLeida = new Date(datosGuardados.guardadoEn);

    if (!Number.isNaN(fechaLeida.getTime())) {
      fechaDeGuardado = fechaLeida;
    }
  }

  registrarOrigenLocal(fechaDeGuardado);

  return true;
}

function mostrarBienvenidaSinDatos() {
  establecerDatos([], []);
  registrarOrigenPublicado();
  mostrarEstadoImportacion(
    'Empieza aquí: arrastra tus CSV de Hevy. Se procesan en tu navegador y se '
      + 'guardan en este dispositivo.',
    ''
  );
  abrirModalImportacion();
}

async function cargarDatosPublicados() {
  const filasPublicadas = await leerFilasPublicadas();

  registrarSiHayDatosPublicados(Boolean(filasPublicadas));

  if (!filasPublicadas) {
    mostrarBienvenidaSinDatos();
    return;
  }

  establecerDatos(
    convertirFilasEnSeries(filasPublicadas.filasEntrenamiento),
    convertirFilasEnMediciones(filasPublicadas.filasMediciones)
  );
  registrarOrigenPublicado();
}

async function cargarDatosIniciales() {
  try {
    if (!restaurarDatosGuardados()) {
      await cargarDatosPublicados();
    }

    aplicarFiltroPeriodo();
    pintarTableroCompleto({ modo: 'inicial' });
  } catch (errorLectura) {
    console.error(errorLectura);

    establecerDatos([], []);
    registrarOrigenPublicado();
    aplicarFiltroPeriodo();
    pintarTableroCompleto({ modo: 'inicial' });
    mostrarEstadoImportacion(
      'No pude leer los datos iniciales. Selecciona tus archivos CSV.',
      'error'
    );
    abrirModalImportacion();
  } finally {
    actualizarPieDeAlmacenamiento();
    finalizarCargaInicial();
  }
}

async function iniciarAplicacion() {
  estabilizarPosicionInicial();
  iniciarTema();
  conectarEventos();
  cambiarSeccion(location.hash.slice(1), { inmediato: true });
  pintarFechaActual();
  await cargarDatosIniciales();
  estabilizarPosicionInicial();
}

try {
  await iniciarAplicacion();
} catch (errorInicio) {
  console.error('No se pudo iniciar la aplicación.', errorInicio);
}
