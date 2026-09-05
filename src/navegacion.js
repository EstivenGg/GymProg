const SECCIONES = ['resumen', 'progreso', 'ejercicios', 'sesiones'];

export function cambiarSeccion(seccionSolicitada, opciones) {
  const configuracion = opciones || {};
  let seccionActiva = 'resumen';

  if (SECCIONES.includes(seccionSolicitada)) {
    seccionActiva = seccionSolicitada;
  }

  const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const vistaAnterior = document.querySelector('.view.active');
  const cambiaVista = !vistaAnterior || vistaAnterior.id !== seccionActiva;

  function actualizarVista() {
    document.querySelectorAll('.view').forEach(function (vista) {
      vista.classList.toggle('active', vista.id === seccionActiva);
    });

    document.querySelectorAll('.nav-item').forEach(function (enlaceNavegacion) {
      const correspondeASeccion = enlaceNavegacion.dataset.section === seccionActiva;
      enlaceNavegacion.classList.toggle('active', correspondeASeccion);
    });
  }

  const puedeUsarTransicion = cambiaVista
    && !configuracion.inmediato
    && !reducirMovimiento
    && typeof document.startViewTransition === 'function';

  // Con transición de vistas el DOM cambia dentro de una llamada asíncrona, así
  // que quien salta a un elemento concreto tiene que esperar a que exista.
  let vistaActualizada = Promise.resolve();

  if (puedeUsarTransicion) {
    vistaActualizada = document.startViewTransition(actualizarVista)
      .updateCallbackDone
      .catch(function () {
        return undefined;
      });
  } else {
    actualizarVista();
  }

  // Saltar desde una gráfica a una sesión concreta no debe empezar por subir
  // al principio de la página: el destino es el elemento, no la sección.
  if (!configuracion.conservarDesplazamiento) {
    const comportamiento = configuracion.inmediato || reducirMovimiento
      ? 'auto'
      : 'smooth';

    window.scrollTo({ top: 0, behavior: comportamiento });
  }

  return vistaActualizada;
}


// Al saltar desde una gráfica o una tabla, la vista de destino ya está pintada:
// solo hay que llevar el elemento a la pantalla y darle el foco para que quien
// navegue con teclado siga donde miró.
export function desplazarHastaElemento(elemento, opciones) {
  const configuracion = opciones || {};
  const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;

  elemento.scrollIntoView({
    behavior: reducirMovimiento ? 'auto' : 'smooth',
    block: configuracion.bloque || 'center'
  });

  if (configuracion.enfocar) {
    elemento.focus({ preventScroll: true });
  }
}

export function resaltarElemento(elemento) {
  elemento.classList.remove('is-highlighted');
  elemento.getBoundingClientRect();
  elemento.classList.add('is-highlighted');

  setTimeout(function () {
    elemento.classList.remove('is-highlighted');
  }, 1_000);
}
