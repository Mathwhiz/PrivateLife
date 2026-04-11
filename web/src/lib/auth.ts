import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

const REMEMBER_KEY = "pl-remember";
const SESSION_KEY = "pl-session";

/**
 * Devuelve la sesión activa o null si no hay ninguna.
 * Si el usuario eligió no recordar la sesión y abrió una nueva ventana del
 * navegador (sessionStorage vacío), cierra sesión automáticamente.
 */
export async function getSession(): Promise<Session | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;

  const wantsRemember = localStorage.getItem(REMEMBER_KEY) === "1";
  const hasSessionFlag = sessionStorage.getItem(SESSION_KEY) === "1";

  // Nueva sesión de navegador y el usuario NO quería ser recordado → cerrar sesión
  if (!wantsRemember && !hasSessionFlag) {
    await supabase.auth.signOut();
    return null;
  }

  return data.session;
}

/**
 * Inicia sesión con email y contraseña.
 * rememberMe=true → persiste entre sesiones de navegador
 * rememberMe=false → se cierra al cerrar el navegador
 */
export async function signIn(
  email: string,
  password: string,
  rememberMe: boolean,
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(
      "Supabase no está configurado. Agregá NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);

  if (rememberMe) {
    localStorage.setItem(REMEMBER_KEY, "1");
  } else {
    localStorage.removeItem(REMEMBER_KEY);
  }
  sessionStorage.setItem(SESSION_KEY, "1");
}

/** Cierra sesión y limpia flags. */
export async function signOut(): Promise<void> {
  localStorage.removeItem(REMEMBER_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  const supabase = getSupabaseBrowserClient();
  if (supabase) await supabase.auth.signOut();
}

/** Escucha cambios de sesión (login / logout). Devuelve un unsubscribe. */
export function onAuthStateChange(
  callback: (session: Session | null) => void,
): () => void {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return () => {};

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => subscription.unsubscribe();
}
