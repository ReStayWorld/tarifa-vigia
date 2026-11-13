"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { registrar, type EstadoForm } from "@/app/actions";
import type { OpcionCategoria } from "@/app/api/categorias/route";
import type { HotelOpcion } from "@/lib/proveedores";

const PLATAFORMAS = ["Booking.com", "Agoda", "Airbnb", "Expedia", "Despegar", "Hotels.com", "Trip.com", "Sitio del hotel", "Agencia de viajes", "Otra"];

const plata = (n: number | null, moneda: string) =>
  n == null ? "—" : `${moneda === "USD" ? "US$" : "$U"} ${new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 }).format(n)}`;

export default function RegistroForm({ variante, hoy, paises }: { variante: string; hoy: string; paises: { codigo: string; nombre: string }[] }) {
  const [estado, accion, enviando] = useActionState<EstadoForm, FormData>(registrar, { error: null });

  const [pais, setPais] = useState("BR");
  const [hotel, setHotel] = useState<HotelOpcion | null>(null);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adultos, setAdultos] = useState(2);
  const [moneda, setMoneda] = useState("USD");
  const [categoria, setCategoria] = useState("");

  const [cats, setCats] = useState<OpcionCategoria[] | null>(null);
  const [sinPrecios, setSinPrecios] = useState(false);
  const [catsCargando, setCatsCargando] = useState(false);
  const [catsError, setCatsError] = useState<string | null>(null);

  // Al tener hotel, fechas y huéspedes, traemos las categorías que ese hotel tiene de verdad.
  useEffect(() => {
    setCategoria("");
    setCats(null);
    setCatsError(null);
    if (!hotel || !checkIn || !checkOut || checkOut <= checkIn) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setCatsCargando(true);
      try {
        const p = new URLSearchParams({ hotel: hotel.id, in: checkIn, out: checkOut, adultos: String(adultos), moneda });
        const res = await fetch(`/api/categorias?${p}`, { signal: ctrl.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setCats(json.categorias);
        setSinPrecios(json.sinPrecios);
      } catch (e) {
        if (!ctrl.signal.aborted) setCatsError(e instanceof Error && e.message ? e.message : "No pudimos traer las habitaciones.");
      } finally {
        if (!ctrl.signal.aborted) setCatsCargando(false);
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [hotel, checkIn, checkOut, adultos, moneda]);

  return (
    <form action={accion} className="form">
      <input type="hidden" name="variante" value={variante} />
      <input type="hidden" name="hotel_id" value={hotel?.id ?? ""} />
      <input type="hidden" name="hotel" value={hotel?.nombre ?? ""} />
      <input type="hidden" name="ciudad" value={hotel?.ciudad ?? ""} />

      <fieldset>
        <legend>Tu hotel</legend>
        <div className="grid2">
          <div className="field">
            <label htmlFor="pais">País</label>
            <select
              id="pais"
              name="pais"
              value={pais}
              onChange={(e) => {
                setPais(e.target.value);
                setHotel(null);
              }}
            >
              {paises.map((p) => (
                <option key={p.codigo} value={p.codigo}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <BuscadorHotel pais={pais} elegido={hotel} onElegir={setHotel} />
        </div>
        <div className="grid3">
          <div className="field">
            <label htmlFor="check_in">Entrada</label>
            <input id="check_in" name="check_in" type="date" required min={hoy} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="check_out">Salida</label>
            <input id="check_out" name="check_out" type="date" required min={checkIn || hoy} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="huespedes">Adultos</label>
            <input id="huespedes" name="huespedes" type="number" min={1} max={10} required value={adultos} onChange={(e) => setAdultos(Number(e.target.value) || 1)} />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Tu habitación</legend>
        {!hotel || !checkIn || !checkOut ? (
          <p className="muted" style={{ margin: 0 }}>
            Elegí el hotel y las fechas para ver las categorías de habitación que tiene.
          </p>
        ) : catsCargando ? (
          <p className="muted" style={{ margin: 0 }} aria-live="polite">
            Buscando las habitaciones de {hotel.nombre}…
          </p>
        ) : catsError ? (
          <p className="error">{catsError}</p>
        ) : cats ? (
          <>
          {sinPrecios && (
            <p className="muted" style={{ margin: 0 }}>
              Hoy no conseguimos precios de este hotel para esas fechas. Igual podés registrarla: la seguimos vigilando y te avisamos si aparece más barata.
            </p>
          )}
          <div className="cats" role="radiogroup" aria-label="Categoría de habitación">
            {cats.map((c) => (
              <label key={c.categoria} className="cat">
                <input type="radio" name="categoria" value={c.categoria} required checked={categoria === c.categoria} onChange={() => setCategoria(c.categoria)} />
                <span className="cat-body">
                  <b>{c.etiqueta}</b>
                  <span className="muted">{c.ejemplos.join(" · ")}</span>
                  {!sinPrecios && (
                    <span className="mono">{`hoy desde ${plata(c.desde, c.moneda)}`}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
          </>
        ) : null}
        <span className="hint">Comparamos siempre la misma categoría. Si reservaste una suite, te avisamos solo por suites.</span>
      </fieldset>

      <fieldset>
        <legend>Lo que pagaste y hasta cuándo podés cancelar</legend>
        <div className="grid2">
          <div className="field">
            <label htmlFor="plataforma">Dónde reservaste</label>
            <select id="plataforma" name="plataforma" required defaultValue="">
              <option value="" disabled>
                Elegí una opción
              </option>
              {PLATAFORMAS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="fecha_reserva">Día que reservaste</label>
            <input id="fecha_reserva" name="fecha_reserva" type="date" required max={hoy} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="genius">¿Tenés Genius de Booking?</label>
          <select id="genius" name="genius" defaultValue="">
            <option value="" disabled>
              Elegí una opción
            </option>
            <option value="0">No tengo Genius</option>
            <option value="1">Sí, nivel 1</option>
            <option value="2">Sí, nivel 2</option>
            <option value="3">Sí, nivel 3</option>
            <option value="nose">No sé</option>
          </select>
          <span className="hint">Lo ves en tu cuenta de Booking.com. Con Genius, los hoteles que participan te muestran precios más bajos, y los tenemos en cuenta al comparar.</span>
        </div>
        <div className="grid2">
          <div className="field highlight">
            <label htmlFor="precio_pagado">Precio total de la estadía</label>
            <input id="precio_pagado" name="precio_pagado" inputMode="decimal" required placeholder="412" className="mono" />
            <span className="hint">El total con impuestos, como figura en tu confirmación.</span>
          </div>
          <div className="field">
            <label htmlFor="moneda">Moneda</label>
            <select id="moneda" name="moneda" value={moneda} onChange={(e) => setMoneda(e.target.value)}>
              <option value="USD">Dólares (US$)</option>
              <option value="UYU">Pesos ($U)</option>
            </select>
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
          <span>Entiendo que es un piloto académico, que no me piden claves de ninguna plataforma y que la decisión de cambiar la reserva es mía.</span>
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

function BuscadorHotel({ pais, elegido, onElegir }: { pais: string; elegido: HotelOpcion | null; onElegir: (h: HotelOpcion | null) => void }) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const [opciones, setOpciones] = useState<HotelOpcion[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [estado, setEstado] = useState<"" | "buscando" | "vacio" | "error">("");
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (elegido) setTexto(elegido.nombre);
  }, [elegido]);

  useEffect(() => {
    if (elegido && texto === elegido.nombre) return;
    if (texto.trim().length < 3) {
      setOpciones([]);
      setEstado("");
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setEstado("buscando");
      try {
        const res = await fetch(`/api/hoteles?${new URLSearchParams({ pais, q: texto })}`, { signal: ctrl.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setOpciones(json.hoteles);
        setActivo(-1);
        setAbierto(true);
        setEstado(json.hoteles.length ? "" : "vacio");
      } catch {
        if (!ctrl.signal.aborted) setEstado("error");
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [texto, pais, elegido]);

  useEffect(() => {
    const cerrar = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  const elegir = (h: HotelOpcion) => {
    onElegir(h);
    setTexto(h.nombre);
    setAbierto(false);
  };

  return (
    <div className="field combo" ref={caja}>
      <label htmlFor={`${id}-hotel`}>Hotel</label>
      <input
        id={`${id}-hotel`}
        role="combobox"
        aria-expanded={abierto && opciones.length > 0}
        aria-controls={`${id}-lista`}
        aria-autocomplete="list"
        aria-activedescendant={activo >= 0 ? `${id}-op-${activo}` : undefined}
        autoComplete="off"
        placeholder="Escribí al menos 3 letras del nombre"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          if (elegido) onElegir(null);
        }}
        onFocus={() => opciones.length && setAbierto(true)}
        onKeyDown={(e) => {
          if (!abierto || !opciones.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActivo((a) => Math.min(a + 1, opciones.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActivo((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && activo >= 0) {
            e.preventDefault();
            elegir(opciones[activo]);
          } else if (e.key === "Escape") {
            setAbierto(false);
          }
        }}
      />
      {abierto && opciones.length > 0 && (
        <ul className="combo-list" id={`${id}-lista`} role="listbox">
          {opciones.map((h, i) => (
            <li
              key={h.id}
              id={`${id}-op-${i}`}
              role="option"
              aria-selected={i === activo}
              className={i === activo ? "on" : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(h);
              }}
            >
              <b>{h.nombre}</b>
              <span className="muted">
                {[h.ciudad, h.direccion].filter(Boolean).join(" · ")}
                {h.estrellas ? ` · ${"★".repeat(Math.round(h.estrellas))}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      <span className="hint" aria-live="polite">
        {elegido
          ? `✓ ${elegido.ciudad}`
          : estado === "buscando"
            ? "Buscando…"
            : estado === "vacio"
              ? "No encontramos ese hotel en ese país. Probá con otra parte del nombre."
              : estado === "error"
                ? "No pudimos buscar ahora. Probá de nuevo."
                : "Elegilo de la lista para que vigilemos el hotel correcto."}
      </span>
    </div>
  );
}
