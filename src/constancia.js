import { obtenerInicioDeSemana } from './metricas.js';
import { sumarDias } from './utilidades.js';

export const META_SESIONES_SEMANA = 4;

function sumarSesiones(semanas) {
  return semanas.reduce(function (total, semana) {
    return total + semana.cantidadSesiones;
  }, 0);
}

function tieneCoberturaCompleta(semanas) {
  return semanas.length === 4 && semanas.every(function (semana) {
    return semana.estado !== 'sin-datos';
  });
}

export function crearResumenConstancia(
  sesiones,
  fechaReferencia,
  cantidadSemanas,
  metaSesiones
) {
  const totalSemanas = cantidadSemanas || 12;
  const meta = metaSesiones || META_SESIONES_SEMANA;
  const inicioUltimaSemana = obtenerInicioDeSemana(fechaReferencia);
  const inicioPrimeraSemanaConDatos = sesiones.length > 0
    ? obtenerInicioDeSemana(sesiones[0].inicio)
    : null;
  const semanas = [];

  for (let indice = totalSemanas - 1; indice >= 0; indice -= 1) {
    const inicio = sumarDias(inicioUltimaSemana, -indice * 7);
    const fin = sumarDias(inicio, 7);
    const cantidadSesiones = sesiones.filter(function (sesion) {
      return sesion.inicio >= inicio && sesion.inicio < fin;
    }).length;
    let estado = 'sin-entrenamiento';

    if (!inicioPrimeraSemanaConDatos || inicio < inicioPrimeraSemanaConDatos) {
      estado = 'sin-datos';
    } else if (cantidadSesiones > 0) {
      estado = 'activa';
    }

    semanas.push({
      inicio: inicio,
      cantidadSesiones: cantidadSesiones,
      estado: estado
    });
  }

  const semanasConDatos = semanas.filter(function (semana) {
    return semana.estado !== 'sin-datos';
  });
  const semanasActivas = semanasConDatos.filter(function (semana) {
    return semana.estado === 'activa';
  });
  const porcentajeActivo = semanasConDatos.length > 0
    ? Math.round(semanasActivas.length / semanasConDatos.length * 100)
    : 0;
  // Semanas activas y semanas en meta son cosas distintas: una semana con un
  // solo entrenamiento cuenta como activa pero casi nunca alcanza la meta.
  const semanasEnMeta = semanasConDatos.filter(function (semana) {
    return semana.cantidadSesiones >= meta;
  });
  const bloqueActual = semanas.slice(-4);
  const bloqueAnterior = semanas.slice(-8, -4);
  const puedeComparar = tieneCoberturaCompleta(bloqueActual)
    && tieneCoberturaCompleta(bloqueAnterior);
  const sesionesBloqueActual = sumarSesiones(bloqueActual);
  const sesionesBloqueAnterior = sumarSesiones(bloqueAnterior);

  return {
    semanas: semanas,
    semanasConDatos: semanasConDatos.length,
    semanasActivas: semanasActivas.length,
    semanasEnMeta: semanasEnMeta.length,
    porcentajeActivo: porcentajeActivo,
    metaSesiones: meta,
    sesionesSemanaActual: semanas[semanas.length - 1].cantidadSesiones,
    progresoMeta: Math.min(
      100,
      semanas[semanas.length - 1].cantidadSesiones / meta * 100
    ),
    comparacion: {
      disponible: puedeComparar,
      actual: sesionesBloqueActual,
      anterior: sesionesBloqueAnterior,
      diferencia: sesionesBloqueActual - sesionesBloqueAnterior
    }
  };
}
