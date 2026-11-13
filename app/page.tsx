import RegistroForm from "@/components/RegistroForm";
import { ALERT_MIN_PCT } from "@/lib/config";
import { hoy } from "@/lib/format";
import { paises } from "@/lib/paises";

export const dynamic = "force-dynamic";

// Test A/B 1 del Obligatorio 2: mensaje de ahorro (a) frente a tranquilidad (b).
// Compartí /?v=a o /?v=b en cada canal; sin parámetro se asigna al azar.
const MENSAJES = {
  a: { titulo: "¿Pagaste de más por tu hotel?", bajada: "Te avisamos si baja el precio de tu reserva, mientras todavía puedas cancelar gratis." },
  b: { titulo: "Reservá y olvidate.", bajada: "Nosotros vigilamos el precio por vos y te avisamos si podés pagar menos por la misma estadía." },
};

export default async function Home({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const variante = v === "a" || v === "b" ? v : Math.random() < 0.5 ? "a" : "b";
  const m = MENSAJES[variante];

  return (
    <main>
      <div className="wrap">
        <section className="hero">
          <div className="hero-copy">
            <span className="tag">Para quien ya reservó</span>
            <h1>{m.titulo}</h1>
            <p className="lead">{m.bajada}</p>
            <div className="row">
              <a className="btn" href="#registro">
                Registrar mi reserva
              </a>
              <span className="muted">Gratis durante el piloto</span>
            </div>
          </div>

          <div>
            <div className="ticket" aria-label="Ejemplo de alerta">
              <div className="ticket-main">
                <div className="ticket-head">
                  <div>
                    <div className="ticket-hotel">Hotel Costa Brava</div>
                    <div className="ticket-sub">Florianópolis · 12 al 19 ene · Doble con desayuno</div>
                  </div>
                  <span className="pill drop">−14%</span>
                </div>
                <div className="prices">
                  <div>
                    <div className="price-label">Pagaste</div>
                    <div className="price old">US$ 412</div>
                  </div>
                  <div>
                    <div className="price-label">Hoy en Booking</div>
                    <div className="price new">US$ 356</div>
                  </div>
                </div>
              </div>
              <div className="ticket-stub">
                <span>
                  <span className="price-label">Cancelación gratis hasta</span>
                  <br />
                  <b className="mono">5 ene</b>
                </span>
                <span className="mono">Ahorrás US$ 56</span>
              </div>
            </div>
            <p className="example-note">Ejemplo de alerta</p>
          </div>
        </section>

        <section className="block">
          <h2>Cómo funciona</h2>
          <ol className="steps">
            <li>
              <h3>Cargás tu reserva</h3>
              <p>Elegís tu hotel y tu tipo de habitación de la lista, cuánto pagaste y hasta cuándo podés cancelar gratis. No te pedimos claves.</p>
            </li>
            <li>
              <h3>Vigilamos el precio</h3>
              <p>Varias veces por día buscamos tu misma categoría de habitación más barata y miramos cuánto está el hotel en Agoda, Booking y otras webs.</p>
            </li>
            <li>
              <h3>Te avisamos a tiempo</h3>
              <p>
                Si baja al menos {ALERT_MIN_PCT}%, te mandamos la alerta con el paso a paso para cancelar gratis y volver a
                reservar más barato.
              </p>
            </li>
          </ol>
        </section>

        <section className="block narrow" id="registro">
          <div className="stack">
            <h2>Registrá tu reserva</h2>
            <p className="muted" style={{ margin: 0 }}>
              Tarda un minuto. Tené a mano el mail de confirmación.
            </p>
          </div>
          <RegistroForm variante={variante} hoy={hoy()} paises={paises()} />
        </section>
      </div>
    </main>
  );
}
