# PrivateLife

## Vision

Una app personal para registrar y consultar tu vida en un solo lugar:

- anecdotas y recuerdos
- habitos y salud cotidiana
- peliculas, libros y series
- eventos importantes
- historial de lugares, personas y etapas
- notas libres y reflexiones

La idea no es hacer "otra app de notas", sino un archivo de vida personal consultable por fecha, tema, lugar, persona y tipo de evento.

## Enfoque recomendado

### 1. Local-first

Tu caso pide que los datos sean tuyos aunque no haya servidor.

Esto encaja con el enfoque `local-first`:

- la app funciona offline
- los datos viven primero en el dispositivo
- puedes exportar todo a JSON o Markdown
- la nube se usa solo para backup o sync opcional

Esto es mejor que depender desde el inicio de una app puramente server-side.

### 2. Web primero, APK despues

La mejor secuencia para tu caso:

1. construir una web app instalable (PWA)
2. hacer que funcione perfecto en movil
3. empaquetarla como APK con Capacitor cuando ya tenga forma

Asi no duplicas producto ni UI.

### 3. GitHub Pages solo sirve si la app es estatica

Si quieres usar la web que te da GitHub, el frontend debe poder publicarse como sitio estatico.

Eso significa:

- sin backend obligatorio para lo basico
- almacenamiento local en el navegador
- import/export manual al principio

Luego, si algun dia quieres sync real entre dispositivos, puedes agregar backend aparte sin romper lo anterior.

## Referencias utiles

### Ideas de producto y filosofia

- Quantified Self: comunidad historica de self-tracking e inspiracion de casos reales
- Anytype local-only: buen ejemplo de producto que prioriza datos locales
- Perfice: ejemplo open source de self-tracking local-first y empaquetado movil

### Tecnicas

- GitHub Pages: ideal para hosting estatico
- IndexedDB: base de datos del navegador para guardar bastante informacion offline
- Capacitor: permite convertir la web app en app Android

## Propuesta de producto

## Nombre interno

`PrivateLife`

## Objetivo principal

Poder responder preguntas como:

- que hice en tal fecha
- cuando vi cierta pelicula
- que estaba pasando en esa etapa de mi vida
- cuanto tiempo llevo con cierto habito
- que recuerdos tengo con cierta persona o en cierto lugar
- que cambios hubo en mi estado fisico o emocional

## Entidades principales

### 1. Entradas de vida

El bloque mas importante.

Campos:

- titulo
- descripcion
- fecha y hora opcional
- tipo: anecdota, evento, recuerdo, reflexion, logro, problema, viaje
- etiquetas
- personas relacionadas
- lugares relacionados
- archivos adjuntos opcionales
- nivel de importancia
- estado emocional opcional

### 2. Registros cuantitativos

Para cosas tipo Habitos:

- lavarse los dientes
- ejercicio
- ir al baño
- peso
- horas de sueño
- energia
- animo

Campos:

- categoria
- valor
- unidad
- fecha y hora
- notas opcionales

### 3. Consumos culturales

- peliculas
- libros
- series
- videojuegos
- musica o albums

Campos:

- titulo
- tipo
- fecha de inicio y fin
- estado: pendiente, en progreso, terminado, repetido
- rating personal
- notas
- etiquetas

### 4. Personas

Para vincular recuerdos y etapas.

Campos:

- nombre
- relacion
- fechas importantes
- notas

### 5. Lugares

Campos:

- nombre
- ciudad/pais
- tipo
- notas

### 6. Etapas de vida

Muy importante para que no sea solo una lista plana.

Ejemplos:

- secundaria
- universidad
- primer trabajo
- etapa en cierta ciudad
- relacion X

Cada etapa agrupa entradas, fotos, personas y habitos.

## Vistas clave

### 1. Timeline

La pantalla principal.

Una linea de tiempo unificada con:

- recuerdos
- habitos importantes
- peliculas/libros terminados
- hitos

### 2. Dashboard de hoy

- que paso hoy otros años
- habitos de hoy
- nota rapida
- estado del dia

### 3. Busqueda global

Necesitas poder buscar:

- texto libre
- por fecha
- por etiqueta
- por persona
- por lugar
- por tipo de contenido

### 4. Fichas de personas y lugares

Para ver "todo lo relacionado con".

### 5. Estadisticas

Sin obsesionarte con analytics complejos al inicio.

Solo cosas utiles:

- rachas
- frecuencia
- libros/peliculas por año
- resumen mensual

## MVP realista

Si quieres que esto salga de verdad, el MVP deberia tener solo esto:

1. timeline de entradas
2. captura rapida de recuerdo o nota
3. tracking simple de habitos/eventos repetibles
4. seccion de peliculas/libros
5. etiquetas
6. exportar e importar JSON
7. instalable en movil

No meter de entrada:

- sync multi-dispositivo complejo
- IA de resumen
- OCR
- reconocimiento de voz avanzado
- login
- backend pesado

## Stack recomendado

## Opcion recomendada

- `Next.js` con export estatico o `Vite + React`
- `TypeScript`
- `IndexedDB` para datos locales
- `Dexie` como capa comoda sobre IndexedDB
- `PWA` para instalar desde navegador
- `Capacitor` para generar APK Android despues
- `GitHub Pages` para hosting del frontend estatico

## Por que esta opcion

- rapido de construir
- usable en web y movil
- sin pagar servidor al principio
- compatible con crecimiento futuro
- puedes tener control total de tus datos

## Persistencia sugerida

### Fase 1

- IndexedDB local
- export/import manual en JSON

### Fase 2

- backup automatico a archivo
- opcion de exportar a Markdown

### Fase 3

- sync opcional con Supabase, Firebase o repositorio privado cifrado

## Estructura de informacion sugerida

Todo deberia girar alrededor de un `Entry` comun.

Ejemplo conceptual:

```ts
type EntryType =
  | "memory"
  | "habit"
  | "health"
  | "movie"
  | "book"
  | "event"
  | "note"
  | "milestone";

type Entry = {
  id: string;
  type: EntryType;
  title: string;
  content?: string;
  date: string;
  tags: string[];
  peopleIds?: string[];
  placeIds?: string[];
  metrics?: {
    value?: number;
    unit?: string;
  };
  meta?: Record<string, unknown>;
};
```

La ventaja es que tu timeline y tu buscador trabajan sobre una base comun.

## Importaciones que valen la pena

Si ya tienes datos en otras apps, conviene pensar importadores desde el inicio:

- CSV de Habitos
- listas de peliculas
- listas de libros
- exportaciones manuales de notas viejas

Aunque al principio sean scripts simples.

## Riesgos reales

### 1. Querer modelarlo todo demasiado pronto

Error comun: pasar meses diseñando categorias.

Solucion:

- usa pocas entidades
- deja campos flexibles
- refina con uso real

### 2. Depender demasiado de GitHub Pages

Pages esta bien para frontend estatico, pero no para un backend serio.

Hay que asumir eso desde el diseño.

### 3. Querer sincronizacion perfecta desde el dia uno

Eso complica mucho el proyecto.

Primero: un solo dispositivo o import/export.

## Roadmap

### Fase 0. Definicion

- decidir stack
- listar 10 a 20 casos de uso reales tuyos
- definir esquema minimo

### Fase 1. MVP

- app web responsive
- timeline
- formulario rapido de entradas
- tracker de habitos simple
- peliculas/libros
- IndexedDB
- export/import

### Fase 2. Movil

- mejorar experiencia tactil
- recordatorios locales
- empaquetado Android con Capacitor

### Fase 3. Inteligencia util

- resumen mensual
- busqueda semantica local o semi-local
- relacionar recuerdos por persona/lugar/epoca

## Siguiente paso recomendado

Antes de escribir mucho codigo, conviene hacer dos cosas:

1. definir con ejemplos reales que quieres guardar
2. levantar un primer esqueleto de app

Checklist inicial:

- 15 ejemplos de entradas reales tuyas
- 10 tipos de datos que quieres conservar
- 5 pantallas maximo para el MVP

## Fuentes

- GitHub Pages docs: https://docs.github.com/pages
- Capacitor docs: https://capacitorjs.com/docs/next
- MDN IndexedDB: https://developer.mozilla.org/es/docs/Glossary/IndexedDB
- Anytype local-only docs: https://doc.anytype.io/anytype-docs/advanced/data-and-security/self-hosting/local-only
- Quantified Self archive: https://quantifiedself.com/show-and-tell/
- Perfice (open source self-tracking): https://github.com/p0lloc/perfice
