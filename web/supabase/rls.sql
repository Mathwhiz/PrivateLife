-- PrivateLife — Row Level Security
-- Ejecutar en Supabase SQL Editor para proteger los datos.
-- Después de esto, solo usuarios autenticados pueden leer o escribir.

-- 1. Habilitar RLS en la tabla principal
ALTER TABLE private_life_state ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas permisivas previas si existieran
DROP POLICY IF EXISTS "Enable all for all users" ON private_life_state;
DROP POLICY IF EXISTS "public_access" ON private_life_state;

-- 3. Solo usuarios autenticados pueden leer
CREATE POLICY "authenticated_read"
  ON private_life_state
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 4. Solo usuarios autenticados pueden insertar
CREATE POLICY "authenticated_insert"
  ON private_life_state
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 5. Solo usuarios autenticados pueden actualizar
CREATE POLICY "authenticated_update"
  ON private_life_state
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- 6. Solo usuarios autenticados pueden eliminar
CREATE POLICY "authenticated_delete"
  ON private_life_state
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Resultado: con el anon key del repositorio nadie puede leer ni escribir
-- sin haber iniciado sesión con email + contraseña válidos en Supabase Auth.
