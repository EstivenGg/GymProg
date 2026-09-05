import {
  convertirLibrasAUnidad,
  estadoAplicacion,
  formatearCarga,
  formatoFechaCorta,
  formatoNumero,
  MILISEGUNDOS_POR_DIA,
  obtenerUnidadPeso
} from '../configuracion.js';
import { crearClaveSesion } from '../datos.js';
import { crearResumenEsfuerzo, mereceMostrarse } from '../esfuerzo.js';
import { calcularRitmoDeSeries, formatearRitmo } from '../ritmo.js';
import { crearUltimasSesionesDelEjercicio } from '../detalle-sesiones-ejercicio.js';
import { pintarGraficaLinea } from '../grafica-linea.js';
import { calcular1RMEstimado, esSerieEfectiva } from '../metricas.js';
import {
  convertirValorDeMetrica,
  crearSerieTemporal,
  formatearValorDeMetrica,
  obtenerMetricaPorClave,
  obtenerMetricasDisponibles,
  obtenerSufijoDeMetrica
} from '../metricas-ejercicio.js';
import {
  cambiarSeccion,
  desplazarHastaElemento,
  resaltarElemento
} from '../navegacion.js';
import { establecerValorSelector } from '../selector-personalizado.js';
import { abrirSesion } from './sesiones.js';
import {
  animarConteo,
  clonarElementoDePlantilla,
  crearClaveDeFecha,
  crearElemento,
  obtenerClaveDeUltimaSesion,
  obtenerElemento
} from '../utilidades.js';

let metricaSeleccionada = '1rm';

function obtenerNombresDeEjercicios() {
  const nombresEjercicios = new Set();

  estadoAplicacion.todasLasSeries.forEach(function (serie) {
    if (esSerieEfectiva(serie)) {
      nombresEjercicios.add(serie.ejercicio);
    }
  });

  const nombresOrdenados = Array.from(nombresEjercicios);

  nombresOrdenados.sort(function (primerNombre, segundoNombre) {
    return primerNombre.localeCompare(segundoNombre, 'es');
  });

  return nombresOrdenados;
}

// Abrir en el primero por orden alfabetico deja la pagina en el ejercicio que
// menos dice; abrimos en el que mas has entrenado.
function obtenerEjercicioMasEntrenado(nombresEjercicios) {
  const cantidadesPorEjercicio = new Map();

  estadoAplicacion.seriesFiltradas.forEach(function (serie) {
    if (!esSerieEfectiva(serie)) {
      return;
    }

    const cantidadActual = cantidadesPorEjercicio.get(serie.ejercicio) || 0;

    cantidadesPorEjercicio.set(serie.ejercicio, cantidadActual + 1);
  });

  let ejercicioElegido = nombresEjercicios[0];
  let mayorCantidad = -1;

  nombresEjercicios.forEach(function (nombreEjercicio) {
    const cantidad = cantidadesPorEjercicio.get(nombreEjercicio) || 0;

    if (cantidad > mayorCantidad) {
      mayorCantidad = cantidad;
      ejercicioElegido = nombreEjercicio;
    }
  });

  return ejercicioElegido;
}

function obtenerSeriesDelEjercicio(nombreEjercicio) {
  return estadoAplicacion.seriesFiltradas.filter(function (serie) {
    return serie.ejercicio === nombreEjercicio && esSerieEfectiva(serie);
  });
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

function calcularTendencia(puntos) {
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

function pintarTendencia(puntos, metrica) {
  const chip = obtenerElemento('exerciseTrend');
  const diferencia = calcularTendencia(puntos);

  chip.classList.remove('negative', 'neutral');

  if (diferencia === null) {
    chip.textContent = 'Sin comparación';
    chip.classList.add('neutral');
    return;
  }

  const diferenciaRedondeada = Number(formatoNumero.format(diferencia).replace(',', '.'));

  // Un cambio de cero no es una mejora: no debe pintarse como tal
  if (diferenciaRedondeada === 0) {
    chip.textContent = 'Sin cambio vs. hace 1 mes';
    chip.classList.add('neutral');
    return;
  }

  const signoDiferencia = diferencia > 0 ? '+' : '−';

  chip.textContent = signoDiferencia
    + formatearValorDeMetrica(Math.abs(diferencia), metrica)
    + ' vs. hace 1 mes';
  chip.classList.toggle('negative', esRetroceso(diferencia, metrica));
}

// En casi todo, subir es mejorar. En ritmo es al revés, y pintarlo igual que el
// resto convertiría una carrera más rápida en una mala noticia.
function esRetroceso(diferencia, metrica) {
  return metrica.menorEsMejor ? diferencia > 0 : diferencia < 0;
}

function crearTextoDeMejorSerie(mejorSerie) {
  if (mejorSerie.pesoLibras && mejorSerie.repeticiones) {
    return formatearCarga(mejorSerie.pesoLibras) + ' × ' + mejorSerie.repeticiones;
  }

  if (mejorSerie.repeticiones) {
    return mejorSerie.repeticiones + ' reps';
  }

  if (mejorSerie.distanciaKm) {
    return formatoNumero.format(mejorSerie.distanciaKm) + ' km';
  }

  if (mejorSerie.duracionSegundos) {
    return Math.round(mejorSerie.duracionSegundos / 60) + ' min';
  }

  return 'Serie registrada';
}

function crearContextoDeSesion(fila, metrica) {
  const valorDelDia = convertirValorDeMetrica(fila.valorBruto, metrica);
  const palabraSerie = fila.cantidadSeries === 1 ? 'serie' : 'series';

  return metrica.etiqueta
    + ' '
    + formatearValorDeMetrica(valorDelDia, metrica)
    + ' · '
    + fila.cantidadSeries
    + ' '
    + palabraSerie
    + ' · '
    + fila.tituloSesion;
}

// El porcentaje compara el valor de la métrica que está pintando la línea, así
// que el número de la fila y el salto del gráfico son la misma cosa.
function pintarCambioDeSesion(elementoFila, fila, metrica) {
  const insignia = elementoFila.querySelector('[data-field="change"]');
  const valorCambio = elementoFila.querySelector('[data-field="change-value"]');

  insignia.classList.remove('increase', 'decrease', 'neutral');

  if (fila.porcentaje === null) {
    insignia.classList.add('neutral');
    valorCambio.textContent = '—';
    insignia.title = 'Primera sesión registrada en el periodo';
    return;
  }

  const porcentajeRedondeado = Number(
    formatoNumero.format(fila.porcentaje).replace(',', '.')
  );

  if (porcentajeRedondeado === 0) {
    insignia.classList.add('neutral');
    valorCambio.textContent = '=';
  } else {
    insignia.classList.add(
      esRetroceso(fila.porcentaje, metrica) ? 'decrease' : 'increase'
    );
    valorCambio.textContent = (fila.porcentaje > 0 ? '+' : '−')
      + formatoNumero.format(Math.abs(fila.porcentaje))
      + ' %';
  }

  insignia.title = metrica.nombre
    + ': '
    + formatearValorDeMetrica(convertirValorDeMetrica(fila.valorBruto, metrica), metrica)
    + ' · sesión anterior: '
    + formatearValorDeMetrica(convertirValorDeMetrica(fila.valorAnterior, metrica), metrica);
}

function crearFilaDeSesionReciente(fila, metrica) {
  const elementoFila = clonarElementoDePlantilla('recentSessionTemplate');
  const esfuerzo = elementoFila.querySelector('[data-field="effort"]');

  elementoFila.dataset.sessionKey = fila.claveSesion;
  elementoFila.querySelector('[data-field="date"]').textContent =
    formatoFechaCorta.format(fila.fecha);
  elementoFila.querySelector('[data-field="set"]').textContent =
    crearTextoDeMejorSerie(fila.mejorSerie);
  elementoFila.querySelector('[data-field="context"]').textContent =
    crearContextoDeSesion(fila, metrica);

  if (!fila.esfuerzo) {
    esfuerzo.textContent = 'Sin RPE';
    esfuerzo.classList.add('is-missing');
  } else {
    esfuerzo.textContent = 'RPE ' + formatoNumero.format(fila.esfuerzo.promedio);
    esfuerzo.title = 'RPE medio de '
      + fila.esfuerzo.seriesConEsfuerzo
      + ' de '
      + fila.esfuerzo.seriesTotales
      + ' series · máximo '
      + formatoNumero.format(fila.esfuerzo.maximo);

    if (fila.esfuerzo.seriesConEsfuerzo < fila.esfuerzo.seriesTotales) {
      esfuerzo.textContent += ' · '
        + fila.esfuerzo.seriesConEsfuerzo
        + '/'
        + fila.esfuerzo.seriesTotales;
    }
  }

  pintarCambioDeSesion(elementoFila, fila, metrica);

  return elementoFila;
}

function pintarUltimasSesiones(seriesEjercicio, metrica) {
  const panel = obtenerElemento('exerciseRecentPanel');
  const lista = obtenerElemento('exerciseRecentList');
  const nota = obtenerElemento('exerciseRecentNote');

  if (!metrica) {
    panel.hidden = true;
    lista.replaceChildren();
    return;
  }

  const filas = crearUltimasSesionesDelEjercicio(seriesEjercicio, metrica);

  panel.hidden = false;

  if (filas.length === 0) {
    nota.textContent = '';
    lista.replaceChildren(
      crearElemento('p', 'recent-sessions-empty', 'No hay sesiones de este ejercicio en el periodo.')
    );
    return;
  }

  nota.textContent = 'Comparadas con la sesión anterior · ' + metrica.nombre;

  const elementos = document.createDocumentFragment();

  filas.forEach(function (fila) {
    elementos.appendChild(crearFilaDeSesionReciente(fila, metrica));
  });

  lista.replaceChildren(elementos);
}

function crearTarjetasDelEjercicio(series) {
  const seriesConPeso = series.filter(function (serie) {
    return Boolean(serie.pesoLibras) && Boolean(serie.repeticiones);
  });
  const seriesConRepeticiones = series.filter(function (serie) {
    return Boolean(serie.repeticiones);
  });
  const distanciaTotal = series.reduce(function (total, serie) {
    return total + (serie.distanciaKm || 0);
  }, 0);
  const duracionTotalMinutos = series.reduce(function (total, serie) {
    return total + (serie.duracionSegundos || 0);
  }, 0) / 60;
  const mejorSerie1RM = obtenerMejorSerie1RM(seriesConPeso);
  const diasEntrenados = new Set(series.map(function (serie) {
    return crearClaveDeFecha(serie.inicio);
  })).size;

  let tarjetasPrincipales = [];

  if (seriesConPeso.length > 0) {
    const mejorPeso = seriesConPeso.reduce(function (mayor, serie) {
      return Math.max(mayor, serie.pesoLibras);
    }, 0);

    tarjetasPrincipales = [
      {
        etiqueta: 'MEJOR PESO',
        valor: mejorPeso,
        enUnidadDePeso: true
      },
      {
        etiqueta: 'MEJOR 1RM EST.',
        valor: mejorSerie1RM ? calcular1RMEstimado(mejorSerie1RM) : 0,
        enUnidadDePeso: true,
        serieDelRecord: mejorSerie1RM
      }
    ];
  } else if (seriesConRepeticiones.length > 0) {
    const mejorSerieDeReps = seriesConRepeticiones.reduce(function (mayor, serie) {
      return Math.max(mayor, serie.repeticiones);
    }, 0);

    tarjetasPrincipales = [{
      etiqueta: 'MEJOR SERIE',
      valor: mejorSerieDeReps,
      sufijo: ' reps'
    }];
  }

  const esfuerzo = crearResumenEsfuerzo(series);
  const ritmo = calcularRitmoDeSeries(series);

  const tarjetasOpcionales = [
    mereceMostrarse(esfuerzo) ? {
      etiqueta: 'RPE MEDIO',
      valor: esfuerzo.promedio,
      conDecimales: true,
      nota: 'en ' + esfuerzo.seriesConEsfuerzo + ' de ' + esfuerzo.seriesTotales + ' series'
    } : null,
    ritmo ? {
      etiqueta: 'RITMO MEDIO',
      valor: ritmo,
      formatear: formatearRitmo,
      sufijo: ' /km'
    } : null,
    distanciaTotal > 0 ? {
      etiqueta: 'DISTANCIA TOTAL',
      valor: distanciaTotal,
      sufijo: ' km',
      conDecimales: true
    } : null,
    duracionTotalMinutos > 0 ? {
      etiqueta: 'TIEMPO TOTAL',
      valor: Math.round(duracionTotalMinutos),
      sufijo: ' min'
    } : null,
    seriesConRepeticiones.length > 0 ? {
      etiqueta: 'REPETICIONES',
      valor: seriesConRepeticiones.reduce(function (total, serie) {
        return total + serie.repeticiones;
      }, 0)
    } : null,
    { etiqueta: 'SERIES EFECTIVAS', valor: series.length },
    { etiqueta: 'SESIONES', valor: diasEntrenados }
  ].filter(Boolean);

  return tarjetasPrincipales.concat(tarjetasOpcionales).slice(0, 4);
}

function crearFormateadorDeTarjeta(tarjeta) {
  if (tarjeta.formatear) {
    return tarjeta.formatear;
  }

  if (tarjeta.conDecimales) {
    return function (valorParcial) {
      return formatoNumero.format(valorParcial);
    };
  }

  return undefined;
}

function pintarTarjetas(series, configuracion) {
  const tarjetas = crearTarjetasDelEjercicio(series);
  const claveUltimaSesion = obtenerClaveDeUltimaSesion(series);
  const rejillaTarjetas = obtenerElemento('miniStatGrid');
  const elementos = document.createDocumentFragment();

  tarjetas.forEach(function (tarjeta) {
    const elemento = clonarElementoDePlantilla('miniStatTemplate');
    const valorElemento = elemento.querySelector('[data-field="value"]');
    const esRecordReciente = Boolean(tarjeta.serieDelRecord)
      && claveUltimaSesion !== null
      && crearClaveDeFecha(tarjeta.serieDelRecord.inicio) === claveUltimaSesion;

    const nota = elemento.querySelector('[data-field="note"]');

    elemento.querySelector('[data-field="label"]').textContent = tarjeta.etiqueta;
    elemento.classList.toggle('is-recent-pr', esRecordReciente);
    elemento.querySelector('.record-badge').hidden = !esRecordReciente;
    nota.hidden = !tarjeta.nota;
    nota.textContent = tarjeta.nota || '';

    if (tarjeta.valor <= 0) {
      valorElemento.textContent = '—';
      valorElemento.dataset.valorAnimado = '0';
    } else if (tarjeta.enUnidadDePeso) {
      animarConteo(valorElemento, tarjeta.valor, {
        animar: configuracion.animarConteos,
        sufijo: ' ' + obtenerUnidadPeso(),
        formatear: function (valorParcial) {
          return formatoNumero.format(convertirLibrasAUnidad(valorParcial));
        }
      });
    } else {
      animarConteo(valorElemento, tarjeta.valor, {
        animar: configuracion.animarConteos,
        sufijo: tarjeta.sufijo || '',
        formatear: crearFormateadorDeTarjeta(tarjeta)
      });
    }

    elementos.appendChild(elemento);
  });

  rejillaTarjetas.replaceChildren(elementos);

  if (!configuracion.animarEntrada) {
    return;
  }

  rejillaTarjetas.getBoundingClientRect();

  rejillaTarjetas.querySelectorAll('article').forEach(function (tarjeta, indiceTarjeta) {
    tarjeta.style.setProperty(
      '--stagger-delay',
      Math.min(indiceTarjeta, 6) * 34 + 'ms'
    );
    tarjeta.classList.add('is-entering');
  });
}

function pintarSelectorDeMetrica(metricasDisponibles) {
  const contenedor = obtenerElemento('exerciseMetricToggle');
  const botones = document.createDocumentFragment();

  contenedor.hidden = metricasDisponibles.length < 2;

  metricasDisponibles.forEach(function (metrica) {
    const boton = clonarElementoDePlantilla('metricButtonTemplate');
    const estaActiva = metrica.clave === metricaSeleccionada;

    boton.textContent = metrica.etiqueta;
    boton.dataset.exerciseMetric = metrica.clave;
    boton.classList.toggle('active', estaActiva);
    boton.setAttribute('aria-pressed', String(estaActiva));
    boton.title = metrica.nombre;
    botones.appendChild(boton);
  });

  contenedor.replaceChildren(contenedor.querySelector('legend'), botones);
}

export function seleccionarMetricaEjercicio(clave) {
  if (!obtenerMetricaPorClave(clave)) {
    return;
  }

  metricaSeleccionada = clave;
  pintarDetalleEjercicio();
}

export function pintarSelectorEjercicios(configuracion) {
  const selectorEjercicios = obtenerElemento('exerciseSelect');
  const ejercicioSeleccionado = selectorEjercicios.value;
  const nombresEjercicios = obtenerNombresDeEjercicios();
  const opciones = document.createDocumentFragment();

  if (nombresEjercicios.length === 0) {
    const opcionVacia = clonarElementoDePlantilla('exerciseOptionTemplate');
    opcionVacia.value = '';
    opcionVacia.textContent = 'Sin ejercicios';
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

  selectorEjercicios.value = nombresEjercicios.includes(ejercicioSeleccionado)
    ? ejercicioSeleccionado
    : obtenerEjercicioMasEntrenado(nombresEjercicios);

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
  const metricasDisponibles = obtenerMetricasDisponibles(seriesEjercicio);

  // Cada ejercicio ofrece lo suyo: si la metrica activa no aplica, cae en la
  // primera que si (1RM para una barra, reps para dominadas, km para la cinta).
  const metricaAplicable = metricasDisponibles.some(function (metrica) {
    return metrica.clave === metricaSeleccionada;
  });

  if (!metricaAplicable && metricasDisponibles.length > 0) {
    metricaSeleccionada = metricasDisponibles[0].clave;
  }

  const metrica = obtenerMetricaPorClave(metricaSeleccionada);

  pintarTarjetas(seriesEjercicio, configuracion);
  pintarSelectorDeMetrica(metricasDisponibles);

  obtenerElemento('exerciseChartTitle').textContent = nombreEjercicio
    || 'Evolución de fuerza';

  const puntos = metricasDisponibles.length > 0
    ? crearSerieTemporal(seriesEjercicio, metrica).map(marcarPuntoSeleccionable)
    : [];
  const mensajeVacio = nombreEjercicio
    ? 'No hay datos para este ejercicio en el periodo.'
    : 'Registra series con peso y repeticiones para ver tu progreso por ejercicio.';

  pintarGraficaLinea(obtenerElemento('exerciseChart'), puntos, {
    alSeleccionarPunto: function (punto) {
      abrirSesion(punto.claveSesion);
    },
    animar: configuracion.animarGraficas,
    formatearValor: metrica ? metrica.formatearValor : null,
    iniciarEnCero: metrica ? metrica.iniciarEnCero : false,
    sufijoValor: metrica ? obtenerSufijoDeMetrica(metrica) : '',
    tituloAccesible: nombreEjercicio && metrica
      ? metrica.nombre + ' de ' + nombreEjercicio
      : 'Evolución de fuerza',
    mensajeVacio: mensajeVacio
  });

  pintarTendencia(puntos, metrica);
  pintarUltimasSesiones(seriesEjercicio, metrica);
}

// Un punto de la línea es un día del ejercicio, y ese día pertenece a un
// entrenamiento concreto: pulsarlo abre justo ese.
function marcarPuntoSeleccionable(punto) {
  const primeraSerie = punto.series[0];

  return Object.assign({}, punto, {
    seleccionable: true,
    claveSesion: crearClaveSesion(primeraSerie.inicio, primeraSerie.tituloSesion)
  });
}

function manejarClicEnUltimasSesiones(evento) {
  const fila = evento.target.closest('.recent-session');

  if (fila) {
    abrirSesion(fila.dataset.sessionKey);
  }
}

export function conectarEventosDeEjercicios() {
  obtenerElemento('exerciseRecentList')
    .addEventListener('click', manejarClicEnUltimasSesiones);
}

// Punto de entrada desde la tabla de récords: selecciona el ejercicio, lo pinta
// y lleva la vista hasta él.
export function abrirEjercicio(nombreEjercicio) {
  const selectorEjercicios = obtenerElemento('exerciseSelect');
  const existeElEjercicio = Array.from(selectorEjercicios.options).some(function (opcion) {
    return opcion.value === nombreEjercicio;
  });

  if (!existeElEjercicio) {
    return Promise.resolve(false);
  }

  selectorEjercicios.value = nombreEjercicio;
  establecerValorSelector('exerciseSelect', nombreEjercicio);
  pintarDetalleEjercicio();

  return cambiarSeccion('ejercicios', { conservarDesplazamiento: true })
    .then(function () {
      const encabezado = obtenerElemento('exerciseChartTitle');
      const panel = encabezado.closest('.panel');

      desplazarHastaElemento(panel, { bloque: 'start' });
      resaltarElemento(panel);

      return true;
    });
}
