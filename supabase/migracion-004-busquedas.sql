-- Migración 4: búsquedas antes de reservar.
-- Pegar en Supabase > SQL Editor y ejecutar una vez.

create table if not exists busquedas (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  created_at timestamptz not null default now(),
  pais text not null,
  ciudad text not null,
  zona text,
  zona_lat double precision,
  zona_lon double precision,
  radio_km numeric,
  check_in date not null,
  check_out date not null,
  huespedes int not null default 2,
  tope_noche numeric not null,
  moneda text not null check (moneda in ('USD', 'UYU')),
  estrellas_min int,
  email text not null,
  estado text not null default 'activa',
  ultimo_chequeo timestamptz,
  resultados jsonb not null default '[]',
  avisados jsonb not null default '{}'
);

alter table busquedas enable row level security;
