-- PrivateLife — Row Level Security
-- Ejecutar en Supabase SQL Editor para proteger los datos.
-- Después de esto, solo los usuarios anotados en private_life_owners pueden
-- leer o escribir. Tener sesión iniciada no alcanza: si el registro de Supabase
-- quedara abierto, cualquiera podría crearse una cuenta.
-- Nota: sin bloques DO $$ ... $$ ni ";" dentro de funciones, porque el SQL
-- Editor de Supabase divide el script por cada ";" y parte el bloque al medio.

-- 0. Dueños: quién puede entrar. Sin políticas = la API no la lee ni la escribe;
--    sólo la consulta la función de abajo (security definer).
CREATE TABLE IF NOT EXISTS public.private_life_owners (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE
);
ALTER TABLE public.private_life_owners ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.private_life_owners FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_private_life_owner()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.private_life_owners WHERE user_id = auth.uid())
$$;
REVOKE ALL ON FUNCTION public.is_private_life_owner() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_private_life_owner() TO authenticated;

-- Para habilitarte, después de crear tu usuario (Authentication → Users),
-- ejecutá esto con tu email. No lo dejes escrito en el repo:
--   INSERT INTO public.private_life_owners (user_id)
--   SELECT id FROM auth.users WHERE email = 'tu@email.com';

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

-- 5. Políticas: sólo los dueños (no cualquier sesión iniciada)
DROP POLICY IF EXISTS "authenticated_read" ON public.private_life_state;
CREATE POLICY "authenticated_read"
  ON public.private_life_state
  FOR SELECT TO authenticated
  USING (public.is_private_life_owner());

DROP POLICY IF EXISTS "authenticated_insert" ON public.private_life_state;
CREATE POLICY "authenticated_insert"
  ON public.private_life_state
  FOR INSERT TO authenticated
  WITH CHECK (public.is_private_life_owner());

DROP POLICY IF EXISTS "authenticated_update" ON public.private_life_state;
CREATE POLICY "authenticated_update"
  ON public.private_life_state
  FOR UPDATE TO authenticated
  USING (public.is_private_life_owner()) WITH CHECK (public.is_private_life_owner());

DROP POLICY IF EXISTS "authenticated_delete" ON public.private_life_state;
CREATE POLICY "authenticated_delete"
  ON public.private_life_state
  FOR DELETE TO authenticated
  USING (public.is_private_life_owner());

-- 6. Verificación: si devuelve alguna fila, quedó una política abierta.
SELECT policyname, roles, cmd
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename  = 'private_life_state'
   AND 'anon' = ANY(roles);
