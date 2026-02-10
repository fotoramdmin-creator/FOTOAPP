// src/LoginVista.js
import React, { useState } from "react";
import { supabase } from "./supabaseClient";
import logoColor from "./assets/FOTO RAMIREZ NUEVO CUADRO.png";

export default function LoginVista({ onLogin }) {
  const [username, setUsername] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    if (!username || !pass) {
      setErr("Ingresa usuario y contraseña");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("login_usuario", {
        p_username: username.trim(),
        p_password: pass,
      });

      if (error) throw error;

      const user = Array.isArray(data) ? data[0] : null;
      if (!user?.id) {
        setErr("Usuario o contraseña incorrectos");
        return;
      }

      if (user.activo === false) {
        setErr("Usuario inactivo");
        return;
      }

      const session = {
        id: user.id,
        nombre: user.nombre,
        admin: !!user.admin,
        codigo: user.codigo ?? null,
        username: username.trim(),
        ts: Date.now(),
      };

      sessionStorage.setItem("FR_SESSION", JSON.stringify(session));
      sessionStorage.removeItem("FR_PIN_OK");

      onLogin?.(session);
    } catch (e2) {
      setErr(e2?.message || "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        <img src={logoColor} alt="Foto Ramírez" style={S.logo} />

        <div style={S.title}>INICIO DE SESIÓN</div>
        <div style={S.sub}>Sistema interno · Foto Ramírez</div>

        {err && <div style={S.err}>{err}</div>}

        <form onSubmit={submit} style={S.form}>
          <div>
            <div style={S.label}>Usuario</div>
            <input
              style={S.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="EMPRESA, LALO, ZALLI..."
              autoCapitalize="characters"
            />
          </div>

          <div>
            <div style={S.label}>Contraseña</div>
            <input
              style={S.input}
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button style={S.btn} type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 14,
    background: `
      radial-gradient(circle at 20% 15%, rgba(0,180,170,0.12), transparent 45%),
      radial-gradient(circle at 80% 20%, rgba(255,255,255,0.05), transparent 45%),
      linear-gradient(180deg, #0b0b0b 0%, #141414 100%)
    `,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    color: "#f5f1e8",
  },

  card: {
    width: "min(420px, 94vw)",
    borderRadius: 20,
    padding: 16,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(212,175,55,0.28)",
    boxShadow: "0 14px 30px rgba(0,0,0,0.5)",
    textAlign: "center",
  },

  logo: {
    width: 150,
    margin: "0 auto 10px",
    display: "block",
  },

  title: {
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: 0.8,
  },

  sub: {
    opacity: 0.75,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: 800,
  },

  form: {
    display: "grid",
    gap: 10,
    textAlign: "left",
  },

  label: {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.85,
    marginBottom: 6,
  },

  input: {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 14,
    background: "rgba(0,0,0,0.45)",
    border: "1px solid rgba(245,241,232,0.18)",
    color: "#f5f1e8",
    fontWeight: 900,
    outline: "none",
  },

  btn: {
    marginTop: 8,
    padding: "12px 14px",
    borderRadius: 16,
    border: "1px solid rgba(212,175,55,0.6)",
    background: "linear-gradient(180deg, #fff7e6 0%, #f3ead6 100%)",
    color: "#1b1b1b",
    fontWeight: 950,
    letterSpacing: 0.3,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(0,0,0,0.4)",
  },

  err: {
    marginBottom: 10,
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(255,70,70,0.12)",
    border: "1px solid rgba(255,70,70,0.25)",
    color: "#ffd2d2",
    fontSize: 13,
    fontWeight: 900,
    textAlign: "center",
  },
};
