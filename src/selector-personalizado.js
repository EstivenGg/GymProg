import { normalizarTexto, obtenerElemento } from './utilidades.js';

const selectoresRegistrados = [];

function marcarOpcionActiva(seleccion, opcionElemento) {
  Array.from(seleccion.lista.children).forEach(function (opcion) {
    opcion.classList.remove('is-active');
  });

  seleccion.opcionActivaId = null;

  if (!opcionElemento) {
    return;
  }

  opcionElemento.classList.add('is-active');
  opcionElemento.scrollIntoView({ block: 'nearest' });
  seleccion.opcionActivaId = opcionElemento.id;
}

function actualizarEstadoSeleccionado(seleccion) {
  const opcionSeleccionadaNativa = seleccion.select.options[seleccion.select.selectedIndex];
  seleccion.valorVisible.textContent = opcionSeleccionadaNativa
    ? opcionSeleccionadaNativa.textContent
    : '';

  Array.from(seleccion.lista.children).forEach(function (opcionElemento) {
    const esSeleccionada = opcionElemento.dataset.valor === seleccion.select.value;
    opcionElemento.classList.toggle('is-selected', esSeleccionada);
    opcionElemento.setAttribute('aria-pressed', esSeleccionada ? 'true' : 'false');
  });
}

function seleccionarValor(seleccion, valor) {
  const valorAnterior = seleccion.select.value;
  seleccion.select.value = valor;
  actualizarEstadoSeleccionado(seleccion);
  cerrarSelector(seleccion);
  seleccion.boton.focus();

  if (seleccion.select.value !== valorAnterior) {
    seleccion.select.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function reconstruirOpciones(seleccion) {
  const fragmento = document.createDocumentFragment();

  Array.from(seleccion.select.options).forEach(function (opcionNativa, indice) {
    const opcionElemento = document.createElement('button');
    opcionElemento.type = 'button';
    opcionElemento.className = 'custom-select-option';
    opcionElemento.id = seleccion.idBase + '-opcion-' + indice;
    opcionElemento.textContent = opcionNativa.textContent;
    opcionElemento.dataset.valor = opcionNativa.value;

    opcionElemento.addEventListener('click', function () {
      seleccionarValor(seleccion, opcionNativa.value);
    });

    opcionElemento.addEventListener('mousemove', function () {
      if (seleccion.opcionActivaId !== opcionElemento.id) {
        marcarOpcionActiva(seleccion, opcionElemento);
      }
    });

    fragmento.appendChild(opcionElemento);
  });

  seleccion.lista.replaceChildren(fragmento);
}

function sincronizarSelector(seleccion) {
  reconstruirOpciones(seleccion);
  actualizarEstadoSeleccionado(seleccion);
  filtrarOpciones(seleccion);
}

function cerrarSelector(seleccion) {
  seleccion.contenedor.classList.remove('open');
  seleccion.boton.setAttribute('aria-expanded', 'false');
  seleccion.opcionActivaId = null;
}

function cerrarOtrosSelectores(seleccionActual) {
  selectoresRegistrados.forEach(function (seleccion) {
    if (seleccion !== seleccionActual) {
      cerrarSelector(seleccion);
    }
  });
}

function filtrarOpciones(seleccion) {
  if (!seleccion.buscador) {
    return;
  }

  const termino = normalizarTexto(seleccion.buscador.value.trim());
  let cantidadVisible = 0;

  Array.from(seleccion.lista.children).forEach(function (opcion) {
    const coincide = normalizarTexto(opcion.textContent).includes(termino);

    opcion.hidden = !coincide;
    if (coincide) {
      cantidadVisible += 1;
    }
  });

  if (seleccion.mensajeVacio) {
    seleccion.mensajeVacio.hidden = cantidadVisible > 0;
  }

  const opcionSeleccionadaVisible = seleccion.lista.querySelector(
    '.is-selected:not([hidden])'
  );
  const primeraOpcionVisible = Array.from(seleccion.lista.children).find(function (opcion) {
    return !opcion.hidden;
  });

  marcarOpcionActiva(
    seleccion,
    opcionSeleccionadaVisible || primeraOpcionVisible || null
  );
}

function abrirSelector(seleccion) {
  if (seleccion.lista.children.length === 0) {
    return;
  }

  cerrarOtrosSelectores(seleccion);
  seleccion.contenedor.classList.add('open');
  seleccion.boton.setAttribute('aria-expanded', 'true');

  if (seleccion.buscador) {
    seleccion.buscador.value = '';
    filtrarOpciones(seleccion);
  }

  const opcionSeleccionada = seleccion.lista.querySelector('.is-selected:not([hidden])')
    || Array.from(seleccion.lista.children).find(function (opcion) {
      return !opcion.hidden;
    });

  marcarOpcionActiva(seleccion, opcionSeleccionada);

  if (seleccion.buscador) {
    seleccion.buscador.focus({ preventScroll: true });
  } else {
    opcionSeleccionada.focus({ preventScroll: true });
  }
}

function moverOpcionActiva(seleccion, delta) {
  const opciones = Array.from(seleccion.lista.children).filter(function (opcion) {
    return !opcion.hidden;
  });

  if (opciones.length === 0) {
    return;
  }

  const indiceActual = opciones.findIndex(function (opcion) {
    return opcion.id === seleccion.opcionActivaId;
  });

  const siguienteIndice = Math.max(0, Math.min(opciones.length - 1, indiceActual + delta));
  marcarOpcionActiva(seleccion, opciones[siguienteIndice]);

  if (document.activeElement !== seleccion.buscador) {
    opciones[siguienteIndice].focus({ preventScroll: true });
  }
}

function manejarClicBoton(seleccion) {
  const estaAbierto = seleccion.contenedor.classList.contains('open');

  if (estaAbierto) {
    cerrarSelector(seleccion);
  } else {
    abrirSelector(seleccion);
  }
}

function manejarTecladoBoton(seleccion, evento) {
  if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(evento.key)) {
    evento.preventDefault();
    abrirSelector(seleccion);
  }
}

function manejarTecladoLista(seleccion, evento) {
  const opcionesVisibles = Array.from(seleccion.lista.children).filter(function (opcion) {
    return !opcion.hidden;
  });

  if (evento.key === 'ArrowDown') {
    evento.preventDefault();
    moverOpcionActiva(seleccion, 1);
  } else if (evento.key === 'ArrowUp') {
    evento.preventDefault();
    moverOpcionActiva(seleccion, -1);
  } else if (evento.key === 'Home') {
    evento.preventDefault();
    marcarOpcionActiva(seleccion, opcionesVisibles[0]);
    opcionesVisibles[0]?.focus({ preventScroll: true });
  } else if (evento.key === 'End') {
    evento.preventDefault();
    const ultimaOpcion = opcionesVisibles.at(-1);
    marcarOpcionActiva(seleccion, ultimaOpcion);
    ultimaOpcion?.focus({ preventScroll: true });
  } else if (evento.key === 'Enter' || evento.key === ' ') {
    evento.preventDefault();
    const opcionActiva = obtenerElemento(seleccion.opcionActivaId);

    if (opcionActiva) {
      seleccionarValor(seleccion, opcionActiva.dataset.valor);
    }
  } else if (evento.key === 'Escape') {
    evento.preventDefault();
    cerrarSelector(seleccion);
    seleccion.boton.focus();
  } else if (evento.key === 'Tab') {
    cerrarSelector(seleccion);
  }
}

function manejarTecladoBuscador(seleccion, evento) {
  if (evento.key === 'ArrowDown') {
    evento.preventDefault();
    moverOpcionActiva(seleccion, 1);
  } else if (evento.key === 'ArrowUp') {
    evento.preventDefault();
    moverOpcionActiva(seleccion, -1);
  } else if (evento.key === 'Enter') {
    evento.preventDefault();
    const opcionActiva = obtenerElemento(seleccion.opcionActivaId);

    if (opcionActiva && !opcionActiva.hidden) {
      seleccionarValor(seleccion, opcionActiva.dataset.valor);
    }
  } else if (evento.key === 'Escape') {
    evento.preventDefault();
    cerrarSelector(seleccion);
    seleccion.boton.focus();
  }
}

function manejarClicFueraDelSelector(evento) {
  selectoresRegistrados.forEach(function (seleccion) {
    if (!seleccion.contenedor.contains(evento.target)) {
      cerrarSelector(seleccion);
    }
  });
}

function crearSelectorPersonalizado(idSelectNativo) {
  const select = obtenerElemento(idSelectNativo);
  const contenedor = select.closest('.custom-select');
  const boton = contenedor.querySelector('.custom-select-trigger');
  const lista = contenedor.querySelector('.custom-select-list');
  const valorVisible = boton.querySelector('.custom-select-value');
  const buscador = contenedor.querySelector('.custom-select-search input');
  const mensajeVacio = contenedor.querySelector('.custom-select-empty');

  const seleccion = {
    select: select,
    contenedor: contenedor,
    boton: boton,
    lista: lista,
    valorVisible: valorVisible,
    buscador: buscador,
    mensajeVacio: mensajeVacio,
    idBase: idSelectNativo,
    opcionActivaId: null
  };

  boton.addEventListener('click', function () {
    manejarClicBoton(seleccion);
  });

  boton.addEventListener('keydown', function (evento) {
    manejarTecladoBoton(seleccion, evento);
  });

  lista.addEventListener('keydown', function (evento) {
    manejarTecladoLista(seleccion, evento);
  });

  if (buscador) {
    buscador.addEventListener('input', function () {
      filtrarOpciones(seleccion);
    });
    buscador.addEventListener('keydown', function (evento) {
      manejarTecladoBuscador(seleccion, evento);
    });
  }

  new MutationObserver(function () {
    sincronizarSelector(seleccion);
  }).observe(select, { childList: true });

  sincronizarSelector(seleccion);
  selectoresRegistrados.push(seleccion);
}

export function inicializarSelectoresPersonalizados() {
  crearSelectorPersonalizado('periodSelect');
  crearSelectorPersonalizado('exerciseSelect');
  crearSelectorPersonalizado('routineSelect');

  document.addEventListener('click', manejarClicFueraDelSelector);
}

export function establecerValorSelector(idSelectNativo, valor) {
  const seleccion = selectoresRegistrados.find(function (selectorRegistrado) {
    return selectorRegistrado.select.id === idSelectNativo;
  });

  if (!seleccion) {
    return false;
  }

  const existeOpcion = Array.from(seleccion.select.options).some(function (opcion) {
    return opcion.value === valor;
  });

  if (!existeOpcion) {
    return false;
  }

  const valorAnterior = seleccion.select.value;
  seleccion.select.value = valor;
  actualizarEstadoSeleccionado(seleccion);
  cerrarSelector(seleccion);

  if (valor !== valorAnterior) {
    seleccion.select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  return true;
}
