import { MILISEGUNDOS_POR_DIA } from './configuracion.js';
import {
  calcularMetricasSesion,
  calcularRachaSemanal,
  obtenerDuracionTotal,
  obtenerVolumenTotal
} from './metricas.js';
import { obtenerInicioDelDia, sumarDias } from './utilidades.js';

function obtenerSeriesEfectivasDeSesiones(sesiones) {
  return sesiones.flatMap(function (sesion) {
    return calcularMetricasSesion(sesion).seriesEfectivas;
  });
}

function resumirSesiones(sesiones) {
  const seriesEfectivas = obtenerSeriesEfectivasDeSesiones(sesiones);

  return {
    entrenamientos: sesiones.length,
    volumen: obtenerVolumenTotal(seriesEfectivas),
    duracion: obtenerDuracionTotal(sesiones),
    racha: calcularRachaSemanal(sesiones).mejorRacha
  };
}

function crearPeriodoNumerico(todasLasSesiones, fechaMasReciente, cantidadDias) {
  const ultimoDia = obtenerInicioDelDia(fechaMasReciente);
  const inicioActual = sumarDias(ultimoDia, -cantidadDias + 1);
  const inicioAnterior = sumarDias(inicioActual, -cantidadDias);

  return {
    sesionesActuales: todasLasSesiones.filter(function (sesion) {
      return sesion.inicio >= inicioActual;
    }),
    sesionesAnteriores: todasLasSesiones.filter(function (sesion) {
      return sesion.inicio >= inicioAnterior && sesion.inicio < inicioActual;
    }),
    hayHistorialAnterior: todasLasSesiones.some(function (sesion) {
      return sesion.inicio < inicioActual;
    }),
    descripcion: 'vs. periodo anterior',
    comparadoCon: 'Comparado con el periodo anterior equivalente'
  };
}

function crearPeriodoHistorialCompleto(todasLasSesiones) {
  if (todasLasSesiones.length < 2) {
    return {
      sesionesActuales: todasLasSesiones.slice(),
      sesionesAnteriores: [],
      hayHistorialAnterior: false,
      descripcion: 'vs. mitad anterior',
      comparadoCon: 'Comparado con la mitad anterior del historial'
    };
  }

  const primerDia = obtenerInicioDelDia(todasLasSesiones[0].inicio);
  const ultimoDia = obtenerInicioDelDia(
    todasLasSesiones[todasLasSesiones.length - 1].inicio
  );
  const cantidadDias = Math.floor(
    (ultimoDia - primerDia) / MILISEGUNDOS_POR_DIA
  ) + 1;
  const cantidadDiasMitad = Math.max(1, Math.ceil(cantidadDias / 2));
  const inicioMitadReciente = sumarDias(ultimoDia, -cantidadDiasMitad + 1);

  const sesionesActuales = todasLasSesiones.filter(function (sesion) {
    return sesion.inicio >= inicioMitadReciente;
  });
  const sesionesAnteriores = todasLasSesiones.filter(function (sesion) {
    return sesion.inicio < inicioMitadReciente;
  });

  return {
    sesionesActuales: sesionesActuales,
    sesionesAnteriores: sesionesAnteriores,
    hayHistorialAnterior: sesionesAnteriores.length > 0,
    descripcion: 'vs. mitad anterior',
    comparadoCon: 'Comparado con la mitad anterior del historial'
  };
}

// Parte el historial en el periodo visible y su equivalente anterior. La usan
// tanto las comparativas del resumen como la progresion de fuerza.
export function crearParticionDePeriodo(
  todasLasSesiones,
  fechaMasReciente,
  periodoSeleccionado
) {
  if (periodoSeleccionado === 'all') {
    return crearPeriodoHistorialCompleto(todasLasSesiones);
  }

  return crearPeriodoNumerico(
    todasLasSesiones,
    fechaMasReciente,
    Number(periodoSeleccionado)
  );
}

export function crearComparativasResumen(
  todasLasSesiones,
  fechaMasReciente,
  periodoSeleccionado
) {
  const periodoComparacion = crearParticionDePeriodo(
    todasLasSesiones,
    fechaMasReciente,
    periodoSeleccionado
  );

  return {
    actual: resumirSesiones(periodoComparacion.sesionesActuales),
    anterior: resumirSesiones(periodoComparacion.sesionesAnteriores),
    hayHistorialAnterior: periodoComparacion.hayHistorialAnterior,
    descripcion: periodoComparacion.descripcion,
    comparadoCon: periodoComparacion.comparadoCon
  };
}