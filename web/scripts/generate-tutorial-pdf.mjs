import puppeteer from "puppeteer";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    font-size: 11pt;
    color: #1a1a1a;
    background: #fff;
    line-height: 1.6;
  }

  /* Cover */
  .cover {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 60px 80px;
    background: #0d0d0e;
    color: #ede8e1;
    page-break-after: always;
  }

  .cover-icon {
    margin-bottom: 40px;
  }

  .cover-kicker {
    font-size: 9pt;
    font-weight: 500;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #c8905a;
    margin-bottom: 16px;
  }

  .cover-title {
    font-size: 34pt;
    font-weight: 500;
    letter-spacing: -0.04em;
    line-height: 1.1;
    text-align: center;
    margin-bottom: 18px;
  }

  .cover-sub {
    font-size: 12pt;
    color: #6b6762;
    text-align: center;
    max-width: 360px;
    line-height: 1.55;
  }

  .cover-footer {
    position: absolute;
    bottom: 48px;
    font-size: 8pt;
    color: #3a3a3a;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  /* Content pages */
  .page {
    padding: 56px 72px;
    page-break-after: always;
  }

  .page:last-child {
    page-break-after: auto;
  }

  /* Section header */
  .section-num {
    font-size: 8pt;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #c8905a;
    margin-bottom: 8px;
  }

  .section-title {
    font-size: 20pt;
    font-weight: 500;
    letter-spacing: -0.03em;
    color: #0d0d0e;
    margin-bottom: 28px;
    padding-bottom: 16px;
    border-bottom: 1.5px solid #f0ece6;
  }

  /* Steps */
  .step {
    display: flex;
    gap: 20px;
    margin-bottom: 28px;
    align-items: flex-start;
  }

  .step-num {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: #c8905a;
    color: #fff;
    font-size: 10pt;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 1px;
  }

  .step-body h3 {
    font-size: 11pt;
    font-weight: 600;
    color: #0d0d0e;
    margin-bottom: 6px;
  }

  .step-body p {
    font-size: 10pt;
    color: #444;
    line-height: 1.6;
    margin-bottom: 8px;
  }

  /* Code blocks */
  code {
    font-family: 'Cascadia Code', 'JetBrains Mono', 'Courier New', monospace;
    font-size: 9pt;
    background: #f4f1ed;
    color: #7a4520;
    padding: 2px 6px;
    border-radius: 4px;
  }

  pre {
    font-family: 'Cascadia Code', 'JetBrains Mono', 'Courier New', monospace;
    font-size: 9pt;
    background: #0d0d0e;
    color: #c8905a;
    padding: 14px 18px;
    border-radius: 8px;
    margin: 10px 0;
    white-space: pre-wrap;
    line-height: 1.7;
  }

  pre .comment { color: #4a4a4a; }
  pre .key { color: #ede8e1; }
  pre .val { color: #6aa47e; }

  /* Note box */
  .note {
    background: #faf7f3;
    border: 1px solid #e8ddd0;
    border-left: 3px solid #c8905a;
    border-radius: 6px;
    padding: 12px 16px;
    margin: 12px 0;
    font-size: 10pt;
    color: #555;
  }

  .note strong {
    color: #c8905a;
    font-weight: 600;
  }

  /* Warning box */
  .warning {
    background: #fff8f8;
    border: 1px solid #e8d0d0;
    border-left: 3px solid #b86868;
    border-radius: 6px;
    padding: 12px 16px;
    margin: 12px 0;
    font-size: 10pt;
    color: #555;
  }

  .warning strong {
    color: #b86868;
    font-weight: 600;
  }

  /* Checklist */
  .checklist {
    list-style: none;
    margin: 10px 0;
  }

  .checklist li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 10pt;
    color: #333;
    margin-bottom: 7px;
    line-height: 1.5;
  }

  .checklist li::before {
    content: '☐';
    color: #c8905a;
    font-size: 12pt;
    flex-shrink: 0;
    margin-top: -1px;
  }

  /* Summary table */
  .summary {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 10pt;
  }

  .summary th {
    text-align: left;
    font-size: 8pt;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #888;
    padding: 8px 12px;
    border-bottom: 1.5px solid #eee;
  }

  .summary td {
    padding: 10px 12px;
    border-bottom: 1px solid #f2f2f2;
    color: #333;
    vertical-align: top;
  }

  .summary td:first-child {
    font-weight: 500;
    color: #0d0d0e;
    white-space: nowrap;
  }

  .tag {
    display: inline-block;
    background: #f4f1ed;
    color: #7a4520;
    border-radius: 4px;
    padding: 1px 7px;
    font-size: 8.5pt;
    font-weight: 500;
    margin-right: 4px;
  }

  .divider {
    height: 1px;
    background: #f0ece6;
    margin: 24px 0;
  }
</style>
</head>
<body>

<!-- ══ COVER ══════════════════════════════════════════════════════ -->
<div class="cover">
  <div class="cover-icon">
    <svg viewBox="0 0 512 512" width="80" height="80">
      <rect width="512" height="512" rx="108" fill="#131315"/>
      <rect x="90" y="94" width="272" height="324" rx="14" fill="#ede8dd"/>
      <rect x="90" y="94" width="46" height="324" rx="12" fill="#c8905a"/>
      <rect x="120" y="94" width="16" height="324" fill="#c8905a"/>
      <circle cx="113" cy="168" r="5" fill="#1a0e06" opacity="0.42"/>
      <circle cx="113" cy="256" r="5" fill="#1a0e06" opacity="0.42"/>
      <circle cx="113" cy="344" r="5" fill="#1a0e06" opacity="0.42"/>
      <rect x="152" y="186" width="182" height="3" rx="1.5" fill="#1a0e06" opacity="0.11"/>
      <rect x="152" y="228" width="182" height="3" rx="1.5" fill="#1a0e06" opacity="0.11"/>
      <rect x="152" y="270" width="182" height="3" rx="1.5" fill="#1a0e06" opacity="0.11"/>
      <rect x="152" y="312" width="124" height="3" rx="1.5" fill="#1a0e06" opacity="0.11"/>
      <path d="M310 94 L338 94 L338 150 L324 138 L310 150 Z" fill="#c8905a" opacity="0.86"/>
    </svg>
  </div>
  <div class="cover-kicker">Tutorial de instalación</div>
  <div class="cover-title">PrivateLife</div>
  <div class="cover-sub">Cómo armar tu propia instancia personal desde cero.</div>
  <div class="cover-footer">github.com/Mathwhiz/PrivateLife</div>
</div>

<!-- ══ PAGE 1: Introducción + Requisitos ══════════════════════════ -->
<div class="page">
  <div class="section-num">Introducción</div>
  <div class="section-title">¿Qué es PrivateLife?</div>

  <div class="step">
    <div class="step-body">
      <p>PrivateLife es una aplicación web personal — un segundo cerebro para registrar hábitos, biblioteca de libros/series/películas, escritos, hitos y más. Cada persona tiene su propia instancia con sus propios datos, completamente privados.</p>
      <p>La app está construida con <strong>Next.js + React + TypeScript</strong> y usa <strong>Supabase</strong> como base de datos en la nube. No hay servidor propio: Supabase se encarga de todo el backend.</p>
    </div>
  </div>

  <div class="divider"></div>

  <div class="section-num">Antes de empezar</div>
  <div class="section-title">Qué necesitás tener instalado</div>

  <ul class="checklist">
    <li><strong>Node.js 18 o superior</strong> — descargalo en nodejs.org</li>
    <li><strong>Git</strong> — para clonar el repositorio</li>
    <li><strong>Una cuenta en Supabase</strong> (gratuita) — en supabase.com</li>
    <li><strong>Un editor de texto</strong> — VS Code recomendado</li>
  </ul>

  <div class="note">
    <strong>Nota:</strong> No necesitás saber programar para seguir este tutorial. Solo copiar y pegar comandos y valores en los lugares indicados.
  </div>
</div>

<!-- ══ PAGE 2: Clonar el repo + Supabase ══════════════════════════ -->
<div class="page">
  <div class="section-num">Paso 1</div>
  <div class="section-title">Clonar el repositorio</div>

  <div class="step">
    <div class="step-num">1</div>
    <div class="step-body">
      <h3>Abrir una terminal</h3>
      <p>En Windows: buscá <strong>PowerShell</strong> o <strong>Terminal</strong> en el menú inicio. En Mac: abrí <strong>Terminal</strong>.</p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">2</div>
    <div class="step-body">
      <h3>Clonar y entrar a la carpeta</h3>
      <pre>git clone https://github.com/Mathwhiz/PrivateLife.git
cd PrivateLife/web</pre>
    </div>
  </div>

  <div class="step">
    <div class="step-num">3</div>
    <div class="step-body">
      <h3>Instalar dependencias</h3>
      <pre>npm install</pre>
      <p>Esto descarga todo lo necesario. Puede tardar un minuto.</p>
    </div>
  </div>

  <div class="divider"></div>

  <div class="section-num">Paso 2</div>
  <div class="section-title">Crear tu proyecto en Supabase</div>

  <div class="step">
    <div class="step-num">1</div>
    <div class="step-body">
      <h3>Crear cuenta y proyecto</h3>
      <p>Entrá a <strong>supabase.com</strong> → Sign Up (es gratis). Una vez dentro, hacé click en <strong>New project</strong>.</p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">2</div>
    <div class="step-body">
      <h3>Configurar el proyecto</h3>
      <p>Elegí un nombre (por ejemplo: <code>mi-private-life</code>), una contraseña para la base de datos (guardala en algún lado), y la región más cercana a donde vivís.</p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">3</div>
    <div class="step-body">
      <h3>Esperar que termine</h3>
      <p>Supabase tarda aproximadamente 1 minuto en crear el proyecto. Verás una pantalla de carga y luego el dashboard.</p>
    </div>
  </div>
</div>

<!-- ══ PAGE 3: SQL ════════════════════════════════════════════════ -->
<div class="page">
  <div class="section-num">Paso 3</div>
  <div class="section-title">Crear la tabla en la base de datos</div>

  <div class="step">
    <div class="step-num">1</div>
    <div class="step-body">
      <h3>Ir al SQL Editor</h3>
      <p>En el menú izquierdo de Supabase, hacé click en <strong>SQL Editor</strong> → <strong>New query</strong>.</p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">2</div>
    <div class="step-body">
      <h3>Pegar y ejecutar el schema</h3>
      <p>Copiá el contenido del archivo <code>web/supabase/schema.sql</code> del repo y pegalo en el editor. Luego hacé click en <strong>Run</strong> (o presioná <code>Ctrl+Enter</code>).</p>
      <pre><span class="comment">-- Esto crea la tabla principal</span>
<span class="key">CREATE TABLE IF NOT EXISTS</span> private_life_state (
  id         text <span class="key">PRIMARY KEY</span>,
  payload    jsonb,
  updated_at timestamptz <span class="key">DEFAULT</span> now()
);</pre>
      <p>Debería aparecer "Success" en verde.</p>
    </div>
  </div>

  <div class="divider"></div>

  <div class="section-num">Paso 4</div>
  <div class="section-title">Activar la seguridad (RLS)</div>

  <div class="step">
    <div class="step-num">1</div>
    <div class="step-body">
      <h3>Nueva query en el SQL Editor</h3>
      <p>Hacé click en <strong>New query</strong> nuevamente. Esta vez copiá el contenido de <code>web/supabase/rls.sql</code> y pegalo. Luego <strong>Run</strong>.</p>
    </div>
  </div>

  <div class="note">
    <strong>¿Para qué sirve esto?</strong> El RLS (Row Level Security) hace que nadie pueda ver ni modificar tus datos sin haber iniciado sesión primero. Es la capa de seguridad más importante de toda la app.
  </div>

  <div class="warning">
    <strong>Importante:</strong> Si no ejecutás el RLS, cualquier persona que tenga tu URL de Supabase podría leer tus datos. No te saltees este paso.
  </div>
</div>

<!-- ══ PAGE 4: Usuario + credenciales ════════════════════════════ -->
<div class="page">
  <div class="section-num">Paso 5</div>
  <div class="section-title">Crear tu usuario</div>

  <div class="step">
    <div class="step-num">1</div>
    <div class="step-body">
      <h3>Ir a Authentication</h3>
      <p>En el menú izquierdo: <strong>Authentication</strong> → <strong>Users</strong>.</p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">2</div>
    <div class="step-body">
      <h3>Crear el usuario</h3>
      <p>Click en <strong>Add user</strong> → <strong>Create new user</strong>. Ingresá tu email y la contraseña que quieras usar para entrar a la app. Guardá esas credenciales — las vas a necesitar para iniciar sesión.</p>
    </div>
  </div>

  <div class="divider"></div>

  <div class="section-num">Paso 6</div>
  <div class="section-title">Obtener las credenciales de la API</div>

  <div class="step">
    <div class="step-num">1</div>
    <div class="step-body">
      <h3>Ir a Settings → API</h3>
      <p>En el menú izquierdo: <strong>Project Settings</strong> (ícono de engranaje) → <strong>API</strong>.</p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">2</div>
    <div class="step-body">
      <h3>Copiar los dos valores</h3>
      <p>Necesitás dos cosas de esta pantalla:</p>
      <ul class="checklist">
        <li><strong>Project URL</strong> — algo como <code>https://xxxxxx.supabase.co</code></li>
        <li><strong>anon public</strong> key — una cadena larga que empieza con <code>eyJ...</code></li>
      </ul>
    </div>
  </div>
</div>

<!-- ══ PAGE 5: .env + correr la app ══════════════════════════════ -->
<div class="page">
  <div class="section-num">Paso 7</div>
  <div class="section-title">Crear el archivo de configuración</div>

  <div class="step">
    <div class="step-num">1</div>
    <div class="step-body">
      <h3>Crear el archivo <code>.env.local</code></h3>
      <p>Dentro de la carpeta <code>PrivateLife/web/</code>, creá un nuevo archivo llamado exactamente <strong>.env.local</strong> (con el punto al principio). Pegá esto adentro, reemplazando con tus valores reales:</p>
      <pre><span class="key">NEXT_PUBLIC_SUPABASE_URL</span>=<span class="val">https://xxxxxx.supabase.co</span>
<span class="key">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>=<span class="val">eyJ...</span></pre>
    </div>
  </div>

  <div class="note">
    <strong>Nota:</strong> Este archivo <strong>nunca</strong> se sube al repositorio (está en .gitignore). Es tuyo y solo tuyo.
  </div>

  <div class="divider"></div>

  <div class="section-num">Paso 8</div>
  <div class="section-title">Correr la app</div>

  <div class="step">
    <div class="step-num">1</div>
    <div class="step-body">
      <h3>Iniciar el servidor de desarrollo</h3>
      <p>En la terminal, desde la carpeta <code>PrivateLife/web/</code>:</p>
      <pre>npm run dev</pre>
    </div>
  </div>

  <div class="step">
    <div class="step-num">2</div>
    <div class="step-body">
      <h3>Abrir en el navegador</h3>
      <p>Abrí <strong>http://localhost:3000</strong> en tu navegador. Vas a ver la pantalla de inicio de sesión.</p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">3</div>
    <div class="step-body">
      <h3>Iniciar sesión</h3>
      <p>Ingresá el email y contraseña que creaste en el Paso 5. Activá <strong>Recordar sesión</strong> si no querés volver a ingresar las credenciales cada vez.</p>
    </div>
  </div>

  <div class="note">
    <strong>Listo.</strong> Si ves el dashboard principal, todo está funcionando. Tus datos se guardan de forma privada en tu cuenta de Supabase — nadie más puede verlos.
  </div>
</div>

<!-- ══ PAGE 6: Resumen + FAQ ══════════════════════════════════════ -->
<div class="page">
  <div class="section-num">Resumen</div>
  <div class="section-title">Checklist completo</div>

  <table class="summary">
    <tr>
      <th>Paso</th>
      <th>Qué hacer</th>
      <th>Dónde</th>
    </tr>
    <tr>
      <td>1</td>
      <td>Clonar el repo e instalar dependencias</td>
      <td>Terminal</td>
    </tr>
    <tr>
      <td>2</td>
      <td>Crear proyecto en Supabase</td>
      <td>supabase.com</td>
    </tr>
    <tr>
      <td>3</td>
      <td>Ejecutar <code>schema.sql</code></td>
      <td>Supabase → SQL Editor</td>
    </tr>
    <tr>
      <td>4</td>
      <td>Ejecutar <code>rls.sql</code></td>
      <td>Supabase → SQL Editor</td>
    </tr>
    <tr>
      <td>5</td>
      <td>Crear tu usuario</td>
      <td>Supabase → Authentication</td>
    </tr>
    <tr>
      <td>6</td>
      <td>Copiar URL y anon key</td>
      <td>Supabase → Settings → API</td>
    </tr>
    <tr>
      <td>7</td>
      <td>Crear <code>.env.local</code> con las credenciales</td>
      <td>Carpeta <code>web/</code></td>
    </tr>
    <tr>
      <td>8</td>
      <td>Correr <code>npm run dev</code> y entrar</td>
      <td>Terminal + localhost:3000</td>
    </tr>
  </table>

  <div class="divider"></div>

  <div class="section-num">Preguntas frecuentes</div>
  <div class="section-title">FAQ</div>

  <div class="step">
    <div class="step-body">
      <h3>¿Mis datos se mezclan con los de otra persona?</h3>
      <p>No. Cada persona tiene su propio proyecto en Supabase con su propia base de datos. Son completamente independientes.</p>
    </div>
  </div>

  <div class="step">
    <div class="step-body">
      <h3>¿Puedo usar la app en el celular?</h3>
      <p>Sí. Si estás en la misma red, abrí <code>http://[IP-de-tu-PC]:3000</code> en el celular. También podés instalarla como PWA desde el navegador mobile.</p>
    </div>
  </div>

  <div class="step">
    <div class="step-body">
      <h3>¿La app tiene costo?</h3>
      <p>El código es gratuito. Supabase tiene un plan gratuito generoso — para uso personal es más que suficiente.</p>
    </div>
  </div>

  <div class="step">
    <div class="step-body">
      <h3>¿Qué pasa si pierdo mi contraseña?</h3>
      <p>Podés cambiarla desde el dashboard de Supabase → Authentication → Users → hacé click en tu usuario → Update password.</p>
    </div>
  </div>
</div>

<!-- ══ PAGE 7: Funcionalidades + Personalización ══════════════════ -->
<div class="page">
  <div class="section-num">Referencia rápida</div>
  <div class="section-title">Secciones de la app</div>

  <table class="summary">
    <tr>
      <th>Sección</th>
      <th>Descripción</th>
    </tr>
    <tr>
      <td>Hábitos</td>
      <td>Tracker diario con checklist, historial y estadísticas de racha</td>
    </tr>
    <tr>
      <td>Biblioteca</td>
      <td>Películas, series, libros, anime y manga con rating, géneros y filtros</td>
    </tr>
    <tr>
      <td>Textos</td>
      <td>Escritos personales: pensamientos, filosofía, anécdotas</td>
    </tr>
    <tr>
      <td>Hitos</td>
      <td>Momentos importantes con fecha y contexto</td>
    </tr>
    <tr>
      <td>Archivo</td>
      <td>Vista global de todas las entradas del sistema</td>
    </tr>
    <tr>
      <td>Ajustes</td>
      <td>Exportar/importar datos, configurar menú y biblioteca</td>
    </tr>
  </table>

  <div class="divider"></div>

  <div class="section-num">Biblioteca</div>
  <div class="section-title">Filtros y orden</div>

  <div class="step">
    <div class="step-body">
      <p>En la biblioteca podés combinar filtros y orden libremente:</p>
      <ul class="checklist">
        <li><strong>Tipo:</strong> Todo / Película / Serie / Libro / Anime / Manga</li>
        <li><strong>Rating:</strong> Todas / 8+ / 9+ / 10</li>
        <li><strong>Orden:</strong> Más reciente · Más antigua · Nota ↓ · Nota ↑</li>
        <li><strong>Géneros:</strong> Filtro dinámico basado en los tags que cargaste</li>
        <li><strong>Búsqueda:</strong> Por nombre en tiempo real</li>
      </ul>
    </div>
  </div>

  <div class="divider"></div>

  <div class="section-num">Ajustes → Personalización</div>
  <div class="section-title">Hacer la app tuya</div>

  <div class="step">
    <div class="step-num">1</div>
    <div class="step-body">
      <h3>Menú lateral</h3>
      <p>En <strong>Ajustes → Menu lateral</strong> podés renombrar cada sección (por ejemplo, cambiar "Hábitos" por "Rutinas") o desactivar las que no usás. Los cambios se guardan automáticamente.</p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">2</div>
    <div class="step-body">
      <h3>Tipos de biblioteca</h3>
      <p>En <strong>Ajustes → Tipos de biblioteca</strong> podés renombrar categorías (por ejemplo, "Película" → "Film") o desactivar las que no te interesan. El botón "Restaurar" vuelve a los valores originales.</p>
    </div>
  </div>

  <div class="note">
    <strong>Importante:</strong> La configuración se guarda en el navegador (localStorage). Si usás la app en otro dispositivo, la configuración es independiente en cada uno.
  </div>

  <div class="divider"></div>

  <div class="section-num">Datos</div>
  <div class="section-title">Exportar e importar</div>

  <div class="step">
    <div class="step-body">
      <p>Desde <strong>Ajustes → Exportar datos</strong> descargás un archivo JSON con todas tus entradas. Podés usarlo como backup o para migrar a otro dispositivo importándolo con <strong>Ajustes → Importar datos</strong>.</p>
    </div>
  </div>
</div>

</body>
</html>`;

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

await page.setContent(html, { waitUntil: "networkidle0" });

const outputPath = join(__dirname, "..", "..", "tutorial.pdf");

await page.pdf({
  path: outputPath,
  format: "A4",
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
  printBackground: true,
});

await browser.close();
console.log(`PDF generado: ${outputPath}`);
