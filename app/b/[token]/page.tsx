import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORIAS, esCategoria } from "@/lib/categorias";
import { BRAND, CHECK_EVERY_HOURS } from "@/lib/config";
import { fecha, fechaHora, noches, plata } from "@/lib/format";
import { store } from "@/lib/store";
import { linkWeb } from "@/lib/webs";
import { pausarBusqueda } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Mi búsqueda · ${BRAND}`, robots: { index: false } };

const ESTADOS = { activa: "Buscando", pausada: "Pausada", finalizada: "Terminada" };

export default async function MiBusqueda({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ nueva?: string }> }) {
  const { token } = await params;
  const { nueva } = await searchParams;
  const b = await store().busquedaPorToken(token);
  if (!b) notFound();

  const donde = b.hotel_nombre
    ? `${b.hotel_nombre}${b.categoria && esCategoria(b.categoria) ? ` · ${CATEGORIAS[b.categoria]}` : ""}, ${b.ciudad}`
    : b.zona
      ? `${b.zona}, ${b.ciudad} (hasta ${b.radio_km ?? 2} km)`
      : b.ciudad;

  return (
    <main className="wrap narrow" style={{ display: "grid", gap: 24, paddingBlock: "8px 40px" }}>
      {nueva && <p className="ok">Listo, guardamos tu búsqueda. Te mandamos un mail con el link a esta página.</p>}

      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)" }}>Tu búsqueda</h1>
        <span className={`pill ${b.estado === "activa" ? "drop" : "neutral"}`}>{ESTADOS[b.estado]}</span>
      </div>

      <div className="ticket">
        <div className="ticket-main">
          <div className="ticket-hotel">{donde}</div>
          <div className="ticket-sub">
            {fecha(b.check_in)} al {fecha(b.check_out)} · {noches(b.check_in, b.check_out)} noches · {b.huespedes} adultos
            {b.estrellas_min ? ` · ${b.estrellas_min} estrellas o más` : ""}
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            Último chequeo: {fechaHora(b.ultimo_chequeo)} · revisamos cada {CHECK_EVERY_HOURS} h
          </div>
        </div>
        <div className="ticket-stub">
          <span>
            <span className="price-label">Máximo por noche</span>
            <br />
            <b className="mono">{plata(b.tope_noche, b.moneda)}</b>
          </span>
          <span className={`pill ${b.resultados.length ? "drop" : "neutral"}`}>
            {b.resultados.length === 1 ? "1 hotel cumple" : `${b.resultados.length} hoteles cumplen`}
          </span>
        </div>
      </div>

      <section className="panel">
        <h3>{b.hotel_nombre ? "Precio de hoy" : "Hoteles que cumplen hoy"}</h3>
        {b.resultados.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {b.hotel_nombre
              ? `Todavía no baja de ${plata(b.tope_noche, b.moneda)} la noche. Seguimos mirando y te escribimos apenas baje.`
              : "Todavía no hay hoteles con esas condiciones. Seguimos buscando y te escribimos apenas aparezca uno."}
          </p>
        ) : (
          <ul className="resultados">
            {b.resultados.map((h) => (
              <li key={h.hotel_id}>
                <span>
                  <b>{h.nombre}</b>
                  {h.estrellas ? <span className="muted"> {"★".repeat(Math.round(h.estrellas))}</span> : null}
                  <br />
                  <span className="muted" style={{ fontSize: 14 }}>
                    {[h.direccion, h.distancia_km != null ? `a ${h.distancia_km} km de ${b.zona}` : null].filter(Boolean).join(" · ")}
                  </span>
                  <br />
                  <span className="muted" style={{ fontSize: 13 }}>
                    {h.donde ? `${h.donde} · ${h.habitacion}` : `${h.habitacion} · ${h.cancelacion_gratis ? "cancelación gratis" : "sin cancelación gratis"}`}
                  </span>
                </span>
                <span className="precio">
                  <b className="mono">{plata(h.por_noche, b.moneda)}</b>
                  <br />
                  <span className="muted" style={{ fontSize: 13 }}>por noche</span>
                  <br />
                  <a href={linkWeb(h.donde ?? "Booking.com", h.nombre, b.ciudad, b.check_in, b.check_out, b.huespedes)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
                    Buscar en {h.donde?.split(" con ")[0].replace(/\.com$/, "") ?? "Booking"}
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Precios de nuestro proveedor de hoteles. En otras webs pueden variar un poco: confirmá el precio antes de reservar.
        </p>
      </section>

      {b.estado !== "finalizada" && (
        <div className="row">
          <form action={pausarBusqueda.bind(null, token)}>
            <button className="btn ghost small" type="submit">
              {b.estado === "activa" ? "Pausar esta búsqueda" : "Volver a buscar"}
            </button>
          </form>
          <span className="muted" style={{ fontSize: 13 }}>
            Guardá el link de esta página: es tu acceso a la búsqueda.
          </span>
        </div>
      )}
    </main>
  );
}
