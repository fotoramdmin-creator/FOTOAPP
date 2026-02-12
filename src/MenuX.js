// src/MenuX.js
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  FiCamera,
  FiUserCheck,
  FiMonitor,
  FiCalendar,
  FiSearch,
  FiDollarSign,
  FiSettings,
  FiTruck,
  FiLogOut,
  FiMinusCircle,
  FiArchive,
} from "react-icons/fi";

export default function Menu({ setVista, session }) {
  const isAdmin = session?.admin === true;

  const [ordenCount, setOrdenCount] = useState(0);
  const [loadingBadges, setLoadingBadges] = useState(false);
  const lastErrRef = useRef("");

  const fetchBadges = async () => {
    setLoadingBadges(true);
    try {
      const { count: cOrden, error: eOrden } = await supabase
        .from("orden_en_curso_fotografo_resumen")
        .select("*", { count: "exact", head: true });

      if (eOrden) throw eOrden;

      setOrdenCount(cOrden ?? 0);
      lastErrRef.current = "";
    } catch (e) {
      const msg = e?.message || String(e);
      if (msg !== lastErrRef.current) console.error("Menu badges error:", e);
      lastErrRef.current = msg;
      setOrdenCount(0);
    } finally {
      setLoadingBadges(false);
    }
  };

  useEffect(() => {
    fetchBadges();
    const t = setInterval(fetchBadges, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = () => {
    sessionStorage.removeItem("FR_SESSION");
    sessionStorage.removeItem("FR_PIN_OK");
    setVista("login");
  };

  const items = [
    { key: "toma", title: "Toma pedidos", icon: <FiCamera /> },
    {
      key: "orden",
      title: "Orden en curso",
      icon: <FiUserCheck />,
      badge: ordenCount,
      badgeLoading: loadingBadges,
    },
    { key: "p3", title: "Producción", icon: <FiMonitor /> },
    { key: "entrega", title: "Entrega", icon: <FiTruck /> },

    // ✅ CAMBIO AQUÍ
    { key: "servicios", title: "Calendario", icon: <FiCalendar /> },

    { key: "busqueda", title: "Búsqueda", icon: <FiSearch /> },
    { key: "archivo", title: "Archivo", icon: <FiArchive /> },

    ...(isAdmin
      ? [
          { key: "cuentas", title: "Cuentas", icon: <FiDollarSign /> },
          { key: "retiro", title: "Retiro de caja", icon: <FiMinusCircle /> },
          { key: "config", title: "Configuración", icon: <FiSettings /> },
        ]
      : []),

    { key: "__logout__", title: "Cerrar sesión", icon: <FiLogOut /> },
  ];

  const Badge = ({ value, loading }) => {
    const n = Number(value || 0);
    if (loading) {
      return (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            padding: "6px 10px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 950,
            letterSpacing: 0.5,
            border: "1px solid rgba(39,224,214,0.45)",
            background: "rgba(0,0,0,0.35)",
            color: "#fff7e6",
          }}
          title="Cargando pendientes…"
        >
          …
        </div>
      );
    }

    if (!n) return null;

    return (
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          minWidth: 34,
          height: 28,
          padding: "0 10px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 950,
          letterSpacing: 0.4,
          border: "1px solid rgba(0,120,115,0.35)",
          background: "rgba(0,0,0,0.35)",
          color: "#fff7e6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 10px 22px rgba(0,0,0,0.28)",
        }}
        title={`Pendientes: ${n}`}
      >
        {n}
      </div>
    );
  };

  return (
    <div
      style={{
        padding: 16,
        minHeight: "100vh",
        background: `
          radial-gradient(circle at 20% 20%, rgba(0,180,170,0.12), transparent 40%),
          radial-gradient(circle at 80% 30%, rgba(255,255,255,0.05), transparent 45%),
          linear-gradient(180deg, #0f0f0f 0%, #1a1a1a 100%)
        `,
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <div
          style={{
            fontSize: 26,
            fontWeight: 900,
            letterSpacing: 0.6,
            color: "#f5f5f5",
          }}
        >
          MENÚ
        </div>

        <div style={{ opacity: 0.75, fontSize: 15, color: "#cfcfcf" }}>
          Sesión:{" "}
          <b style={{ color: "#fff" }}>
            {session?.nombre || session?.username || "—"}
          </b>
          {isAdmin ? (
            <span style={{ marginLeft: 8, color: "rgba(212,175,55,0.95)" }}>
              (ADMIN)
            </span>
          ) : (
            <span style={{ marginLeft: 8 }}>(USUARIO)</span>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
        }}
      >
        {items.map((it) => {
          const isLogout = it.key === "__logout__";
          const isRetiros = it.key === "retiro";

          return (
            <button
              key={it.key}
              onClick={() => (isLogout ? logout() : setVista(it.key))}
              style={{
                background: isLogout
                  ? "rgba(255,255,255,0.06)"
                  : "linear-gradient(180deg, #fff7e6 0%, #f3ead6 100%)",
                borderRadius: 33,
                padding: 18,
                minHeight: 120,
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                border: isLogout
                  ? "1px solid rgba(245,241,232,0.18)"
                  : "1px solid rgba(0,0,0,0.12)",
                boxShadow: "0 8px 18px rgba(0,0,0,0.35)",
                cursor: "pointer",
                color: isLogout ? "#f5f1e8" : "#2a2a2a",
                position: "relative",
              }}
            >
              {it.key === "orden" && (
                <Badge value={it.badge} loading={it.badgeLoading} />
              )}

              <div
                style={{
                  color: isLogout
                    ? "rgba(255,90,90,0.95)"
                    : isRetiros
                    ? "rgba(180,70,70,0.90)"
                    : "rgba(0,120,115,0.9)",
                }}
              >
                {React.cloneElement(it.icon, { size: 32 })}
              </div>

              <div
                style={{
                  fontSize: 19,
                  fontWeight: 800,
                  marginTop: 14,
                  color: isLogout ? "#f5f1e8" : "#2a2a2a",
                  letterSpacing: 0.4,
                }}
              >
                {it.title}
              </div>

              {isRetiros && (
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 950,
                    letterSpacing: 0.5,
                    border: "1px solid rgba(212,175,55,0.45)",
                    background: "rgba(0,0,0,0.35)",
                    color: "#fff7e6",
                  }}
                >
                  PRIVADO
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
