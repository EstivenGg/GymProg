const SEGUNDOS_POR_MINUTO = 60;

export function tieneRitmo(serie) {
  return Boolean(serie.distanciaKm) && Boolean(serie.duracionSegundos);
}

// El ritmo de un conjunto de series no es el promedio de sus ritmos: son los
// kilómetros totales contra el tiempo total. Promediar ritmos daría más peso a
// los tramos cortos.
export function calcularRitmoMinutosPorKm(distanciaKm, duracionSegundos) {
  if (!distanciaKm || !duracionSegundos || distanciaKm <= 0) {
    return null;
  }

  return duracionSegundos / SEGUNDOS_POR_MINUTO / distanciaKm;
}

export function calcularRitmoDeSeries(series) {
  const seriesConRitmo = series.filter(tieneRitmo);

  if (seriesConRitmo.length === 0) {
    return null;
  }

  const totales = seriesConRitmo.reduce(function (acumulado, serie) {
    return {
      distanciaKm: acumulado.distanciaKm + serie.distanciaKm,
      duracionSegundos: acumulado.duracionSegundos + serie.duracionSegundos
    };
  }, { distanciaKm: 0, duracionSegundos: 0 });

  return calcularRitmoMinutosPorKm(totales.distanciaKm, totales.duracionSegundos);
}

// Un ritmo se lee en minutos y segundos, no en decimales: 4:38 y no 4,6.
// El cero no es un ritmo, pero sí es el origen de la escala en el eje, así que
// se escribe como 0:00; la raya se reserva para cuando no hay dato.
export function formatearRitmo(minutosPorKm) {
  if (!Number.isFinite(minutosPorKm) || minutosPorKm < 0) {
    return '—';
  }

  const segundosTotales = Math.round(minutosPorKm * SEGUNDOS_POR_MINUTO);
  const minutos = Math.floor(segundosTotales / SEGUNDOS_POR_MINUTO);
  const segundos = segundosTotales % SEGUNDOS_POR_MINUTO;

  return minutos + ':' + String(segundos).padStart(2, '0');
}

export function obtenerMejorRitmo(series) {
  const ritmos = series.filter(tieneRitmo).map(function (serie) {
    return {
      serie: serie,
      minutosPorKm: calcularRitmoMinutosPorKm(serie.distanciaKm, serie.duracionSegundos)
    };
  }).filter(function (candidato) {
    return candidato.minutosPorKm !== null;
  });

  if (ritmos.length === 0) {
    return null;
  }

  // En ritmo gana el número más bajo.
  return ritmos.reduce(function (mejor, candidato) {
    return candidato.minutosPorKm < mejor.minutosPorKm ? candidato : mejor;
  });
}
