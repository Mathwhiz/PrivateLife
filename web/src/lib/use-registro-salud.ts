import { useCallback, useEffect, useMemo, useState } from "react";
import { armarDias, leerCache, traerRegistro, type RegistroSalud } from "@/lib/salud";

/**
 * Registro de salud compartido entre Hoy y Salud: se lee una sola vez por
 * sesión (la planilla tarda unos segundos), mostrando primero lo último cacheado.
 */
export function useRegistroSalud(enabled: boolean) {
  const [registro, setRegistro] = useState<RegistroSalud | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const actualizar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      setRegistro(await traerRegistro());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer la planilla.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const cache = leerCache();
    if (cache) setRegistro(cache);
    void actualizar();
  }, [enabled, actualizar]);

  const dias = useMemo(() => (registro ? armarDias(registro.filas) : []), [registro]);

  return { registro, dias, cargando, error, actualizar };
}

export type RegistroSaludState = ReturnType<typeof useRegistroSalud>;
