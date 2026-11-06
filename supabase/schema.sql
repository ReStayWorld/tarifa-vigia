-- Pegar en Supabase > SQL Editor y ejecutar una vez.

create table if not exists reservas (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  created_at timestamptz not null default now(),
  hotel text not null,
  ciudad text not null,
  check_in date not null,
  check_out date not null,
  huespedes int not null default 2,
  habitacion text not null,
  plataforma text not null,
  precio_pagado numeric not null,
  moneda text not null check (moneda in ('USD', 'UYU')),
  fecha_reserva date not null,
  cancelacion_hasta date not null,
  email text not null,
  whatsapp text,
  variante text,
  estado text not null default 'activa',
  ultimo_chequeo timestamptz,
  property_token text,
  precio_actual numeric,
  fuente_actual text,
  link_actual text,
  cancelacion_gratis_actual boolean,
  ultima_alerta_precio numeric,
  ultima_alerta_at timestamptz,
  recordatorio_enviado boolean not null default false,
  respuesta text,
  precio_nuevo numeric,
  confianza int,
  motivo text
);

create table if not exists chequeos (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references reservas(id) on delete cascade,
  created_at timestamptz not null default now(),
  precio numeric,
  fuente text,
  link text,
  cancelacion_gratis boolean,
  ahorro_pct numeric,
  alerta boolean not null default false,
  nota text,
  busquedas int not null default 0
);

create index if not exists chequeos_reserva_idx on chequeos (reserva_id, created_at desc);

-- Solo el servidor (con la service role key) lee y escribe. Nadie accede desde el navegador.
alter table reservas enable row level security;
alter table chequeos enable row level security;
