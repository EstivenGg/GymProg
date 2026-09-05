import {
  convertirLibrasAUnidad,
  estadoAplicacion,
  formatearCarga,
  formatoFechaCompleta,
  formatoFechaCorta,
  formatoNumero,
  formatoNumeroCompacto,
  MILISEGUNDOS_POR_DIA,
  obtenerUnidadPeso
} from '../configuracion.js';
import {
  agruparVolumen,
  contarSesionesSinCarga,
  filtrarSesionesPorRutina,
  obtenerAgrupacion,
  RUTINA_TODAS
} from '../agrupacion-volumen.js';
import { crearComparativasResumen } from '../comparativas.js';
import { crearResumenConstancia } from '../constancia.js';
import { pintarGraficaLinea } from '../grafica-linea.js';
import { abrirSesion } from './sesiones.js';
import {
  contarSesionesPorRutina,
  crearVariablesDeRutina,
  VARIABLE_OTRAS_RUTINAS
} from '../rutinas.js';
import { establecerValorSelector } from '../selector-personalizado.js';
import {
  calcularMetricasSesion,
  calcularRachaSemanal,
  esSerieEfectiva,
  obtenerDuracionTotal,
  obtenerVolumenTotal
} from '../metricas.js';
import {
  animarConteo,
  clonarElementoDePlantilla,
  crearElemento,
  crearEstadoVacio,
  describirRangoDeFechas,
  leerVariableCSS,
  obtenerElemento,
  obtenerInicioDelDia,
  sumarDias
} from '../utilidades.js';

let metricaCorporalSeleccionada = 'weight';

const CLAVE_AGRUPACION_VOLUMEN = 'hevy-progress-volume-group';
const formatoMesEje = new Intl.DateTimeFormat('es-CO', {
  month: 'short',
  year: '2-digit'
});
const formatoMesCompleto = new Intl.DateTimeFormat('es-CO', {
  month: 'long',
  year: 'numeric'
});
let agrupacionVolumenSeleccionada = null;
let rutinaVolumenSeleccionada = RUTINA_TODAS;

function crearTextoDuracion(duracionMinutos) {
  if (duracionMinutos < 60) {
    return duracionMinutos + ' min';
  }

  const horasCompletas = Math.floor(duracionMinutos / 60);
  const minutosRestantes = duracionMinutos % 60;

  return horasCompletas + ' h ' + minutosRestantes + ' min';
}

function crearTextoDiferenciaCantidad(cantidad, unidadSingular, unidadPlural, aumenta) {
  const unidad = cantidad === 1 ? unidadSingular : unidadPlural;
  const direccion = aumenta ? 'más' : 'menos';

  return cantidad + ' ' + unidad + ' ' + direccion;
}

function crearTextoDiferenciaVolumen(diferencia, aumenta) {
  return formatearCarga(diferencia, true)
    + ' '
    + (aumenta ? 'más' : 'menos');
}

function crearTextoDiferenciaDuracion(diferencia, aumenta) {
  return crearTextoDuracion(Math.round(diferencia))
    + ' '
    + (aumenta ? 'más' : 'menos');
}

// La insignia solo muestra el porcentaje; el detalle en palabras vive en el
// title, y el periodo de comparacion se enuncia una sola vez para toda la tira.
function pintarComparacion(
  idElemento,
  valorActual,
  valorAnterior,
  hayHistorialAnterior,
  descripcionPeriodo,
  crearTextoDiferencia
) {
  const insignia = obtenerElemento(idElemento);
  const valor = insignia.querySelector('[data-field="trend"]');

  insignia.classList.remove('increase', 'decrease', 'neutral');

  if (!hayHistorialAnterior) {
    insignia.classList.add('neutral');
    valor.textContent = '—';
    insignia.title = 'Sin historial anterior';
    return;
  }

  const diferencia = valorActual - valorAnterior;

  if (diferencia === 0) {
    insignia.classList.add('neutral');
    valor.textContent = '0%';
    insignia.title = 'Sin cambio · ' + descripcionPeriodo;
    return;
  }

  const aumenta = diferencia > 0;
  const detalle = crearTextoDiferencia(Math.abs(diferencia), aumenta)
    + ' · '
    + descripcionPeriodo;

  if (valorAnterior === 0) {
    insignia.classList.add('increase');
    valor.textContent = 'NUEVO';
    insignia.title = 'Nuevo · ' + detalle;
    return;
  }

  const porcentaje = Math.round(Math.abs(diferencia / valorAnterior) * 100);

  insignia.classList.add(aumenta ? 'increase' : 'decrease');
  valor.textContent = (aumenta ? '+' : '-') + porcentaje + '%';
  insignia.title = valor.textContent + ' · ' + detalle;
}

function pintarComparativas() {
  const comparativas = crearComparativasResumen(
    estadoAplicacion.sesiones,
    estadoAplicacion.fechaMasReciente,
    estadoAplicacion.periodoSeleccionado
  );

  obtenerElemento('comparisonPeriod').textContent = comparativas.hayHistorialAnterior
    ? comparativas.comparadoCon
    : 'Sin historial anterior para comparar';

  pintarComparacion(
    'statWorkoutsComparison',
    comparativas.actual.entrenamientos,
    comparativas.anterior.entrenamientos,
    comparativas.hayHistorialAnterior,
    comparativas.descripcion,
    function (diferencia, aumenta) {
      return crearTextoDiferenciaCantidad(
        diferencia,
        'entrenamiento',
        'entrenamientos',
        aumenta
      );
    }
  );
  pintarComparacion(
    'statVolumeComparison',
    comparativas.actual.volumen,
    comparativas.anterior.volumen,
    comparativas.hayHistorialAnterior,
    comparativas.descripcion,
    crearTextoDiferenciaVolumen
  );
  pintarComparacion(
    'statTimeComparison',
    comparativas.actual.duracion,
    comparativas.anterior.duracion,
    comparativas.hayHistorialAnterior,
    comparativas.descripcion,
    crearTextoDiferenciaDuracion
  );
}

function obtenerAgrupacionVolumen() {
  if (agrupacionVolumenSeleccionada) {
    return agrupacionVolumenSeleccionada;
  }

  const guardada = localStorage.getItem(CLAVE_AGRUPACION_VOLUMEN);

  if (obtenerAgrupacion(guardada)) {
    agrupacionVolumenSeleccionada = guardada;
    return agrupacionVolumenSeleccionada;
  }

  // En una pantalla estrecha, un año de entrenamientos son casi doscientas
  // barras de un par de píxeles. La vista semanal es el punto de partida útil.
  const pantallaEstrecha = matchMedia('(max-width: 700px)').matches;

  agrupacionVolumenSeleccionada = pantallaEstrecha ? 'semana' : 'sesion';

  return agrupacionVolumenSeleccionada;
}

function obtenerRutinaVolumen() {
  const existeLaRutina = estadoAplicacion.sesiones.some(function (sesion) {
    return sesion.titulo === rutinaVolumenSeleccionada;
  });

  if (rutinaVolumenSeleccionada !== RUTINA_TODAS && !existeLaRutina) {
    rutinaVolumenSeleccionada = RUTINA_TODAS;
  }

  return rutinaVolumenSeleccionada;
}

// El color se resuelve contra el historial completo: la misma rutina se pinta
// igual aquí que en el listado de sesiones, sin importar el filtro de periodo.
function obtenerColoresDeRutinaResueltos() {
  const variablesPorRutina = crearVariablesDeRutina(estadoAplicacion.sesiones);
  const coloresPorRutina = new Map();

  variablesPorRutina.forEach(function (variable, titulo) {
    coloresPorRutina.set(titulo, leerVariableCSS(variable));
  });

  return coloresPorRutina;
}

function describirRutinasDelBloque(punto) {
  if (punto.rutinas.length <= 1) {
    return '';
  }

  return ' · ' + punto.rutinas.join(', ');
}

function crearDetalleDeBloque(punto) {
  const palabraSesion = punto.cantidadSesiones === 1 ? 'sesión' : 'sesiones';

  return punto.cantidadSesiones
    + ' '
    + palabraSesion
    + describirRutinasDelBloque(punto);
}

function decorarPuntoDeVolumen(punto, agrupacion, coloresPorRutina, colorearPorRutina) {
  const decorado = {
    fecha: punto.fecha,
    valor: convertirLibrasAUnidad(punto.volumenLibras),
    color: colorearPorRutina && punto.rutina
      ? coloresPorRutina.get(punto.rutina)
      : null,
    claveSesion: punto.claveSesion,
    seleccionable: Boolean(punto.claveSesion)
  };

  if (agrupacion === 'sesion') {
    decorado.detalle = punto.rutina;
    return decorado;
  }

  if (agrupacion === 'mes') {
    decorado.titulo = formatoMesCompleto.format(punto.fecha);
    decorado.etiquetaEje = formatoMesEje.format(punto.fecha);
    decorado.detalle = crearDetalleDeBloque(punto);
    return decorado;
  }

  decorado.titulo = 'Semana del ' + describirRangoDeFechas(punto.fecha, punto.fin);
  decorado.detalle = crearDetalleDeBloque(punto);

  return decorado;
}

// Al agrupar, una semana suelta de una sola rutina heredaría su color y saldría
// pintada de azul entre barras naranjas, sin nada en la leyenda que lo explique.
// Por eso el color por rutina solo se aplica cuando todas las barras lo pueden
// tener: en la vista por sesión, o con una rutina ya filtrada.
function crearPuntosDeVolumen(sesiones, agrupacion, rutina) {
  const coloresPorRutina = obtenerColoresDeRutinaResueltos();
  const colorearPorRutina = agrupacion === 'sesion' || rutina !== RUTINA_TODAS;

  return agruparVolumen(sesiones, agrupacion).map(function (punto) {
    return decorarPuntoDeVolumen(
      punto,
      agrupacion,
      coloresPorRutina,
      colorearPorRutina
    );
  });
}

function animarEntradaResumen(animar) {
  const rejilla = obtenerElemento('resumenGrid');
  const paneles = rejilla.querySelectorAll('.panel');

  paneles.forEach(function (panel) {
    panel.classList.remove('is-entering');
  });

  if (!animar) {
    return;
  }

  rejilla.getBoundingClientRect();

  paneles.forEach(function (panel, indicePanel) {
    panel.style.setProperty('--stagger-delay', Math.min(indicePanel, 8) * 38 + 'ms');
    panel.classList.add('is-entering');
  });
}

function pintarMetricasResumen(
  sesiones,
  seriesEfectivas,
  volumenTotal,
  duracionTotal,
  sesionesPorSemana,
  informacionRacha,
  configuracion
) {
  animarConteo(obtenerElemento('statWorkouts'), sesiones.length, {
    animar: configuracion.animarConteos
  });

  if (sesiones.length > 0) {
    obtenerElemento('statFrequency').textContent = formatoNumero.format(sesionesPorSemana)
      + ' sesiones / semana';
  } else {
    obtenerElemento('statFrequency').textContent = 'Sin datos';
  }

  animarConteo(obtenerElemento('statVolume'), volumenTotal, {
    animar: configuracion.animarConteos,
    sufijo: ' ' + obtenerUnidadPeso(),
    formatear: function (valor) {
      return formatoNumeroCompacto.format(convertirLibrasAUnidad(valor));
    }
  });

  const seriesConCarga = seriesEfectivas.filter(function (serie) {
    return Number.isFinite(serie.pesoLibras)
      && serie.pesoLibras > 0
      && Number.isFinite(serie.repeticiones)
      && serie.repeticiones > 0;
  });

  obtenerElemento('statVolumeSub').textContent = seriesConCarga.length
    + ' series con carga registrada';

  obtenerElemento('statTime').textContent = crearTextoDuracion(duracionTotal);

  if (sesiones.length > 0) {
    const promedioDuracion = Math.round(duracionTotal / sesiones.length);
    obtenerElemento('statTimeSub').textContent = promedioDuracion + ' min por sesión';
  } else {
    obtenerElemento('statTimeSub').textContent = 'Duración registrada';
  }

  animarConteo(obtenerElemento('statStreak'), informacionRacha.mejorRacha, {
    animar: configuracion.animarConteos,
    sufijo: ' sem'
  });

  if (informacionRacha.mejorRacha === 1) {
    obtenerElemento('statStreakSub').textContent = 'Semana activa';
  } else {
    obtenerElemento('statStreakSub').textContent = 'Semanas consecutivas';
  }

  pintarComparativas();

  animarEntradaResumen(configuracion.animarEntrada);
}

function pintarRangoDeDatos(primeraFecha, ultimaFecha) {
  if (!primeraFecha || !ultimaFecha) {
    obtenerElemento('dataRange').textContent = 'Esperando datos';
    return;
  }

  obtenerElemento('dataRange').textContent = describirRangoDeFechas(
    primeraFecha,
    ultimaFecha
  );
}

// El filtro no cuenta hacia atrás desde hoy sino desde el último dato del
// archivo, así que esa fecha tiene que estar a la vista.
function pintarReferenciaDePeriodo() {
  const referencia = obtenerElemento('dataAnchor');

  if (estadoAplicacion.periodoSeleccionado === 'all') {
    referencia.hidden = true;
    referencia.textContent = '';
    return;
  }

  const opcionActiva = obtenerElemento('periodSelect').selectedOptions[0];
  const etiquetaPeriodo = opcionActiva ? opcionActiva.textContent : 'El periodo';

  referencia.hidden = false;
  referencia.textContent = '«'
    + etiquetaPeriodo
    + '» cuenta hacia atrás desde tu último dato: '
    + formatoFechaCompleta.format(estadoAplicacion.fechaMasReciente);
}

function pintarCalidadDeDatos() {
  const sesiones = estadoAplicacion.sesiones;
  const mediciones = estadoAplicacion.mediciones;
  const indicador = obtenerElemento('dataQuality');

  if (sesiones.length === 0) {
    indicador.hidden = true;
    indicador.textContent = '';
    return;
  }

  const sesionesConCarga = sesiones.filter(function (sesion) {
    return calcularMetricasSesion(sesion).volumenLibras > 0;
  }).length;
  const coberturaCarga = Math.round(sesionesConCarga / sesiones.length * 100);
  const palabraEntrenamiento = sesiones.length === 1
    ? 'entrenamiento'
    : 'entrenamientos';
  const palabraMedicion = mediciones.length === 1 ? 'medición' : 'mediciones';

  indicador.textContent = sesiones.length
    + ' '
    + palabraEntrenamiento
    + ' · '
    + mediciones.length
    + ' '
    + palabraMedicion
    + ' · carga registrada en '
    + coberturaCarga
    + '% de las sesiones';
  indicador.hidden = false;
}

function actualizarSelectorDeRutinas() {
  const selectorRutinas = obtenerElemento('routineSelect');
  const rutinaActiva = obtenerRutinaVolumen();
  const opciones = document.createDocumentFragment();
  const opcionTodas = document.createElement('option');

  opcionTodas.value = RUTINA_TODAS;
  opcionTodas.textContent = 'Todas las rutinas';
  opciones.appendChild(opcionTodas);

  contarSesionesPorRutina(estadoAplicacion.sesiones).forEach(function (rutina) {
    const opcionRutina = document.createElement('option');

    opcionRutina.value = rutina.titulo;
    opcionRutina.textContent = rutina.titulo + ' (' + rutina.cantidad + ')';
    opciones.appendChild(opcionRutina);
  });

  selectorRutinas.replaceChildren(opciones);
  selectorRutinas.value = rutinaActiva;
  establecerValorSelector('routineSelect', rutinaActiva);
}

function actualizarBotonesDeAgrupacion() {
  const agrupacionActiva = obtenerAgrupacionVolumen();

  document.querySelectorAll('[data-volume-group]').forEach(function (boton) {
    const estaActivo = boton.dataset.volumeGroup === agrupacionActiva;

    boton.classList.toggle('active', estaActivo);
    boton.setAttribute('aria-pressed', String(estaActivo));
  });

  obtenerElemento('volumeGroupLabel').textContent =
    obtenerAgrupacion(agrupacionActiva).descripcion;
}

function crearChipDeLeyenda(texto, color) {
  const chip = crearElemento('span', 'volume-legend-chip');
  const muestra = crearElemento('i', '');

  muestra.style.background = color;
  chip.append(muestra, crearElemento('span', '', texto));

  return chip;
}

// La leyenda solo tiene sentido cuando cada barra puede ser de una rutina
// distinta; al filtrar o al agrupar, todas comparten color y sobra.
function pintarLeyendaDeVolumen(agrupacion, rutina) {
  const leyenda = obtenerElemento('volumeLegend');
  const coloresPorRutina = obtenerColoresDeRutinaResueltos();

  if (agrupacion !== 'sesion' || rutina !== RUTINA_TODAS) {
    const colorUnico = rutina === RUTINA_TODAS
      ? leerVariableCSS('--orange')
      : coloresPorRutina.get(rutina);

    leyenda.replaceChildren(crearChipDeLeyenda('Volumen', colorUnico));
    return;
  }

  const rutinasDelHistorial = contarSesionesPorRutina(estadoAplicacion.sesiones);
  const chips = document.createDocumentFragment();
  let hayRutinasSinColorPropio = false;

  rutinasDelHistorial.forEach(function (rutinaDelHistorial) {
    const color = coloresPorRutina.get(rutinaDelHistorial.titulo);

    if (color === leerVariableCSS(VARIABLE_OTRAS_RUTINAS)) {
      hayRutinasSinColorPropio = true;
      return;
    }

    chips.appendChild(crearChipDeLeyenda(rutinaDelHistorial.titulo, color));
  });

  if (hayRutinasSinColorPropio) {
    chips.appendChild(crearChipDeLeyenda(
      'Otras rutinas',
      leerVariableCSS(VARIABLE_OTRAS_RUTINAS)
    ));
  }

  leyenda.replaceChildren(chips);
}

function pintarNotaDeVolumen(sesionesDeLaRutina) {
  const sesionesSinVolumen = contarSesionesSinCarga(sesionesDeLaRutina);
  const nota = obtenerElemento('volumeChartNote');

  nota.hidden = sesionesSinVolumen === 0;
  nota.textContent = sesionesSinVolumen === 1
    ? '1 sesión sin carga no graficada'
    : sesionesSinVolumen + ' sesiones sin carga no graficadas';
}

function pintarGraficaDeVolumen(sesiones, animar) {
  const agrupacion = obtenerAgrupacionVolumen();
  const rutina = obtenerRutinaVolumen();
  const sesionesDeLaRutina = filtrarSesionesPorRutina(sesiones, rutina);
  const descripcion = obtenerAgrupacion(agrupacion).descripcion;

  actualizarSelectorDeRutinas();
  actualizarBotonesDeAgrupacion();
  pintarLeyendaDeVolumen(agrupacion, rutina);
  pintarNotaDeVolumen(sesionesDeLaRutina);
  obtenerElemento('volumeUnitLabel').textContent = obtenerUnidadPeso();

  const mensajeVacio = rutina === RUTINA_TODAS
    ? 'No hay sesiones con volumen de peso en este periodo.'
    : 'No hay sesiones de ' + rutina + ' con volumen de peso en este periodo.';

  pintarGraficaLinea(
    obtenerElemento('volumeChart'),
    crearPuntosDeVolumen(sesionesDeLaRutina, agrupacion, rutina),
    {
      alSeleccionarPunto: function (punto) {
        abrirSesion(punto.claveSesion);
      },
      animar: animar,
      tipo: 'bar',
      sufijoValor: ' ' + obtenerUnidadPeso(),
      tituloAccesible: 'Volumen con carga ' + descripcion,
      mensajeVacio: mensajeVacio
    }
  );
}

function repintarVolumen() {
  pintarGraficaDeVolumen(estadoAplicacion.sesionesFiltradas, true);
}

export function seleccionarAgrupacionVolumen(clave) {
  if (!obtenerAgrupacion(clave) || clave === obtenerAgrupacionVolumen()) {
    return;
  }

  agrupacionVolumenSeleccionada = clave;
  localStorage.setItem(CLAVE_AGRUPACION_VOLUMEN, clave);
  repintarVolumen();
}

export function seleccionarRutinaVolumen(rutina) {
  if (rutina === obtenerRutinaVolumen()) {
    return;
  }

  rutinaVolumenSeleccionada = rutina || RUTINA_TODAS;
  repintarVolumen();
}

function crearDescripcionSemana(semana) {
  const rango = formatoFechaCorta.format(semana.inicio)
    + ' al '
    + formatoFechaCorta.format(sumarDias(semana.inicio, 6));

  if (semana.estado === 'sin-datos') {
    return rango + ': sin datos disponibles';
  }

  if (semana.estado === 'sin-entrenamiento') {
    return rango + ': sin entrenamientos';
  }

  const unidad = semana.cantidadSesiones === 1 ? 'sesión' : 'sesiones';
  return rango + ': ' + semana.cantidadSesiones + ' ' + unidad;
}

function crearBarrasDeSemanas(semanas) {
  const barrasDeSemanas = document.createDocumentFragment();

  semanas.forEach(function (semana, indiceSemana) {
    let alturaPorcentaje = 12;

    if (semana.estado === 'sin-datos') {
      alturaPorcentaje = 18;
    } else if (semana.estado === 'activa') {
      alturaPorcentaje = Math.min(100, 28 + semana.cantidadSesiones * 18);
    }

    const descripcion = crearDescripcionSemana(semana);

    const barraDeSemana = clonarElementoDePlantilla('weekBarTemplate');
    barraDeSemana.classList.add(semana.estado);
    barraDeSemana.classList.toggle('current', indiceSemana === semanas.length - 1);
    barraDeSemana.style.height = '0%';
    barraDeSemana.dataset.targetHeight = alturaPorcentaje + '%';
    barraDeSemana.dataset.label = descripcion;
    const graficoSemana = barraDeSemana.querySelector('svg');
    graficoSemana.setAttribute('aria-label', descripcion);
    graficoSemana.querySelector('title').textContent = descripcion;
    barrasDeSemanas.appendChild(barraDeSemana);
  });

  return barrasDeSemanas;
}

function pintarComparacionConstancia(comparacion) {
  const elemento = obtenerElemento('consistencyInsight');
  elemento.classList.remove('positive', 'negative', 'neutral');

  if (!comparacion.disponible) {
    elemento.classList.add('neutral');
    elemento.textContent = 'La comparación aparecerá al completar 8 semanas con datos.';
    return;
  }

  const diferencia = comparacion.diferencia;

  if (diferencia === 0) {
    const unidad = comparacion.actual === 1 ? 'entrenamiento' : 'entrenamientos';
    elemento.classList.add('neutral');
    elemento.textContent = '→ Sin cambio · '
      + comparacion.actual
      + ' '
      + unidad
      + ' en cada bloque de 4 semanas.';
    return;
  }

  const aumenta = diferencia > 0;
  const cantidadAbsoluta = Math.abs(diferencia);
  const unidad = cantidadAbsoluta === 1 ? 'entrenamiento' : 'entrenamientos';
  let indicador = aumenta ? '↑ Nuevo ritmo' : '↓ -100%';

  if (comparacion.anterior > 0) {
    const porcentaje = Math.round(cantidadAbsoluta / comparacion.anterior * 100);
    indicador = (aumenta ? '↑ +' : '↓ -') + porcentaje + '%';
  }

  elemento.classList.add(aumenta ? 'positive' : 'negative');
  elemento.textContent = indicador
    + ' · '
    + cantidadAbsoluta
    + ' '
    + unidad
    + ' '
    + (aumenta ? 'más' : 'menos')
    + ' que las 4 semanas anteriores.';
}

function pintarMetaSemanal(resumen, animar) {
  const cantidad = resumen.sesionesSemanaActual;
  const meta = resumen.metaSesiones;
  const faltantes = Math.max(0, meta - cantidad);

  obtenerElemento('weeklyGoalValue').textContent = cantidad + ' de';

  const estadoUltimaSemana = faltantes === 0
    ? 'Meta alcanzada en la última semana registrada'
    : 'Faltan ' + faltantes + ' para la meta de la última semana registrada';

  obtenerElemento('weeklyGoalCopy').textContent = estadoUltimaSemana
    + ' · '
    + resumen.semanasEnMeta
    + ' de '
    + resumen.semanasConDatos
    + ' '
    + (resumen.semanasConDatos === 1 ? 'semana llegó' : 'semanas llegaron')
    + ' a la meta';

  const pista = obtenerElemento('weeklyGoalTrack');
  const valorProgreso = Math.min(cantidad, meta);
  pista.max = meta;
  pista.setAttribute(
    'aria-valuetext',
    cantidad + ' de ' + meta + ' sesiones completadas'
  );

  if (animar) {
    pista.value = 0;
    pista.getBoundingClientRect();

    requestAnimationFrame(function () {
      pista.value = valorProgreso;
    });
  } else {
    pista.value = valorProgreso;
  }
}

function pintarConstancia(animar) {
  const metaSemanal = Number(obtenerElemento('weeklyGoalInput').value);
  const resumen = crearResumenConstancia(
    estadoAplicacion.sesiones,
    estadoAplicacion.fechaMasReciente,
    12,
    metaSemanal
  );

  obtenerElemento('consistencyValue').textContent = resumen.porcentajeActivo + '%';

  if (resumen.semanasConDatos === 0) {
    obtenerElemento('consistencyCopy').textContent = 'Sin semanas registradas';
  } else {
    obtenerElemento('consistencyCopy').textContent = resumen.semanasActivas
      + ' de '
      + resumen.semanasConDatos
      + ' semanas con al menos 1 entrenamiento';
  }

  pintarMetaSemanal(resumen, animar);
  const contenedorBarras = obtenerElemento('weekBars');

  contenedorBarras.replaceChildren(
    crearBarrasDeSemanas(resumen.semanas)
  );

  if (animar) {
    contenedorBarras.getBoundingClientRect();
    requestAnimationFrame(function () {
      contenedorBarras.querySelectorAll('.week-bar').forEach(function (barra) {
        barra.style.height = barra.dataset.targetHeight;
      });
    });
  } else {
    contenedorBarras.querySelectorAll('.week-bar').forEach(function (barra) {
      barra.style.height = barra.dataset.targetHeight;
    });
  }

  pintarComparacionConstancia(resumen.comparacion);
}

function obtenerMedicionesDelPeriodo() {
  if (estadoAplicacion.periodoSeleccionado === 'all') {
    return estadoAplicacion.mediciones.slice();
  }

  const cantidadDias = Number(estadoAplicacion.periodoSeleccionado);
  const fechaMasReciente = obtenerInicioDelDia(estadoAplicacion.fechaMasReciente);
  const fechaLimite = sumarDias(fechaMasReciente, -cantidadDias + 1);

  return estadoAplicacion.mediciones.filter(function (medicion) {
    return medicion.fecha >= fechaLimite;
  });
}

function pintarCambioCorporal(puntos, unidad, animar) {
  const etiquetaCambio = obtenerElemento('weightDelta');
  const textoAnterior = etiquetaCambio.textContent;
  let textoCambio = 'Sin registros';

  if (puntos.length === 1) {
    textoCambio = formatoNumero.format(puntos[0].valor) + unidad;
  } else if (puntos.length > 1) {
    const primerValor = puntos[0].valor;
    const ultimoValor = puntos[puntos.length - 1].valor;
    const diferencia = ultimoValor - primerValor;
    const signoDiferencia = diferencia > 0 ? '+' : '';

    textoCambio = signoDiferencia + formatoNumero.format(diferencia) + unidad;
  }

  etiquetaCambio.textContent = textoCambio;
  etiquetaCambio.classList.remove('negative');
  etiquetaCambio.classList.add('neutral');

  if (animar && textoAnterior !== textoCambio) {
    etiquetaCambio.classList.remove('is-updated');
    etiquetaCambio.getBoundingClientRect();
    etiquetaCambio.classList.add('is-updated');
  }
}

function actualizarSelectorCorporal(medicionesDelPeriodo) {
  const disponibilidad = {
    weight: medicionesDelPeriodo.some(function (medicion) {
      return medicion.pesoLibras !== null;
    }),
    fat: medicionesDelPeriodo.some(function (medicion) {
      return medicion.porcentajeGrasa !== null;
    })
  };

  if (!disponibilidad[metricaCorporalSeleccionada]) {
    if (disponibilidad.weight) {
      metricaCorporalSeleccionada = 'weight';
    } else if (disponibilidad.fat) {
      metricaCorporalSeleccionada = 'fat';
    }
  }

  document.querySelectorAll('[data-body-metric]').forEach(function (boton) {
    const metricaBoton = boton.dataset.bodyMetric;
    const estaActivo = metricaBoton === metricaCorporalSeleccionada;

    boton.disabled = !disponibilidad[metricaBoton];
    boton.classList.toggle('active', estaActivo);
    boton.setAttribute('aria-pressed', String(estaActivo));
  });
}

function pintarGraficaCorporal(animarGrafica, animarCambios) {
  const medicionesDelPeriodo = obtenerMedicionesDelPeriodo();
  actualizarSelectorCorporal(medicionesDelPeriodo);
  const mostrarGrasa = metricaCorporalSeleccionada === 'fat';
  const campo = mostrarGrasa ? 'porcentajeGrasa' : 'pesoLibras';
  const unidadCambio = mostrarGrasa ? ' pp' : ' ' + obtenerUnidadPeso();
  const sufijoGrafica = mostrarGrasa ? '%' : ' ' + obtenerUnidadPeso();
  const titulo = mostrarGrasa ? 'Grasa corporal' : 'Peso corporal';
  const mensajeVacio = mostrarGrasa
    ? 'Añade mediciones de porcentaje de grasa en Hevy.'
    : 'Añade mediciones de peso en Hevy.';

  const puntos = medicionesDelPeriodo
    .filter(function (medicion) {
      return medicion[campo] !== null;
    })
    .map(function (medicion) {
      return {
        fecha: medicion.fecha,
        valor: mostrarGrasa
          ? medicion[campo]
          : convertirLibrasAUnidad(medicion[campo])
      };
    });

  obtenerElemento('bodyMetricTitle').textContent = titulo;

  pintarGraficaLinea(
    obtenerElemento('weightChart'),
    puntos,
    {
      animar: animarGrafica,
      iniciarEnCero: false,
      sufijoValor: sufijoGrafica,
      tituloAccesible: titulo,
      mensajeVacio: mensajeVacio
    }
  );

  pintarCambioCorporal(puntos, unidadCambio, animarCambios);
}

export function seleccionarMetricaCorporal(metrica) {
  if (metrica !== 'weight' && metrica !== 'fat') {
    return;
  }

  metricaCorporalSeleccionada = metrica;
  pintarGraficaCorporal(true, true);
}

function pintarIndicadoresAdicionales(seriesEfectivas) {
  const contenedor = obtenerElemento('trainingInsights');
  const indicadorRPE = obtenerElemento('rpeInsight');
  const indicadorCardio = obtenerElemento('cardioInsight');
  const seriesConRPE = seriesEfectivas.filter(function (serie) {
    return Number.isFinite(serie.esfuerzoPercibido)
      && serie.esfuerzoPercibido > 0;
  });
  const coberturaRPE = seriesEfectivas.length > 0
    ? seriesConRPE.length / seriesEfectivas.length
    : 0;
  const mostrarRPE = seriesConRPE.length >= 3 && coberturaRPE >= 0.25;

  indicadorRPE.hidden = !mostrarRPE;

  if (mostrarRPE) {
    const sumaRPE = seriesConRPE.reduce(function (total, serie) {
      return total + serie.esfuerzoPercibido;
    }, 0);
    const promedioRPE = sumaRPE / seriesConRPE.length;

    indicadorRPE.textContent = 'RPE medio '
      + formatoNumero.format(promedioRPE)
      + ' · '
      + Math.round(coberturaRPE * 100)
      + '% de las series';
  }

  const distanciaTotal = seriesEfectivas.reduce(function (total, serie) {
    return total + (serie.distanciaKm || 0);
  }, 0);
  const duracionCardioSegundos = seriesEfectivas.reduce(function (total, serie) {
    return total + (serie.duracionSegundos || 0);
  }, 0);
  const mostrarCardio = distanciaTotal > 0 || duracionCardioSegundos > 0;

  indicadorCardio.hidden = !mostrarCardio;

  if (mostrarCardio) {
    const partesCardio = [];

    if (distanciaTotal > 0) {
      partesCardio.push(formatoNumero.format(distanciaTotal) + ' km');
    }

    if (duracionCardioSegundos > 0) {
      partesCardio.push(
        crearTextoDuracion(Math.max(1, Math.round(duracionCardioSegundos / 60)))
      );
    }

    indicadorCardio.textContent = 'Cardio · ' + partesCardio.join(' · ');
  }

  contenedor.hidden = !mostrarRPE && !mostrarCardio;
}

function contarSeriesPorEjercicio(series) {
  const cantidadesPorEjercicio = new Map();

  series.filter(esSerieEfectiva).forEach(function (serie) {
    let cantidadActual = 0;

    if (cantidadesPorEjercicio.has(serie.ejercicio)) {
      cantidadActual = cantidadesPorEjercicio.get(serie.ejercicio);
    }

    cantidadesPorEjercicio.set(serie.ejercicio, cantidadActual + 1);
  });

  return cantidadesPorEjercicio;
}

function pintarEjerciciosPrincipales(animar) {
  const cantidadesPorEjercicio = contarSeriesPorEjercicio(
    estadoAplicacion.seriesFiltradas
  );

  const ejerciciosOrdenados = Array.from(cantidadesPorEjercicio.entries());

  ejerciciosOrdenados.sort(function (primerEjercicio, segundoEjercicio) {
    return segundoEjercicio[1] - primerEjercicio[1];
  });

  const ejerciciosPrincipales = ejerciciosOrdenados.slice(0, 6);

  if (ejerciciosPrincipales.length === 0) {
    obtenerElemento('topExercises').replaceChildren(
      crearEstadoVacio('Aún no hay ejercicios.')
    );
    return;
  }

  const cantidadMayor = ejerciciosPrincipales[0][1];
  const filasEjercicios = document.createDocumentFragment();

  ejerciciosPrincipales.forEach(function (informacionEjercicio) {
    const nombreEjercicio = informacionEjercicio[0];
    const cantidadSeries = informacionEjercicio[1];
    const porcentajeBarra = cantidadSeries / cantidadMayor * 100;
    const filaEjercicio = clonarElementoDePlantilla('topExerciseTemplate');
    const nombre = filaEjercicio.querySelector('[data-field="name"]');

    nombre.textContent = nombreEjercicio;
    nombre.title = nombreEjercicio;
    filaEjercicio.setAttribute(
      'aria-label',
      'Ver detalle de ' + nombreEjercicio + ', ' + cantidadSeries + ' series efectivas'
    );
    filaEjercicio.addEventListener('click', function () {
      if (establecerValorSelector('exerciseSelect', nombreEjercicio)) {
        location.hash = 'ejercicios';
      }
    });
    const rellenoBarra = filaEjercicio.querySelector('.bar-fill');
    rellenoBarra.style.width = animar ? '0%' : porcentajeBarra + '%';
    rellenoBarra.dataset.targetWidth = porcentajeBarra + '%';
    filaEjercicio.querySelector('[data-field="count"]').textContent = String(cantidadSeries);
    filasEjercicios.appendChild(filaEjercicio);
  });

  const contenedorEjercicios = obtenerElemento('topExercises');

  contenedorEjercicios.replaceChildren(filasEjercicios);
  if (animar) {
    contenedorEjercicios.getBoundingClientRect();
    requestAnimationFrame(function () {
      contenedorEjercicios.querySelectorAll('.bar-fill').forEach(function (barra) {
        barra.style.width = barra.dataset.targetWidth;
      });
    });
  }
}

export function pintarResumen(configuracionOriginal) {
  const configuracion = configuracionOriginal || {
    animarEntrada: true,
    animarConteos: true,
    animarGraficas: true,
    animarCambios: true,
    animarDatosNuevos: true
  };
  const sesiones = estadoAplicacion.sesionesFiltradas;
  const seriesEfectivas = estadoAplicacion.seriesFiltradas.filter(esSerieEfectiva);
  const volumenTotal = obtenerVolumenTotal(seriesEfectivas);
  const duracionTotal = obtenerDuracionTotal(sesiones);
  const informacionRacha = calcularRachaSemanal(sesiones);

  let primeraFecha = null;
  let ultimaFecha = null;

  if (sesiones.length > 0) {
    primeraFecha = sesiones[0].inicio;
    ultimaFecha = sesiones[sesiones.length - 1].inicio;
  }

  let cantidadDias = 0;

  if (estadoAplicacion.periodoSeleccionado !== 'all') {
    cantidadDias = Number(estadoAplicacion.periodoSeleccionado);
  } else if (primeraFecha && ultimaFecha) {
    cantidadDias = Math.max(
      1,
      (ultimaFecha - primeraFecha) / MILISEGUNDOS_POR_DIA + 1
    );
  }

  let sesionesPorSemana = 0;

  if (cantidadDias > 0) {
    sesionesPorSemana = sesiones.length / Math.max(1, cantidadDias / 7);
  }

  pintarMetricasResumen(
    sesiones,
    seriesEfectivas,
    volumenTotal,
    duracionTotal,
    sesionesPorSemana,
    informacionRacha,
    configuracion
  );

  pintarRangoDeDatos(primeraFecha, ultimaFecha);
  pintarReferenciaDePeriodo();
  pintarCalidadDeDatos();
  pintarGraficaDeVolumen(sesiones, configuracion.animarGraficas);
  pintarConstancia(configuracion.animarDatosNuevos);
  pintarGraficaCorporal(configuracion.animarGraficas, configuracion.animarCambios);
  pintarEjerciciosPrincipales(configuracion.animarCambios);
  pintarIndicadoresAdicionales(seriesEfectivas);
}
