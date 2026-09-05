import {
  identificarTipoDeArchivo,
  obtenerColumnasDelEncabezado
} from './analisis-importacion.js';
import { convertirCSVaObjetos } from './datos.js';

async function descargarArchivoCSV(rutaArchivo) {
  const respuestaArchivo = await fetch(rutaArchivo, {
    cache: 'no-store'
  });

  if (respuestaArchivo.ok) {
    return respuestaArchivo.text();
  }

  return '';
}

// No basta con que la descarga responda: algunos servidores estáticos
// devuelven la propia página con código 200 cuando el archivo no existe, y esa
// respuesta se interpretaría como un CSV vacío. Solo se acepta si el encabezado
// es de verdad un export de entrenamientos de Hevy.
function esCSVDeEntrenamientos(contenido) {
  if (!contenido.trim()) {
    return false;
  }

  const columnas = obtenerColumnasDelEncabezado(contenido);

  return identificarTipoDeArchivo('workout_data.csv', columnas) === 'entrenamiento'
    && columnas.has('start_time');
}

// Los CSV que viajan con el tablero: son el punto de partida cuando todavía no
// hay un historial guardado en el navegador. Publicado en internet lo normal es
// que no existan —los datos de entrenamiento son personales—, así que su
// ausencia devuelve null y no es un fallo: significa "empieza importando".
export async function leerFilasPublicadas() {
  const contenidoEntrenamientos = await descargarArchivoCSV(
    './data/workout_data.csv'
  );

  if (!esCSVDeEntrenamientos(contenidoEntrenamientos)) {
    return null;
  }

  const contenidoMediciones = await descargarArchivoCSV(
    './data/measurement_data.csv'
  );

  let filasMediciones = [];

  if (contenidoMediciones) {
    filasMediciones = convertirCSVaObjetos(contenidoMediciones);
  }

  return {
    filasEntrenamiento: convertirCSVaObjetos(contenidoEntrenamientos),
    filasMediciones: filasMediciones
  };
}
