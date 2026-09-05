import {
  analizarEntrenamientos,
  analizarMediciones,
  identificarTipoDeArchivo,
  obtenerColumnasDelEncabezado
} from './analisis-importacion.js';
import {
  borrarDatosLocales,
  guardarDatosLocales
} from './almacenamiento.js';
import { leerFilasPublicadas } from './carga-inicial.js';
import {
  estadoAplicacion,
  formatoFechaCompleta,
  formatoFechaCorta
} from './configuracion.js';
import {
  aplicarFiltroPeriodo,
  convertirCSVaObjetos,
  convertirFilasEnMediciones,
  convertirFilasEnSeries,
  establecerDatos
} from './datos.js';
import { crearElemento, obtenerElemento } from './utilidades.js';
import { pintarTableroCompleto } from './vistas/index.js';

const MAXIMO_ELEMENTOS_LISTADOS = 6;

// Lo analizado espera aquí a que la persona decida: nada toca el tablero hasta
// que confirma desde la vista previa.
let analisisPendiente = null;

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

function pluralizar(cantidad, singular, plural) {
  return cantidad === 1 ? singular : plural;
}

export function describirOrigenDeDatos() {
  const origen = estadoAplicacion.origenDatos;

  if (origen.tipo !== 'local') {
    return estadoAplicacion.sesiones.length === 0
      ? 'Todavía no has importado nada. Todo se procesa en tu navegador.'
      : 'Mostrando los datos que vienen con el tablero.';
  }

  if (!origen.guardadoEn) {
    return 'Historial guardado en este navegador.';
  }

  return 'Historial guardado en este navegador · '
    + formatoFechaCompleta.format(origen.guardadoEn);
}

export function actualizarPieDeAlmacenamiento() {
  const esLocal = estadoAplicacion.origenDatos.tipo === 'local';
  const botonReinicio = obtenerElemento('resetDataButton');

  obtenerElemento('storageInfo').textContent = describirOrigenDeDatos();
  botonReinicio.hidden = !esLocal;
  botonReinicio.textContent = hayDatosPublicados
    ? 'Volver a los datos iniciales'
    : 'Borrar el historial guardado';
}

// Se descubre en el arranque: si el tablero no viaja con CSV, ofrecer "volver a
// los datos iniciales" sería ofrecer volver a nada.
let hayDatosPublicados = false;

export function registrarSiHayDatosPublicados(existen) {
  hayDatosPublicados = existen;
}

export function registrarOrigenLocal(guardadoEn) {
  estadoAplicacion.origenDatos = {
    tipo: 'local',
    guardadoEn: guardadoEn || new Date()
  };
}

export function registrarOrigenPublicado() {
  estadoAplicacion.origenDatos = { tipo: 'publicado', guardadoEn: null };
}

function leerArchivoComoTexto(archivo) {
  return archivo.text().then(function (contenidoArchivo) {
    return {
      nombre: archivo.name,
      contenido: contenidoArchivo
    };
  });
}

// Varios archivos del mismo tipo se acumulan: quien exporta por años puede
// soltar los tres CSV de golpe.
function agruparFilasPorTipo(archivosLeidos) {
  const agrupado = {
    entrenamiento: [],
    mediciones: [],
    ignorados: []
  };

  archivosLeidos.forEach(function (archivo) {
    const columnas = obtenerColumnasDelEncabezado(archivo.contenido);
    const tipoArchivo = identificarTipoDeArchivo(archivo.nombre, columnas);

    if (!tipoArchivo) {
      agrupado.ignorados.push(archivo.nombre);
      return;
    }

    agrupado[tipoArchivo].push(...convertirCSVaObjetos(archivo.contenido));
  });

  return agrupado;
}

function construirAnalisis(agrupado) {
  const analisis = {
    entrenamientos: null,
    mediciones: null,
    ignorados: agrupado.ignorados
  };

  if (agrupado.entrenamiento.length > 0) {
    analisis.entrenamientos = analizarEntrenamientos(
      agrupado.entrenamiento,
      estadoAplicacion.todasLasSeries
    );
  }

  if (agrupado.mediciones.length > 0) {
    analisis.mediciones = analizarMediciones(
      agrupado.mediciones,
      estadoAplicacion.mediciones
    );
  }

  return analisis;
}

function contarNovedades(analisis) {
  let novedades = 0;

  if (analisis.entrenamientos) {
    novedades += analisis.entrenamientos.sesionesNuevas.length;
  }

  if (analisis.mediciones) {
    novedades += analisis.mediciones.medicionesNuevas.length;
  }

  return novedades;
}

function crearContador(cantidad, etiqueta, clase) {
  const contador = crearElemento('li', clase || '');

  contador.append(
    crearElemento('strong', '', String(cantidad)),
    crearElemento('span', '', etiqueta)
  );

  return contador;
}

function crearGrupoDeResumen(titulo, contadores) {
  const grupo = crearElemento('div', 'import-group');
  const lista = crearElemento('ul', 'import-counts');

  contadores.forEach(function (contador) {
    lista.append(crearContador(contador.cantidad, contador.etiqueta, contador.clase));
  });

  grupo.append(crearElemento('span', 'import-group-title', titulo), lista);

  return grupo;
}

function pintarResumenDeEntrenamientos(contenedor, resultado) {
  const nuevas = resultado.sesionesNuevas.length;
  const duplicadas = resultado.sesionesDuplicadas.length;
  const invalidas = resultado.filasInvalidas.length;

  contenedor.append(crearGrupoDeResumen('Entrenamientos', [
    {
      cantidad: nuevas,
      etiqueta: pluralizar(nuevas, 'sesión nueva', 'sesiones nuevas'),
      clase: nuevas > 0 ? 'is-new' : ''
    },
    {
      cantidad: duplicadas,
      etiqueta: pluralizar(duplicadas, 'ya estaba', 'ya estaban')
    },
    {
      cantidad: invalidas,
      etiqueta: pluralizar(invalidas, 'fila inválida', 'filas inválidas'),
      clase: invalidas > 0 ? 'is-invalid' : ''
    }
  ]));
}

function pintarResumenDeMediciones(contenedor, resultado) {
  const nuevas = resultado.medicionesNuevas.length;
  const duplicadas = resultado.medicionesDuplicadas.length;
  const invalidas = resultado.filasInvalidas.length;

  contenedor.append(crearGrupoDeResumen('Mediciones', [
    {
      cantidad: nuevas,
      etiqueta: pluralizar(nuevas, 'medición nueva', 'mediciones nuevas'),
      clase: nuevas > 0 ? 'is-new' : ''
    },
    {
      cantidad: duplicadas,
      etiqueta: pluralizar(duplicadas, 'ya estaba', 'ya estaban')
    },
    {
      cantidad: invalidas,
      etiqueta: pluralizar(invalidas, 'fila inválida', 'filas inválidas'),
      clase: invalidas > 0 ? 'is-invalid' : ''
    }
  ]));
}

function crearListaDeDetalle(elementos, crearFila) {
  const lista = crearElemento('ul', 'import-list');

  elementos.slice(0, MAXIMO_ELEMENTOS_LISTADOS).forEach(function (elemento) {
    lista.append(crearFila(elemento));
  });

  const restantes = elementos.length - MAXIMO_ELEMENTOS_LISTADOS;

  if (restantes > 0) {
    lista.append(crearElemento(
      'li',
      'import-list-more',
      'y ' + restantes + ' ' + pluralizar(restantes, 'más', 'más')
    ));
  }

  return lista;
}

function crearBloqueDeDetalle(titulo, cantidad, lista, abierto) {
  const bloque = crearElemento('details', 'import-detail');
  const encabezado = crearElemento('summary', '', titulo + ' (' + cantidad + ')');

  bloque.open = Boolean(abierto);
  bloque.append(encabezado, lista);

  return bloque;
}

function crearFilaDeSesion(sesion) {
  const fila = crearElemento('li', '');

  fila.append(
    crearElemento('span', 'import-list-date', formatoFechaCorta.format(sesion.inicio)),
    crearElemento('strong', '', sesion.titulo),
    crearElemento(
      'span',
      'import-list-note',
      sesion.cantidadSeries + ' ' + pluralizar(sesion.cantidadSeries, 'serie', 'series')
    )
  );

  return fila;
}

function crearFilaDeMedicion(medicion) {
  const fila = crearElemento('li', '');
  const detalles = [];

  if (medicion.pesoLibras !== null) {
    detalles.push('peso');
  }

  if (medicion.porcentajeGrasa !== null) {
    detalles.push('% de grasa');
  }

  fila.append(
    crearElemento('span', 'import-list-date', formatoFechaCorta.format(medicion.fecha)),
    crearElemento('strong', '', detalles.join(' y '))
  );

  return fila;
}

function crearFilaInvalida(filaInvalida) {
  const fila = crearElemento('li', '');

  fila.append(
    crearElemento('span', 'import-list-date', 'Fila ' + filaInvalida.numeroFila),
    crearElemento('strong', '', filaInvalida.motivo),
    crearElemento('span', 'import-list-note', filaInvalida.descripcion)
  );

  return fila;
}

function reunirFilasInvalidas(analisis) {
  const filasInvalidas = [];

  if (analisis.entrenamientos) {
    filasInvalidas.push(...analisis.entrenamientos.filasInvalidas);
  }

  if (analisis.mediciones) {
    filasInvalidas.push(...analisis.mediciones.filasInvalidas);
  }

  return filasInvalidas;
}

function pintarDetalles(contenedor, analisis) {
  if (analisis.entrenamientos) {
    const sesionesNuevas = analisis.entrenamientos.sesionesNuevas;
    const sesionesDuplicadas = analisis.entrenamientos.sesionesDuplicadas;

    if (sesionesNuevas.length > 0) {
      contenedor.append(crearBloqueDeDetalle(
        'Sesiones nuevas',
        sesionesNuevas.length,
        crearListaDeDetalle(sesionesNuevas, crearFilaDeSesion),
        true
      ));
    }

    if (sesionesDuplicadas.length > 0) {
      contenedor.append(crearBloqueDeDetalle(
        'Sesiones que ya estaban',
        sesionesDuplicadas.length,
        crearListaDeDetalle(sesionesDuplicadas, crearFilaDeSesion),
        false
      ));
    }
  }

  if (analisis.mediciones && analisis.mediciones.medicionesNuevas.length > 0) {
    contenedor.append(crearBloqueDeDetalle(
      'Mediciones nuevas',
      analisis.mediciones.medicionesNuevas.length,
      crearListaDeDetalle(analisis.mediciones.medicionesNuevas, crearFilaDeMedicion),
      true
    ));
  }

  const filasInvalidas = reunirFilasInvalidas(analisis);

  if (filasInvalidas.length > 0) {
    contenedor.append(crearBloqueDeDetalle(
      'Filas descartadas',
      filasInvalidas.length,
      crearListaDeDetalle(filasInvalidas, crearFilaInvalida),
      false
    ));
  }

  if (analisis.ignorados.length > 0) {
    contenedor.append(crearElemento(
      'p',
      'import-ignored',
      'Sin reconocer: ' + analisis.ignorados.join(', ')
    ));
  }
}

function describirBotonDeReemplazo(analisis) {
  if (analisis.entrenamientos && analisis.mediciones) {
    return 'Reemplazar historial';
  }

  if (analisis.entrenamientos) {
    return 'Reemplazar entrenamientos';
  }

  return 'Reemplazar mediciones';
}

function crearBoton(texto, clases, alPulsar) {
  const boton = crearElemento('button', clases, texto);

  boton.type = 'button';
  boton.addEventListener('click', alPulsar);

  return boton;
}

function pintarAcciones(contenedor, analisis) {
  const novedades = contarNovedades(analisis);
  const botonAgregar = crearBoton(
    novedades > 0
      ? 'Añadir ' + novedades + ' ' + pluralizar(novedades, 'registro', 'registros')
      : 'Nada nuevo que añadir',
    'import-action is-primary',
    function () {
      aplicarImportacion('agregar');
    }
  );

  botonAgregar.disabled = novedades === 0;

  contenedor.append(
    botonAgregar,
    crearBoton(
      describirBotonDeReemplazo(analisis),
      'import-action',
      function () {
        aplicarImportacion('reemplazar');
      }
    ),
    crearBoton('Cancelar', 'import-action is-ghost', cancelarImportacion)
  );
}

function mostrarVistaPrevia(analisis) {
  const resumen = obtenerElemento('importSummary');
  const detalles = obtenerElemento('importDetails');
  const acciones = obtenerElemento('importActions');

  resumen.replaceChildren();
  detalles.replaceChildren();
  acciones.replaceChildren();

  if (analisis.entrenamientos) {
    pintarResumenDeEntrenamientos(resumen, analisis.entrenamientos);
  }

  if (analisis.mediciones) {
    pintarResumenDeMediciones(resumen, analisis.mediciones);
  }

  pintarDetalles(detalles, analisis);
  pintarAcciones(acciones, analisis);

  obtenerElemento('dropZone').hidden = true;
  obtenerElemento('importPreview').hidden = false;
}

export function cancelarImportacion() {
  analisisPendiente = null;

  obtenerElemento('importPreview').hidden = true;
  obtenerElemento('dropZone').hidden = false;
  obtenerElemento('importSummary').replaceChildren();
  obtenerElemento('importDetails').replaceChildren();
  obtenerElemento('importActions').replaceChildren();
  mostrarEstadoImportacion('Todo se procesa dentro de tu navegador.', '');
}

function fusionarSeries(analisis, modo) {
  if (!analisis.entrenamientos) {
    return estadoAplicacion.todasLasSeries;
  }

  if (modo === 'reemplazar') {
    return analisis.entrenamientos.seriesTotales;
  }

  return estadoAplicacion.todasLasSeries.concat(analisis.entrenamientos.seriesNuevas);
}

function fusionarMediciones(analisis, modo) {
  if (!analisis.mediciones) {
    return estadoAplicacion.mediciones;
  }

  if (modo === 'reemplazar') {
    return analisis.mediciones.medicionesTotales;
  }

  return estadoAplicacion.mediciones.concat(analisis.mediciones.medicionesNuevas);
}

function describirResultado(analisis, modo) {
  if (modo === 'reemplazar') {
    return estadoAplicacion.sesiones.length
      + ' '
      + pluralizar(estadoAplicacion.sesiones.length, 'entrenamiento', 'entrenamientos')
      + ' y '
      + estadoAplicacion.mediciones.length
      + ' '
      + pluralizar(estadoAplicacion.mediciones.length, 'medición', 'mediciones')
      + ' en el tablero.';
  }

  const novedades = contarNovedades(analisis);

  return 'Añadí '
    + novedades
    + ' '
    + pluralizar(novedades, 'registro nuevo', 'registros nuevos')
    + '.';
}

function aplicarImportacion(modo) {
  const analisis = analisisPendiente;

  if (!analisis) {
    return;
  }

  establecerDatos(
    fusionarSeries(analisis, modo),
    fusionarMediciones(analisis, modo)
  );

  const resultadoGuardado = guardarDatosLocales(
    estadoAplicacion.todasLasSeries,
    estadoAplicacion.mediciones
  );

  if (resultadoGuardado.guardado) {
    registrarOrigenLocal(new Date());
  }

  analisisPendiente = null;
  aplicarFiltroPeriodo();
  pintarTableroCompleto({ modo: 'datos' });
  actualizarPieDeAlmacenamiento();

  if (!resultadoGuardado.guardado) {
    mostrarEstadoImportacion(
      describirResultado(analisis, modo)
        + ' No pude guardarlo en este navegador, así que se perderá al recargar.',
      'error'
    );
    return;
  }

  mostrarEstadoImportacion(describirResultado(analisis, modo), 'success');

  setTimeout(function () {
    cerrarModalImportacion();
    cancelarImportacion();
  }, 900);

  mostrarNotificacion('Datos guardados en este navegador. Todo se procesó localmente.');
}

export async function importarArchivos(archivosSeleccionados) {
  const archivosCSV = Array.from(archivosSeleccionados).filter(function (archivo) {
    return archivo.name.toLowerCase().endsWith('.csv');
  });

  if (archivosCSV.length === 0) {
    mostrarEstadoImportacion('Selecciona al menos un archivo CSV.', 'error');
    return;
  }

  mostrarEstadoImportacion('Revisando los archivos…', '');

  const archivosLeidos = await Promise.all(archivosCSV.map(leerArchivoComoTexto));
  const agrupado = agruparFilasPorTipo(archivosLeidos);
  const hayEntrenamientos = agrupado.entrenamiento.length > 0;
  const hayMediciones = agrupado.mediciones.length > 0;

  if (!hayEntrenamientos && !hayMediciones) {
    mostrarEstadoImportacion(
      'No reconocí ninguno de esos CSV. Espero columnas de Hevy: '
        + 'exercise_title para entrenamientos, date y peso para mediciones.',
      'error'
    );
    return;
  }

  const analisis = construirAnalisis(agrupado);

  if (hayEntrenamientos && analisis.entrenamientos.seriesTotales.length === 0) {
    mostrarEstadoImportacion(
      'El CSV de entrenamientos no tiene ninguna fecha de Hevy válida.',
      'error'
    );
    return;
  }

  analisisPendiente = analisis;
  mostrarVistaPrevia(analisis);
  mostrarEstadoImportacion('Nada cambia hasta que confirmes.', '');
}

export async function restaurarDatosIniciales() {
  try {
    const filasPublicadas = await leerFilasPublicadas();

    borrarDatosLocales();

    // Sin CSV publicados —lo normal en una copia en internet— volver al inicio
    // es quedarse sin datos, no recuperar otros.
    if (filasPublicadas) {
      establecerDatos(
        convertirFilasEnSeries(filasPublicadas.filasEntrenamiento),
        convertirFilasEnMediciones(filasPublicadas.filasMediciones)
      );
    } else {
      establecerDatos([], []);
    }

    registrarOrigenPublicado();
    aplicarFiltroPeriodo();
    pintarTableroCompleto({ modo: 'datos' });
    actualizarPieDeAlmacenamiento();
    mostrarEstadoImportacion(
      filasPublicadas
        ? 'Volví a los datos que vienen con el tablero.'
        : 'Historial borrado. Importa tus CSV cuando quieras.',
      'success'
    );
    mostrarNotificacion('Historial local borrado.');
  } catch (errorLectura) {
    console.error(errorLectura);
    mostrarEstadoImportacion(
      'No pude recuperar los datos iniciales. Tu historial guardado sigue intacto.',
      'error'
    );
  }
}

export function abrirModalImportacion() {
  const dialogoImportacion = obtenerElemento('importModal');

  actualizarPieDeAlmacenamiento();

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
