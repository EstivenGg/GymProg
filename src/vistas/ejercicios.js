import { estadoAplicacion, formatoNumero, MILISEGUNDOS_POR_DIA } from '../configuracion.js';
import { pintarGraficaLinea } from '../grafica-linea.js';
import { calcular1RMEstimado, esSerieEfectiva } from '../metricas.js';
import {
  animarConteo,
  clonarElementoDePlantilla,
  crearClaveDeFecha,
  obtenerClaveDeUltimaSesion,
  obtenerElemento
} from '../utilidades.js';

function obtenerNombresDeEjerciciosConPeso() {
  const nombresEjercicios = new Set();

  estadoAplicacion.todasLasSeries.forEach(function (serie) {
    const tienePesoYRepeticiones = serie.pesoLibras && serie.repeticiones;

    if (esSerieEfectiva(serie) && tienePesoYRepeticiones) {
      nombresEjercicios.add(serie.ejercicio);
    }
  });

  const nombresOrdenados = Array.from(nombresEjercicios);

  nombresOrdenados.sort(function (primerNombre, segundoNombre) {
    return primerNombre.localeCompare(segundoNombre, 'es');
  });

  return nombresOrdenados;
}

function obtenerSeriesDelEjercicio(nombreEjercicio) {
  return estadoAplicacion.seriesFiltradas.filter(function (serie) {
    return serie.ejercicio === nombreEjercicio && esSerieEfectiva(serie);
  });
}

function obtenerValorMayor(valores) {
  if (valores.length === 0) {
    return 0;
  }

  return Math.max.apply(null, valores);
}

function obtenerMejorSerie1RM(series) {
  let mejorSerie = null;
  let mejorValor = 0;

  series.forEach(function (serie) {
    const valor = calcular1RMEstimado(serie);

    if (valor > mejorValor) {
      mejorValor = valor;
      mejorSerie = serie;
    }
  });

  return mejorSerie;
}

function agruparMejor1RMPorDia(series) {
  const mejoresPuntosPorDia = new Map();

  series.forEach(function (serie) {
    const claveDia = crearClaveDeFecha(serie.inicio);
    const puntoNuevo = {
      fecha: serie.inicio,
      valor: calcular1RMEstimado(serie)
    };

    const puntoActual = mejoresPuntosPorDia.get(claveDia);

    if (!puntoActual || puntoNuevo.valor > puntoActual.valor) {
      mejoresPuntosPorDia.set(claveDia, puntoNuevo);
    }
  });

  const puntosOrdenados = Array.from(mejoresPuntosPorDia.values());

  puntosOrdenados.sort(function (primerPunto, segundoPunto) {
    return primerPunto.fecha - segundoPunto.fecha;
  });

  return puntosOrdenados;
}

function calcularTendencia1RM(puntos) {
  if (puntos.length < 2) {
    return null;
  }

  const ultimoPunto = puntos[puntos.length - 1];
  const fechaObjetivo = new Date(ultimoPunto.fecha.getTime() - 30 * MILISEGUNDOS_POR_DIA);

  let puntoDeReferencia = null;

  puntos.forEach(function (punto) {
    if (punto.fecha <= fechaObjetivo) {
      puntoDeReferencia = punto;
    }
  });

  if (!puntoDeReferencia || puntoDeReferencia === ultimoPunto) {
    return null;
  }

  return ultimoPunto.valor - puntoDeReferencia.valor;
}

function pintarTendencia(puntos) {
  const chip = obtenerElemento('exerciseTrend');
  const diferencia = calcularTendencia1RM(puntos);

  if (diferencia === null) {
    chip.textContent = 'Sin comparación';
    chip.classList.remove('negative');
    return;
  }

  const signoDiferencia = diferencia > 0 ? '+' : '';

  chip.textContent = signoDiferencia + formatoNumero.format(diferencia) + ' lb vs. hace 1 mes';
  chip.classList.toggle('negative', diferencia < 0);
}

function animarNumeroOGuion(elemento, valor, animar) {
  if (valor > 0) {
    animarConteo(elemento, valor, {
      animar: animar,
      sufijo: ' lb',
      formatear: function (valorParcial) {
        return formatoNumero.format(valorParcial);
      }
    });
    return;
  }

  elemento.textContent = '—';
  elemento.dataset.valorAnimado = '0';
}

function animarEntradaTarjetasEjercicio(animar) {
  const rejillaTarjetas = obtenerElemento('miniStatGrid');
  const tarjetas = rejillaTarjetas.querySelectorAll('article');

  tarjetas.forEach(function (tarjeta) {
    tarjeta.classList.remove('is-entering');
  });

  if (!animar) {
    return;
  }

  rejillaTarjetas.getBoundingClientRect();

  tarjetas.forEach(function (tarjeta, indiceTarjeta) {
    tarjeta.style.setProperty('--stagger-delay', indiceTarjeta * 40 + 'ms');
    tarjeta.classList.add('is-entering');
  });
}

function pintarTarjetas(
  mejorPeso,
  mejorSerie1RM,
  repeticionesTotales,
  cantidadSeries,
  esRecordReciente,
  configuracion
) {
  animarNumeroOGuion(
    obtenerElemento('exerciseBestWeight'),
    mejorPeso,
    configuracion.animarConteos
  );

  const mejor1RM = mejorSerie1RM ? calcular1RMEstimado(mejorSerie1RM) : 0;
  const elemento1RM = obtenerElemento('exerciseBest1rm');
  const tarjeta1RM = elemento1RM.closest('article');

  animarNumeroOGuion(elemento1RM, mejor1RM, configuracion.animarConteos);
  tarjeta1RM.classList.toggle('is-recent-pr', esRecordReciente);
  tarjeta1RM.querySelector('.record-badge').hidden = !esRecordReciente;

  animarConteo(obtenerElemento('exerciseReps'), repeticionesTotales, {
    animar: configuracion.animarConteos
  });
  animarConteo(obtenerElemento('exerciseSets'), cantidadSeries, {
    animar: configuracion.animarConteos
  });

  animarEntradaTarjetasEjercicio(configuracion.animarEntrada);
}

function pintarGraficaEjercicio(puntos, opciones, configuracion) {
  const contenedor = obtenerElemento('exerciseChart');
  const opcionesGrafica = Object.assign({}, opciones, {
    animar: configuracion.animarGraficas
  });

  if (contenedor.childElementCount === 0 || configuracion.modo !== 'interaccion') {
    contenedor.classList.remove('is-swapping');
    pintarGraficaLinea(contenedor, puntos, opcionesGrafica);
    return;
  }

  contenedor.classList.add('is-swapping');

  window.setTimeout(function () {
    pintarGraficaLinea(contenedor, puntos, opcionesGrafica);

    requestAnimationFrame(function () {
      contenedor.classList.remove('is-swapping');
    });
  }, 160);
}

export function pintarSelectorEjercicios(configuracion) {
  const selectorEjercicios = obtenerElemento('exerciseSelect');
  const ejercicioSeleccionado = selectorEjercicios.value;
  const nombresEjercicios = obtenerNombresDeEjerciciosConPeso();
  const opciones = document.createDocumentFragment();

  if (nombresEjercicios.length === 0) {
    const opcionVacia = clonarElementoDePlantilla('exerciseOptionTemplate');
    opcionVacia.value = '';
    opcionVacia.textContent = 'Sin ejercicios con peso';
    selectorEjercicios.replaceChildren(opcionVacia);
    pintarDetalleEjercicio(configuracion);
    return;
  }

  nombresEjercicios.forEach(function (nombreEjercicio) {
    const opcionEjercicio = clonarElementoDePlantilla('exerciseOptionTemplate');
    opcionEjercicio.value = nombreEjercicio;
    opcionEjercicio.textContent = nombreEjercicio;
    opciones.appendChild(opcionEjercicio);
  });

  selectorEjercicios.replaceChildren(opciones);

  if (nombresEjercicios.includes(ejercicioSeleccionado)) {
    selectorEjercicios.value = ejercicioSeleccionado;
  }

  pintarDetalleEjercicio(configuracion);
}

export function pintarDetalleEjercicio(configuracionOriginal) {
  const configuracion = configuracionOriginal || {
    animarConteos: true,
    animarEntrada: false,
    animarGraficas: true,
    modo: 'interaccion'
  };
  const nombreEjercicio = obtenerElemento('exerciseSelect').value;
  const seriesEjercicio = obtenerSeriesDelEjercicio(nombreEjercicio);

  const seriesConPeso = seriesEjercicio.filter(function (serie) {
    return Boolean(serie.pesoLibras) && Boolean(serie.repeticiones);
  });

  const pesos = seriesConPeso.map(function (serie) {
    return serie.pesoLibras;
  });

  const mejorPeso = obtenerValorMayor(pesos);
  const mejorSerie1RM = obtenerMejorSerie1RM(seriesConPeso);
  const claveUltimaSesion = obtenerClaveDeUltimaSesion(seriesEjercicio);
  const esRecordReciente = Boolean(mejorSerie1RM)
    && claveUltimaSesion !== null
    && crearClaveDeFecha(mejorSerie1RM.inicio) === claveUltimaSesion;

  let repeticionesTotales = 0;

  seriesEjercicio.forEach(function (serie) {
    repeticionesTotales += serie.repeticiones || 0;
  });

  pintarTarjetas(
    mejorPeso,
    mejorSerie1RM,
    repeticionesTotales,
    seriesEjercicio.length,
    esRecordReciente,
    configuracion
  );

  obtenerElemento('exerciseChartTitle').textContent = nombreEjercicio
    || 'Evolución de fuerza';

  const puntos1RM = agruparMejor1RMPorDia(seriesConPeso);
  const mensajeVacio = nombreEjercicio
    ? 'No hay datos para este ejercicio en el periodo.'
    : 'Registra series con peso y repeticiones para ver tu progreso por ejercicio.';

  pintarGraficaEjercicio(puntos1RM, {
    iniciarEnCero: false,
    sufijoValor: ' lb',
    mensajeVacio: mensajeVacio
  }, configuracion);

  pintarTendencia(puntos1RM);
}
