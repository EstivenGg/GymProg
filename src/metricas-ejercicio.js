import {
  convertirLibrasAUnidad,
  formatoNumero,
  obtenerUnidadPeso
} from './configuracion.js';
import { calcular1RMEstimado } from './metricas.js';
import {
  calcularRitmoDeSeries,
  formatearRitmo,
  tieneRitmo
} from './ritmo.js';
import { crearClaveDeFecha } from './utilidades.js';

function tienePeso(serie) {
  return Boolean(serie.pesoLibras);
}

function tieneRepeticiones(serie) {
  return Boolean(serie.repeticiones);
}

function tieneCarga(serie) {
  return tienePeso(serie) && tieneRepeticiones(serie);
}

function tieneDistancia(serie) {
  return Boolean(serie.distanciaKm);
}

function tieneDuracion(serie) {
  return Boolean(serie.duracionSegundos);
}

function mayorDe(series, obtenerValor) {
  return series.reduce(function (mayor, serie) {
    return Math.max(mayor, obtenerValor(serie));
  }, 0);
}

function sumaDe(series, obtenerValor) {
  return series.reduce(function (total, serie) {
    return total + obtenerValor(serie);
  }, 0);
}

// Cada ejercicio se mide con lo que tiene: una barra progresa en 1RM, las
// dominadas en repeticiones y la cinta en kilometros.
export const METRICAS_EJERCICIO = [
  {
    clave: '1rm',
    etiqueta: '1RM est.',
    nombre: '1RM estimado',
    aplicaA: tieneCarga,
    enUnidadDePeso: true,
    iniciarEnCero: false,
    resumirDia: function (seriesDelDia) {
      return mayorDe(seriesDelDia, calcular1RMEstimado);
    }
  },
  {
    clave: 'peso',
    etiqueta: 'Peso máx.',
    nombre: 'Peso máximo por sesión',
    aplicaA: tienePeso,
    enUnidadDePeso: true,
    iniciarEnCero: false,
    resumirDia: function (seriesDelDia) {
      return mayorDe(seriesDelDia, function (serie) {
        return serie.pesoLibras;
      });
    }
  },
  {
    clave: 'volumen',
    etiqueta: 'Volumen',
    nombre: 'Volumen por sesión',
    aplicaA: tieneCarga,
    enUnidadDePeso: true,
    iniciarEnCero: true,
    resumirDia: function (seriesDelDia) {
      return sumaDe(seriesDelDia, function (serie) {
        return serie.pesoLibras * serie.repeticiones;
      });
    }
  },
  {
    clave: 'reps',
    etiqueta: 'Reps',
    nombre: 'Repeticiones por sesión',
    aplicaA: tieneRepeticiones,
    enUnidadDePeso: false,
    sufijo: ' reps',
    iniciarEnCero: true,
    resumirDia: function (seriesDelDia) {
      return sumaDe(seriesDelDia, function (serie) {
        return serie.repeticiones;
      });
    }
  },
  {
    clave: 'distancia',
    etiqueta: 'Distancia',
    nombre: 'Distancia por sesión',
    aplicaA: tieneDistancia,
    enUnidadDePeso: false,
    sufijo: ' km',
    iniciarEnCero: true,
    resumirDia: function (seriesDelDia) {
      return sumaDe(seriesDelDia, function (serie) {
        return serie.distanciaKm;
      });
    }
  },
  {
    clave: 'ritmo',
    etiqueta: 'Ritmo',
    nombre: 'Ritmo por kilómetro',
    aplicaA: tieneRitmo,
    enUnidadDePeso: false,
    sufijo: ' /km',
    iniciarEnCero: false,
    // En ritmo, bajar es mejorar: quien lo lea tiene que verlo en verde.
    menorEsMejor: true,
    formatearValor: formatearRitmo,
    resumirDia: function (seriesDelDia) {
      return calcularRitmoDeSeries(seriesDelDia) || 0;
    }
  },
  {
    clave: 'duracion',
    etiqueta: 'Duración',
    nombre: 'Duración por sesión',
    aplicaA: tieneDuracion,
    enUnidadDePeso: false,
    sufijo: ' min',
    iniciarEnCero: true,
    resumirDia: function (seriesDelDia) {
      return sumaDe(seriesDelDia, function (serie) {
        return serie.duracionSegundos;
      }) / 60;
    }
  }
];

export function obtenerMetricasDisponibles(series) {
  return METRICAS_EJERCICIO.filter(function (metrica) {
    return series.some(metrica.aplicaA);
  });
}

export function obtenerMetricaPorClave(clave) {
  return METRICAS_EJERCICIO.find(function (metrica) {
    return metrica.clave === clave;
  }) || null;
}

// Un ritmo no se escribe como un peso. Cada métrica sabe darse formato y el
// resto del tablero pasa por aquí en vez de asumir decimales.
export function formatearValorDeMetrica(valor, metrica) {
  if (metrica.formatearValor) {
    return metrica.formatearValor(valor) + (metrica.sufijo || '');
  }

  return formatoNumero.format(valor) + obtenerSufijoDeMetrica(metrica);
}

export function obtenerSufijoDeMetrica(metrica) {
  if (metrica.enUnidadDePeso) {
    return ' ' + obtenerUnidadPeso();
  }

  return metrica.sufijo || '';
}

// Un dia de entrenamiento con las series que esa metrica sabe leer y el valor
// que resume el dia. Es la base tanto de la linea como de la tabla que la
// explica, para que las dos cuenten lo mismo.
export function agruparSeriesPorDia(series, metrica) {
  const seriesPorDia = new Map();

  series.filter(metrica.aplicaA).forEach(function (serie) {
    const claveDia = crearClaveDeFecha(serie.inicio);

    if (!seriesPorDia.has(claveDia)) {
      seriesPorDia.set(claveDia, { fecha: serie.inicio, series: [] });
    }

    seriesPorDia.get(claveDia).series.push(serie);
  });

  return Array.from(seriesPorDia.values())
    .map(function (dia) {
      return {
        fecha: dia.fecha,
        series: dia.series,
        valorBruto: metrica.resumirDia(dia.series)
      };
    })
    .sort(function (primerDia, segundoDia) {
      return primerDia.fecha - segundoDia.fecha;
    });
}

export function convertirValorDeMetrica(valorBruto, metrica) {
  return metrica.enUnidadDePeso
    ? convertirLibrasAUnidad(valorBruto)
    : valorBruto;
}

// Un punto por dia de entrenamiento, con las series que esa metrica sabe leer.
export function crearSerieTemporal(series, metrica) {
  return agruparSeriesPorDia(series, metrica).map(function (dia) {
    return {
      fecha: dia.fecha,
      series: dia.series,
      valor: convertirValorDeMetrica(dia.valorBruto, metrica)
    };
  });
}
