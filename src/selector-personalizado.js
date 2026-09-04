import { obtenerElemento } from './utilidades.js';

const selectoresRegistrados = [];

function marcarOpcionActiva(seleccion, opcionElemento) {
  Array.from(seleccion.lista.children).forEach(function (opcion) {
    opcion.classList.remove('is-active');
  });

  seleccion.opcionActivaId = null;

  if (!opcionElemento) {
    seleccion.lista.removeAttribute('aria-activedescendant');
    return;
  }

  opcionElemento.classList.add('is-active');
  opcionElemento.scrollIntoView({ block: 'nearest' });
  seleccion.opcionActivaId = opcionElemento.id;
  seleccion.lista.setAttribute('aria-activedescendant', opcionElemento.id);
}

function actualizarEstadoSeleccionado(seleccion) {
  const opcionSeleccionadaNativa = seleccion.select.options[seleccion.select.selectedIndex];
  seleccion.valorVisible.textContent = opcionSeleccionadaNativa
    ? opcionSeleccionadaNativa.textContent
    : '';

  Array.from(seleccion.lista.children).forEach(function (opcionElemento) {
    const esSeleccionada = opcionElemento.dataset.valor === seleccion.select.value;
    opcionElemento.classList.toggle('is-selected', esSeleccionada);
    opcionElemento.setAttribute('aria-selected', esSeleccionada ? 'true' : 'false');
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
    const opcionElemento = document.createElement('li');
    opcionElemento.className = 'custom-select-option';
    opcionElemento.id = seleccion.idBase + '-opcion-' + indice;
    opcionElemento.setAttribute('role', 'option');
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
}

function cerrarSelector(seleccion) {
  seleccion.contenedor.classList.remove('open');
  seleccion.boton.setAttribute('aria-expanded', 'false');
  seleccion.lista.removeAttribute('aria-activedescendant');
  seleccion.opcionActivaId = null;
}

function cerrarOtrosSelectores(seleccionActual) {
  selectoresRegistrados.forEach(function (seleccion) {
    if (seleccion !== seleccionActual) {
      cerrarSelector(seleccion);
    }
  });
}

function abrirSelector(seleccion) {
  if (seleccion.lista.children.length === 0) {
    return;
  }

  cerrarOtrosSelectores(seleccion);
  seleccion.contenedor.classList.add('open');
  seleccion.boton.setAttribute('aria-expanded', 'true');

  const opcionSeleccionada = seleccion.lista.querySelector('.is-selected')
    || seleccion.lista.firstElementChild;

  marcarOpcionActiva(seleccion, opcionSeleccionada);
  seleccion.lista.focus({ preventScroll: true });
}

function moverOpcionActiva(seleccion, delta) {
  const opciones = Array.from(seleccion.lista.children);

  if (opciones.length === 0) {
    return;
  }

  const indiceActual = opciones.findIndex(function (opcion) {
    return opcion.id === seleccion.opcionActivaId;
  });

  const siguienteIndice = Math.max(0, Math.min(opciones.length - 1, indiceActual + delta));
  marcarOpcionActiva(seleccion, opciones[siguienteIndice]);
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
  if (evento.key === 'ArrowDown') {
    evento.preventDefault();
    moverOpcionActiva(seleccion, 1);
  } else if (evento.key === 'ArrowUp') {
    evento.preventDefault();
    moverOpcionActiva(seleccion, -1);
  } else if (evento.key === 'Home') {
    evento.preventDefault();
    marcarOpcionActiva(seleccion, seleccion.lista.firstElementChild);
  } else if (evento.key === 'End') {
    evento.preventDefault();
    marcarOpcionActiva(seleccion, seleccion.lista.lastElementChild);
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

  const seleccion = {
    select: select,
    contenedor: contenedor,
    boton: boton,
    lista: lista,
    valorVisible: valorVisible,
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

  new MutationObserver(function () {
    sincronizarSelector(seleccion);
  }).observe(select, { childList: true });

  sincronizarSelector(seleccion);
  selectoresRegistrados.push(seleccion);
}

export function inicializarSelectoresPersonalizados() {
  crearSelectorPersonalizado('periodSelect');
  crearSelectorPersonalizado('exerciseSelect');

  document.addEventListener('click', manejarClicFueraDelSelector);
}
