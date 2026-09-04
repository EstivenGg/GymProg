import { INDICES_MESES } from './configuracion.js';

export function obtenerElemento(idElemento) {
  return document.getElementById(idElemento);
}

export function clonarElementoDePlantilla(idPlantilla) {
  const plantilla = obtenerElemento(idPlantilla);

  if (!(plantilla instanceof HTMLTemplateElement)) {
    throw new Error('No existe la plantilla HTML: ' + idPlantilla);
  }

  const elementoRaiz = plantilla.content.firstElementChild;

  if (!elementoRaiz) {
    throw new Error('La plantilla no contiene un elemento: ' + idPlantilla);
  }

  return elementoRaiz.cloneNode(true);
}

export function crearEstadoVacio(mensaje, clasesAdicionales) {
  const estadoVacio = clonarElementoDePlantilla('emptyStateTemplate');
  estadoVacio.textContent = mensaje;

  if (clasesAdicionales) {
    estadoVacio.classList.add(...clasesAdicionales);
  }

  return estadoVacio;
}

export function normalizarTexto(valorOriginal) {
  return String(valorOriginal || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace('.', '');
}

export function convertirFechaHevy(valorFecha) {
  const patronFechaHevy = /^(\d{1,2})\s+([^\s]+)\s+(\d{4}),\s*(\d{1,2}):(\d{2})/i;
  const textoFecha = String(valorFecha || '').trim();
  const resultadoFecha = patronFechaHevy.exec(textoFecha);

  if (!resultadoFecha) {
    return null;
  }

  const nombreMes = normalizarTexto(resultadoFecha[2]).slice(0, 3);
  const indiceMes = INDICES_MESES[nombreMes];

  if (indiceMes === undefined) {
    return null;
  }

  const dia = Number(resultadoFecha[1]);
  const anio = Number(resultadoFecha[3]);
  const hora = Number(resultadoFecha[4]);
  const minutos = Number(resultadoFecha[5]);

  return new Date(anio, indiceMes, dia, hora, minutos);
}

export function convertirNumero(valorOriginal) {
  if (valorOriginal === '' || valorOriginal === null || valorOriginal === undefined) {
    return null;
  }

  const numeroConvertido = Number(String(valorOriginal).replace(',', '.'));

  if (!Number.isFinite(numeroConvertido)) {
    return null;
  }

  return numeroConvertido;
}

export function obtenerInicioDelDia(fechaOriginal) {
  return new Date(
    fechaOriginal.getFullYear(),
    fechaOriginal.getMonth(),
    fechaOriginal.getDate()
  );
}

export function sumarDias(fechaOriginal, cantidadDias) {
  const fechaResultado = new Date(fechaOriginal);
  fechaResultado.setDate(fechaResultado.getDate() + cantidadDias);

  return fechaResultado;
}

export function crearClaveDeFecha(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');

  return anio + '-' + mes + '-' + dia;
}

export function obtenerClaveDeUltimaSesion(elementosConFecha) {
  let fechaMasReciente = null;

  elementosConFecha.forEach(function (elemento) {
    if (!fechaMasReciente || elemento.inicio > fechaMasReciente) {
      fechaMasReciente = elemento.inicio;
    }
  });

  if (!fechaMasReciente) {
    return null;
  }

  return crearClaveDeFecha(fechaMasReciente);
}

const contadoresActivos = new WeakMap();

export function animarConteo(elemento, valorFinal, opciones) {
  const configuracion = opciones || {};
  const sufijo = configuracion.sufijo || '';
  const formatear = configuracion.formatear || function (valor) {
    return String(Math.round(valor));
  };

  const valorInicial = Number(elemento.dataset.valorAnimado) || 0;
  const idEjecucion = (contadoresActivos.get(elemento) || 0) + 1;
  const duracionMs = 650;
  const tiempoInicio = performance.now();

  contadoresActivos.set(elemento, idEjecucion);

  function avanzarFrame(tiempoActual) {
    if (contadoresActivos.get(elemento) !== idEjecucion) {
      return;
    }

    const progreso = Math.min(1, (tiempoActual - tiempoInicio) / duracionMs);
    const progresoSuave = 1 - Math.pow(1 - progreso, 3);
    const valorActual = valorInicial + (valorFinal - valorInicial) * progresoSuave;

    elemento.textContent = formatear(valorActual) + sufijo;

    if (progreso < 1) {
      requestAnimationFrame(avanzarFrame);
    } else {
      elemento.dataset.valorAnimado = String(valorFinal);
    }
  }

  requestAnimationFrame(avanzarFrame);
}
