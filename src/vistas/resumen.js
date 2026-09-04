import {
  estadoAplicacion,
  formatoFechaCorta,
  formatoNumero,
  formatoNumeroCompacto,
  MILISEGUNDOS_POR_DIA
} from '../configuracion.js';
import {
  crearComparativasResumen,
  crearSeriesResumen
} from '../comparativas.js';
import { crearResumenConstancia } from '../constancia.js';
import { pintarGraficaLinea } from '../grafica-linea.js';
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

function crearTextoDiferenciaCantidad(cantidad, unidadSingular, unidadPlural, aumenta) {
  const unidad = cantidad === 1 ? unidadSingular : unidadPlural;
  const direccion = aumenta ? 'más' : 'menos';

  return cantidad + ' ' + unidad + ' ' + direccion;
}

function crearTextoDiferenciaVolumen(diferencia, aumenta) {
  return formatoNumeroCompacto.format(diferencia)
    + ' lb '
    + (aumenta ? 'más' : 'menos');
}

function crearTextoDiferenciaDuracion(diferencia, aumenta) {
  return crearTextoDuracion(Math.round(diferencia))
    + ' '
    + (aumenta ? 'más' : 'menos');
}

function pintarComparacion(
  idElemento,
  valorActual,
  valorAnterior,
  hayHistorialAnterior,
  descripcionPeriodo,
  crearTextoDiferencia
) {
  const elemento = obtenerElemento(idElemento);
  const insignia = elemento.querySelector('[data-field="trend"]');
  const detalle = elemento.querySelector('[data-field="comparison"]');

  elemento.classList.remove('positive', 'negative', 'neutral');

  if (!hayHistorialAnterior) {
    elemento.classList.add('neutral');
    insignia.textContent = '—';
    detalle.textContent = 'Sin historial anterior';
    elemento.removeAttribute('title');
    return;
  }

  const diferencia = valorActual - valorAnterior;

  if (diferencia === 0) {
    elemento.classList.add('neutral');
    insignia.textContent = '0%';
    detalle.textContent = 'Sin cambio · ' + descripcionPeriodo;
  } else if (valorAnterior === 0) {
    elemento.classList.add('positive');
    insignia.textContent = 'NUEVO';
    detalle.textContent = crearTextoDiferencia(
      Math.abs(diferencia),
      diferencia > 0
    ) + ' · ' + descripcionPeriodo;
  } else {
    const porcentaje = Math.round(Math.abs(diferencia / valorAnterior) * 100);
    const aumenta = diferencia > 0;

    elemento.classList.add(aumenta ? 'positive' : 'negative');
    insignia.textContent = (aumenta ? '+' : '-') + porcentaje + '%';
    detalle.textContent = crearTextoDiferencia(
      Math.abs(diferencia),
      aumenta
    ) + ' · ' + descripcionPeriodo;
  }

  elemento.title = insignia.textContent + ' · ' + detalle.textContent;
}

function crearGeometriaSparkline(valoresOriginales) {
  let valores = valoresOriginales.filter(Number.isFinite);

  if (valores.length === 0) {
    valores = [0, 0];
  } else if (valores.length === 1) {
    valores = [valores[0], valores[0]];
  }

  const minimo = Math.min.apply(null, valores);
  const maximo = Math.max.apply(null, valores);
  const rango = maximo - minimo;
  const puntos = valores.map(function (valor, indice) {
    const x = 3 + indice * 66 / (valores.length - 1);
    const proporcion = rango === 0 ? 0.5 : (valor - minimo) / rango;
    const y = 30 - proporcion * 24;

    return { x: x, y: y };
  });
  const comandosLinea = puntos.map(function (punto, indice) {
    return (indice === 0 ? 'M ' : 'L ') + punto.x + ' ' + punto.y;
  }).join(' ');
  const ultimoPunto = puntos[puntos.length - 1];

  return {
    linea: comandosLinea,
    area: comandosLinea + ' L ' + ultimoPunto.x + ' 33 L ' + puntos[0].x + ' 33 Z',
    ultimoPunto: ultimoPunto
  };
}

function pintarSparkline(idElemento, valores, animar) {
  const sparkline = obtenerElemento(idElemento);
  const geometria = crearGeometriaSparkline(valores);

  const linea = sparkline.querySelector('.sparkline-line');
  linea.setAttribute('d', geometria.linea);
  linea.setAttribute('pathLength', '1');
  sparkline.querySelector('.sparkline-area').setAttribute('d', geometria.area);

  const punto = sparkline.querySelector('.sparkline-point');
  punto.setAttribute('cx', geometria.ultimoPunto.x);
  punto.setAttribute('cy', geometria.ultimoPunto.y);

  sparkline.classList.remove('is-updated');

  if (animar) {
    sparkline.getBoundingClientRect();
    sparkline.classList.add('is-updated');
  }
}

function pintarComparativasYSeries(sesiones, animar) {
  const comparativas = crearComparativasResumen(
    estadoAplicacion.sesiones,
    estadoAplicacion.fechaMasReciente,
    estadoAplicacion.periodoSeleccionado
  );
  const series = crearSeriesResumen(
    sesiones,
    estadoAplicacion.fechaMasReciente
  );

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
  pintarComparacion(
    'statStreakComparison',
    comparativas.actual.racha,
    comparativas.anterior.racha,
    comparativas.hayHistorialAnterior,
    comparativas.descripcion,
    function (diferencia, aumenta) {
      return crearTextoDiferenciaCantidad(
        diferencia,
        'semana',
        'semanas',
        aumenta
      );
    }
  );

  pintarSparkline('statWorkoutsSparkline', series.entrenamientos, animar);
  pintarSparkline('statVolumeSparkline', series.volumen, animar);
  pintarSparkline('statTimeSparkline', series.duracion, animar);
  pintarSparkline('statStreakSparkline', series.racha, animar);
}

function crearPuntosDeVolumen(sesiones) {
  return sesiones.map(function (sesion) {
    const metricasSesion = calcularMetricasSesion(sesion);

    return {
      fecha: sesion.inicio,
      valor: metricasSesion.volumenLibras
    };
  }).filter(function (punto) {
    return punto.valor > 0;
  });
}

function animarEntradaTarjetasResumen(animar) {
  const rejillaTarjetas = obtenerElemento('statGrid');
  const tarjetas = rejillaTarjetas.querySelectorAll('.stat-card');

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

function pintarTarjetasResumen(
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

  animarConteo(obtenerElemento('statStreak'), informacionRacha.mejorRacha, {
    animar: configuracion.animarConteos,
    sufijo: ' sem'
  });

  if (informacionRacha.mejorRacha === 1) {
    obtenerElemento('statStreakSub').textContent = 'Semana activa';
  } else {
    obtenerElemento('statStreakSub').textContent = 'Semanas consecutivas';
  }

  pintarComparativasYSeries(sesiones, configuracion.animarCambios);

  animarEntradaTarjetasResumen(configuracion.animarEntrada);
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

function pintarGraficaDeVolumen(sesiones, animar) {
  const sesionesSinVolumen = sesiones.filter(function (sesion) {
    return calcularMetricasSesion(sesion).volumenLibras <= 0;
  }).length;
  const nota = obtenerElemento('volumeChartNote');

  nota.hidden = sesionesSinVolumen === 0;
  nota.textContent = sesionesSinVolumen === 1
    ? '1 sesión sin carga no graficada'
    : sesionesSinVolumen + ' sesiones sin carga no graficadas';

  pintarGraficaLinea(
    obtenerElemento('volumeChart'),
    crearPuntosDeVolumen(sesiones),
    {
      animar: animar,
      tipo: 'bar',
      sufijoValor: ' lb',
      mensajeVacio: 'No hay sesiones con volumen de peso en este periodo.'
    }
  );
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
    barraDeSemana.setAttribute('aria-label', descripcion);
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

  obtenerElemento('weeklyGoalValue').textContent = cantidad
    + ' de '
    + meta
    + ' sesiones';
  obtenerElemento('weeklyGoalCopy').textContent = faltantes === 0
    ? 'Meta alcanzada en la última semana registrada'
    : 'Faltan ' + faltantes + ' para la meta de la última semana registrada';

  const pista = obtenerElemento('weeklyGoalTrack');
  pista.setAttribute('aria-valuenow', String(Math.min(cantidad, meta)));
  pista.setAttribute(
    'aria-valuetext',
    cantidad + ' de ' + meta + ' sesiones completadas'
  );
  const relleno = obtenerElemento('weeklyGoalFill');
  if (animar) {
    relleno.style.width = '0%';
    relleno.getBoundingClientRect();

    requestAnimationFrame(function () {
      relleno.style.width = resumen.progresoMeta + '%';
    });
  } else {
    relleno.style.width = resumen.progresoMeta + '%';
  }
}

function pintarConstancia(animar) {
  const resumen = crearResumenConstancia(
    estadoAplicacion.sesiones,
    estadoAplicacion.fechaMasReciente,
    12
  );

  obtenerElemento('consistencyValue').textContent = resumen.porcentajeActivo + '%';

  if (resumen.semanasConDatos === 0) {
    obtenerElemento('consistencyCopy').textContent = 'Sin semanas registradas';
  } else {
    obtenerElemento('consistencyCopy').textContent = resumen.semanasActivas
      + ' de '
      + resumen.semanasConDatos
      + ' semanas con datos';
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

function pintarCambioDePeso(puntosPeso, animar) {
  const etiquetaCambio = obtenerElemento('weightDelta');
  const textoAnterior = etiquetaCambio.textContent;
  let textoCambio = 'Sin registros';

  if (puntosPeso.length === 1) {
    textoCambio = formatoNumero.format(puntosPeso[0].valor) + ' lb';
  } else if (puntosPeso.length > 1) {
    const primerPeso = puntosPeso[0].valor;
    const ultimoPeso = puntosPeso[puntosPeso.length - 1].valor;
    const diferenciaPeso = ultimoPeso - primerPeso;
    const signoDiferencia = diferenciaPeso > 0 ? '+' : '';

    textoCambio = signoDiferencia + formatoNumero.format(diferenciaPeso) + ' lb';
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

function pintarGraficaPeso(animarGrafica, animarCambios) {
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
      animar: animarGrafica,
      iniciarEnCero: false,
      sufijoValor: ' lb',
      mensajeVacio: 'Añade mediciones de peso en Hevy.'
    }
  );

  pintarCambioDePeso(puntosPeso, animarCambios);
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
    animarCambios: true
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
    informacionRacha,
    configuracion
  );

  pintarRangoDeDatos(primeraFecha, ultimaFecha);
  pintarGraficaDeVolumen(sesiones, configuracion.animarGraficas);
  pintarConstancia(configuracion.animarCambios);
  pintarGraficaPeso(configuracion.animarGraficas, configuracion.animarCambios);
  pintarEjerciciosPrincipales(configuracion.animarCambios);
}
