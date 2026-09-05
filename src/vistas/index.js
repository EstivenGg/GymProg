import { pintarSelectorEjercicios } from './ejercicios.js';
import { pintarProgreso } from './progreso.js';
import { pintarResumen } from './resumen.js';
import { pintarSesiones } from './sesiones.js';

export { pintarDetalleEjercicio } from './ejercicios.js';

// Cada repintado tiene un motivo, y no todo cambia por el mismo motivo. La
// regla es animar solo lo que de verdad se mueve: al filtrar por periodo
// cambian los números y las series, pero no la ventana fija de constancia; al
// cambiar de unidad no cambia ningún dato, solo la escala con que se escribe.
// La primera pintura de la sesión es la única que presenta la interfaz entera.
const MODOS_CON_ENTRADA = ['inicial'];
// El valor de los números cambia: merece la pena verlos moverse hasta el nuevo.
const MODOS_CON_NUMEROS_NUEVOS = ['inicial', 'datos', 'periodo'];
// Cambia la serie que se dibuja, no solo la escala con que se escribe.
const MODOS_CON_SERIES_NUEVAS = ['inicial', 'datos', 'periodo', 'interaccion'];
// Elementos sensibles al filtro: barras de ejercicios, chips de variación.
const MODOS_CON_CAMBIO_VISIBLE = ['inicial', 'datos', 'periodo', 'interaccion'];
// Solo aquí puede haber datos que antes no estaban. Manda en dos sitios: la
// constancia, que mira 12 semanas fijas y no depende del filtro, y el destello
// de récord nuevo, que si saltara al cambiar de tema dejaría de significar algo.
const MODOS_CON_DATOS_NUEVOS = ['inicial', 'datos'];

function crearConfiguracionPintado(opciones) {
  const modo = opciones?.modo || 'interaccion';
  const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function animaEn(modosPermitidos) {
    return !reducirMovimiento && modosPermitidos.includes(modo);
  }

  return {
    animarEntrada: animaEn(MODOS_CON_ENTRADA),
    animarConteos: animaEn(MODOS_CON_NUMEROS_NUEVOS),
    animarGraficas: animaEn(MODOS_CON_SERIES_NUEVAS),
    animarCambios: animaEn(MODOS_CON_CAMBIO_VISIBLE),
    animarDatosNuevos: animaEn(MODOS_CON_DATOS_NUEVOS),
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
