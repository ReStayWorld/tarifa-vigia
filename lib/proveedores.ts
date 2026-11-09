import "server-only";
import { createHash } from "node:crypto";
import { categoriaDe, type Categoria } from "./categorias";
import { noches } from "./format";

/**
 * De dónde salen los hoteles y los precios.
 * - LiteAPI: catálogo mundial de hoteles y tarifas por habitación, con política de cancelación.
 * - Xotelo: precio más barato del hotel en cada web (Agoda, Booking, Trip.com...), como referencia.
 * Sin LITEAPI_KEY todo funciona en modo demo, con hoteles y precios simulados.
 */

export interface HotelOpcion {
  id: string;
  nombre: string;
  ciudad: string;
  pais: string;
  direccion: string | null;
  estrellas: number | null;
}

export interface Tarifa {
  categoria: Categoria;
  nombre: string; // nombre de la habitación tal como lo da el proveedor
  total: number; // total de la estadía
  moneda: string;
  cancelacionGratis: boolean;
  cancelacionHasta: string | null; // ISO, si se conoce
  regimen: string | null; // "Solo alojamiento", "Desayuno incluido"...
}

/** La opción más barata encontrada en un chequeo, y dónde se puede reservar. */
export interface Oferta {
  total: number;
  donde: string; // "Booking.com", "Agoda.com", "Nuestro sitio de reservas"...
  link: string;
  habitacion: string | null; // null cuando la web no informa la habitación
  regimen: string | null;
  cancelacionGratis: boolean | null; // null = la web no lo informa
  cancelacionHasta: string | null;
}

export interface PrecioWeb {
  web: string;
  total: number; // total de la estadía (Xotelo da por noche; lo multiplicamos)
}

export interface Consulta {
  hotelId: string;
  checkIn: string;
  checkOut: string;
  adultos: number;
  moneda: string;
}

export const modoDemo = () => !process.env.LITEAPI_KEY;

// ---------- Caché corta en memoria, para no repetir consultas idénticas ----------

const cache = new Map<string, { hasta: number; valor: unknown }>();

async function conCache<T>(clave: string, ms: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(clave);
  if (hit && hit.hasta > Date.now()) return hit.valor as T;
  const valor = await fn();
  cache.set(clave, { hasta: Date.now() + ms, valor });
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return valor;
}

// ---------- LiteAPI ----------

const LITE = "https://api.liteapi.travel/v3.0";

async function lite<T>(ruta: string, init?: RequestInit): Promise<T> {
  const res = await fetch(LITE + ruta, {
    ...init,
    headers: { "X-API-Key": process.env.LITEAPI_KEY ?? "", accept: "application/json", "content-type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`LiteAPI ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
  return json as T;
}

type LiteHotel = { id: string; name: string; city?: string; country?: string; address?: string; stars?: number };

type LiteRate = {
  name?: string;
  boardName?: string;
  boardType?: string;
  retailRate?: { total?: { amount: number; currency: string }[] };
  cancellationPolicies?: { refundableTag?: string; cancelPolicyInfos?: { cancelTime?: string; amount?: number }[] };
};

type LiteRates = { data?: { hotelId: string; roomTypes?: { name?: string; rates?: LiteRate[] }[] }[] };

export async function buscarHoteles(pais: string, texto: string): Promise<HotelOpcion[]> {
  const q = texto.trim();
  if (q.length < 3) return [];
  if (modoDemo()) return demoHoteles(pais, q);
  return conCache(`h:${pais}:${q.toLowerCase()}`, 6 * 3_600_000, async () => {
    const params = new URLSearchParams({ countryCode: pais, hotelName: q, limit: "10" });
    const r = await lite<{ data?: LiteHotel[] }>(`/data/hotels?${params}`);
    return (r.data ?? []).map((h) => ({
      id: String(h.id),
      nombre: h.name,
      ciudad: h.city ?? "",
      pais: h.country?.toUpperCase() ?? pais,
      direccion: h.address ?? null,
      estrellas: h.stars ?? null,
    }));
  });
}

export async function tarifas(c: Consulta): Promise<Tarifa[]> {
  if (modoDemo()) return demoTarifas(c);
  const r = await lite<LiteRates>("/hotels/rates", {
    method: "POST",
    body: JSON.stringify({
      hotelIds: [c.hotelId],
      checkin: c.checkIn,
      checkout: c.checkOut,
      currency: c.moneda,
      guestNationality: "UY",
      occupancies: [{ adults: c.adultos }],
      timeout: 15,
    }),
  });
  const salida: Tarifa[] = [];
  for (const rt of r.data?.[0]?.roomTypes ?? []) {
    for (const rate of rt.rates ?? []) {
      const total = rate.retailRate?.total?.[0];
      if (!total || !(total.amount > 0)) continue;
      const nombre = rate.name ?? rt.name ?? "Habitación";
      const politica = rate.cancellationPolicies;
      const gratis = politica?.refundableTag === "RFN";
      // La cancelación es gratis hasta el primer momento en que empieza a cobrar algo.
      const primera = politica?.cancelPolicyInfos?.filter((p) => (p.amount ?? 0) > 0).map((p) => p.cancelTime).filter(Boolean).sort()[0];
      salida.push({
        categoria: categoriaDe(nombre),
        nombre,
        total: Math.round(total.amount * 100) / 100,
        moneda: total.currency,
        cancelacionGratis: gratis,
        cancelacionHasta: gratis && primera ? new Date(primera.replace(" ", "T") + (primera.endsWith("Z") ? "" : "Z")).toISOString() : null,
        regimen: rate.boardName ?? null,
      });
    }
  }
  return salida;
}

/** Habitaciones del catálogo del hotel (sin precios). Sirve cuando hoy no hay tarifas. */
export async function habitacionesCatalogo(hotelId: string): Promise<string[]> {
  if (modoDemo()) return ["Standard Double Room", "Superior Room", "Junior Suite", "Suite"];
  return conCache(`cat:${hotelId}`, 24 * 3_600_000, async () => {
    const r = await lite<{ data?: { rooms?: { roomName?: string }[] } }>(`/data/hotel?${new URLSearchParams({ hotelId })}`);
    return [...new Set((r.data?.rooms ?? []).map((x) => x.roomName?.trim()).filter((x): x is string => !!x))];
  });
}

// ---------- Xotelo (precio por web) ----------

const XOTELO_MONEDAS = new Set(["USD", "EUR", "GBP", "BRL"]);

export async function preciosPorWeb(xoteloKey: string | null, c: Omit<Consulta, "hotelId">): Promise<PrecioWeb[]> {
  if (!xoteloKey || !XOTELO_MONEDAS.has(c.moneda)) return [];
  const params = new URLSearchParams({
    hotel_key: xoteloKey,
    chk_in: c.checkIn,
    chk_out: c.checkOut,
    adults: String(c.adultos),
    currency: c.moneda,
  });
  try {
    const res = await fetch(`https://data.xotelo.com/api/rates?${params}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const json = (await res.json()) as { result?: { rates?: { name: string; rate: number }[] } };
    const n = noches(c.checkIn, c.checkOut);
    return (json.result?.rates ?? [])
      .filter((r) => r.rate > 0)
      .map((r) => ({ web: r.name, total: Math.round(r.rate * n) }))
      .sort((a, b) => a.total - b.total);
  } catch {
    return [];
  }
}

/** Busca la clave del hotel en Xotelo (TripAdvisor). Necesita XOTELO_RAPIDAPI_KEY; sin ella devuelve null. */
export async function claveXotelo(nombre: string, ciudad: string): Promise<string | null> {
  if (modoDemo()) return DEMO.find((h) => h.nombre === nombre)?.xotelo ?? null;
  const key = process.env.XOTELO_RAPIDAPI_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://xotelo-hotel-prices.p.rapidapi.com/api/search?${new URLSearchParams({ query: `${nombre} ${ciudad}` })}`, {
      headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": "xotelo-hotel-prices.p.rapidapi.com" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json()) as { result?: { list?: { hotel_key?: string; name?: string }[] } };
    const lista = json.result?.list ?? [];
    const mejor = lista.map((h) => ({ h, s: parecido(nombre, h.name ?? "") })).sort((a, b) => b.s - a.s)[0];
    return mejor && mejor.s >= 0.5 ? mejor.h.hotel_key ?? null : null;
  } catch {
    return null;
  }
}

function palabras(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && w !== "hotel");
}

function parecido(a: string, b: string): number {
  const x = new Set(palabras(a));
  const y = palabras(b);
  if (!x.size || !y.length) return 0;
  return y.filter((w) => x.has(w)).length / Math.max(x.size, y.length);
}

// ---------- Demo ----------

const DEMO = [
  { id: "demo-castelmar", nombre: "Castelmar Hotel", ciudad: "Florianópolis", pais: "BR", estrellas: 4, xotelo: "g303576-d486919" },
  { id: "demo-costao", nombre: "Costão do Santinho Resort", ciudad: "Florianópolis", pais: "BR", estrellas: 5, xotelo: null },
  { id: "demo-jurere", nombre: "Il Campanario Villaggio Resort", ciudad: "Florianópolis", pais: "BR", estrellas: 5, xotelo: null },
  { id: "demo-conrad", nombre: "Enjoy Punta del Este", ciudad: "Punta del Este", pais: "UY", estrellas: 5, xotelo: null },
  { id: "demo-sheraton", nombre: "Sheraton Colonia Golf & Spa Resort", ciudad: "Colonia del Sacramento", pais: "UY", estrellas: 5, xotelo: null },
  { id: "demo-alvear", nombre: "Alvear Palace Hotel", ciudad: "Buenos Aires", pais: "AR", estrellas: 5, xotelo: null },
  { id: "demo-faena", nombre: "Faena Hotel Buenos Aires", ciudad: "Buenos Aires", pais: "AR", estrellas: 5, xotelo: null },
];

function demoHoteles(pais: string, q: string): HotelOpcion[] {
  const t = palabras(q);
  return DEMO.filter((h) => h.pais === pais && t.some((w) => palabras(h.nombre + " " + h.ciudad).some((p) => p.startsWith(w)))).map((h) => ({
    id: h.id,
    nombre: h.nombre,
    ciudad: h.ciudad,
    pais: h.pais,
    direccion: null,
    estrellas: h.estrellas,
  }));
}

function demoTarifas(c: Consulta): Tarifa[] {
  const n = noches(c.checkIn, c.checkOut);
  const semilla = createHash("sha1").update(c.hotelId + c.checkIn + new Date().toISOString().slice(0, 13)).digest();
  const base = (c.moneda === "UYU" ? 4000 : 100) * n;
  const habitaciones: [string, number][] = [
    ["Standard Double Room", 1],
    ["Superior King Room with Sea View", 1.3],
    ["Deluxe Double Room", 1.55],
    ["Junior Suite", 1.9],
    ["Suite with Balcony", 2.4],
    ["Family Room", 1.7],
  ];
  return habitaciones.flatMap(([nombre, f], i) => {
    const variacion = 0.85 + (semilla[i] / 255) * 0.3;
    const total = Math.round(base * f * variacion);
    return [
      { categoria: categoriaDe(nombre), nombre, total, moneda: c.moneda, cancelacionGratis: true, cancelacionHasta: null, regimen: "Desayuno incluido" },
      { categoria: categoriaDe(nombre), nombre, total: Math.round(total * 0.88), moneda: c.moneda, cancelacionGratis: false, cancelacionHasta: null, regimen: "Solo alojamiento" },
    ];
  });
}
