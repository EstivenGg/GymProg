import {
  CANTIDAD_SEMANAS_CONSTANCIA,
  estadoAplicacion,
  formatoFechaCorta,
  formatoNumero,
  formatoNumeroCompacto,
  MILISEGUNDOS_POR_DIA
} from '../configuracion.js';
import { pintarGraficaLinea } from '../grafica-linea.js';
import {
  calcularMetricasSesion,
  calcularRachaSemanal,
  esSerieEfectiva,
  obtenerDuracionTotal,
  obtenerInicioDeSemana,
  obtenerVolumenTotal
} from '../metricas.js';
import {
  animarConteo,
  clonarElementoDePlantilla,
  crearEstadoVacio,
  obtenerElemento,
  obtenerInicioDelDia,
  sumarDias
} from '../utilidades.js';

function crearTextoDuracion(duracionMinutos) {
  if (duracionMinutos < 60) {
    return duracionMinutos + ' min';
  }

  const horasCompletas = Math.floor(duracionMinutos / 60);
  const minutosRestantes = duracionMinutos % 60;

  return horasCompletas + ' h ' + minutosRestantes + ' min';
}

function crearPuntosDeVolumen(sesiones) {
  return sesiones.map(function (sesion) {
    const metricasSesion = calcularMetricasSesion(sesion);

    return {
      fecha: sesion.inicio,
      valor: metricasSesion.volumenLibras
    };
  });
}

function animarEntradaTarjetasResumen() {
  const rejillaTarjetas = obtenerElemento('statGrid');
  const tarjetas = rejillaTarjetas.querySelectorAll('.stat-card');

  tarjetas.forEach(function (tarjeta) {
    tarjeta.classList.remove('is-entering');
  });

  rejillaTarjetas.getBoundingClientRect();

  tarjetas.forEach(function (tarjeta, indiceTarjeta) {
    tarjeta.style.setProperty('--stagger-delay', indiceTarjeta * 70 + 'ms');
    tarjeta.classList.add('is-entering');
  });
}

function pintarTarjetasResumen(
  sesiones,
  seriesEfectivas,
  volumenTotal,
  duracionTotal,
  sesionesPorSemana,
  informacionRacha
) {
  animarConteo(obtenerElemento('statWorkouts'), sesiones.length);

  if (sesiones.length > 0) {
    obtenerElemento('statFrequency').textContent = formatoNumero.format(sesionesPorSemana)
      + ' sesiones / semana';
  } else {
    obtenerElemento('statFrequency').textContent = 'Sin datos';
  }

  animarConteo(obtenerElemento('statVolume'), volumenTotal, {
    sufijo: ' lb',
    formatear: function (valor) {
      return formatoNumeroCompacto.format(valor);
    }
  });

  obtenerElemento('statVolumeSub').textContent = seriesEfectivas.length
    + ' series efectivas';

  obtenerElemento('statTime').textContent = crearTextoDuracion(duracionTotal);

  if (sesiones.length > 0) {
    const promedioDuracion = Math.round(duracionTotal / sesiones.length);
    obtenerElemento('statTimeSub').textContent = promedioDuracion + ' min por sesión';
  } else {
    obtenerElemento('statTimeSub').textContent = 'Duración registrada';
  }

  animarConteo(obtenerElemento('statStreak'), informacionRacha.mejorRacha, { sufijo: ' sem' });

  if (informacionRacha.mejorRacha === 1) {
    obtenerElemento('statStreakSub').textContent = 'Semana activa';
  } else {
    obtenerElemento('statStreakSub').textContent = 'Semanas consecutivas';
  }

  animarEntradaTarjetasResumen();
}

function pintarRangoDeDatos(primeraFecha, ultimaFecha) {
  if (!primeraFecha || !ultimaFecha) {
    obtenerElemento('dataRange').textContent = 'Esperando datos';
    return;
  }

  obtenerElemento('dataRange').textContent = formatoFechaCorta.format(primeraFecha)
    + ' — '
    + formatoFechaCorta.format(ultimaFecha);
}

function pintarGraficaDeVolumen(sesiones) {
  pintarGraficaLinea(
    obtenerElemento('volumeChart'),
    crearPuntosDeVolumen(sesiones),
    {
      sufijoValor: ' lb',
      mensajeVacio: 'No hay volumen con peso en este periodo.'
    }
  );
}

function crearBarrasDeSemanas(semanas, cantidadesPorSemana) {
  const barrasDeSemanas = document.createDocumentFragment();

  semanas.forEach(function (semana, indiceSemana) {
    const cantidadSesiones = cantidadesPorSemana[indiceSemana];

    let alturaPorcentaje = 9;

    if (cantidadSesiones > 0) {
      alturaPorcentaje = Math.min(100, 25 + cantidadSesiones * 22);
    }

    let palabraSesion = 'sesiones';

    if (cantidadSesiones === 1) {
      palabraSesion = 'sesión';
    }

    const descripcion = formatoFechaCorta.format(semana)
      + ': '
      + cantidadSesiones
      + ' '
      + palabraSesion;

    const barraDeSemana = clonarElementoDePlantilla('weekBarTemplate');
    barraDeSemana.classList.toggle('active', cantidadSesiones > 0);
    barraDeSemana.style.height = '0%';
    barraDeSemana.dataset.targetHeight = alturaPorcentaje + '%';
    barraDeSemana.dataset.label = descripcion;
    barrasDeSemanas.appendChild(barraDeSemana);
  });

  return barrasDeSemanas;
}

function pintarMensajeDeConstancia(cantidadesPorSemana) {
  const ultimasCuatroSemanas = cantidadesPorSemana.slice(-4);
  let entrenamientosRecientes = 0;

  ultimasCuatroSemanas.forEach(function (cantidadSesiones) {
    entrenamientosRecientes += cantidadSesiones;
  });

  if (entrenamientosRecientes === 0) {
    obtenerElemento('consistencyInsight').textContent =
      'Cada entrenamiento suma. Tu próxima sesión enciende una nueva semana.';
    return;
  }

  let palabraEntrenamiento = 'entrenamientos';

  if (entrenamientosRecientes === 1) {
    palabraEntrenamiento = 'entrenamiento';
  }

  obtenerElemento('consistencyInsight').textContent = 'Completaste '
    + entrenamientosRecientes
    + ' '
    + palabraEntrenamiento
    + ' en las últimas 4 semanas registradas.';
}

function pintarConstancia() {
  const semanaMasReciente = obtenerInicioDeSemana(estadoAplicacion.fechaMasReciente);
  const semanas = [];

  for (
    let indiceSemana = 0;
    indiceSemana < CANTIDAD_SEMANAS_CONSTANCIA;
    indiceSemana += 1
  ) {
    const semanasDesdeElFinal = indiceSemana - CANTIDAD_SEMANAS_CONSTANCIA + 1;
    semanas.push(sumarDias(semanaMasReciente, semanasDesdeElFinal * 7));
  }

  const cantidadesPorSemana = semanas.map(function (semana) {
    return estadoAplicacion.sesiones.filter(function (sesion) {
      const inicioSemanaSesion = obtenerInicioDeSemana(sesion.inicio);
      return inicioSemanaSesion.getTime() === semana.getTime();
    }).length;
  });

  const semanasActivas = cantidadesPorSemana.filter(function (cantidadSesiones) {
    return cantidadSesiones > 0;
  }).length;

  const porcentajeActivo = Math.round(
    semanasActivas / CANTIDAD_SEMANAS_CONSTANCIA * 100
  );

  obtenerElemento('consistencyValue').textContent = porcentajeActivo + '%';
  obtenerElemento('consistencyCopy').textContent = 'de semanas activas';
  const contenedorBarras = obtenerElemento('weekBars');

  contenedorBarras.replaceChildren(
    crearBarrasDeSemanas(semanas, cantidadesPorSemana)
  );

  contenedorBarras.getBoundingClientRect();
  requestAnimationFrame(function () {
    contenedorBarras.querySelectorAll('.week-bar').forEach(function (barra) {
      barra.style.height = barra.dataset.targetHeight;
    });
  });

  pintarMensajeDeConstancia(cantidadesPorSemana);
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

function pintarCambioDePeso(puntosPeso) {
  const etiquetaCambio = obtenerElemento('weightDelta');
  const textoAnterior = etiquetaCambio.textContent;
  let textoCambio = 'Sin registros';
  let esCambioNegativo = false;

  if (puntosPeso.length === 1) {
    textoCambio = formatoNumero.format(puntosPeso[0].valor) + ' lb';
  } else if (puntosPeso.length > 1) {
    const primerPeso = puntosPeso[0].valor;
    const ultimoPeso = puntosPeso[puntosPeso.length - 1].valor;
    const diferenciaPeso = ultimoPeso - primerPeso;
    const signoDiferencia = diferenciaPeso > 0 ? '+' : '';

    textoCambio = signoDiferencia + formatoNumero.format(diferenciaPeso) + ' lb';
    esCambioNegativo = diferenciaPeso < 0;
  }

  etiquetaCambio.textContent = textoCambio;
  etiquetaCambio.classList.toggle('negative', esCambioNegativo);

  if (textoAnterior !== textoCambio) {
    etiquetaCambio.classList.remove('is-updated');
    etiquetaCambio.getBoundingClientRect();
    etiquetaCambio.classList.add('is-updated');
  }
}

function pintarGraficaPeso() {
  const medicionesDelPeriodo = obtenerMedicionesDelPeriodo();

  const puntosPeso = medicionesDelPeriodo
    .filter(function (medicion) {
      return medicion.pesoLibras !== null;
    })
    .map(function (medicion) {
      return {
        fecha: medicion.fecha,
        valor: medicion.pesoLibras
      };
    });

  pintarGraficaLinea(
    obtenerElemento('weightChart'),
    puntosPeso,
    {
      iniciarEnCero: false,
      sufijoValor: ' lb',
      mensajeVacio: 'Añade mediciones de peso en Hevy.'
    }
  );

  pintarCambioDePeso(puntosPeso);
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

function pintarEjerciciosPrincipales() {
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
    const rellenoBarra = filaEjercicio.querySelector('.bar-fill');
    rellenoBarra.style.width = '0%';
    rellenoBarra.dataset.targetWidth = porcentajeBarra + '%';
    filaEjercicio.querySelector('[data-field="count"]').textContent = String(cantidadSeries);
    filasEjercicios.appendChild(filaEjercicio);
  });

  const contenedorEjercicios = obtenerElemento('topExercises');

  contenedorEjercicios.replaceChildren(filasEjercicios);
  contenedorEjercicios.getBoundingClientRect();
  requestAnimationFrame(function () {
    contenedorEjercicios.querySelectorAll('.bar-fill').forEach(function (barra) {
      barra.style.width = barra.dataset.targetWidth;
    });
  });
}

export function pintarResumen() {
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

  if (primeraFecha && ultimaFecha) {
    cantidadDias = Math.max(
      1,
      (ultimaFecha - primeraFecha) / MILISEGUNDOS_POR_DIA + 1
    );
  }

  let sesionesPorSemana = 0;

  if (cantidadDias > 0) {
    sesionesPorSemana = sesiones.length / Math.max(1, cantidadDias / 7);
  }

  pintarTarjetasResumen(
    sesiones,
    seriesEfectivas,
    volumenTotal,
    duracionTotal,
    sesionesPorSemana,
    informacionRacha
  );

  pintarRangoDeDatos(primeraFecha, ultimaFecha);
  pintarGraficaDeVolumen(sesiones);
  pintarConstancia();
  pintarGraficaPeso();
  pintarEjerciciosPrincipales();
}
