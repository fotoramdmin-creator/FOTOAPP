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

  // ====== LOGICA INTACTA (COMO TÚ SABES) ======
  const [ordenCount, setOrdenCount] = useState(0);
  const [p3UrgCount, setP3UrgCount] = useState(0);
  const [p3HoyCount, setP3HoyCount] = useState(0);
  const [loadingBadges, setLoadingBadges] = useState(false);
  const lastErrRef = useRef("");

  const pick = (obj, keys) => {
    for (const k of keys)
      if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
    return undefined;
  };

  const asNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const asCat = (v) =>
    String(v || "")
      .toUpperCase()
      .trim();

  const fetchBadges = async () => {
    setLoadingBadges(true);
    try {
      const { count: cOrden, error: eOrden } = await supabase
        .from("orden_en_curso_fotografo_resumen")
        .select("*", { count: "exact", head: true });
      if (eOrden) throw eOrden;
      const { data: p3Rows, error: eP3 } = await supabase
        .from("produccion_resumen")
        .select("*")
        .limit(200);
      if (eP3) throw eP3;
      let urg = 0,
        hoy = 0;
      for (const r of p3Rows || []) {
        const cat = asCat(
          pick(r, ["categoria", "cat", "grupo", "tipo", "bucket", "estado"])
        );
        const total = asNum(
          pick(r, ["total", "count", "cantidad", "n", "pendientes"])
        );
        if (cat === "URGENTE") urg += total;
        if (cat === "HOY") hoy += total;
        if (total === 0) {
          const isUrg =
            r?.urgente === true ||
            asCat(pick(r, ["prioridad"])) === "URGENTE" ||
            asCat(pick(r, ["categoria"])) === "URGENTE";
          const isHoy =
            r?.hoy === true ||
            r?.para_hoy === true ||
            asCat(pick(r, ["categoria"])) === "HOY";
          if (isUrg) urg += 1;
          if (isHoy) hoy += 1;
        }
      }
      setOrdenCount(cOrden ?? 0);
      setP3UrgCount(urg);
      setP3HoyCount(hoy);
      lastErrRef.current = "";
    } catch (e) {
      const msg = e?.message || String(e);
      if (msg !== lastErrRef.current) console.error("Menu badges error:", e);
      lastErrRef.current = msg;
    } finally {
      setLoadingBadges(false);
    }
  };

  useEffect(() => {
    fetchBadges();
    const t = setInterval(fetchBadges, 15000);
    return () => clearInterval(t);
  }, []);

  const logout = () => {
    sessionStorage.removeItem("FR_SESSION");
    sessionStorage.removeItem("FR_PIN_OK");
    setVista("login");
  };

  const items = [
    { key: "toma", title: "TOMA PEDIDOS", icon: <FiCamera /> },
    {
      key: "orden",
      title: "ORDEN EN CURSO",
      icon: <FiUserCheck />,
      badge: ordenCount,
    },
    {
      key: "p3",
      title: "PRODUCCIÓN",
      icon: <FiMonitor />,
      urg: p3UrgCount,
      hoy: p3HoyCount,
    },
    { key: "entrega", title: "ENTREGA", icon: <FiTruck /> },
    { key: "servicios", title: "SERVICIOS", icon: <FiCalendar /> },
    { key: "busqueda", title: "BÚSQUEDA", icon: <FiSearch /> },
    { key: "archivo", title: "ARCHIVO", icon: <FiArchive /> },
    ...(isAdmin
      ? [
          { key: "cuentas", title: "CUENTAS", icon: <FiDollarSign /> },
          { key: "retiro", title: "RETIRO DE CAJA", icon: <FiMinusCircle /> },
          { key: "config", title: "CONFIGURACIÓN", icon: <FiSettings /> },
        ]
      : []),
    { key: "__logout__", title: "CERRAR SESIÓN", icon: <FiLogOut /> },
  ];

  return (
    <div
      style={{
        padding: 16,
        minHeight: "100vh",
        background: "#080808",
        backgroundImage: `radial-gradient(circle at 0% 0%, rgba(0,255,242,0.08) 0%, transparent 50%), 
                        radial-gradient(circle at 100% 100%, rgba(212,175,55,0.06) 0%, transparent 50%)`,
        fontFamily: "'Inter', sans-serif",
        overflow: "hidden",
      }}
    >
      {/* HEADER ESTILO RACING CON ANIMACIÓN DE ENTRADA */}
      <div
        className="animate-pnl-in"
        style={{ marginBottom: 25, paddingLeft: 10 }}
      >
        <div
          style={{
            fontSize: 32,
            fontWeight: 900,
            fontStyle: "italic",
            color: "#fff",
            letterSpacing: "-1px",
            transform: "skewX(-5deg)",
          }}
        >
          DASHBOARD_
        </div>
        <div
          style={{
            opacity: 0.6,
            fontSize: 13,
            color: "#fff",
            fontWeight: 700,
            fontStyle: "italic",
          }}
        >
          OP: {session?.nombre || "N/A"} •{" "}
          {isAdmin ? "MASTER_ADMIN" : "STAFF_OPERATOR"}
        </div>
      </div>

      {/* GRID CON ANIMACIÓN STAGGERED */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {items.map((it, index) => {
          const isLogout = it.key === "__logout__";
          const isCuentas = it.key === "cuentas";
          const isRetiro = it.key === "retiro";

          return (
            <button
              key={it.key}
              onClick={() => (isLogout ? logout() : setVista(it.key))}
              className={`menu-btn ${
                isCuentas
                  ? "btn-cuentas"
                  : isLogout
                  ? "btn-logout"
                  : "btn-normal"
              }`}
              style={{
                borderRadius: 24,
                padding: 20,
                minHeight: 135,
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
                cursor: "pointer",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                overflow: "hidden",
                outline: "none",
                animationDelay: `${index * 60}ms`,
              }}
            >
              {/* GLOW DE FONDO DINÁMICO (Intensificado en hover por CSS) */}
              {isCuentas && <div className="btn-glow" />}

              {/* BADGES DINÁMICOS CON ANIMACIÓN DE PULSO */}
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  display: "flex",
                  gap: 5,
                  zIndex: 2,
                }}
              >
                {it.key === "orden" && it.badge > 0 && (
                  <div
                    style={{
                      background: "#000",
                      color: "#00f2ea",
                      padding: "4px 8px",
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 950,
                      border: "2px solid #00f2ea",
                    }}
                  >
                    {it.badge}
                  </div>
                )}
                {it.key === "p3" && (it.urg > 0 || it.hoy > 0) && (
                  <>
                    {it.urg > 0 && (
                      <div
                        className="badge-urgente"
                        style={{
                          background: "#ff3e3e",
                          color: "#fff",
                          padding: "4px 8px",
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 950,
                        }}
                      >
                        ⚡ {it.urg}
                      </div>
                    )}
                    {it.hoy > 0 && (
                      <div
                        className="badge-hoy"
                        style={{
                          background: "#000",
                          color: "#d4af37",
                          padding: "4px 8px",
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 950,
                          border: "1px solid #d4af37",
                        }}
                      >
                        🕒 {it.hoy}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ICONOS (Se escalan en hover por CSS) */}
              <div
                className="btn-icon"
                style={{
                  color: isLogout
                    ? "#ff3e3e"
                    : isCuentas
                    ? "#2bff88"
                    : isRetiro
                    ? "#b44646"
                    : "#007873",
                }}
              >
                {React.cloneElement(it.icon, { size: 34, strokeWidth: 2.5 })}
              </div>

              {/* TÍTULOS EN ITALIC */}
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 900,
                  fontStyle: "italic",
                  letterSpacing: "-0.5px",
                  transform: "skewX(-6deg)",
                  color: isLogout
                    ? "#ff8a8a"
                    : isCuentas
                    ? "#fff7e6"
                    : "#1a1a1a",
                  zIndex: 1,
                }}
              >
                {it.title}
              </div>
            </button>
          );
        })}
      </div>

      {/* MOTOR DE ANIMACIONES (CSS ES EL REY AQUÍ) */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        
        /* Animación de entrada de los botones */
        @keyframes btnIn {
          from { opacity: 0; transform: translateY(20px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Animación de entrada del panel */
        @keyframes pnlIn {
          from { opacity: 0; transform: translateX(-15px); }
          to { opacity: 1; transform: translateX(0); }
        }

        /* Pulso Neón para Badges */
        @keyframes pulseUrgente { 0% { box-shadow: 0 0 0px #ff3e3e; } 50% { box-shadow: 0 0 12px #ff3e3e; } 100% { box-shadow: 0 0 0px #ff3e3e; } }
        @keyframes pulseHoy { 0% { box-shadow: 0 0 0px #d4af37; } 50% { box-shadow: 0 0 8px #d4af37; } 100% { box-shadow: 0 0 0px #d4af37; } }

        .animate-pnl-in { animation: pnlIn 0.5s ease-out forwards; }

        .menu-btn {
          animation: btnIn 0.4s ease-out forwards;
          opacity: 0; /* Empieza invisible para la animación staggered */
        }

        /* Hover Effects */
        .menu-btn:hover {
          transform: translateY(-4px) !important;
          filter: brightness(1.1);
        }

        .menu-btn:hover .btn-icon {
          transform: scale(1.1);
          transition: transform 0.2s ease;
        }

        /* Active/Click Effects (Haptic Feed) */
        .menu-btn:active {
          transform: translateY(1px) scale(0.96) !important;
          transition: all 0.05s ease !important;
        }

        /* Estilos específicos de botones */
        .btn-normal {
          background: linear-gradient(135deg, #fdf8eb 0%, #ece2ca 100%);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }

        .btn-cuentas {
          background: linear-gradient(135deg, #062d1a 0%, #020f08 100%);
          border: 1px solid rgba(43,255,136,0.3);
          box-shadow: 0 10px 30px rgba(0,0,0,0.5), inset 0 0 15px rgba(43,255,136,0.1);
        }

        .btn-cuentas .btn-glow {
          position: absolute; width: 100px; height: 100px; background: #2bff88; 
          filter: blur(60px); top: -20px; right: -20px; opacity: 0.15;
          transition: opacity 0.3s ease;
        }

        .btn-cuentas:hover .btn-glow { opacity: 0.3; }

        .btn-cuentas .btn-icon { filter: drop-shadow(0 0 5px #2bff88); }

        .btn-logout {
          background: rgba(40,0,0,0.4);
          border: 1px solid rgba(255,50,50,0.2);
        }

        /* Animaciones de Badges */
        .badge-urgente { animation: pulseUrgente 1.5s infinite; }
        .badge-hoy { animation: pulseHoy 2s infinite; }

      `}</style>
    </div>
  );
}
