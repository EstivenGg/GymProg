import { Chart } from 'chart.js/auto';
import {
  formatoFechaCompleta,
  formatoFechaCorta,
  formatoNumero,
  formatoNumeroCompacto
} from './configuracion.js';
import { crearEstadoVacio } from './utilidades.js';

const instanciasPorContenedor = new WeakMap();

function leerVariableCSS(nombreVariable) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(nombreVariable)
    .trim();
}

function obtenerColoresDeTema() {
  return {
    acento: leerVariableCSS('--orange'),
    texto: leerVariableCSS('--text'),
    apagado: leerVariableCSS('--muted'),
    borde: leerVariableCSS('--border'),
    superficie: leerVariableCSS('--surface')
  };
}

function convertirHexARGBA(colorHex, opacidad) {
  const hexLimpio = colorHex.replace('#', '');
  const componenteRojo = Number.parseInt(hexLimpio.substring(0, 2), 16);
  const componenteVerde = Number.parseInt(hexLimpio.substring(2, 4), 16);
  const componenteAzul = Number.parseInt(hexLimpio.substring(4, 6), 16);

  return 'rgba(' + componenteRojo + ',' + componenteVerde + ',' + componenteAzul + ',' + opacidad + ')';
}

function crearGradienteDeArea(contextoLienzo, areaDeGrafica, colorAcento) {
  const gradiente = contextoLienzo.createLinearGradient(
    0,
    areaDeGrafica.top,
    0,
    areaDeGrafica.bottom
  );

  gradiente.addColorStop(0, convertirHexARGBA(colorAcento, 0.28));
  gradiente.addColorStop(1, convertirHexARGBA(colorAcento, 0));

  return gradiente;
}

function obtenerOReemplazarLienzo(contenedor) {
  const lienzoExistente = contenedor.querySelector('canvas');

  if (lienzoExistente) {
    return lienzoExistente;
  }

  const lienzoNuevo = document.createElement('canvas');
  contenedor.replaceChildren(lienzoNuevo);

  return lienzoNuevo;
}

export function pintarGraficaLinea(contenedor, puntos, opcionesOriginales) {
  const opciones = opcionesOriginales || {};

  const instanciaPrevia = instanciasPorContenedor.get(contenedor);

  if (instanciaPrevia) {
    instanciaPrevia.destroy();
    instanciasPorContenedor.delete(contenedor);
  }

  const puntosValidos = puntos.filter(function (punto) {
    return Number.isFinite(punto.valor);
  });

  if (puntosValidos.length === 0) {
    const mensajeVacio = opciones.mensajeVacio || 'No hay datos en este periodo.';

    contenedor.replaceChildren(crearEstadoVacio(mensajeVacio));

    return;
  }

  const sufijoValor = opciones.sufijoValor || '';
  const iniciarEnCero = opciones.iniciarEnCero !== false;
  const esGraficaDeBarras = opciones.tipo === 'bar';
  const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animarGrafica = opciones.animar !== false && !reducirMovimiento;
  const colores = obtenerColoresDeTema();
  const lienzo = obtenerOReemplazarLienzo(contenedor);
  let conjuntoDeDatos;

  if (esGraficaDeBarras) {
    conjuntoDeDatos = {
      data: puntosValidos.map(function (punto) {
        return punto.valor;
      }),
      backgroundColor: convertirHexARGBA(colores.acento, 0.72),
      hoverBackgroundColor: colores.acento,
      borderColor: colores.acento,
      borderWidth: 1,
      borderSkipped: false,
      borderRadius: 6,
      maxBarThickness: 34
    };
  } else {
    conjuntoDeDatos = {
      data: puntosValidos.map(function (punto) {
        return punto.valor;
      }),
      borderColor: colores.acento,
      borderWidth: 2.3,
      pointRadius: 3.5,
      pointHoverRadius: 5,
      pointBackgroundColor: colores.superficie,
      pointBorderColor: colores.acento,
      pointBorderWidth: 2.3,
      tension: 0.35,
      fill: true,
      backgroundColor: function (contexto) {
        const grafica = contexto.chart;
        const areaDeGrafica = grafica.chartArea;

        if (!areaDeGrafica) {
          return undefined;
        }

        return crearGradienteDeArea(grafica.ctx, areaDeGrafica, colores.acento);
      }
    };
  }

  const instancia = new Chart(lienzo, {
    type: esGraficaDeBarras ? 'bar' : 'line',
    data: {
      labels: puntosValidos.map(function (punto) {
        return punto.fecha;
      }),
      datasets: [conjuntoDeDatos]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: animarGrafica ? {
        duration: 380,
        easing: 'easeOutQuart'
      } : false,
      interaction: {
        intersect: false,
        mode: 'nearest'
      },
      scales: {
        x: {
          offset: esGraficaDeBarras,
          grid: { display: false },
          ticks: {
            color: colores.apagado,
            font: { size: 11 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 6,
            callback: function (valor, indice) {
              return formatoFechaCorta.format(puntosValidos[indice].fecha);
            }
          }
        },
        y: {
          beginAtZero: iniciarEnCero,
          grid: {
            color: colores.borde,
            drawTicks: false
          },
          border: { display: false },
          ticks: {
            color: colores.apagado,
            font: { size: 11 },
            maxTicksLimit: 5,
            callback: function (valor) {
              return formatoNumeroCompacto.format(valor);
            }
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: colores.superficie,
          titleColor: colores.texto,
          bodyColor: colores.texto,
          borderColor: colores.borde,
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            title: function (elementos) {
              const indice = elementos[0].dataIndex;
              return formatoFechaCompleta.format(puntosValidos[indice].fecha);
            },
            label: function (elemento) {
              return formatoNumero.format(elemento.parsed.y) + sufijoValor;
            }
          }
        }
      }
    }
  });

  instanciasPorContenedor.set(contenedor, instancia);
}
