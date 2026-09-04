import { MILISEGUNDOS_POR_DIA } from './configuracion.js';
import {
  crearClaveDeFecha,
  normalizarTexto,
  obtenerInicioDelDia
} from './utilidades.js';

export function esSerieEfectiva(serie) {
  return normalizarTexto(serie.tipoSerie) !== 'warmup';
}

export function calcular1RMEstimado(serie) {
  if (!serie.pesoLibras || !serie.repeticiones) {
    return 0;
  }

  return serie.pesoLibras * (1 + serie.repeticiones / 30);
}

export function calcularMetricasSesion(sesion) {
  const seriesEfectivas = sesion.series.filter(esSerieEfectiva);
  const nombresEjercicios = new Set();

  let volumenLibras = 0;

  seriesEfectivas.forEach(function (serie) {
    const peso = serie.pesoLibras || 0;
    const repeticiones = serie.repeticiones || 0;

    volumenLibras += peso * repeticiones;
  });

  sesion.series.forEach(function (serie) {
    nombresEjercicios.add(serie.ejercicio);
  });

  let duracionMinutos = 0;

  if (sesion.fin) {
    const diferenciaMilisegundos = sesion.fin - sesion.inicio;
    duracionMinutos = Math.max(0, Math.round(diferenciaMilisegundos / 60_000));
  }

  return {
    seriesEfectivas: seriesEfectivas,
    volumenLibras: volumenLibras,
    duracionMinutos: duracionMinutos,
    nombresEjercicios: nombresEjercicios
  };
}

export function obtenerInicioDeSemana(fechaOriginal) {
  const inicioSemana = obtenerInicioDelDia(fechaOriginal);
  const diasDesdeElLunes = (inicioSemana.getDay() + 6) % 7;

  inicioSemana.setDate(inicioSemana.getDate() - diasDesdeElLunes);

  return inicioSemana;
}

export function calcularRachaSemanal(sesiones) {
  const clavesSemanas = new Set();

  sesiones.forEach(function (sesion) {
    const inicioSemana = obtenerInicioDeSemana(sesion.inicio);
    clavesSemanas.add(crearClaveDeFecha(inicioSemana));
  });

  const semanasOrdenadas = Array.from(clavesSemanas);

  semanasOrdenadas.sort(function (primeraSemana, segundaSemana) {
    return primeraSemana.localeCompare(segundaSemana);
  });

  let mejorRacha = 0;
  let rachaActual = 0;
  let fechaSemanaAnterior = null;

  semanasOrdenadas.forEach(function (claveSemana) {
    const fechaSemanaActual = new Date(claveSemana + 'T12:00:00');
    let semanasConsecutivas = false;

    if (fechaSemanaAnterior) {
      const diferenciaDias = Math.round(
        (fechaSemanaActual - fechaSemanaAnterior) / MILISEGUNDOS_POR_DIA
      );

      semanasConsecutivas = diferenciaDias === 7;
    }

    if (semanasConsecutivas) {
      rachaActual += 1;
    } else {
      rachaActual = 1;
    }

    mejorRacha = Math.max(mejorRacha, rachaActual);
    fechaSemanaAnterior = fechaSemanaActual;
  });

  return {
    mejorRacha: mejorRacha,
    semanasActivas: semanasOrdenadas.length
  };
}

export function obtenerVolumenTotal(series) {
  let volumenTotal = 0;

  series.forEach(function (serie) {
    const peso = serie.pesoLibras || 0;
    const repeticiones = serie.repeticiones || 0;

    volumenTotal += peso * repeticiones;
  });

  return volumenTotal;
}

export function obtenerDuracionTotal(sesiones) {
  let duracionTotal = 0;

  sesiones.forEach(function (sesion) {
    const metricasSesion = calcularMetricasSesion(sesion);
    duracionTotal += metricasSesion.duracionMinutos;
  });

  return duracionTotal;
}
