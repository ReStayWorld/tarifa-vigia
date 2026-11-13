"use client";

import { useState } from "react";

/** Dos caminos: "ya reservé" (vigilamos la reserva) o "todavía no reservé" (buscamos por zona y precio). */
export default function Modos({ inicial, reservado, buscar }: { inicial: "reserva" | "busqueda"; reservado: React.ReactNode; buscar: React.ReactNode }) {
  const [modo, setModo] = useState(inicial);
  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="modos" role="tablist" aria-label="¿Ya reservaste?">
        <button type="button" role="tab" aria-selected={modo === "reserva"} className={modo === "reserva" ? "on" : ""} onClick={() => setModo("reserva")}>
          <b>Ya reservé</b>
          <span>Te avisamos si baja el precio de tu reserva</span>
        </button>
        <button type="button" role="tab" aria-selected={modo === "busqueda"} className={modo === "busqueda" ? "on" : ""} onClick={() => setModo("busqueda")}>
          <b>Todavía no reservé</b>
          <span>Te avisamos cuando aparezca un hotel en tu zona y precio</span>
        </button>
      </div>
      <div role="tabpanel">{modo === "reserva" ? reservado : buscar}</div>
    </div>
  );
}
