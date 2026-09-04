import { MILISEGUNDOS_POR_DIA } from './configuracion.js';
import {
  calcularMetricasSesion,
  calcularRachaSemanal,
  obtenerDuracionTotal,
  obtenerInicioDeSemana,
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
    descripcion: 'vs. periodo anterior'
  };
}

function crearPeriodoHistorialCompleto(todasLasSesiones) {
  if (todasLasSesiones.length < 2) {
    return {
      sesionesActuales: todasLasSesiones.slice(),
      sesionesAnteriores: [],
      hayHistorialAnterior: false,
      descripcion: 'vs. mitad anterior'
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
    descripcion: 'vs. mitad anterior'
  };
}

export function crearComparativasResumen(
  todasLasSesiones,
  fechaMasReciente,
  periodoSeleccionado
) {
  let periodoComparacion;

  if (periodoSeleccionado === 'all') {
    periodoComparacion = crearPeriodoHistorialCompleto(todasLasSesiones);
  } else {
    periodoComparacion = crearPeriodoNumerico(
      todasLasSesiones,
      fechaMasReciente,
      Number(periodoSeleccionado)
    );
  }

  return {
    actual: resumirSesiones(periodoComparacion.sesionesActuales),
    anterior: resumirSesiones(periodoComparacion.sesionesAnteriores),
    hayHistorialAnterior: periodoComparacion.hayHistorialAnterior,
    descripcion: periodoComparacion.descripcion
  };
}

function obtenerSemanasRecientes(sesiones, fechaReferencia, cantidadSemanas) {
  const inicioUltimaSemana = obtenerInicioDeSemana(fechaReferencia);
  const cantidades = [];

  for (let indice = cantidadSemanas - 1; indice >= 0; indice -= 1) {
    const inicioSemana = sumarDias(inicioUltimaSemana, -indice * 7);
    const finSemana = sumarDias(inicioSemana, 7);
    const cantidad = sesiones.filter(function (sesion) {
      return sesion.inicio >= inicioSemana && sesion.inicio < finSemana;
    }).length;

    cantidades.push(cantidad);
  }

  return cantidades;
}

function crearRachaSemanal(cantidadesSemanales) {
  let racha = 0;

  return cantidadesSemanales.map(function (cantidad) {
    if (cantidad > 0) {
      racha += 1;
    } else {
      racha = 0;
    }

    return racha;
  });
}

export function crearSeriesResumen(sesiones, fechaMasReciente) {
  const sesionesRecientes = sesiones.slice(-8);
  const actividadSemanal = obtenerSemanasRecientes(
    sesiones,
    fechaMasReciente,
    8
  );

  return {
    entrenamientos: actividadSemanal,
    volumen: sesionesRecientes.map(function (sesion) {
      return calcularMetricasSesion(sesion).volumenLibras;
    }),
    duracion: sesionesRecientes.map(function (sesion) {
      return calcularMetricasSesion(sesion).duracionMinutos;
    }),
    racha: crearRachaSemanal(actividadSemanal)
  };
}
