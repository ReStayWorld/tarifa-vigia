-- Migración 3: nivel de Genius de Booking del viajero (0 = no tiene, null = no sabe).
-- Pegar en Supabase > SQL Editor y ejecutar una vez.

alter table reservas add column if not exists genius int;
