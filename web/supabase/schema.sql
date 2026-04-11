-- PrivateLife — Schema
-- Crear la tabla principal. Ejecutar antes que rls.sql.

CREATE TABLE IF NOT EXISTS private_life_state (
  id         text PRIMARY KEY,
  payload    jsonb,
  updated_at timestamptz DEFAULT now()
);
