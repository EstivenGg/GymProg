import { estadoAplicacion } from './configuracion.js';
import { aplicarFiltroPeriodo, convertirCSVaObjetos, prepararDatos } from './datos.js';
import { obtenerElemento } from './utilidades.js';
import { pintarTableroCompleto } from './vistas/index.js';

export function mostrarNotificacion(mensaje) {
  const notificacion = obtenerElemento('toast');

  notificacion.textContent = mensaje;
  notificacion.classList.add('show');

  clearTimeout(mostrarNotificacion.temporizador);

  mostrarNotificacion.temporizador = setTimeout(function () {
    notificacion.classList.remove('show');
  }, 3_200);
}

export function mostrarEstadoImportacion(mensaje, tipoEstado) {
  const estadoImportacion = obtenerElemento('importStatus');
  const claseEstado = tipoEstado || '';

  estadoImportacion.textContent = mensaje;
  estadoImportacion.className = 'modal-status ' + claseEstado;
}

function obtenerColumnasDelEncabezado(contenidoArchivo) {
  const primeraLinea = contenidoArchivo.split(/\r?\n/, 1)[0];

  const nombresColumnas = primeraLinea.split(',').map(function (nombreColumna) {
    return nombreColumna
      .replace(/^\uFEFF/, '')
      .trim()
      .replace(/^"|"$/g, '');
  });

  return new Set(nombresColumnas);
}

function identificarContenidoDeArchivos(archivosLeidos) {
  const contenidos = {
    entrenamiento: '',
    mediciones: ''
  };

  archivosLeidos.forEach(function (archivo) {
    const columnasEncabezado = obtenerColumnasDelEncabezado(archivo.contenido);

    const esArchivoEntrenamiento = archivo.nombre.includes('workout')
      || columnasEncabezado.has('exercise_title');

    const esArchivoMediciones = archivo.nombre.includes('measurement')
      || columnasEncabezado.has('fat_percent');

    if (esArchivoEntrenamiento) {
      contenidos.entrenamiento = archivo.contenido;
    } else if (esArchivoMediciones) {
      contenidos.mediciones = archivo.contenido;
    }
  });

  return contenidos;
}

function leerArchivoComoTexto(archivo) {
  return archivo.text().then(function (contenidoArchivo) {
    return {
      nombre: archivo.name.toLowerCase(),
      contenido: contenidoArchivo
    };
  });
}

export async function importarArchivos(archivosSeleccionados) {
  const archivosCSV = Array.from(archivosSeleccionados).filter(function (archivo) {
    return archivo.name.toLowerCase().endsWith('.csv');
  });

  if (archivosCSV.length === 0) {
    mostrarEstadoImportacion('Selecciona al menos un archivo CSV.', 'error');
    return;
  }

  const promesasLectura = archivosCSV.map(leerArchivoComoTexto);
  const archivosLeidos = await Promise.all(promesasLectura);
  const contenidos = identificarContenidoDeArchivos(archivosLeidos);

  if (!contenidos.entrenamiento) {
    mostrarEstadoImportacion(
      'No encontré workout_data.csv ni columnas de entrenamiento.',
      'error'
    );
    return;
  }

  const filasEntrenamiento = convertirCSVaObjetos(contenidos.entrenamiento);
  let filasMediciones = [];

  if (contenidos.mediciones) {
    filasMediciones = convertirCSVaObjetos(contenidos.mediciones);
  }

  prepararDatos(filasEntrenamiento, filasMediciones);

  if (estadoAplicacion.sesiones.length === 0) {
    mostrarEstadoImportacion(
      'El CSV no contiene fechas de Hevy válidas.',
      'error'
    );
    return;
  }

  aplicarFiltroPeriodo();
  pintarTableroCompleto({ modo: 'datos' });

  mostrarEstadoImportacion(
    estadoAplicacion.sesiones.length + ' entrenamientos cargados correctamente.',
    'success'
  );

  setTimeout(cerrarModalImportacion, 650);
  mostrarNotificacion('Datos actualizados. Todo se procesó localmente.');
}

export function abrirModalImportacion() {
  const dialogoImportacion = obtenerElemento('importModal');

  if (!dialogoImportacion.open) {
    dialogoImportacion.showModal();
  }
}

export function cerrarModalImportacion() {
  const dialogoImportacion = obtenerElemento('importModal');

  if (dialogoImportacion.open) {
    dialogoImportacion.close();
  }
}
