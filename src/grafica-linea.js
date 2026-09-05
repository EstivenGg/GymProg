import { Chart } from 'chart.js/auto';
import {
  formatoFechaCompleta,
  formatoFechaCorta,
  formatoNumero,
  formatoNumeroCompacto
} from './configuracion.js';
import { crearEstadoVacio, leerVariableCSS } from './utilidades.js';

const instanciasPorContenedor = new WeakMap();
const seleccionPorContenedor = new WeakMap();
const alternativasPorContenedor = new WeakMap();
let siguienteIdAlternativa = 1;

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

function crearCelda(etiqueta, contenido) {
  const celda = document.createElement(etiqueta);

  celda.textContent = contenido;
  return celda;
}

function obtenerOCrearAlternativa(contenedor) {
  const alternativaExistente = alternativasPorContenedor.get(contenedor);

  if (alternativaExistente) {
    return alternativaExistente;
  }

  const detalles = document.createElement('details');
  const resumen = document.createElement('summary');
  const envolturaTabla = document.createElement('div');
  const tabla = document.createElement('table');
  const cabecera = document.createElement('thead');
  const filaCabecera = document.createElement('tr');
  const cuerpo = document.createElement('tbody');
  const id = 'chartData-' + siguienteIdAlternativa;

  siguienteIdAlternativa += 1;
  detalles.className = 'chart-data';
  detalles.id = id;
  resumen.className = 'chart-data-summary';
  envolturaTabla.className = 'chart-data-table-wrap';
  tabla.className = 'chart-data-table';

  const cabeceraFecha = crearCelda('th', 'Fecha');
  const cabeceraValor = crearCelda('th', 'Valor');

  cabeceraFecha.scope = 'col';
  cabeceraValor.scope = 'col';
  filaCabecera.append(cabeceraFecha, cabeceraValor);
  cabecera.appendChild(filaCabecera);
  tabla.append(cabecera, cuerpo);
  envolturaTabla.appendChild(tabla);
  detalles.append(resumen, envolturaTabla);
  contenedor.after(detalles);

  const alternativa = {
    detalles: detalles,
    resumen: resumen,
    tabla: tabla,
    cuerpo: cuerpo
  };

  alternativasPorContenedor.set(contenedor, alternativa);
  return alternativa;
}

function pintarAlternativaAccesible(contenedor, puntos, opciones, formatearValor) {
  const alternativa = obtenerOCrearAlternativa(contenedor);
  const titulo = opciones.tituloAccesible || 'Datos de la gráfica';
  const filas = document.createDocumentFragment();

  puntos.forEach(function (punto) {
    const fila = document.createElement('tr');

    fila.append(
      crearCelda('td', punto.titulo || formatoFechaCompleta.format(punto.fecha)),
      crearCelda('td', formatearValor(punto.valor))
    );
    filas.appendChild(fila);
  });

  alternativa.resumen.textContent = 'Ver datos de la gráfica · '
    + puntos.length
    + (puntos.length === 1 ? ' registro' : ' registros');
  alternativa.tabla.setAttribute('aria-label', titulo);
  alternativa.cuerpo.replaceChildren(filas);
  alternativa.detalles.hidden = puntos.length === 0;

  return alternativa.detalles.id;
}

function obtenerPuntoSeleccionable(contenedor, elementos) {
  const seleccion = seleccionPorContenedor.get(contenedor);

  if (!seleccion || !seleccion.alSeleccionar || elementos.length === 0) {
    return null;
  }

  const punto = seleccion.puntos[elementos[0].index];

  return punto && punto.seleccionable ? punto : null;
}

function manejarClicEnGrafica(contenedor, elementos) {
  const punto = obtenerPuntoSeleccionable(contenedor, elementos);

  if (punto) {
    seleccionPorContenedor.get(contenedor).alSeleccionar(punto);
  }
}

// El cursor solo cambia donde el clic hace algo: en una barra que agrupa varias
// sesiones no hay un entrenamiento al que ir, y prometerlo sería mentir.
function manejarHoverEnGrafica(contenedor, elementos, grafica) {
  const punto = obtenerPuntoSeleccionable(contenedor, elementos);

  grafica.canvas.style.cursor = punto ? 'pointer' : 'default';
}

function crearFormateadorDeValor(opciones) {
  const sufijoValor = opciones.sufijoValor || '';

  if (opciones.formatearValor) {
    return function (valor) {
      return opciones.formatearValor(valor) + sufijoValor;
    };
  }

  return function (valor) {
    return formatoNumero.format(valor) + sufijoValor;
  };
}

export function pintarGraficaLinea(contenedor, puntos, opcionesOriginales) {
  const opciones = opcionesOriginales || {};
  const formatearValor = crearFormateadorDeValor(opciones);
  const puntosValidos = puntos.filter(function (punto) {
    return Number.isFinite(punto.valor);
  });
  const sufijoValor = opciones.sufijoValor || '';
  const instanciaPrevia = instanciasPorContenedor.get(contenedor);
  const idAlternativa = pintarAlternativaAccesible(
    contenedor,
    puntosValidos,
    opciones,
    formatearValor
  );

  if (puntosValidos.length === 0) {
    const mensajeVacio = opciones.mensajeVacio || 'No hay datos en este periodo.';

    if (instanciaPrevia) {
      instanciaPrevia.instancia.destroy();
      instanciasPorContenedor.delete(contenedor);
    }

    contenedor.replaceChildren(crearEstadoVacio(mensajeVacio));
    seleccionPorContenedor.delete(contenedor);

    return;
  }

  seleccionPorContenedor.set(contenedor, {
    puntos: puntosValidos,
    alSeleccionar: opciones.alSeleccionarPunto || null
  });

  const iniciarEnCero = opciones.iniciarEnCero !== false;
  const esGraficaDeBarras = opciones.tipo === 'bar';
  const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animarGrafica = opciones.animar !== false && !reducirMovimiento;
  const colores = obtenerColoresDeTema();
  const tipoGrafica = esGraficaDeBarras ? 'bar' : 'line';
  const firmaTema = Object.values(colores).join('|');
  const puedeActualizar = instanciaPrevia
    && instanciaPrevia.tipo === tipoGrafica
    && instanciaPrevia.firmaTema === firmaTema;

  if (instanciaPrevia && !puedeActualizar) {
    instanciaPrevia.instancia.destroy();
    instanciasPorContenedor.delete(contenedor);
  }

  const lienzo = obtenerOReemplazarLienzo(contenedor);
  lienzo.setAttribute('role', 'img');
  lienzo.setAttribute(
    'aria-label',
    opciones.tituloAccesible || 'Gráfica de evolución'
  );
  lienzo.setAttribute('aria-describedby', idAlternativa);
  let conjuntoDeDatos;

  if (esGraficaDeBarras) {
    // Cada punto puede traer su propio color; sin él, todas las barras usan el
    // acento y la gráfica se comporta como siempre.
    const coloresDeBarra = puntosValidos.map(function (punto) {
      return punto.color || colores.acento;
    });

    conjuntoDeDatos = {
      data: puntosValidos.map(function (punto) {
        return punto.valor;
      }),
      sufijoValor: sufijoValor,
      backgroundColor: coloresDeBarra.map(function (color) {
        return convertirHexARGBA(color, 0.72);
      }),
      hoverBackgroundColor: coloresDeBarra,
      borderColor: coloresDeBarra,
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
      sufijoValor: sufijoValor,
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

  const etiquetas = puntosValidos.map(function (punto) {
    return punto.fecha;
  });

  conjuntoDeDatos.formatearValor = formatearValor;
  conjuntoDeDatos.formatoPropioEnEje = Boolean(opciones.formatearValor);
  conjuntoDeDatos.titulosDePunto = puntosValidos.map(function (punto) {
    return punto.titulo || null;
  });
  conjuntoDeDatos.detallesDePunto = puntosValidos.map(function (punto) {
    return punto.detalle || null;
  });
  conjuntoDeDatos.etiquetasDeEje = puntosValidos.map(function (punto) {
    return punto.etiquetaEje || null;
  });

  if (puedeActualizar) {
    const instancia = instanciaPrevia.instancia;

    instancia.data.labels = etiquetas;
    Object.assign(instancia.data.datasets[0], conjuntoDeDatos);
    instancia.options.animation = animarGrafica ? {
      duration: 380,
      easing: 'easeOutQuart'
    } : false;
    instancia.options.scales.x.offset = esGraficaDeBarras;
    instancia.options.scales.y.beginAtZero = iniciarEnCero;
    instancia.update();
    return;
  }

  const instancia = new Chart(lienzo, {
    type: tipoGrafica,
    data: {
      labels: etiquetas,
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
      onClick: function (evento, elementos) {
        manejarClicEnGrafica(contenedor, elementos);
      },
      onHover: function (evento, elementos, grafica) {
        manejarHoverEnGrafica(contenedor, elementos, grafica);
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
              const conjunto = this.chart.data.datasets[0];
              const etiquetaPropia = conjunto.etiquetasDeEje
                && conjunto.etiquetasDeEje[indice];

              return etiquetaPropia
                || formatoFechaCorta.format(this.chart.data.labels[indice]);
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
              const conjunto = this.chart.data.datasets[0];

              if (conjunto.formatearValor && conjunto.formatoPropioEnEje) {
                return conjunto.formatearValor(valor);
              }

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
              const conjunto = elementos[0].dataset;
              const tituloPropio = conjunto.titulosDePunto
                && conjunto.titulosDePunto[indice];

              return tituloPropio || formatoFechaCompleta.format(
                elementos[0].chart.data.labels[indice]
              );
            },
            label: function (elemento) {
              const lineas = [elemento.dataset.formatearValor(elemento.parsed.y)];
              const detalle = elemento.dataset.detallesDePunto
                && elemento.dataset.detallesDePunto[elemento.dataIndex];

              if (detalle) {
                lineas.push(detalle);
              }

              return lineas;
            }
          }
        }
      }
    }
  });

  instanciasPorContenedor.set(contenedor, {
    instancia: instancia,
    tipo: tipoGrafica,
    firmaTema: firmaTema
  });
}
