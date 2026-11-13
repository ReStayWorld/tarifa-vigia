-- Migración 6: Genius y precios por web en las búsquedas.
-- Pegar en Supabase > SQL Editor y ejecutar una vez.

alter table busquedas add column if not exists genius int;
alter table busquedas add column if not exists xotelo_key text;
