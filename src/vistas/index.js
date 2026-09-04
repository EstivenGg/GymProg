import { pintarSelectorEjercicios } from './ejercicios.js';
import { pintarProgreso } from './progreso.js';
import { pintarResumen } from './resumen.js';
import { pintarSesiones } from './sesiones.js';

export { pintarDetalleEjercicio } from './ejercicios.js';

function crearConfiguracionPintado(opciones) {
  const modo = opciones && opciones.modo ? opciones.modo : 'interaccion';
  const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const permiteMovimiento = !reducirMovimiento;

  return {
    animarEntrada: permiteMovimiento && modo === 'inicial',
    animarConteos: permiteMovimiento && (modo === 'inicial' || modo === 'datos'),
    animarGraficas: permiteMovimiento && (modo === 'inicial' || modo === 'datos'),
    animarCambios: permiteMovimiento
      && (modo === 'inicial' || modo === 'datos' || modo === 'interaccion'),
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
