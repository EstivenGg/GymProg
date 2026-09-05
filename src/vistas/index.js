import { pintarSelectorEjercicios } from './ejercicios.js';
import { pintarProgreso } from './progreso.js';
import { pintarResumen } from './resumen.js';
import { pintarSesiones } from './sesiones.js';

export { pintarDetalleEjercicio } from './ejercicios.js';

// Cada modo anima únicamente los elementos cuyos datos han cambiado.
const MODOS_CON_ENTRADA = ['inicial'];
const MODOS_CON_NUMEROS_NUEVOS = ['inicial', 'datos', 'periodo'];
const MODOS_CON_SERIES_NUEVAS = ['inicial', 'datos', 'periodo', 'interaccion'];
const MODOS_CON_CAMBIO_VISIBLE = ['inicial', 'datos', 'periodo', 'interaccion'];
// La carga inicial y la importación pueden incorporar récords nuevos.
const MODOS_CON_DATOS_NUEVOS = ['inicial', 'datos'];

function crearConfiguracionPintado(opciones) {
  const modo = opciones?.modo || 'interaccion';
  const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function debeAnimarseEn(modosPermitidos) {
    return !reducirMovimiento && modosPermitidos.includes(modo);
  }

  return {
    animarEntrada: debeAnimarseEn(MODOS_CON_ENTRADA),
    animarConteos: debeAnimarseEn(MODOS_CON_NUMEROS_NUEVOS),
    animarGraficas: debeAnimarseEn(MODOS_CON_SERIES_NUEVAS),
    animarCambios: debeAnimarseEn(MODOS_CON_CAMBIO_VISIBLE),
    animarDatosNuevos: debeAnimarseEn(MODOS_CON_DATOS_NUEVOS),
    modo: modo
  };
}

export function pintarTableroCompleto(opciones) {
  const configuracion = crearConfiguracionPintado(opciones);

  pintarResumen(configuracion);
  pintarProgreso(configuracion);
  pintarSelectorEjercicios(configuracion);
  pintarSesiones(configuracion);
}
