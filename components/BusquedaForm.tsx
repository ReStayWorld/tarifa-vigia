"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { crearBusqueda, type EstadoBusqueda } from "@/app/b/actions";
import { BuscadorHotel } from "@/components/RegistroForm";
import { CATEGORIAS } from "@/lib/categorias";
import type { HotelOpcion } from "@/lib/proveedores";

type Zona = { nombre: string; detalle: string; lat: number; lon: number };

export default function BusquedaForm({ hoy, paises }: { hoy: string; paises: { codigo: string; nombre: string }[] }) {
  const [estado, accion, enviando] = useActionState<EstadoBusqueda, FormData>(crearBusqueda, { error: null });
  const [que, setQue] = useState<"zona" | "hotel">("zona");
  const [hotel, setHotel] = useState<HotelOpcion | null>(null);
  const [pais, setPais] = useState("UY");
  const [ciudades, setCiudades] = useState<string[] | null>(null);
  const [ciudad, setCiudad] = useState("");
  const [zona, setZona] = useState<Zona | null>(null);
  const [checkIn, setCheckIn] = useState("");
  const [moneda, setMoneda] = useState("USD");

  useEffect(() => {
    setCiudades(null);
    setCiudad("");
    setZona(null);
    setHotel(null);
    const ctrl = new AbortController();
    fetch(`/api/ciudades?pais=${pais}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => setCiudades(j.ciudades ?? []))
      .catch(() => !ctrl.signal.aborted && setCiudades([]));
    return () => ctrl.abort();
  }, [pais]);

  return (
    <form action={accion} className="form">
      <input type="hidden" name="zona" value={zona?.nombre ?? ""} />
      <input type="hidden" name="zona_lat" value={zona?.lat ?? ""} />
      <input type="hidden" name="zona_lon" value={zona?.lon ?? ""} />

      <input type="hidden" name="que" value={que} />
      <fieldset>
        <legend>Qué buscás</legend>
        <div className="row">
          <label className="check">
            <input type="radio" name="que-ui" checked={que === "zona"} onChange={() => setQue("zona")} />
            <span>Cualquier hotel en una ciudad o zona</span>
          </label>
          <label className="check">
            <input type="radio" name="que-ui" checked={que === "hotel"} onChange={() => setQue("hotel")} />
            <span>Un hotel en particular</span>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>{que === "hotel" ? "Qué hotel" : "Dónde te querés quedar"}</legend>
        <div className="grid2">
          <div className="field">
            <label htmlFor="b-pais">País</label>
            <select id="b-pais" name="pais" value={pais} onChange={(e) => setPais(e.target.value)}>
              {paises.map((p) => (
                <option key={p.codigo} value={p.codigo}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          {que === "hotel" ? (
            <>
              <input type="hidden" name="hotel_id" value={hotel?.id ?? ""} />
              <input type="hidden" name="hotel" value={hotel?.nombre ?? ""} />
              <input type="hidden" name="ciudad" value={hotel?.ciudad ?? ""} />
              <BuscadorHotel pais={pais} elegido={hotel} onElegir={setHotel} />
            </>
          ) : (
          <div className="field">
            <label htmlFor="b-ciudad">Ciudad</label>
            <select
              id="b-ciudad"
              name="ciudad"
              required
              value={ciudad}
              disabled={!ciudades}
              onChange={(e) => {
                setCiudad(e.target.value);
                setZona(null);
              }}
            >
              <option value="" disabled>
                {ciudades ? (ciudades.length ? "Elegí una ciudad" : "No hay ciudades para ese país") : "Cargando ciudades…"}
              </option>
              {ciudades?.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          )}
        </div>
        {que === "hotel" ? (
          <div className="field">
            <label htmlFor="b-categoria">Habitación</label>
            <select id="b-categoria" name="categoria" defaultValue="">
              <option value="">Cualquier habitación (la más barata)</option>
              {Object.entries(CATEGORIAS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        ) : (
        <div className="grid2">
          <BuscadorZona pais={pais} ciudad={ciudad} elegida={zona} onElegir={setZona} />
          <div className="field">
            <label htmlFor="b-radio">Distancia máxima a esa zona</label>
            <select id="b-radio" name="radio_km" defaultValue="2" disabled={!zona}>
              <option value="1">Hasta 1 km</option>
              <option value="2">Hasta 2 km</option>
              <option value="5">Hasta 5 km</option>
            </select>
          </div>
        </div>
        )}
      </fieldset>

      <fieldset>
        <legend>Cuándo y cuánto querés pagar</legend>
        <div className="grid3">
          <div className="field">
            <label htmlFor="b-in">Entrada</label>
            <input id="b-in" name="check_in" type="date" required min={hoy} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="b-out">Salida</label>
            <input id="b-out" name="check_out" type="date" required min={checkIn || hoy} />
          </div>
          <div className="field">
            <label htmlFor="b-adultos">Adultos</label>
            <input id="b-adultos" name="huespedes" type="number" min={1} max={10} defaultValue={2} required />
          </div>
        </div>
        <div className="grid3">
          <div className="field highlight">
            <label htmlFor="b-tope">Máximo por noche</label>
            <input id="b-tope" name="tope_noche" inputMode="decimal" required placeholder="200" className="mono" />
          </div>
          <div className="field">
            <label htmlFor="b-moneda">Moneda</label>
            <select id="b-moneda" name="moneda" value={moneda} onChange={(e) => setMoneda(e.target.value)}>
              <option value="USD">Dólares (US$)</option>
              <option value="UYU">Pesos ($U)</option>
            </select>
          </div>
          <div className="field" hidden={que === "hotel"}>
            <label htmlFor="b-estrellas">Estrellas</label>
            <select id="b-estrellas" name="estrellas_min" defaultValue="">
              <option value="">Cualquiera</option>
              <option value="3">3 o más</option>
              <option value="4">4 o más</option>
              <option value="5">5</option>
            </select>
          </div>
        </div>
        <span className="hint">El máximo es por noche, con impuestos, para toda la habitación.</span>
      </fieldset>

      <fieldset>
        <legend>Dónde te avisamos</legend>
        <div className="field">
          <label htmlFor="b-email">Email</label>
          <input id="b-email" name="email" type="email" required autoComplete="email" placeholder="vos@mail.com" />
        </div>
        <label className="check">
          <input type="checkbox" name="acepto" required />
          <span>Entiendo que es un piloto académico y que la decisión de reservar es mía.</span>
        </label>
      </fieldset>

      {estado.error && (
        <p className="error" role="alert">
          {estado.error}
        </p>
      )}

      <div>
        <button className="btn" type="submit" disabled={enviando}>
          {enviando ? "Buscando…" : "Avisame cuando aparezca"}
        </button>
      </div>
    </form>
  );
}

function BuscadorZona({ pais, ciudad, elegida, onElegir }: { pais: string; ciudad: string; elegida: Zona | null; onElegir: (z: Zona | null) => void }) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const [opciones, setOpciones] = useState<Zona[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTexto(elegida?.nombre ?? "");
  }, [elegida]);

  useEffect(() => {
    if (!ciudad || (elegida && texto === elegida.nombre) || texto.trim().length < 2) {
      setOpciones([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/zonas?${new URLSearchParams({ pais, ciudad, q: texto })}`, { signal: ctrl.signal });
        const json = await res.json();
        setOpciones(json.zonas ?? []);
        setActivo(-1);
        setAbierto(true);
      } catch {
        /* sin sugerencias */
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [texto, pais, ciudad, elegida]);

  useEffect(() => {
    const cerrar = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  const elegir = (z: Zona) => {
    onElegir(z);
    setAbierto(false);
  };

  return (
    <div className="field combo" ref={caja}>
      <label htmlFor={`${id}-zona`}>Barrio o zona (opcional)</label>
      <input
        id={`${id}-zona`}
        role="combobox"
        aria-expanded={abierto && opciones.length > 0}
        aria-controls={`${id}-lista`}
        aria-autocomplete="list"
        aria-activedescendant={activo >= 0 ? `${id}-op-${activo}` : undefined}
        autoComplete="off"
        disabled={!ciudad}
        placeholder={ciudad ? "Ej.: Pocitos" : "Elegí la ciudad primero"}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          if (elegida) onElegir(null);
        }}
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
          {opciones.map((z, i) => (
            <li
              key={`${z.nombre}-${i}`}
              id={`${id}-op-${i}`}
              role="option"
              aria-selected={i === activo}
              className={i === activo ? "on" : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(z);
              }}
            >
              <b>{z.nombre}</b>
              <span className="muted">{z.detalle}</span>
            </li>
          ))}
        </ul>
      )}
      <span className="hint">{elegida ? `✓ ${elegida.nombre}` : texto && !elegida ? "Elegila de la lista, o dejalo vacío para buscar en toda la ciudad." : "Si lo dejás vacío, buscamos en toda la ciudad."}</span>
    </div>
  );
}
