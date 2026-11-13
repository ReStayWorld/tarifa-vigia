import "server-only";
import { ALERT_MIN_PCT, CHECK_EVERY_HOURS } from "./config";
import { enviar, mailBusquedaAlerta } from "./email";
import { diasHasta, noches } from "./format";
import { CATEGORIAS, esCategoria } from "./categorias";
import { hotelesConPrecio, tarifas } from "./proveedores";
import { store } from "./store";
import type { Busqueda, ResultadoBusqueda } from "./types";
import { distanciaKm } from "./zonas";

/** Busca hoteles que cumplan la búsqueda y avisa por los nuevos o los que bajaron de precio. */
export async function chequearBusqueda(b: Busqueda, forzar = false): Promise<{ accion: string; detalle?: string }> {
  const db = store();
  if (b.estado !== "activa") return { accion: "salteada", detalle: b.estado };
  if (diasHasta(b.check_in) < 0) {
    await db.actualizarBusqueda(b.id, { estado: "finalizada" });
    return { accion: "finalizada" };
  }
  const horas = b.ultimo_chequeo ? (Date.now() - Date.parse(b.ultimo_chequeo)) / 3_600_000 : Infinity;
  if (!forzar && horas < CHECK_EVERY_HOURS * 0.9) return { accion: "salteada", detalle: `Último chequeo hace ${horas.toFixed(1)} h` };

  try {
    const n = noches(b.check_in, b.check_out);
    const consulta = { checkIn: b.check_in, checkOut: b.check_out, adultos: b.huespedes, moneda: b.moneda };
    const hoteles = b.hotel_id ? await unHotel(b, consulta) : await hotelesConPrecio(b.pais, b.ciudad, consulta);
    const zona = b.zona_lat != null && b.zona_lon != null ? { lat: b.zona_lat, lon: b.zona_lon } : null;

    const resultados: ResultadoBusqueda[] = hoteles
      .map((h) => ({
        hotel_id: h.hotelId,
        nombre: h.nombre,
        direccion: h.direccion,
        estrellas: h.estrellas,
        por_noche: Math.round(h.total / n),
        total: Math.round(h.total),
        habitacion: h.habitacion,
        cancelacion_gratis: h.cancelacionGratis,
        distancia_km: zona && h.lat != null && h.lon != null ? Math.round(distanciaKm(zona, { lat: h.lat, lon: h.lon }) * 10) / 10 : null,
      }))
      .filter((h) => h.por_noche <= b.tope_noche)
      .filter((h) => !b.estrellas_min || (h.estrellas ?? 0) >= b.estrellas_min)
      .filter((h) => !zona || (h.distancia_km != null && h.distancia_km <= (b.radio_km ?? 2)))
      .sort((a, c) => a.por_noche - c.por_noche);

    // Avisamos por hoteles nuevos, o por los que ya avisamos si bajaron al menos ALERT_MIN_PCT.
    const nuevos = resultados.filter((h) => {
      const antes = b.avisados[h.hotel_id];
      return antes == null || h.por_noche <= antes * (1 - ALERT_MIN_PCT / 100);
    });

    const cambios: Partial<Busqueda> = { ultimo_chequeo: new Date().toISOString(), resultados };
    if (nuevos.length) {
      await enviar(mailBusquedaAlerta(b, nuevos, resultados.length));
      cambios.avisados = { ...b.avisados, ...Object.fromEntries(nuevos.map((h) => [h.hotel_id, h.por_noche])) };
    }
    await db.actualizarBusqueda(b.id, cambios);
    return { accion: nuevos.length ? "alerta" : "chequeada", detalle: `${resultados.length} hoteles cumplen` };
  } catch (e) {
    return { accion: "error", detalle: e instanceof Error ? e.message : String(e) };
  }
}

export async function chequearTodasBusquedas() {
  const activas = await store().busquedas(true);
  const salida = [];
  for (const b of activas) salida.push({ busqueda: b.id, ...(await chequearBusqueda(b)) });
  return salida;
}

/** Búsqueda de un hotel en particular: su tarifa más barata, de la categoría pedida si hay una. */
async function unHotel(b: Busqueda, consulta: { checkIn: string; checkOut: string; adultos: number; moneda: string }) {
  const lista = (await tarifas({ ...consulta, hotelId: b.hotel_id! })).filter((t) => !b.categoria || t.categoria === b.categoria);
  const mejor = lista.sort((x, y) => x.total - y.total)[0];
  if (!mejor) return [];
  return [
    {
      hotelId: b.hotel_id!,
      nombre: b.hotel_nombre ?? "Hotel",
      direccion: null,
      estrellas: null,
      lat: null,
      lon: null,
      total: mejor.total,
      habitacion: b.categoria && esCategoria(b.categoria) ? `${CATEGORIAS[b.categoria]} · ${mejor.nombre}` : mejor.nombre,
      cancelacionGratis: mejor.cancelacionGratis,
    },
  ];
}
