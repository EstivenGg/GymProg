import { crearClaveSesion } from './datos.js';
import { crearResumenEsfuerzo } from './esfuerzo.js';
import { calcular1RMEstimado } from './metricas.js';
import { agruparSeriesPorDia } from './metricas-ejercicio.js';

export const SESIONES_RECIENTES = 5;

// La serie que representa el día: la de mayor 1RM si hay carga, y si no la de
// más repeticiones. Es la que se enseña junto al valor de la métrica.
function elegirMejorSerie(series) {
  if (series.length === 0) {
    return null;
  }

  const conCarga = series.filter(function (serie) {
    return calcular1RMEstimado(serie) > 0;
  });

  if (conCarga.length > 0) {
    return conCarga.reduce(function (mejor, serie) {
      return calcular1RMEstimado(serie) > calcular1RMEstimado(mejor) ? serie : mejor;
    });
  }

  return series.reduce(function (mejor, serie) {
    return (serie.repeticiones || 0) > (mejor.repeticiones || 0) ? serie : mejor;
  });
}

function calcularPorcentaje(valorActual, valorAnterior) {
  if (valorAnterior === null || valorAnterior === 0) {
    return null;
  }

  return (valorActual - valorAnterior) / valorAnterior * 100;
}

function crearFilaDeSesion(dia, diaAnterior) {
  const mejorSerie = elegirMejorSerie(dia.series);
  const valorAnterior = diaAnterior ? diaAnterior.valorBruto : null;

  return {
    fecha: dia.fecha,
    claveSesion: crearClaveSesion(mejorSerie.inicio, mejorSerie.tituloSesion),
    tituloSesion: mejorSerie.tituloSesion,
    valorBruto: dia.valorBruto,
    valorAnterior: valorAnterior,
    diferencia: valorAnterior === null ? null : dia.valorBruto - valorAnterior,
    porcentaje: calcularPorcentaje(dia.valorBruto, valorAnterior),
    mejorSerie: mejorSerie,
    cantidadSeries: dia.series.length,
    // Resumen completo, no solo el máximo: incluye sobre cuántas series se
    // calculó, que es lo que permite juzgar si el número significa algo.
    esfuerzo: crearResumenEsfuerzo(dia.series)
  };
}

// Las últimas sesiones del ejercicio, de la más reciente hacia atrás. Cada una
// se compara con la sesión anterior de ese mismo ejercicio, aunque esa anterior
// quede fuera de las que se muestran.
export function crearUltimasSesionesDelEjercicio(series, metrica, cantidad) {
  const dias = agruparSeriesPorDia(series, metrica).filter(function (dia) {
    return dia.series.length > 0;
  });

  const filas = dias.map(function (dia, indiceDia) {
    return crearFilaDeSesion(dia, indiceDia > 0 ? dias[indiceDia - 1] : null);
  });

  const cantidadVisible = cantidad || SESIONES_RECIENTES;

  return filas.slice(-cantidadVisible).reverse();
}
