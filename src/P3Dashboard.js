import React, { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

// ✅ LOGO (marca de agua fondo)
import logoBg from "./assets/FOTO RAMIREZ NUEVO CUADRO.png";

export default function P3Dashboard({ onOpenCategoria }) {
  const [counts, setCounts] = useState({ URGENTE: 0, HOY: 0, GENERAL: 0 });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const lastUrgRef = useRef(0);
  const [pulseUrg, setPulseUrg] = useState(false);

  // ✅ Countdown visible
  const INTERVAL_MS = 15000;
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(INTERVAL_MS / 1000));
  const nextTickAtRef = useRef(Date.now() + INTERVAL_MS);

  const fetchCounts = async (playDing = false) => {
    setLoading(true);
    setStatus("");

    try {
      // ✅ SOLO CONTAR PENDIENTES (no los "done")
      const onlyPendingOr =
        "pendiente_retocado.eq.true,pendiente_impreso.eq.true,pendiente_calendario.eq.true";

      const [u, h, g] = await Promise.all([
        supabase
          .from("produccion_resumen")
          .select("pedido_id", { count: "exact", head: true })
          .eq("categoria", "URGENTE")
          .or(onlyPendingOr),

        supabase
          .from("produccion_resumen")
          .select("pedido_id", { count: "exact", head: true })
          .eq("categoria", "HOY")
          .or(onlyPendingOr),

        supabase
          .from("produccion_resumen")
          .select("pedido_id", { count: "exact", head: true })
          .eq("categoria", "GENERAL")
          .or(onlyPendingOr),
      ]);

      const anyErr = u.error || h.error || g.error;
      if (anyErr) {
        console.error("Counts error:", anyErr);
        setCounts({ URGENTE: 0, HOY: 0, GENERAL: 0 });
        setStatus("❌ Error leyendo conteos (revisa consola).");
        return;
      }

      const newCounts = {
        URGENTE: u.count ?? 0,
        HOY: h.count ?? 0,
        GENERAL: g.count ?? 0,
      };

      if (playDing && newCounts.URGENTE > (lastUrgRef.current ?? 0)) {
        playDingSound();
        setPulseUrg(true);
        setTimeout(() => setPulseUrg(false), 1200);
      }

      lastUrgRef.current = newCounts.URGENTE;
      setCounts(newCounts);

      if (!playDing) setStatus("✅ Actualizado");
    } catch (e) {
      console.error(e);
      setCounts({ URGENTE: 0, HOY: 0, GENERAL: 0 });
      setStatus("❌ Error actualizando.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Primera carga
    fetchCounts(false);

    // ✅ reinicia el “próximo tick”
    nextTickAtRef.current = Date.now() + INTERVAL_MS;
    setSecondsLeft(Math.ceil(INTERVAL_MS / 1000));

    // Interval principal (cada 15s)
    const t = setInterval(() => {
      fetchCounts(true);
      nextTickAtRef.current = Date.now() + INTERVAL_MS;
      setSecondsLeft(Math.ceil(INTERVAL_MS / 1000));
    }, INTERVAL_MS);

    // ✅ contador visible (cada 250ms para que se sienta vivo)
    const c = setInterval(() => {
      const diffMs = Math.max(0, nextTickAtRef.current - Date.now());
      const s = Math.ceil(diffMs / 1000);
      setSecondsLeft(s);
    }, 250);

    return () => {
      clearInterval(t);
      clearInterval(c);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const urgHas = (counts.URGENTE ?? 0) > 0;

  // ✅ texto del contador (visible)
  const countdownText = loading
    ? "Actualizando…"
    : `Actualiza en ${secondsLeft}s`;

  return (
    <div className="p3Page">
      <style>{`
        :root{
          --bg:#0B0F14;
          --text:#E9F1F1;

          /* Verde olivo suave (shell) */
          --olive1: rgba(88,132,112,0.28);
          --olive2: rgba(88,132,112,0.12);
          --oliveBorder: rgba(150,200,170,0.22);

          /* Botón negro + azul gris */
          --slateBorder: rgba(95,124,138,0.55);
          --slateText: rgba(190,210,220,0.95);
          --blackBtn: rgba(0,0,0,0.86);
          --blackBtn2: rgba(0,0,0,0.60);

          /* Pills */
          --amberBorder: rgba(255,209,102,0.38);
          --amberBg: rgba(255,209,102,0.10);

          --aquaBorder: rgba(39,224,214,0.38);
          --aquaBg: rgba(39,224,214,0.10);

          --genBorder: rgba(255,255,255,0.14);
          --genBg: rgba(255,255,255,0.05);

          /* Glow verde */
          --greenGlow: rgba(43,255,136,0.18);
          --greenGlow2: rgba(43,255,136,0.10);
        }

        *{ box-sizing:border-box; }
        body{ margin:0; background:var(--bg); color:var(--text); font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; }
        .p3Page{ padding:12px; max-width: 720px; margin: 0 auto; }

        /* Shell */
        .shell{
          position: relative;
          border:1px solid var(--oliveBorder);
          border-radius: 18px;
          padding: 12px;
          overflow:hidden;

          background:
            linear-gradient(135deg, var(--olive1), var(--olive2)),
            url(${logoBg});
          background-repeat: no-repeat;
          background-position: center;
          background-size: 80%;
        }

        .shell::after{
          content:"";
          position:absolute;
          inset:0;
          background: rgba(11,15,20,0.84);
          pointer-events:none;
        }
        .shell > *{
          position: relative;
          z-index: 1;
        }

        /* Top bar */
        .topbar{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          margin-bottom: 12px;
        }

        /* ✅ countdown pill */
        .countdown{
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding: 10px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(0,0,0,0.18);
          color: rgba(233,241,241,0.92);
          font-weight: 900;
          letter-spacing: .2px;
          font-size: 13px;
          user-select:none;
        }
        .countdownDot{
          width:8px; height:8px; border-radius:999px;
          background: rgba(39,224,214,0.95);
          box-shadow: 0 0 0 2px rgba(39,224,214,0.15);
          opacity: .9;
        }

        .btnRefresh{
          border:2px solid var(--slateBorder);
          background: linear-gradient(180deg, var(--blackBtn), var(--blackBtn2));
          color: var(--slateText);
          font-weight: 950;
          letter-spacing: .2px;
          padding: 10px 12px;
          border-radius: 999px;
          cursor:pointer;
        }
        .btnRefresh:disabled{ opacity:.55; cursor:not-allowed; }

        /* Pills row */
        .pills{
          display:flex;
          gap:12px;
          flex-wrap:wrap;
          align-items:stretch;
        }

        .pill{
          flex: 1 1 160px;
          min-width: 160px;
          border-radius: 18px;
          border:1px solid rgba(255,255,255,0.14);
          background: rgba(0,0,0,0.18);
          padding: 12px;
          cursor:pointer;
          user-select:none;
        }

        .pillTop{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
        }

        .pillTitle{
          font-weight: 980;
          letter-spacing: .6px;
          text-transform: uppercase;
          font-size: 13px;
          opacity: .95;
        }

        .pillIcon{
          font-size: 18px;
          opacity: .95;
        }

        .pillNum{
          margin-top: 10px;
          font-size: 26px;
          font-weight: 980;
          letter-spacing: .5px;
        }

        .pillSub{
          margin-top: 6px;
          font-size: 12px;
          opacity: .70;
          line-height: 1.25;
        }

        .pillUrg{ border-color: var(--amberBorder); background: var(--amberBg); }
        .pillHoy{ border-color: var(--aquaBorder); background: var(--aquaBg); }
        .pillGen{ border-color: var(--genBorder); background: var(--genBg); }

        /* Glow/animación en urgentes */
        .pillUrgGlow{
          box-shadow: 0 0 0 2px var(--greenGlow), 0 0 22px var(--greenGlow2);
          border-color: rgba(43,255,136,0.35);
        }
        .pillUrgPulse{
          animation: urgPulse 1.2s ease-in-out 1;
        }
        @keyframes urgPulse{
          0%   { box-shadow: 0 0 0 0 rgba(43,255,136,0.00), 0 0 0 rgba(43,255,136,0.00); }
          25%  { box-shadow: 0 0 0 4px rgba(43,255,136,0.20), 0 0 26px rgba(43,255,136,0.18); }
          60%  { box-shadow: 0 0 0 2px rgba(43,255,136,0.14), 0 0 18px rgba(43,255,136,0.12); }
          100% { box-shadow: 0 0 0 2px rgba(43,255,136,0.12), 0 0 18px rgba(43,255,136,0.10); }
        }

        .status{
          margin-top: 12px;
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding: 8px 10px;
          border-radius: 999px;
          border:1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          font-size: 12px;
          max-width:100%;
          overflow-wrap:anywhere;
        }

        @media (max-width:420px){
          .pill{ min-width: 100%; }
          .topbar{ flex-direction:column; align-items:stretch; }
          .btnRefresh{ width:100%; }
          .countdown{ width:100%; justify-content:center; }
        }
      `}</style>

      <div className="shell">
        <div className="topbar">
          <div className="countdown" title="Auto-actualización cada 15s">
            <span className="countdownDot" />
            <span>{countdownText}</span>
          </div>

          <button
            className="btnRefresh"
            onClick={() => {
              fetchCounts(false);
              nextTickAtRef.current = Date.now() + INTERVAL_MS;
              setSecondsLeft(Math.ceil(INTERVAL_MS / 1000));
            }}
            disabled={loading}
            title="Actualizar conteos"
          >
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>

        <div className="pills">
          <div
            className={[
              "pill",
              "pillUrg",
              urgHas ? "pillUrgGlow" : "",
              pulseUrg ? "pillUrgPulse" : "",
            ].join(" ")}
            onClick={() => onOpenCategoria("URGENTE")}
            title="Abrir urgentes"
          >
            <div className="pillTop">
              <div className="pillTitle">URGENTE</div>
              <div className="pillIcon">⚡</div>
            </div>
            <div className="pillNum">{counts.URGENTE}</div>
            <div className="pillSub">Pendientes urgentes</div>
          </div>

          <div
            className="pill pillHoy"
            onClick={() => onOpenCategoria("HOY")}
            title="Abrir hoy"
          >
            <div className="pillTop">
              <div className="pillTitle">HOY</div>
              <div className="pillIcon">🕒</div>
            </div>
            <div className="pillNum">{counts.HOY}</div>
            <div className="pillSub">Entregas del día</div>
          </div>

          <div
            className="pill pillGen"
            onClick={() => onOpenCategoria("GENERAL")}
            title="Abrir general"
          >
            <div className="pillTop">
              <div className="pillTitle">GENERAL</div>
              <div className="pillIcon">📁</div>
            </div>
            <div className="pillNum">{counts.GENERAL}</div>
            <div className="pillSub">Pendientes restantes</div>
          </div>
        </div>

        {!!status && <div className="status">{status}</div>}
      </div>
    </div>
  );
}

function playDingSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.08;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, 120);
  } catch {}
}
