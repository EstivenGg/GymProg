import { pintarSelectorEjercicios } from './ejercicios.js';
import { pintarProgreso } from './progreso.js';
import { pintarResumen } from './resumen.js';
import { pintarSesiones } from './sesiones.js';

export { pintarDetalleEjercicio } from './ejercicios.js';

export function pintarTableroCompleto() {
  pintarResumen();
  pintarProgreso();
  pintarSelectorEjercicios();
  pintarSesiones();
}
