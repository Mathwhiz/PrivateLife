# Estado de PrivateLife

## Resumen

`PrivateLife` es una app personal pensada como un segundo cerebro propio:

- recuerdos
- anecdotas
- habitos
- peliculas
- libros
- notas
- historial personal consultable

La idea central es que toda esa informacion viva en un sistema unificado, simple de usar y controlado por ti.

## Vision del producto

La app busca responder preguntas como:

- que hice en cierta fecha
- cuando vi una pelicula o termine un libro
- que estaba pasando en una etapa concreta de mi vida
- que recuerdos tengo ligados a cierta etiqueta o tema
- que habitos sostuve o rompi en cierto periodo

No pretende ser solo una app de notas. La direccion correcta es un archivo de vida personal con timeline, captura rapida y busqueda.

## Enfoque tecnico elegido

### Principios

- `local-first`
- `web primero`
- `publicable en GitHub Pages`
- `base reutilizable para APK mas adelante`

### Motivo

Este enfoque permite:

- no depender de backend en el MVP
- conservar los datos localmente en el navegador
- publicar una version funcional como web estatica
- convertir la misma app en una app movil mas adelante

## Stack actual

En [web/package.json](E:\PrivateLife\web\package.json):

- `Next.js 16`
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`

### Hosting previsto

- `GitHub Pages`

### Persistencia actual

- `localStorage` del navegador

Esto es una solucion inicial simple. Mas adelante se puede migrar a `IndexedDB` para mas volumen y mejor estructura local.

## Estado actual de la app

La app ya no es una landing estatica. Ahora funciona como un MVP usable.

### Ya implementado

#### 1. Modelo de datos unificado

En [types.ts](E:\PrivateLife\web\src\lib\types.ts):

- `EntryType`
- `LifeEntry`
- etiquetas por tipo
- datos iniciales
- lista de habitos rapidos

Tipos actuales:

- `memory`
- `habit`
- `movie`
- `book`
- `note`

#### 2. Aplicacion principal interactiva

En [private-life-app.tsx](E:\PrivateLife\web\src\components\private-life-app.tsx):

- formulario para crear entradas
- timeline comun para todos los tipos
- filtros por tipo
- busqueda por texto
- filtro por etiquetas
- contadores por categoria
- persistencia local

#### 3. Captura rapida

La app deja crear una entrada con:

- tipo
- fecha
- titulo
- contenido
- etiquetas

#### 4. Habitos rapidos

Hay botones para crear registros inmediatos de:

- cepillado
- ejercicio fisico
- lectura
- orden/tareas personales

Estos botones generan entradas de tipo `habit` automaticamente en la fecha actual.

#### 5. Exportacion e importacion

Ya existe backup manual en JSON:

- `Exportar JSON`
- `Importar JSON`

Esto permite no depender del navegador para siempre y da una base real para conservar tus datos.

#### 6. UI base propia

La interfaz ya tiene una direccion visual definida:

- tonos calidos
- tarjetas tipo glass/paper
- layout responsive
- enfoque mobile-friendly desde el principio

Archivos principales:

- [page.tsx](E:\PrivateLife\web\src\app\page.tsx)
- [globals.css](E:\PrivateLife\web\src\app\globals.css)
- [layout.tsx](E:\PrivateLife\web\src\app\layout.tsx)

## Validacion tecnica

La app pasa:

- `npm run lint`
- `npm run build`

La exportacion estatica tambien esta preparada para GitHub Pages.

## GitHub Pages

Existe workflow en:

- [deploy-pages.yml](E:\PrivateLife\.github\workflows\deploy-pages.yml)

Y configuracion de export estatico en:

- [next.config.ts](E:\PrivateLife\web\next.config.ts)

### Importante

Para que GitHub Pages funcione, el repo debe tener Pages habilitado en:

- `Settings > Pages`
- `Source: GitHub Actions`

Si el repo sigue siendo privado, puede haber restricciones segun el plan de GitHub.

## Estructura actual del proyecto

### Raiz

- [plan-segundo-cerebro.md](E:\PrivateLife\plan-segundo-cerebro.md)
- [estado-proyecto.md](E:\PrivateLife\estado-proyecto.md)
- [.github/workflows/deploy-pages.yml](E:\PrivateLife\.github\workflows\deploy-pages.yml)
- [.gitignore](E:\PrivateLife\.gitignore)

### App web

- [web/src/app/page.tsx](E:\PrivateLife\web\src\app\page.tsx)
- [web/src/app/layout.tsx](E:\PrivateLife\web\src\app\layout.tsx)
- [web/src/app/globals.css](E:\PrivateLife\web\src\app\globals.css)
- [web/src/components/private-life-app.tsx](E:\PrivateLife\web\src\components\private-life-app.tsx)
- [web/src/lib/types.ts](E:\PrivateLife\web\src\lib\types.ts)

## Decisiones que se tomaron

### 1. No meter backend todavia

Correcto para esta fase porque:

- reduce friccion
- permite publicar rapido
- mantiene el MVP simple

### 2. Unificar todo en entradas

En vez de separar demasiado pronto cada modulo, se usa un modelo comun de entrada.

Ventajas:

- timeline unico
- filtros y busqueda mas simples
- menos complejidad inicial

### 3. Priorizar uso real sobre arquitectura perfecta

Primero hace falta poder:

- guardar cosas
- encontrarlas
- conservarlas

Luego se sofisticara el sistema.

## Limites actuales

Todavia faltan varias cosas importantes:

- persistencia mas robusta con `IndexedDB`
- eliminacion y edicion de entradas
- modulos reales para peliculas/libros con campos dedicados
- trackers de habitos con rachas y estadisticas
- personas, lugares y etapas
- busqueda mas rica
- PWA completa
- empaquetado APK con Capacitor

## Siguiente roadmap recomendado

### Fase inmediata

1. editar y borrar entradas
2. mejorar import/export
3. migrar de `localStorage` a `IndexedDB`
4. añadir vista de estadisticas simples

### Fase producto

1. modulo de habitos con checks diarios
2. modulo de peliculas/libros con fecha y rating
3. etiquetas mejoradas
4. timeline mas rico

### Fase movil

1. convertir en PWA instalable
2. añadir iconos y manifest
3. soporte offline mas claro
4. empaquetar APK con Capacitor

## Como arrancar localmente

Desde [web](E:\PrivateLife\web):

```powershell
npm install
npm run dev
```

Para build:

```powershell
npm run build
```

Para Pages:

```powershell
$env:GITHUB_PAGES='true'
npm run build
```

## Estado general

Ahora mismo `PrivateLife` ya es una base real y no solo una idea:

- tiene stack definido
- tiene UI propia
- tiene modelo de datos
- guarda entradas reales
- permite buscar
- permite hacer backup

La siguiente mejora importante ya no es "hacer una app", sino empezar a convertirla en tu sistema personal de verdad.
