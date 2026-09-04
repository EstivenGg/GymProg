# Hevy Progress

Tablero visual para analizar exportaciones CSV de Hevy. Está construido con JavaScript modular, Vite y Chart.js. No necesita backend: el navegador carga los archivos y calcula las métricas.

## Estado actual

La prioridad es terminar y revisar la aplicación localmente. El proyecto todavía no necesita un repositorio Git ni está publicado.

El ZIP antiguo se conserva como referencia, pero ya no forma parte de la compilación ni se vuelve a generar.

## Datos utilizados

La aplicación busca estos archivos:

- `public/data/workout_data.csv`
- `public/data/measurement_data.csv`

El archivo de entrenamientos es obligatorio. El de mediciones es opcional. Si el primero no existe o no puede leerse, el tablero abre el diálogo para importar archivos manualmente.

> Importante: cuando el proyecto se publique en GitHub Pages, cualquier CSV guardado dentro de `public/data/` podrá descargarse desde internet. Antes de publicar hay que decidir si se mostrarán datos reales, datos de demostración o solamente la importación manual.

## Desarrollo local

```powershell
npm.cmd install
npm.cmd run dev
```

Vite mostrará una dirección local que se abre en el navegador. Los cambios del código se actualizan durante el desarrollo.

Comandos de validación:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

## Organización del código

- `src/app.js`: inicia la aplicación y carga los CSV publicados.
- `src/datos.js`: interpreta el CSV y prepara el estado.
- `src/metricas.js`: calcula volumen, duración, rachas y 1RM estimado.
- `src/grafica-linea.js`: crea las gráficas con Chart.js.
- `src/importacion.js`: procesa los archivos elegidos por la persona.
- `src/interfaz.js`: conecta navegación, tema, filtros y eventos.
- `src/vistas/`: pinta resumen, progreso, ejercicios y sesiones.
- `src/utilidades.js`: contiene funciones compartidas y pequeñas.

## Métricas

- Entrenamientos, frecuencia semanal, duración y volumen total.
- Volumen por sesión y evolución del peso corporal.
- Constancia de las últimas 12 semanas y calendario de actividad.
- Ejercicios más trabajados y récords estimados.
- Evolución individual por ejercicio.
- Historial desplegable de sesiones y series.

El volumen excluye las series marcadas como calentamiento (`warmup`). El 1RM estimado usa la fórmula de Epley: `peso × (1 + repeticiones / 30)`.

## Publicación futura

El proyecto ya tiene una configuración estática compatible con GitHub Pages, pero no es necesario inicializar Git ni publicar hasta que la interfaz y las métricas estén terminadas y aprobadas.
