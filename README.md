# Hevy Progress

Tablero visual para analizar exportaciones CSV de Hevy. JavaScript modular, Vite
y Chart.js, sin backend: el navegador lee los archivos, calcula las métricas y
guarda el historial en el propio dispositivo.

## Privacidad

Los CSV de entrenamiento son datos personales y **nunca se publican**. El
`.gitignore` excluye todos los `*.csv`, incluidos los de `public/data/`, así que
la copia publicada arranca vacía y pide importar. Lo que se importa se queda en
el `localStorage` del navegador de cada persona.

## Uso

Al abrir el tablero por primera vez aparece el diálogo de importación. Acepta:

- `workout_data.csv` (entrenamientos)
- `measurement_data.csv` (peso y % de grasa)

Cualquiera de los dos sirve por separado, en libras o en kilos. Antes de aplicar
nada muestra una vista previa con las sesiones nuevas, las que ya estaban y las
filas que no se pueden leer, y deja elegir entre añadir solo lo nuevo o
reemplazar. El historial importado sobrevive a las recargas.

Para trabajar en local con datos propios sin importarlos cada vez, se pueden
dejar los CSV en `public/data/`; el tablero los carga al arrancar y siguen fuera
del repositorio.

## Desarrollo

```powershell
npm.cmd install
npm.cmd run dev
```

Comprobaciones:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

Nota: `npm run preview` devuelve `index.html` cuando un archivo no existe, así
que no sirve para comprobar el comportamiento con 404 reales; GitHub Pages sí
responde 404.

## Publicación

`.github/workflows/deploy.yml` compila y publica en GitHub Pages en cada push a
`main`. En el repositorio hay que dejar **Settings → Pages → Source: GitHub
Actions**. `vite.config.js` usa `base: './'`, así que funciona igual en la raíz
de un dominio que en una subcarpeta `usuario.github.io/repositorio/`.

## Organización del código

Datos e importación:

- `src/datos.js`: lee el CSV y convierte filas en series y sesiones.
- `src/carga-inicial.js`: descarga los CSV publicados, si los hay.
- `src/analisis-importacion.js`: clasifica archivos y compara con lo ya cargado.
- `src/almacenamiento.js`: guarda y recupera el historial del navegador.
- `src/importacion.js`: vista previa, fusión y estado del diálogo.

Cálculo:

- `src/metricas.js`: volumen, duración, rachas y 1RM estimado.
- `src/metricas-ejercicio.js`: métricas por ejercicio y series temporales.
- `src/agrupacion-volumen.js`: volumen por sesión, semana o mes.
- `src/progresion.js`, `src/comparativas.js`, `src/constancia.js`: comparaciones
  entre periodos y constancia semanal.
- `src/esfuerzo.js`: RPE con la cobertura sobre la que se calcula.
- `src/ritmo.js`: ritmo por kilómetro cuando hay distancia y duración.
- `src/records-repeticiones.js`: marcas de ejercicios sin carga.
- `src/detalle-sesiones-ejercicio.js`: últimas sesiones de un ejercicio.
- `src/rutinas.js`: reparto de colores por rutina.

Interfaz:

- `src/app.js`: arranque.
- `src/interfaz.js`, `src/navegacion.js`: eventos, tema, filtros y navegación.
- `src/grafica-linea.js`: gráficas con Chart.js.
- `src/vistas/`: resumen, progreso, ejercicios y sesiones.
- `src/utilidades.js`: funciones compartidas.

## Métricas

- Entrenamientos, frecuencia semanal, duración y volumen.
- Volumen por sesión, semana o mes, con filtro por rutina y color por rutina.
- Peso corporal y % de grasa.
- Constancia de las últimas 12 semanas, separando semanas activas de semanas que
  alcanzan la meta.
- Récords estimados (1RM) y récords de repeticiones para ejercicios sin carga.
- RPE por ejercicio y por sesión, siempre indicando en cuántas series hay dato.
- Ritmo por kilómetro en ejercicios con distancia y duración.

El volumen excluye las series marcadas como calentamiento (`warmup`). El 1RM
estimado usa la fórmula de Epley: `peso × (1 + repeticiones / 30)`.
