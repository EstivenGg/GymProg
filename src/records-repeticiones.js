import { crearResumenEsfuerzo } from './esfuerzo.js';
import { crearClaveDeFecha } from './utilidades.js';

// Dominadas y fondos no tienen 1RM que estimar, así que quedaban fuera de la
// tabla de récords aunque sean de los ejercicios más repetidos del historial.
// Su marca es otra: cuántas repeticiones se aguantan en una sola serie.
export function esEjercicioDePesoCorporal(seriesDelEjercicio) {
  const alguienLlevaPeso = seriesDelEjercicio.some(function (serie) {
    return Boolean(serie.pesoLibras);
  });

  const alguienTieneRepeticiones = seriesDelEjercicio.some(function (serie) {
    return Boolean(serie.repeticiones);
  });

  return !alguienLlevaPeso && alguienTieneRepeticiones;
}

function agruparPorEjercicio(series) {
  const seriesPorEjercicio = new Map();

  series.forEach(function (serie) {
    if (!seriesPorEjercicio.has(serie.ejercicio)) {
      seriesPorEjercicio.set(serie.ejercicio, []);
    }

    seriesPorEjercicio.get(serie.ejercicio).push(serie);
  });

  return seriesPorEjercicio;
}

function crearRecordDelEjercicio(ejercicio, seriesDelEjercicio) {
  const conRepeticiones = seriesDelEjercicio.filter(function (serie) {
    return Boolean(serie.repeticiones);
  });

  const mejorSerie = conRepeticiones.reduce(function (mejor, serie) {
    return serie.repeticiones > mejor.repeticiones ? serie : mejor;
  });

  const repeticionesTotales = conRepeticiones.reduce(function (total, serie) {
    return total + serie.repeticiones;
  }, 0);

  const sesiones = new Set(conRepeticiones.map(function (serie) {
    return crearClaveDeFecha(serie.inicio);
  }));

  return {
    ejercicio: ejercicio,
    mejorSerie: mejorSerie,
    repeticiones: mejorSerie.repeticiones,
    fecha: mejorSerie.inicio,
    repeticionesTotales: repeticionesTotales,
    cantidadSeries: conRepeticiones.length,
    cantidadSesiones: sesiones.size,
    esfuerzo: crearResumenEsfuerzo(conRepeticiones)
  };
}

export function crearRecordsDeRepeticiones(series) {
  const records = [];

  agruparPorEjercicio(series).forEach(function (seriesDelEjercicio, ejercicio) {
    if (esEjercicioDePesoCorporal(seriesDelEjercicio)) {
      records.push(crearRecordDelEjercicio(ejercicio, seriesDelEjercicio));
    }
  });

  records.sort(function (primero, segundo) {
    return segundo.repeticiones - primero.repeticiones
      || primero.ejercicio.localeCompare(segundo.ejercicio, 'es');
  });

  return records;
}
