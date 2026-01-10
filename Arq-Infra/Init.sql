-- =========================================================
-- SCRIPT DE INICIALIZACIÓN DE POSTGRESQL (init.sql)
-- Se ejecuta automáticamente al iniciar el contenedor.
-- =========================================================

-- 1. Crear la base de datos si no existe (No necesario en este setup
--    porque se define en el docker-compose como POSTGRES_DB)

-- 2. Conectarse a la base de datos 'repu'

-- 3. Crear el esquema 'marketplace' dentro de la base de datos
CREATE SCHEMA IF NOT EXISTS repu;

-- 4. Establecer el esquema 'marketplace' como el predeterminado para el usuario
ALTER ROLE admin SET search_path TO repu, public;

-- Nota: Las tablas definidas en 'schema.sql' se cargarán en este esquema.