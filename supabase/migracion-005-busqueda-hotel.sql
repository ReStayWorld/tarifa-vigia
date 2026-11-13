-- Migración 5: una búsqueda puede ser de un hotel en particular.
-- Pegar en Supabase > SQL Editor y ejecutar una vez.

alter table busquedas add column if not exists hotel_id text;
alter table busquedas add column if not exists hotel_nombre text;
alter table busquedas add column if not exists categoria text;
