import "server-only";

export interface Zona {
  nombre: string;
  detalle: string;
  lat: number;
  lon: number;
}

/** Barrios y zonas de una ciudad (OpenStreetMap, gratis), para elegir de una lista. */
export async function buscarZonas(texto: string, ciudad: string, pais: string): Promise<Zona[]> {
  const q = texto.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({ q: `${q}, ${ciudad}`, limit: "8", lang: "default" });
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, {
    headers: { "User-Agent": "tarifa-vigia (piloto ORT Uruguay)" },
    signal: AbortSignal.timeout(10_000),
    next: { revalidate: 86_400 },
  });
  if (!res.ok) return [];
  type F = { properties: { name?: string; osm_key?: string; osm_value?: string; city?: string; countrycode?: string; district?: string }; geometry: { coordinates: [number, number] } };
  const json = (await res.json()) as { features?: F[] };
  const vistos = new Set<string>();
  const salida: Zona[] = [];
  for (const f of json.features ?? []) {
    const p = f.properties;
    if (!p.name || p.countrycode?.toUpperCase() !== pais) continue;
    // Solo lugares que sirven como zona: barrios, localidades, playas, parques, plazas.
    const util = p.osm_key === "place" || ["beach", "park", "square", "attraction", "bay", "cape"].includes(p.osm_value ?? "");
    if (!util || vistos.has(p.name) || p.name.toLowerCase() === ciudad.toLowerCase()) continue;
    vistos.add(p.name);
    const [lon, lat] = f.geometry.coordinates;
    salida.push({ nombre: p.name, detalle: [p.district, p.city].filter(Boolean).join(", "), lat, lon });
  }
  return salida;
}

/** Distancia en km entre dos puntos. */
export function distanciaKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
