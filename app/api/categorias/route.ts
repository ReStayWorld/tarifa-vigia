import { NextResponse } from "next/server";
import { CATEGORIAS, categoriaDe, type Categoria } from "@/lib/categorias";
import { permitido } from "@/lib/limite";
import { habitacionesCatalogo, tarifas } from "@/lib/proveedores";

export const dynamic = "force-dynamic";

export type OpcionCategoria = {
  categoria: Categoria;
  etiqueta: string;
  desde: number | null; // precio más bajo de la categoría
  moneda: string;
  ejemplos: string[]; // nombres de habitaciones de esa categoría
};

const fechaOk = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Categorías de habitación que tiene un hotel para esas fechas: /api/categorias?hotel=..&in=..&out=..&adultos=2&moneda=USD */
export async function GET(req: Request) {
  if (!permitido(req, 15)) return NextResponse.json({ error: "Demasiadas búsquedas, esperá un minuto." }, { status: 429 });
  const u = new URL(req.url).searchParams;
  const hotelId = u.get("hotel");
  const checkIn = u.get("in");
  const checkOut = u.get("out");
  const adultos = Number(u.get("adultos") ?? 2);
  const moneda = u.get("moneda") === "UYU" ? "UYU" : "USD";
  if (!hotelId || !fechaOk(checkIn) || !fechaOk(checkOut) || checkOut <= checkIn || !(adultos >= 1 && adultos <= 10)) {
    return NextResponse.json({ error: "Elegí el hotel y las fechas primero." }, { status: 400 });
  }
  try {
    const lista = await tarifas({ hotelId, checkIn, checkOut, adultos, moneda });
    const grupos = new Map<Categoria, OpcionCategoria>();

    // Si hoy no hay tarifas, igual mostramos las habitaciones que el hotel tiene en su catálogo
    // (o todas las categorías), para que el viajero pueda registrar su reserva.
    if (!lista.length) {
      const nombres = await habitacionesCatalogo(hotelId).catch(() => []);
      for (const n of nombres) {
        const cat = categoriaDe(n);
        const g = grupos.get(cat) ?? { categoria: cat, etiqueta: CATEGORIAS[cat], desde: null, moneda, ejemplos: [] };
        if (!g.ejemplos.includes(n) && g.ejemplos.length < 3) g.ejemplos.push(n);
        grupos.set(cat, g);
      }
      if (!grupos.size) for (const cat of Object.keys(CATEGORIAS) as Categoria[]) grupos.set(cat, { categoria: cat, etiqueta: CATEGORIAS[cat], desde: null, moneda, ejemplos: [] });
    }

    for (const t of lista) {
      const g = grupos.get(t.categoria) ?? { categoria: t.categoria, etiqueta: CATEGORIAS[t.categoria], desde: null, moneda: t.moneda, ejemplos: [] };
      if (g.desde == null || t.total < g.desde) g.desde = t.total;
      if (!g.ejemplos.includes(t.nombre) && g.ejemplos.length < 3) g.ejemplos.push(t.nombre);
      grupos.set(t.categoria, g);
    }
    const orden = Object.keys(CATEGORIAS) as Categoria[];
    const categorias = [...grupos.values()].sort((a, b) => orden.indexOf(a.categoria) - orden.indexOf(b.categoria));
    return NextResponse.json({ categorias, sinPrecios: !lista.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No pudimos traer las habitaciones de ese hotel. Probá de nuevo en un rato." }, { status: 502 });
  }
}
