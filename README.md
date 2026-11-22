# PrivateLife

Un segundo cerebro personal. Registrá hábitos, biblioteca, escritos, hitos y más — todo en una sola app, privada y tuya.

> Para el tutorial completo de instalación paso a paso, descargá [`tutorial.pdf`](./tutorial.pdf).

---

## Qué incluye

| Sección | Descripción |
|---|---|
| Hoy | Inicio: hábitos del día, resumen de Salud, «En este día» y lo último cargado |
| Registro | Lo que hiciste cada día (bueno, malo o juegos): última vez, cada cuánto y un mapa de calor por año |
| Biblioteca | Películas, series, libros, anime, manga y videojuegos — con tapa, rating, géneros y filtros |
| Mi vida | Hitos (con fecha de inicio y fin, y un gráfico de períodos), textos y recuerdos en una línea de tiempo |
| Salud | Comidas, movimiento y peso leídos de una planilla de Google (vía Apps Script + edge function `salud`) |

- **Agregar (+):** botón flotante en el celular y en el menú lateral en escritorio. Formularios cortos para texto, recuerdo e hito; para la biblioteca abre el formulario con búsqueda de tapa.
- **Buscar:** lupa arriba (o `Ctrl+K`). Busca en todo menos los registros de hábitos, salvo que elijas ese filtro.
- **Ajustes:** ícono de engranaje. Exportar/importar datos y configurar la app.

### Biblioteca

- Tipos: Película, Serie, Libro, Anime, Manga, Videojuego
- Tapas: botón **Buscar** en el formulario que completa tapa, año y géneros sugeridos (TMDB, AniList, Open Library y Steam); todo sigue siendo editable a mano
- Vista de tapas (grilla) o lista; tocar una tapa abre su ficha con Editar y Eliminar
- Filtros por tipo, género, rating (8+, 9+, 10)
- Orden: más reciente, más antigua, nota ↓, nota ↑
- Búsqueda por nombre

### Personalización (desde Ajustes)

- Renombrá o ocultá cualquier sección del menú lateral
- Renombrá o desactivá tipos de la biblioteca
- La config se guarda localmente y persiste entre visitas

---

## Stack

| | |
|---|---|
| Framework | Next.js 16 + React 19 + TypeScript |
| Estilos | Tailwind CSS 4 |
| Base de datos | Supabase (PostgreSQL + Auth) |
| Mobile | Capacitor (Android) |

---

## Instalación rápida

### Requisitos

- Node.js 18+
- Una cuenta en [Supabase](https://supabase.com) (gratuita)

### 1. Clonar e instalar

```bash
git clone https://github.com/Mathwhiz/PrivateLife.git
cd PrivateLife/web
npm install
```

### 2. Configurar Supabase

1. Crear un nuevo proyecto en [supabase.com](https://supabase.com)
2. **SQL Editor → New query** → pegar y ejecutar `web/supabase/schema.sql`
3. **SQL Editor → New query** → pegar y ejecutar `web/supabase/rls.sql`
4. **Authentication → Users → Add user** → crear tu usuario (email y contraseña)
5. **SQL Editor** → habilitarte como dueño (sin esto la base no te devuelve nada):
   ```sql
   INSERT INTO public.private_life_owners (user_id)
   SELECT id FROM auth.users WHERE email = 'tu@email.com';
   ```
6. **Authentication → Sign In / Providers** → desactivar *Allow new users to sign up*

### 3. Credenciales

Crear el archivo `web/.env.local` (nunca se sube al repo):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Los valores están en tu proyecto de Supabase → **Settings → API**.

### 4. Correr

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000) e iniciar sesión.

### 5. Tapas automáticas (opcional)

El buscador de tapas corre en una Edge Function de Supabase, así el token de TMDB nunca llega al navegador. Con la [CLI de Supabase](https://supabase.com/docs/guides/cli) vinculada al proyecto, desde `web/`:

```bash
npx supabase functions deploy metadatos --no-verify-jwt
npx supabase secrets set TMDB_TOKEN=<API Read Access Token de TMDB>
```

El token se saca gratis en [themoviedb.org](https://www.themoviedb.org/settings/api). Sin él, la búsqueda de películas y series no anda; anime, manga, libros y juegos no necesitan cuenta. La función solo responde a sesiones iniciadas (valida el JWT por su cuenta, por eso `--no-verify-jwt`).

---

## Seguridad

- Sin credenciales hardcodeadas en el repositorio
- `.env.local` está en `.gitignore`
- RLS activo: sólo los usuarios de `private_life_owners` leen o escriben; cualquier otra sesión no ve nada
- Registro público desactivado: las cuentas se crean a mano desde Supabase
- Autenticación con email y contraseña vía Supabase Auth
- Claves de APIs externas (TMDB) como secrets de Supabase, nunca en el bundle

---

## Scripts

```bash
npm run dev                              # Servidor de desarrollo
npm run dev:sandbox                      # Igual pero sin Supabase ni login (localhost:3001), para probar la interfaz
npm run build                           # Build de producción
node scripts/generate-icons.mjs         # Regenerar íconos Android + PWA
node scripts/generate-tutorial-pdf.mjs  # Regenerar tutorial PDF
```
