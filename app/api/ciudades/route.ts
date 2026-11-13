import { NextResponse } from "next/server";
import { permitido } from "@/lib/limite";
import { ciudades } from "@/lib/proveedores";

export const dynamic = "force-dynamic";

/** Ciudades de un país: /api/ciudades?pais=UY */
export async function GET(req: Request) {
  if (!permitido(req)) return NextResponse.json({ error: "Demasiadas búsquedas, esperá un minuto." }, { status: 429 });
  const pais = (new URL(req.url).searchParams.get("pais") ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(pais)) return NextResponse.json({ ciudades: [] });
  try {
    return NextResponse.json({ ciudades: await ciudades(pais) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No pudimos traer las ciudades. Probá de nuevo en un rato." }, { status: 502 });
  }
}
