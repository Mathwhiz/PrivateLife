// Servidor de desarrollo SIN Supabase, para probar cambios de interfaz sin
// tocar los datos reales: la app entra sin login y guarda solo en el
// localStorage de localhost:3001. Uso: npm run dev:sandbox
import { spawn } from "node:child_process";

const env = {
  ...process.env,
  NEXT_PUBLIC_SANDBOX: "1",
  // Vacías a propósito: Next no pisa variables que ya existen con .env.local.
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
};

const child = spawn("npx", ["next", "dev", "-p", "3001"], { env, stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
