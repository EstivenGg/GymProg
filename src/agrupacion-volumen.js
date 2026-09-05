import { crearClaveSesion } from './datos.js';
import { calcularMetricasSesion, obtenerInicioDeSemana } from './metricas.js';
import { obtenerInicioDelDia, sumarDias } from './utilidades.js';

export const RUTINA_TODAS = 'todas';

export const AGRUPACIONES_VOLUMEN = [
  { clave: 'sesion', etiqueta: 'Sesión', descripcion: 'por sesión' },
  { clave: 'semana', etiqueta: 'Semana', descripcion: 'por semana' },
  { clave: 'mes', etiqueta: 'Mes', descripcion: 'por mes' }
];

export function obtenerAgrupacion(clave) {
  return AGRUPACIONES_VOLUMEN.find(function (agrupacion) {
    return agrupacion.clave === clave;
  }) || null;
}

export function filtrarSesionesPorRutina(sesiones, rutina) {
  if (!rutina || rutina === RUTINA_TODAS) {
    return sesiones.slice();
  }

  return sesiones.filter(function (sesion) {
    return sesion.titulo === rutina;
  });
}

function crearBloque(inicio, fin) {
  return {
    fecha: inicio,
    fin: fin,
    volumenLibras: 0,
    cantidadSesiones: 0,
    rutinas: [],
    claves: []
  };
}

// Una barra solo puede abrir un entrenamiento si representa exactamente uno.
function resolverClaveDelBloque(bloque) {
  return bloque.claves.length === 1 ? bloque.claves[0] : null;
}

// Un bloque hereda el color de la rutina solo si todas sus sesiones son de la
// misma: una semana que mezcla Empuje y Pierna no puede pintarse de ninguna de
// las dos sin mentir.
function resolverRutinaDelBloque(bloque) {
  const rutinasUnicas = Array.from(new Set(bloque.rutinas));

  return rutinasUnicas.length === 1 ? rutinasUnicas[0] : null;
}

function obtenerInicioDelMes(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
}

function obtenerFinDelMes(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
}

function calcularLimitesDelBloque(sesion, agrupacion) {
  if (agrupacion === 'semana') {
    const inicioSemana = obtenerInicioDeSemana(sesion.inicio);

    return { inicio: inicioSemana, fin: sumarDias(inicioSemana, 6) };
  }

  if (agrupacion === 'mes') {
    return {
      inicio: obtenerInicioDelMes(sesion.inicio),
      fin: obtenerFinDelMes(sesion.inicio)
    };
  }

  const inicioDia = obtenerInicioDelDia(sesion.inicio);

  return { inicio: inicioDia, fin: inicioDia };
}

function agruparEnBloques(sesiones, agrupacion) {
  const bloquesPorClave = new Map();

  sesiones.forEach(function (sesion) {
    const volumenLibras = calcularMetricasSesion(sesion).volumenLibras;

    if (volumenLibras <= 0) {
      return;
    }

    const limites = calcularLimitesDelBloque(sesion, agrupacion);
    const clave = limites.inicio.getTime();
    let bloque = bloquesPorClave.get(clave);

    if (!bloque) {
      bloque = crearBloque(limites.inicio, limites.fin);
      bloquesPorClave.set(clave, bloque);
    }

    bloque.volumenLibras += volumenLibras;
    bloque.cantidadSesiones += 1;
    bloque.rutinas.push(sesion.titulo);
    bloque.claves.push(crearClaveSesion(sesion.inicio, sesion.titulo));
  });

  return Array.from(bloquesPorClave.values());
}

export function agruparVolumen(sesiones, agrupacion) {
  if (agrupacion !== 'semana' && agrupacion !== 'mes') {
    return sesiones
      .map(function (sesion) {
        return {
          fecha: sesion.inicio,
          fin: sesion.inicio,
          volumenLibras: calcularMetricasSesion(sesion).volumenLibras,
          cantidadSesiones: 1,
          rutina: sesion.titulo,
          rutinas: [sesion.titulo],
          claveSesion: crearClaveSesion(sesion.inicio, sesion.titulo)
        };
      })
      .filter(function (punto) {
        return punto.volumenLibras > 0;
      })
      .sort(function (primerPunto, segundoPunto) {
        return primerPunto.fecha - segundoPunto.fecha;
      });
  }

  return agruparEnBloques(sesiones, agrupacion)
    .map(function (bloque) {
      return {
        fecha: bloque.fecha,
        fin: bloque.fin,
        volumenLibras: bloque.volumenLibras,
        cantidadSesiones: bloque.cantidadSesiones,
        rutina: resolverRutinaDelBloque(bloque),
        rutinas: Array.from(new Set(bloque.rutinas)),
        claveSesion: resolverClaveDelBloque(bloque)
      };
    })
    .sort(function (primerBloque, segundoBloque) {
      return primerBloque.fecha - segundoBloque.fecha;
    });
}

export function contarSesionesSinCarga(sesiones) {
  return sesiones.filter(function (sesion) {
    return calcularMetricasSesion(sesion).volumenLibras <= 0;
  }).length;
}
