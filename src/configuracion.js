export const INDICES_MESES = {
  ene: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dic: 11
};

export const NOMBRES_DIAS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado'
];

export const MILISEGUNDOS_POR_DIA = 86_400_000;
export const DIAS_DEL_CALENDARIO = 365;
export const CANTIDAD_SEMANAS_CONSTANCIA = 12;
export const LIBRAS_POR_KILOGRAMO = 2.2046226218;

export const estadoAplicacion = {
  todasLasSeries: [],
  mediciones: [],
  sesiones: [],
  seriesFiltradas: [],
  sesionesFiltradas: [],
  fechaMasReciente: new Date(),
  periodoSeleccionado: 'all',
  unidadPeso: 'lb',
  origenDatos: { tipo: 'publicado', guardadoEn: null }
};

export const formatoNumero = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 1
});

export const formatoNumeroCompacto = new Intl.NumberFormat('es-CO', {
  notation: 'compact',
  maximumFractionDigits: 1
});

export const formatoFechaCompleta = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});

export const formatoFechaCorta = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short'
});

export function establecerUnidadPeso(unidad) {
  estadoAplicacion.unidadPeso = unidad === 'kg' ? 'kg' : 'lb';
}

export function obtenerUnidadPeso() {
  return estadoAplicacion.unidadPeso;
}

export function convertirLibrasAUnidad(valorLibras) {
  if (estadoAplicacion.unidadPeso === 'kg') {
    return valorLibras / LIBRAS_POR_KILOGRAMO;
  }

  return valorLibras;
}

export function formatearCarga(valorLibras, compacto) {
  const formateador = compacto ? formatoNumeroCompacto : formatoNumero;

  return formateador.format(convertirLibrasAUnidad(valorLibras))
    + ' '
    + obtenerUnidadPeso();
}
