import { NextResponse } from "next/server";
import { permitido } from "@/lib/limite";
import { buscarHoteles } from "@/lib/proveedores";

export const dynamic = "force-dynamic";

/** Autocompletado de hoteles: /api/hoteles?pais=BR&q=castel */
export async function GET(req: Request) {
  if (!permitido(req)) return NextResponse.json({ error: "Demasiadas búsquedas, esperá un minuto." }, { status: 429 });
  const url = new URL(req.url);
  const pais = (url.searchParams.get("pais") ?? "").toUpperCase();
  const q = url.searchParams.get("q") ?? "";
  if (!/^[A-Z]{2}$/.test(pais)) return NextResponse.json({ hoteles: [] });
  try {
    return NextResponse.json({ hoteles: await buscarHoteles(pais, q) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No pudimos buscar hoteles ahora. Probá de nuevo en un rato." }, { status: 502 });
  }
}
