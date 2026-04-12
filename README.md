# PrivateLife

Un segundo cerebro personal. Registrá hábitos, biblioteca, escritos, hitos y más — todo en una sola app, privada y tuya.

> Para el tutorial completo de instalación paso a paso, descargá [`tutorial.pdf`](./tutorial.pdf).

---

## Qué incluye

| Sección | Descripción |
|---|---|
| Hábitos | Tracker diario con checklist, historial y estadísticas |
| Biblioteca | Películas, series, libros, anime, manga — con rating, géneros y filtros |
| Textos | Escritos personales: pensamientos, filosofía, anécdotas |
| Hitos | Momentos importantes con fecha y contexto |
| Archivo | Vista global de todas las entradas |
| Ajustes | Exportar/importar datos, configurar la app |

### Biblioteca

- Tipos: Película, Serie, Libro, Anime, Manga
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
4. **Authentication → Users → Add user** → crear tu usuario (email + contraseña)

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

---

## Seguridad

- Sin credenciales hardcodeadas en el repositorio
- `.env.local` está en `.gitignore`
- RLS activo: sin sesión iniciada, la base de datos no devuelve nada
- Autenticación con email + contraseña via Supabase Auth

---

## Scripts

```bash
npm run dev                              # Servidor de desarrollo
npm run build                           # Build de producción
node scripts/generate-icons.mjs         # Regenerar íconos Android + PWA
node scripts/generate-tutorial-pdf.mjs  # Regenerar tutorial PDF
```
