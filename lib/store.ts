import "server-only";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Chequeo, NuevaReserva, Reserva } from "./types";

/**
 * Acceso a datos. En producción usa Supabase; si no hay credenciales
 * (desarrollo local) guarda todo en .data/db.json.
 */
export interface Store {
  crearReserva(r: NuevaReserva): Promise<Reserva>;
  reservaPorToken(token: string): Promise<Reserva | null>;
  reservaPorId(id: string): Promise<Reserva | null>;
  reservas(soloActivas?: boolean): Promise<Reserva[]>;
  actualizarReserva(id: string, cambios: Partial<Reserva>): Promise<void>;
  agregarChequeo(c: Omit<Chequeo, "id" | "created_at">): Promise<void>;
  chequeos(reservaId?: string): Promise<Chequeo[]>;
}

const DEFAULTS = {
  estado: "activa",
  ultimo_chequeo: null,
  property_token: null,
  precio_actual: null,
  fuente_actual: null,
  link_actual: null,
  cancelacion_gratis_actual: null,
  ultima_alerta_precio: null,
  ultima_alerta_at: null,
  recordatorio_enviado: false,
  respuesta: null,
  precio_nuevo: null,
  confianza: null,
  motivo: null,
} as const;

// ---------- Supabase ----------

function numeros(r: Reserva): Reserva {
  // Postgres devuelve numeric como string.
  const n = (v: unknown) => (v == null ? null : Number(v));
  return {
    ...r,
    precio_pagado: Number(r.precio_pagado),
    precio_actual: n(r.precio_actual),
    ultima_alerta_precio: n(r.ultima_alerta_precio),
    precio_nuevo: n(r.precio_nuevo),
  };
}

function supabaseStore(sb: SupabaseClient): Store {
  const falla = (e: { message: string } | null) => {
    if (e) throw new Error("Supabase: " + e.message);
  };
  return {
    async crearReserva(r) {
      const { data, error } = await sb.from("reservas").insert(r).select().single();
      falla(error);
      return numeros(data as Reserva);
    },
    async reservaPorToken(token) {
      const { data, error } = await sb.from("reservas").select().eq("token", token).maybeSingle();
      falla(error);
      return data ? numeros(data as Reserva) : null;
    },
    async reservaPorId(id) {
      const { data, error } = await sb.from("reservas").select().eq("id", id).maybeSingle();
      falla(error);
      return data ? numeros(data as Reserva) : null;
    },
    async reservas(soloActivas = false) {
      let q = sb.from("reservas").select().order("cancelacion_hasta", { ascending: true });
      if (soloActivas) q = q.eq("estado", "activa");
      const { data, error } = await q;
      falla(error);
      return (data as Reserva[]).map(numeros);
    },
    async actualizarReserva(id, cambios) {
      const { error } = await sb.from("reservas").update(cambios).eq("id", id);
      falla(error);
    },
    async agregarChequeo(c) {
      const { error } = await sb.from("chequeos").insert(c);
      falla(error);
    },
    async chequeos(reservaId) {
      let q = sb.from("chequeos").select().order("created_at", { ascending: false });
      if (reservaId) q = q.eq("reserva_id", reservaId);
      const { data, error } = await q;
      falla(error);
      return (data as Chequeo[]).map((c) => ({
        ...c,
        precio: c.precio == null ? null : Number(c.precio),
        ahorro_pct: c.ahorro_pct == null ? null : Number(c.ahorro_pct),
      }));
    },
  };
}

// ---------- Archivo local ----------

type Archivo = { reservas: Reserva[]; chequeos: Chequeo[] };
const ARCHIVO = path.join(process.cwd(), ".data", "db.json");

async function leer(): Promise<Archivo> {
  try {
    return JSON.parse(await fs.readFile(ARCHIVO, "utf8"));
  } catch {
    return { reservas: [], chequeos: [] };
  }
}

async function escribir(a: Archivo) {
  await fs.mkdir(path.dirname(ARCHIVO), { recursive: true });
  await fs.writeFile(ARCHIVO, JSON.stringify(a, null, 2));
}

function archivoStore(): Store {
  return {
    async crearReserva(r) {
      const a = await leer();
      const nueva: Reserva = { ...r, ...DEFAULTS, id: randomUUID(), created_at: new Date().toISOString() };
      a.reservas.push(nueva);
      await escribir(a);
      return nueva;
    },
    async reservaPorToken(token) {
      return (await leer()).reservas.find((r) => r.token === token) ?? null;
    },
    async reservaPorId(id) {
      return (await leer()).reservas.find((r) => r.id === id) ?? null;
    },
    async reservas(soloActivas = false) {
      return (await leer()).reservas
        .filter((r) => !soloActivas || r.estado === "activa")
        .sort((x, y) => x.cancelacion_hasta.localeCompare(y.cancelacion_hasta));
    },
    async actualizarReserva(id, cambios) {
      const a = await leer();
      const i = a.reservas.findIndex((r) => r.id === id);
      if (i >= 0) a.reservas[i] = { ...a.reservas[i], ...cambios };
      await escribir(a);
    },
    async agregarChequeo(c) {
      const a = await leer();
      a.chequeos.push({ ...c, id: randomUUID(), created_at: new Date().toISOString() });
      await escribir(a);
    },
    async chequeos(reservaId) {
      return (await leer()).chequeos
        .filter((c) => !reservaId || c.reserva_id === reservaId)
        .sort((x, y) => y.created_at.localeCompare(x.created_at));
    },
  };
}

let cache: Store | null = null;

export function store(): Store {
  if (cache) return cache;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    cache = supabaseStore(createClient(url, key, { auth: { persistSession: false } }));
  } else if (process.env.VERCEL) {
    throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en las variables de entorno de Vercel.");
  } else {
    cache = archivoStore();
  }
  return cache;
}
