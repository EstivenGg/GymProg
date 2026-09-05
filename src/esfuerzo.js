// El RPE está en la mitad de las series, no en todas. Un promedio suelto oculta
// eso, así que todo lo que sale de aquí lleva pegado sobre cuántas series se
// calculó: "8,1 en 102 de 198" dice algo que "8,1" no dice.

export function tieneEsfuerzo(serie) {
  return Number.isFinite(serie.esfuerzoPercibido) && serie.esfuerzoPercibido > 0;
}

export function crearResumenEsfuerzo(series) {
  const seriesConEsfuerzo = series.filter(tieneEsfuerzo);

  if (seriesConEsfuerzo.length === 0) {
    return null;
  }

  const suma = seriesConEsfuerzo.reduce(function (total, serie) {
    return total + serie.esfuerzoPercibido;
  }, 0);

  const maximo = seriesConEsfuerzo.reduce(function (mayor, serie) {
    return Math.max(mayor, serie.esfuerzoPercibido);
  }, 0);

  return {
    promedio: suma / seriesConEsfuerzo.length,
    maximo: maximo,
    seriesConEsfuerzo: seriesConEsfuerzo.length,
    seriesTotales: series.length,
    cobertura: seriesConEsfuerzo.length / series.length
  };
}

export function crearEsfuerzoPorEjercicio(series) {
  const seriesPorEjercicio = new Map();

  series.forEach(function (serie) {
    if (!seriesPorEjercicio.has(serie.ejercicio)) {
      seriesPorEjercicio.set(serie.ejercicio, []);
    }

    seriesPorEjercicio.get(serie.ejercicio).push(serie);
  });

  const resumenes = [];

  seriesPorEjercicio.forEach(function (seriesDelEjercicio, ejercicio) {
    const resumen = crearResumenEsfuerzo(seriesDelEjercicio);

    if (resumen) {
      resumenes.push(Object.assign({ ejercicio: ejercicio }, resumen));
    }
  });

  resumenes.sort(function (primero, segundo) {
    return segundo.promedio - primero.promedio
      || primero.ejercicio.localeCompare(segundo.ejercicio, 'es');
  });

  return resumenes;
}

// Con una o dos series sueltas el promedio no describe nada; por debajo de ese
// mínimo es más honesto no enseñar el dato que enseñarlo con letra pequeña.
export function mereceMostrarse(resumen, minimoSeries) {
  const minimo = minimoSeries || 3;

  return Boolean(resumen) && resumen.seriesConEsfuerzo >= minimo;
}
