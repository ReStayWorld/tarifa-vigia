-- Migración 2: hotel elegido de una lista, categoría de habitación y precios por web.
-- Pegar en Supabase > SQL Editor y ejecutar una vez (se puede correr de nuevo sin problema).

alter table reservas add column if not exists hotel_id text;
alter table reservas add column if not exists xotelo_key text;
alter table reservas add column if not exists pais text;
alter table reservas add column if not exists categoria text;

alter table chequeos add column if not exists detalle jsonb;
