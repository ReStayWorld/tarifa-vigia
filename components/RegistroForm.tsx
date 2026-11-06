"use client";

import { useActionState, useState } from "react";
import { registrar, type EstadoForm } from "@/app/actions";

const PLATAFORMAS = ["Booking.com", "Airbnb", "Expedia", "Despegar", "Hotels.com", "Sitio del hotel", "Agencia de viajes", "Otra"];

export default function RegistroForm({ variante, hoy }: { variante: string; hoy: string }) {
  const [estado, accion, enviando] = useActionState<EstadoForm, FormData>(registrar, { error: null });
  const [checkIn, setCheckIn] = useState("");

  return (
    <form action={accion} className="form" noValidate={false}>
      <input type="hidden" name="variante" value={variante} />

      <fieldset>
        <legend>Tu reserva</legend>
        <div className="grid2">
          <div className="field">
            <label htmlFor="hotel">Hotel</label>
            <input id="hotel" name="hotel" required placeholder="Ej.: Hotel Fasano Las Piedras" autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="ciudad">Ciudad</label>
            <input id="ciudad" name="ciudad" required placeholder="Ej.: Punta del Este" />
          </div>
        </div>
        <div className="grid3">
          <div className="field">
            <label htmlFor="check_in">Entrada</label>
            <input id="check_in" name="check_in" type="date" required min={hoy} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="check_out">Salida</label>
            <input id="check_out" name="check_out" type="date" required min={checkIn || hoy} />
          </div>
          <div className="field">
            <label htmlFor="huespedes">Huéspedes</label>
            <input id="huespedes" name="huespedes" type="number" min={1} max={10} defaultValue={2} required />
          </div>
        </div>
        <div className="grid2">
          <div className="field">
            <label htmlFor="habitacion">Tipo de habitación</label>
            <input id="habitacion" name="habitacion" required placeholder="Ej.: Doble estándar con desayuno" />
          </div>
          <div className="field">
            <label htmlFor="plataforma">Dónde reservaste</label>
            <select id="plataforma" name="plataforma" required defaultValue="">
              <option value="" disabled>Elegí una opción</option>
              {PLATAFORMAS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Lo que pagaste y hasta cuándo podés cancelar</legend>
        <div className="grid3">
          <div className="field highlight">
            <label htmlFor="precio_pagado">Precio total pagado</label>
            <input id="precio_pagado" name="precio_pagado" inputMode="decimal" required placeholder="412" className="mono" />
          </div>
          <div className="field">
            <label htmlFor="moneda">Moneda</label>
            <select id="moneda" name="moneda" defaultValue="USD">
              <option value="USD">Dólares (US$)</option>
              <option value="UYU">Pesos ($U)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="fecha_reserva">Día que reservaste</label>
            <input id="fecha_reserva" name="fecha_reserva" type="date" required max={hoy} />
          </div>
        </div>
        <div className="field highlight">
          <label htmlFor="cancelacion_hasta">Cancelación gratis hasta</label>
          <input id="cancelacion_hasta" name="cancelacion_hasta" type="date" required min={hoy} max={checkIn || undefined} />
          <span className="hint">Lo encontrás en el mail de confirmación. Te avisamos solo mientras puedas cancelar sin costo.</span>
        </div>
      </fieldset>

      <fieldset>
        <legend>Dónde te avisamos</legend>
        <div className="grid2">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" placeholder="vos@mail.com" />
          </div>
          <div className="field">
            <label htmlFor="whatsapp">WhatsApp (opcional)</label>
            <input id="whatsapp" name="whatsapp" type="tel" autoComplete="tel" placeholder="099 123 456" />
          </div>
        </div>
        <label className="check">
          <input type="checkbox" name="acepto" required />
          <span>
            Entiendo que es un piloto académico, que no me piden claves de ninguna plataforma y que la decisión de
            cambiar la reserva es mía.
          </span>
        </label>
      </fieldset>

      {estado.error && (
        <p className="error" role="alert">
          {estado.error}
        </p>
      )}

      <div>
        <button className="btn" type="submit" disabled={enviando}>
          {enviando ? "Registrando…" : "Empezar a vigilar mi reserva"}
        </button>
      </div>
    </form>
  );
}
