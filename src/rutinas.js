// Las rutinas más frecuentes se quedan con los colores; el resto va en gris.
// El reparto se calcula siempre sobre el historial completo, no sobre lo que
// haya filtrado a la vista, para que una rutina tenga el mismo color en el
// listado de sesiones y en la gráfica de volumen.
export const VARIABLES_DE_RUTINA = [
  '--orange',
  '--blue',
  '--violet',
  '--green'
];

export const VARIABLE_OTRAS_RUTINAS = '--muted';

export function contarSesionesPorRutina(sesiones) {
  const cantidadesPorRutina = new Map();

  sesiones.forEach(function (sesion) {
    const cantidadActual = cantidadesPorRutina.get(sesion.titulo) || 0;

    cantidadesPorRutina.set(sesion.titulo, cantidadActual + 1);
  });

  const rutinas = Array.from(cantidadesPorRutina.entries()).map(function (entrada) {
    return { titulo: entrada[0], cantidad: entrada[1] };
  });

  rutinas.sort(function (primeraRutina, segundaRutina) {
    return segundaRutina.cantidad - primeraRutina.cantidad
      || primeraRutina.titulo.localeCompare(segundaRutina.titulo, 'es');
  });

  return rutinas;
}

export function crearVariablesDeRutina(sesiones) {
  const variablesPorRutina = new Map();

  contarSesionesPorRutina(sesiones).forEach(function (rutina, indiceRutina) {
    variablesPorRutina.set(
      rutina.titulo,
      indiceRutina < VARIABLES_DE_RUTINA.length
        ? VARIABLES_DE_RUTINA[indiceRutina]
        : VARIABLE_OTRAS_RUTINAS
    );
  });

  return variablesPorRutina;
}

export function crearColoresDeRutina(sesiones) {
  const coloresPorRutina = new Map();

  crearVariablesDeRutina(sesiones).forEach(function (variable, titulo) {
    coloresPorRutina.set(titulo, 'var(' + variable + ')');
  });

  return coloresPorRutina;
}

export function tieneRutinasSinColorPropio(sesiones) {
  return contarSesionesPorRutina(sesiones).length > VARIABLES_DE_RUTINA.length;
}
