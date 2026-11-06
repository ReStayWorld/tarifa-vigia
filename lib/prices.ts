import "server-only";
import { createHash } from "node:crypto";
import { noches } from "./format";
import type { Reserva } from "./types";

export interface Cotizacion {
  precio: number | null; // total de la estadía, misma moneda que la reserva
  fuente: string | null;
  link: string | null;
  cancelacionGratis: boolean | null; // null = la fuente no lo informa
  nota: string | null;
  propertyToken?: string | null; // para guardarlo y ahorrar una búsqueda la próxima vez
  busquedas: number; // búsquedas de SerpApi gastadas
}

export async function cotizar(r: Reserva): Promise<Cotizacion> {
  const proveedor = process.env.PRICE_PROVIDER ?? "demo";
  if (proveedor === "serpapi") return serpapi(r);
  return demo(r);
}

// ---------- Demo: precios simulados, para probar sin gastar búsquedas ----------

function demo(r: Reserva): Cotizacion {
  // Varía con la reserva y el día, entre -18% y +8% del precio pagado.
  const semilla = createHash("sha1").update(r.id + new Date().toISOString().slice(0, 10)).digest();
  const factor = 0.82 + (semilla[0] / 255) * 0.26;
  const fuentes = ["Booking.com", "Expedia", "Hotels.com", "Sitio del hotel"];
  return {
    precio: Math.round(r.precio_pagado * factor),
    fuente: fuentes[semilla[1] % fuentes.length],
    link: "https://www.google.com/travel/search?q=" + encodeURIComponent(`${r.hotel} ${r.ciudad}`),
    cancelacionGratis: semilla[2] % 5 !== 0,
    nota: "Precio simulado (modo demo)",
    busquedas: 0,
  };
}

// ---------- SerpApi: Google Hotels ----------

type SerpPrecio = {
  source?: string;
  link?: string;
  free_cancellation?: boolean;
  total_rate?: { extracted_lowest?: number };
  rate_per_night?: { extracted_lowest?: number };
};

type SerpRespuesta = {
  error?: string;
  name?: string;
  link?: string;
  prices?: SerpPrecio[];
  featured_prices?: SerpPrecio[];
  total_rate?: { extracted_lowest?: number };
  properties?: {
    name?: string;
    property_token?: string;
    link?: string;
    total_rate?: { extracted_lowest?: number };
  }[];
};

function normalizar(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && w !== "hotel");
}

function parecido(a: string, b: string): number {
  const x = new Set(normalizar(a));
  const y = normalizar(b);
  if (!x.size || !y.length) return 0;
  return y.filter((w) => x.has(w)).length / Math.max(x.size, y.length);
}

async function buscar(params: Record<string, string>): Promise<SerpRespuesta> {
  const url = new URL("https://serpapi.com/search.json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("api_key", process.env.SERPAPI_KEY ?? "");
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json()) as SerpRespuesta;
  if (!res.ok || json.error) throw new Error("SerpApi: " + (json.error ?? res.status));
  return json;
}

async function serpapi(r: Reserva): Promise<Cotizacion> {
  if (!process.env.SERPAPI_KEY) throw new Error("Falta SERPAPI_KEY");
  const base = {
    engine: "google_hotels",
    q: `${r.hotel} ${r.ciudad}`,
    check_in_date: r.check_in,
    check_out_date: r.check_out,
    adults: String(r.huespedes),
    currency: r.moneda,
    gl: "uy",
    hl: "es",
  };

  // Si ya identificamos el hotel antes, vamos directo a su detalle: 1 búsqueda en vez de 2.
  let propertyToken = r.property_token;
  let busquedas = 1;
  let detalle = await buscar(propertyToken ? { ...base, property_token: propertyToken } : base);

  // Si Google devuelve una lista, elegimos el hotel con el nombre más parecido y pedimos su detalle.
  if (!detalle.prices && detalle.properties?.length) {
    const mejor = detalle.properties
      .map((p) => ({ p, score: parecido(r.hotel, p.name ?? "") }))
      .sort((a, b) => b.score - a.score)[0];
    if (!mejor || mejor.score < 0.5 || !mejor.p.property_token) {
      return { precio: null, fuente: null, link: null, cancelacionGratis: null, nota: "No encontramos el hotel en Google Hotels", busquedas };
    }
    propertyToken = mejor.p.property_token;
    detalle = await buscar({ ...base, property_token: propertyToken });
    busquedas++;
  }

  const n = noches(r.check_in, r.check_out);
  const ofertas = [...(detalle.featured_prices ?? []), ...(detalle.prices ?? [])]
    .map((p) => ({
      precio: p.total_rate?.extracted_lowest ?? (p.rate_per_night?.extracted_lowest ? p.rate_per_night.extracted_lowest * n : null),
      fuente: p.source ?? null,
      link: p.link ?? detalle.link ?? null,
      cancelacionGratis: typeof p.free_cancellation === "boolean" ? p.free_cancellation : null,
    }))
    .filter((o): o is typeof o & { precio: number } => typeof o.precio === "number" && o.precio > 0);

  if (!ofertas.length) {
    return { precio: null, fuente: null, link: detalle.link ?? null, cancelacionGratis: null, nota: "Sin tarifas para esas fechas", propertyToken, busquedas };
  }

  // Regla del MVP: la oferta tiene que tener cancelación igual o mejor. Preferimos las que
  // confirman cancelación gratis; si ninguna lo informa, usamos la más barata y lo marcamos.
  const conCancelacion = ofertas.filter((o) => o.cancelacionGratis === true);
  const elegibles = conCancelacion.length ? conCancelacion : ofertas.filter((o) => o.cancelacionGratis !== false);
  const pool = elegibles.length ? elegibles : ofertas;
  const masBarata = pool.sort((a, b) => a.precio - b.precio)[0];

  return {
    ...masBarata,
    nota: masBarata.cancelacionGratis === null ? "La fuente no informa la política de cancelación" : null,
    propertyToken,
    busquedas,
  };
}
