import { crearParticionDePeriodo } from './comparativas.js';
import { calcular1RMEstimado, calcularMetricasSesion } from './metricas.js';

// Por debajo de este cambio relativo damos el ejercicio por estancado: el 1RM
// estimado se mueve solo con que cambie una repeticion de la mejor serie.
const UMBRAL_DE_CAMBIO = 0.02;

function obtenerMejor1RMPorEjercicio(sesiones) {
  const mejoresPorEjercicio = new Map();

  sesiones.forEach(function (sesion) {
    calcularMetricasSesion(sesion).seriesEfectivas.forEach(function (serie) {
      const estimado = calcular1RMEstimado(serie);

      if (estimado <= 0) {
        return;
      }

      const mejorActual = mejoresPorEjercicio.get(serie.ejercicio);

      if (mejorActual === undefined || estimado > mejorActual) {
        mejoresPorEjercicio.set(serie.ejercicio, estimado);
      }
    });
  });

  return mejoresPorEjercicio;
}

function crearCambio(mejorActual, mejorAnterior) {
  if (mejorAnterior === undefined) {
    return { estado: 'nuevo', diferencia: 0, porcentaje: 0 };
  }

  const diferencia = mejorActual - mejorAnterior;
  const porcentaje = diferencia / mejorAnterior;

  if (Math.abs(porcentaje) < UMBRAL_DE_CAMBIO) {
    return { estado: 'mantiene', diferencia: diferencia, porcentaje: porcentaje };
  }

  return {
    estado: diferencia > 0 ? 'subio' : 'bajo',
    diferencia: diferencia,
    porcentaje: porcentaje
  };
}

function contarPorEstado(ejercicios, estadoBuscado) {
  return ejercicios.filter(function (ejercicio) {
    return ejercicio.estado === estadoBuscado;
  }).length;
}

export function crearProgresionFuerza(
  todasLasSesiones,
  fechaMasReciente,
  periodoSeleccionado
) {
  const particion = crearParticionDePeriodo(
    todasLasSesiones,
    fechaMasReciente,
    periodoSeleccionado
  );
  const mejoresActuales = obtenerMejor1RMPorEjercicio(particion.sesionesActuales);
  const mejoresAnteriores = obtenerMejor1RMPorEjercicio(particion.sesionesAnteriores);
  const ejercicios = [];

  mejoresActuales.forEach(function (mejorActual, nombreEjercicio) {
    const mejorAnterior = mejoresAnteriores.get(nombreEjercicio);
    const cambio = crearCambio(mejorActual, mejorAnterior);

    ejercicios.push({
      ejercicio: nombreEjercicio,
      actual: mejorActual,
      anterior: mejorAnterior === undefined ? null : mejorAnterior,
      diferencia: cambio.diferencia,
      porcentaje: cambio.porcentaje,
      estado: cambio.estado
    });
  });

  ejercicios.sort(function (primerEjercicio, segundoEjercicio) {
    return segundoEjercicio.porcentaje - primerEjercicio.porcentaje;
  });

  return {
    ejercicios: ejercicios,
    subieron: contarPorEstado(ejercicios, 'subio'),
    mantienen: contarPorEstado(ejercicios, 'mantiene'),
    bajaron: contarPorEstado(ejercicios, 'bajo'),
    nuevos: contarPorEstado(ejercicios, 'nuevo'),
    hayHistorialAnterior: particion.hayHistorialAnterior,
    comparadoCon: particion.comparadoCon
  };
}

// Los ejercicios que mas se movieron en cada direccion, para el panel de fuerza.
export function obtenerMayoresCambios(progresion, cantidad) {
  const subieron = progresion.ejercicios.filter(function (ejercicio) {
    return ejercicio.estado === 'subio';
  });
  const bajaron = progresion.ejercicios.filter(function (ejercicio) {
    return ejercicio.estado === 'bajo';
  });

  return {
    subieron: subieron.slice(0, cantidad),
    bajaron: bajaron.slice(-cantidad).reverse()
  };
}
