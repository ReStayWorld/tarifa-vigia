"use client";

import { useActionState } from "react";
import { entrar } from "@/app/admin/actions";

export default function LoginForm() {
  const [estado, accion, enviando] = useActionState(entrar, { error: null as string | null });
  return (
    <form action={accion} className="panel" style={{ maxWidth: 380 }}>
      <h2>Panel del equipo</h2>
      <div className="field">
        <label htmlFor="clave">Clave</label>
        <input id="clave" name="clave" type="password" required autoComplete="current-password" />
      </div>
      {estado.error && <p className="error">{estado.error}</p>}
      <div>
        <button className="btn" type="submit" disabled={enviando}>
          Entrar
        </button>
      </div>
    </form>
  );
}
