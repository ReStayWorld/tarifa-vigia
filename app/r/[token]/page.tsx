import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ALERT_MIN_PCT, BRAND, CHECK_EVERY_HOURS } from "@/lib/config";
import { ahorroPct, diasHasta, fecha, fechaHora, noches, plata } from "@/lib/format";
import { store } from "@/lib/store";
import { darDeBaja, reactivar, responder } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Mi reserva · ${BRAND}`, robots: { index: false } };

const ESTADOS: Record<string, string> = {
  activa: "Vigilando",
  cambiada: "Cambiaste la reserva",
  no_cambia: "Decidiste no cambiarla",
  baja: "Pausada",
  finalizada: "Venció la cancelación gratis",
};

export default async function MiReserva({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ nuevo?: string; gracias?: string }>;
}) {
  const { token } = await params;
  const { nuevo, gracias } = await searchParams;
  const db = store();
  const r = await db.reservaPorToken(token);
  if (!r) notFound();
  const historial = await db.chequeos(r.id);

  const pct = ahorroPct(r.precio_pagado, r.precio_actual);
  const dias = diasHasta(r.cancelacion_hasta);
  const hayAlerta =
    r.estado === "activa" && pct != null && pct >= ALERT_MIN_PCT && r.cancelacion_gratis_actual !== false && dias >= 0;
  const ahorro = r.precio_actual != null ? r.precio_pagado - r.precio_actual : null;
  const vence = dias < 0 ? "Ya venció" : dias === 0 ? "Vence hoy" : dias === 1 ? "Vence mañana" : `Faltan ${dias} días`;

  return (
    <main className="wrap narrow" style={{ display: "grid", gap: 24, paddingBlock: "8px 40px" }}>
      {nuevo && <p className="ok">Listo, tu reserva quedó registrada. Te mandamos un mail con el link a esta página.</p>}
      {gracias && <p className="ok">Gracias por contarnos. Nos ayuda mucho para el piloto.</p>}

      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)" }}>Tu reserva</h1>
        <span className={`pill ${r.estado === "activa" ? "drop" : "neutral"}`}>{ESTADOS[r.estado]}</span>
      </div>

      <div className="ticket">
        <div className="ticket-main">
          <div className="ticket-head">
            <div>
              <div className="ticket-hotel">{r.hotel}</div>
              <div className="ticket-sub">
                {r.ciudad} · {fecha(r.check_in)} al {fecha(r.check_out)} · {noches(r.check_in, r.check_out)} noches ·{" "}
                {r.habitacion}
              </div>
            </div>
            {pct != null && (
              <span className={`pill ${pct > 0 ? "drop" : "neutral"}`}>
                {pct > 0 ? `−${pct}%` : pct === 0 ? "Igual" : `+${Math.abs(pct)}%`}
              </span>
            )}
          </div>
          <div className="prices">
            <div>
              <div className="price-label">Pagaste en {r.plataforma}</div>
              <div className={`price ${hayAlerta ? "old" : ""}`}>{plata(r.precio_pagado, r.moneda)}</div>
            </div>
            <div>
              <div className="price-label">Hoy{r.fuente_actual ? ` en ${r.fuente_actual}` : ""}</div>
              <div className={`price ${hayAlerta ? "new" : ""}`}>{plata(r.precio_actual, r.moneda)}</div>
            </div>
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            Último chequeo: {fechaHora(r.ultimo_chequeo)} · revisamos cada {CHECK_EVERY_HOURS} h
          </div>
        </div>
        <div className="ticket-stub">
          <span>
            <span className="price-label">Cancelación gratis hasta</span>
            <br />
            <b className="mono">{fecha(r.cancelacion_hasta)}</b>
          </span>
          <span className={`pill ${dias <= 2 ? "warn" : "neutral"}`}>{vence}</span>
        </div>
      </div>

      {hayAlerta && ahorro != null && (
        <section className="panel alert-panel">
          <h2>Podés ahorrar {plata(ahorro, r.moneda)}</h2>
          <p style={{ margin: 0 }}>
            Encontramos tu misma estadía a {plata(r.precio_actual, r.moneda)}
            {r.fuente_actual ? ` en ${r.fuente_actual}` : ""}.{" "}
            {r.cancelacion_gratis_actual === true
              ? "La oferta también tiene cancelación gratis."
              : "Revisá la política de cancelación de la oferta antes de reservar."}
          </p>
          <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>
            <li>Reservá la nueva opción y revisá que sea la misma habitación y los mismos servicios.</li>
            <li>Confirmá que la nueva reserva quedó confirmada.</li>
            <li>
              Cancelá tu reserva anterior en {r.plataforma} antes del <b>{fecha(r.cancelacion_hasta)}</b>.
            </li>
          </ol>
          {r.link_actual && (
            <div>
              <a className="btn go" href={r.link_actual} target="_blank" rel="noopener noreferrer">
                Ver la oferta
              </a>
            </div>
          )}
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            La decisión es tuya. Los precios cambian rápido: confirmá el monto antes de pagar.
          </p>
        </section>
      )}

      {(r.ultima_alerta_at || r.estado === "cambiada" || r.estado === "no_cambia") && (
        <section className="panel">
          <h3>¿Qué hiciste con la alerta?</h3>
          <form action={responder.bind(null, token)} className="stack">
            <div className="row">
              <label className="check">
                <input type="radio" name="respuesta" value="cambie" defaultChecked={r.respuesta === "cambie"} required />
                <span>Cambié la reserva</span>
              </label>
              <label className="check">
                <input type="radio" name="respuesta" value="no_cambio" defaultChecked={r.respuesta === "no_cambio"} />
                <span>No la voy a cambiar</span>
              </label>
            </div>
            <div className="grid2">
              <div className="field">
                <label htmlFor="precio_nuevo">Si cambiaste: ¿cuánto pagaste?</label>
                <input id="precio_nuevo" name="precio_nuevo" inputMode="decimal" className="mono" defaultValue={r.precio_nuevo ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="motivo">Si no: ¿qué te frenó?</label>
                <input id="motivo" name="motivo" placeholder="Ej.: no confié en la otra plataforma" defaultValue={r.motivo ?? ""} />
              </div>
            </div>
            <div className="field">
              <span style={{ fontSize: 14, fontWeight: 600 }}>¿Qué tan confiable te pareció la comparación? (1 a 5)</span>
              <div className="rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n}>
                    <input type="radio" name="confianza" value={n} defaultChecked={r.confianza === n} />
                    <span>{n}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <button className="btn small" type="submit">
                Enviar respuesta
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel">
        <h3>Historial de precios</h3>
        {historial.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Todavía no hicimos el primer chequeo. Pasá en unas horas.
          </p>
        ) : (
          <ul className="history">
            {historial.slice(0, 20).map((c) => (
              <li key={c.id}>
                <span className="when">{fechaHora(c.created_at)}</span>
                <span>
                  <span className="mono">{plata(c.precio, r.moneda)}</span>
                  {c.fuente ? <span className="muted"> · {c.fuente}</span> : null}
                  {c.nota ? <span className="muted"> · {c.nota}</span> : null}
                </span>
                <span className={`pill ${c.alerta ? "drop" : "neutral"}`}>
                  {c.ahorro_pct == null ? "—" : c.ahorro_pct > 0 ? `−${c.ahorro_pct}%` : c.ahorro_pct === 0 ? "Igual" : `+${-c.ahorro_pct}%`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="row">
        {r.estado === "activa" ? (
          <form action={darDeBaja.bind(null, token)}>
            <button className="btn ghost small" type="submit">
              Dejar de vigilar esta reserva
            </button>
          </form>
        ) : r.estado === "baja" ? (
          <form action={reactivar.bind(null, token)}>
            <button className="btn ghost small" type="submit">
              Volver a vigilarla
            </button>
          </form>
        ) : null}
        <span className="muted" style={{ fontSize: 13 }}>
          Guardá el link de esta página: es tu acceso a la reserva.
        </span>
      </div>
    </main>
  );
}
