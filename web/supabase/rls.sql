-- PrivateLife — Row Level Security
-- Ejecutar en Supabase SQL Editor para proteger los datos.
-- Después de esto, solo usuarios autenticados pueden leer o escribir.
-- Nota: sin bloques DO $$ ... $$, porque el SQL Editor de Supabase divide el
-- script por cada ";" y parte el bloque al medio.

-- 1. Habilitar RLS en la tabla principal
ALTER TABLE public.private_life_state ENABLE ROW LEVEL SECURITY;

-- 2. Quitarle al rol anónimo el permiso sobre la tabla.
--    Esto es lo que realmente cierra la puerta: sin permiso de tabla no entra,
--    aunque quedara viva alguna política permisiva.
REVOKE ALL ON public.private_life_state FROM anon;

-- 3. Permisos explícitos para los roles que sí deben entrar
GRANT SELECT, INSERT, UPDATE, DELETE ON public.private_life_state TO authenticated;
GRANT ALL ON public.private_life_state TO service_role;

-- 4. Borrar las políticas viejas que permitían entrar sin login
DROP POLICY IF EXISTS "Allow anonymous read"     ON public.private_life_state;
DROP POLICY IF EXISTS "Allow anonymous write"    ON public.private_life_state;
DROP POLICY IF EXISTS "Allow anonymous update"   ON public.private_life_state;
DROP POLICY IF EXISTS "Enable all for all users" ON public.private_life_state;
DROP POLICY IF EXISTS "public_access"            ON public.private_life_state;

-- 5. Políticas para usuarios con sesión iniciada
DROP POLICY IF EXISTS "authenticated_read" ON public.private_life_state;
CREATE POLICY "authenticated_read"
  ON public.private_life_state
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "authenticated_insert" ON public.private_life_state;
CREATE POLICY "authenticated_insert"
  ON public.private_life_state
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update" ON public.private_life_state;
CREATE POLICY "authenticated_update"
  ON public.private_life_state
  FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete" ON public.private_life_state;
CREATE POLICY "authenticated_delete"
  ON public.private_life_state
  FOR DELETE TO authenticated
  USING (true);

-- 6. Verificación: si devuelve alguna fila, quedó una política abierta.
SELECT policyname, roles, cmd
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename  = 'private_life_state'
   AND 'anon' = ANY(roles);
