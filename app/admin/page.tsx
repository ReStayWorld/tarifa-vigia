import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "@/components/LoginForm";
import { BRAND, CHECK_EVERY_HOURS } from "@/lib/config";
import { ahorroPct, diasHasta, fecha, fechaHora, plata } from "@/lib/format";
import { store } from "@/lib/store";
import { modoDemo } from "@/lib/proveedores";
import { chequearTodo, chequearUna, esAdmin, guardarTripadvisor, salir } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Panel · ${BRAND}`, robots: { index: false } };

const pctDe = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export default async function Admin() {
  if (!(await esAdmin())) {
    return (
      <main className="wrap" style={{ paddingBlock: "24px 48px" }}>
        <LoginForm />
      </main>
    );
  }

  const db = store();
  const [reservas, chequeos, busquedas] = await Promise.all([db.reservas(), db.chequeos(), db.busquedas()]);

  // Métricas del experimento (sección 7.2 del Obligatorio 2).
  const chequeadas = new Set(chequeos.filter((c) => c.precio != null).map((c) => c.reserva_id));
  const con10 = new Set(chequeos.filter((c) => (c.ahorro_pct ?? 0) >= 10).map((c) => c.reserva_id));
  const alertadas = reservas.filter((r) => r.ultima_alerta_at);
  const cambiadas = reservas.filter((r) => r.estado === "cambiada");
  const calificaron = reservas.filter((r) => r.confianza != null);
  const confiables = calificaron.filter((r) => (r.confianza ?? 0) >= 4);
  const ahorroTotal = cambiadas.reduce((s, r) => s + (r.precio_nuevo != null ? r.precio_pagado - r.precio_nuevo : 0), 0);
  const porVariante = (v: string) => reservas.filter((r) => r.variante === v).length;

  return (
    <main className="wrap" style={{ display: "grid", gap: 24, paddingBlock: "8px 48px" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)" }}>Panel del equipo</h1>
        <div className="row">
          <form action={chequearTodo}>
            <button className="btn small" type="submit">
              Chequear todas ahora
            </button>
          </form>
          <form action={salir}>
            <button className="btn ghost small" type="submit">
              Salir
            </button>
          </form>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <b>{reservas.length}</b>
          <span>
            Reservas registradas (SH2) · A: {porVariante("a")} · B: {porVariante("b")}
          </span>
        </div>
        <div className="stat">
          <b>{pctDe(con10.size, chequeadas.size)}</b>
          <span>
            Con ahorro ≥ 10% (SH1) · {con10.size} de {chequeadas.size}
          </span>
        </div>
        <div className="stat">
          <b>{alertadas.length}</b>
          <span>Reservas alertadas</span>
        </div>
        <div className="stat">
          <b>{pctDe(cambiadas.length, alertadas.length)}</b>
          <span>
            Cambiaron la reserva (SH5) · {cambiadas.length} de {alertadas.length}
          </span>
        </div>
        <div className="stat">
          <b>{pctDe(confiables.length, calificaron.length)}</b>
          <span>
            Confianza 4 o 5 (SH4) · n = {calificaron.length}
          </span>
        </div>
        <div className="stat">
          <b>{plata(ahorroTotal, "USD")}</b>
          <span>Ahorro logrado (solo reservas en US$)</span>
        </div>
        <div className="stat">
          <b>{modoDemo() ? "Demo" : "LiteAPI"}</b>
          <span>Fuente de precios · chequeo cada {CHECK_EVERY_HOURS} h</span>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Reserva</th>
              <th>Pagó</th>
              <th>Hoy</th>
              <th>Ahorro</th>
              <th>Cancela gratis</th>
              <th>Estado</th>
              <th>Respuesta</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reservas.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  Todavía no hay reservas. Compartí la página principal (/?v=a o /?v=b) para empezar.
                </td>
              </tr>
            )}
            {reservas.map((r) => {
              const pct = ahorroPct(r.precio_pagado, r.precio_actual);
              const dias = diasHasta(r.cancelacion_hasta);
              return (
                <tr key={r.id}>
                  <td>
                    <Link href={`/r/${r.token}`}>
                      <b>{r.hotel}</b>
                    </Link>
                    <div className="muted">
                      {r.ciudad} · {fecha(r.check_in)}–{fecha(r.check_out)} · {r.plataforma}
                    </div>
                    <div className="muted">
                      {r.email}
                      {r.whatsapp ? ` · ${r.whatsapp}` : ""}
                    </div>
                  </td>
                  <td className="num">{plata(r.precio_pagado, r.moneda)}</td>
                  <td className="num">
                    {plata(r.precio_actual, r.moneda)}
                    <div className="muted">{r.fuente_actual ?? ""}</div>
                    <div className="muted">{fechaHora(r.ultimo_chequeo)}</div>
                  </td>
                  <td className="num">
                    {pct == null ? "—" : <span className={`pill ${pct >= 5 ? "drop" : "neutral"}`}>{pct}%</span>}
                  </td>
                  <td className="num">
                    {fecha(r.cancelacion_hasta)}
                    <div>
                      <span className={`pill ${dias <= 2 ? "warn" : "neutral"}`}>{dias < 0 ? "vencida" : `${dias} d`}</span>
                    </div>
                  </td>
                  <td>
                    {r.estado}
                    {r.ultima_alerta_at && <div className="muted">Alerta {fechaHora(r.ultima_alerta_at)}</div>}
                  </td>
                  <td>
                    {r.respuesta === "cambie" ? `Cambió${r.precio_nuevo ? ` a ${plata(r.precio_nuevo, r.moneda)}` : ""}` : r.respuesta === "no_cambio" ? "No cambia" : "—"}
                    {r.confianza != null && <div className="muted">Confianza {r.confianza}/5</div>}
                    {r.motivo && <div className="muted">“{r.motivo}”</div>}
                  </td>
                  <td>
                    {r.estado === "activa" && (
                      <form action={chequearUna.bind(null, r.id)}>
                        <button className="btn ghost small" type="submit">
                          Chequear
                        </button>
                      </form>
                    )}
                    <form action={guardarTripadvisor.bind(null, r.id)} className="stack" style={{ gap: 6, marginTop: 8, minWidth: 220 }}>
                      <label className="muted" htmlFor={`ta-${r.id}`} style={{ fontSize: 12 }}>
                        {r.xotelo_key ? `Precios por web: ${r.xotelo_key}` : "Link de TripAdvisor del hotel (para precios en Agoda, Booking…)"}
                      </label>
                      <input id={`ta-${r.id}`} name="tripadvisor" placeholder="https://www.tripadvisor.com/Hotel_Review-g…" style={{ minHeight: 36, padding: "6px 8px", fontSize: 13 }} />
                      <button className="btn ghost small" type="submit">
                        Guardar
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Búsquedas antes de reservar</h2>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Dónde</th>
              <th>Fechas</th>
              <th>Máximo por noche</th>
              <th>Hoteles que cumplen</th>
              <th>Avisados</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {busquedas.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Todavía no hay búsquedas. Se crean desde la página principal, en "Todavía no reservé" (/?modo=buscar).
                </td>
              </tr>
            )}
            {busquedas.map((b) => (
              <tr key={b.id}>
                <td>
                  <Link href={`/b/${b.token}`}>
                    <b>{b.zona ? `${b.zona}, ${b.ciudad}` : b.ciudad}</b>
                  </Link>
                  <div className="muted">{b.email}</div>
                </td>
                <td className="num">
                  {fecha(b.check_in)}–{fecha(b.check_out)}
                </td>
                <td className="num">{plata(b.tope_noche, b.moneda)}</td>
                <td className="num">{b.resultados.length}</td>
                <td className="num">{Object.keys(b.avisados).length}</td>
                <td>
                  {b.estado}
                  <div className="muted">{fechaHora(b.ultimo_chequeo)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
