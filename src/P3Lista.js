import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const URGENTE_LIMITE_MIN = 30; // solo para activar ⚠️ a partir de 30+

// ====== TEMA FOTO RAMÍREZ ======
const THEME = {
  bg: "rgba(12, 14, 18, 0.92)",
  bg2: "rgba(18, 22, 28, 0.92)",
  cardA: "rgba(255,255,255,0.035)",
  cardB: "rgba(255,255,255,0.05)",

  text: "#FFFFFF",
  textSoft: "rgba(255,255,255,0.80)",
  textMute: "rgba(255,255,255,0.65)",

  crema: "#F4E7CC",
  gold: "#D4AF37",
  goldSoft: "rgba(212,175,55,0.25)",

  aqua: "#00FFD0",
  aquaSoft: "rgba(0,255,208,0.12)",
  aquaBorder: "rgba(0,255,208,0.26)",

  okSoft: "rgba(0,255,120,0.18)",
  okBorder: "rgba(0,255,120,0.45)",

  // ✅ AMARILLO (solo para tiempo/horario)
  yellow: "#FFD84A",
  yellowSoft: "rgba(255,216,74,0.14)",
  yellowBorder: "rgba(255,216,74,0.34)",

  // ✅ SEMÁFORO CRONO (solo URGENTES)
  green: "#25F59A",
  greenSoft: "rgba(37,245,154,0.14)",
  greenBorder: "rgba(37,245,154,0.34)",

  red: "#FF4D4D",
  redSoft: "rgba(255,77,77,0.14)",
  redBorder: "rgba(255,77,77,0.34)",
};

export default function P3Lista({ categoria, onBack, onOpenPedido }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 520 : true
  );

  // ✅ LIVE TICK: para que URGENTES corra en vivo
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    if (categoria !== "URGENTE") return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [categoria]);

  // detecta resize (solo para estilos)
  useEffect(() => {
    const onR = () => setIsMobile(window.innerWidth <= 520);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  const title = useMemo(() => {
    if (categoria === "URGENTE") return "⚡ URGENTES";
    if (categoria === "HOY") return "🟡 HOY";
    return "⚪ GENERAL";
  }, [categoria]);

  const isAllDone = (r) =>
    !r.pendiente_retocado && !r.pendiente_impreso && !r.pendiente_calendario;

  const formatTomaNum = (tomaResumen) => {
    const raw = (tomaResumen || "").toString().trim();
    if (!raw) return "—";
    const m = raw.match(/\d+/);
    return m ? m[0] : raw.slice(0, 10);
  };

  // ✅ parse robusto para timestamp de Postgres/Supabase (con +00 ya viene perfecto)
  const parseDate = (v) => {
    if (!v) return null;

    let s = typeof v === "string" ? v.trim() : String(v);

    // "YYYY-MM-DD HH:MM:SS" -> "YYYY-MM-DDTHH:MM:SS"
    if (s.includes(" ") && !s.includes("T")) s = s.replace(" ", "T");

    // microsegundos -> milisegundos
    s = s.replace(/\.(\d{3})\d+/, ".$1");

    // offsets tipo "+00" o "-06" -> "+00:00" / "-06:00"
    s = s.replace(/([+-]\d{2})$/, "$1:00");

    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  // ✅ ahora que el VIEW ya trae fecha_inicio_urgente, lo leemos directo
  const pickInicioUrgenteRaw = (r) => (r ? r.fecha_inicio_urgente : null);

  // ✅ texto con SEGUNDOS (se ve vivo)
  const msToPretty = (ms) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const h = Math.floor(m / 60);
    const mm = m % 60;

    if (h > 0) return `+${h}h ${mm}m`;
    if (m > 0) return `+${m}m ${String(s).padStart(2, "0")}s`;
    return `+${s}s`;
  };

  // ✅ Semáforo pedido: 0-15 verde, 15-25 amarillo, 25+ rojo (30+ además ⚠️)
  const getUrgLevel = (elapsedMs) => {
    const m = elapsedMs != null ? elapsedMs / 60000 : 0;
    if (m < 15) return "GREEN";
    if (m < 25) return "YELLOW";
    return "RED";
  };

  const getUrgPillStyles = (S, level) => {
    if (level === "GREEN") return S.timePillGreen;
    if (level === "RED") return S.timePillRed;
    return S.timePillYellow;
  };

  const getUrgTextStyles = (S, level) => {
    if (level === "GREEN") return S.pillBigGreen;
    if (level === "RED") return S.pillBigRed;
    return S.pillBigYellow;
  };

  // ✅ FIX: evita 400 por columnas que NO existan en la vista
  const safeOrder = (q, col, opts) => {
    if (!col) return q;
    try {
      const first = rows?.[0];
      if (first && typeof first === "object" && !(col in first)) return q;
      return q.order(col, opts);
    } catch {
      return q;
    }
  };

  // ✅ NUEVO: trae conteo de renglones (detalles) por pedido_id
  const fetchRenglonesCount = async (pedidoIds) => {
    try {
      const ids = Array.from(new Set((pedidoIds || []).filter(Boolean)));
      if (ids.length === 0) return {};

      // Traemos solo pedido_id de detalles_pedido y contamos en JS (simple y sin tocar views)
      const { data, error } = await supabase
        .from("detalles_pedido")
        .select("pedido_id")
        .in("pedido_id", ids);

      if (error) {
        console.error("P3Lista fetchRenglonesCount error:", error);
        return {};
      }

      const map = {};
      for (const x of data || []) {
        const k = x?.pedido_id;
        if (!k) continue;
        map[k] = (map[k] || 0) + 1;
      }

      // si un pedido no regresó filas, lo dejamos en 0
      for (const id of ids) if (!(id in map)) map[id] = 0;

      return map;
    } catch (e) {
      console.error("P3Lista fetchRenglonesCount catch:", e);
      return {};
    }
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      let q1 = supabase
        .from("produccion_resumen")
        .select("*")
        .eq("categoria", categoria);

      if (categoria === "URGENTE") {
        q1 = q1.order("fecha_inicio_urgente", {
          ascending: true,
          nullsFirst: false,
        });
      } else if (categoria === "HOY") {
        q1 = q1.order("horario_entrega", { ascending: true });
      } else {
        q1 = q1
          .order("fecha_entrega", { ascending: true })
          .order("horario_entrega", { ascending: true });
      }

      const r1 = await q1;

      if (r1.error) {
        console.error("P3Lista primer intento (con order) falló:", r1.error);

        const r2 = await supabase
          .from("produccion_resumen")
          .select("*")
          .eq("categoria", categoria);

        if (r2.error) throw r2.error;

        const filtered2 = (r2.data ?? []).filter((r) => !isAllDone(r));

        // ✅ NUEVO: agrega renglones_count
        const countMap2 = await fetchRenglonesCount(
          filtered2.map((x) => x.pedido_id)
        );
        const enriched2 = filtered2.map((x) => ({
          ...x,
          renglones_count: countMap2?.[x.pedido_id] ?? 0,
        }));

        setRows(enriched2);
        return;
      }

      const filtered1 = (r1.data ?? []).filter((r) => !isAllDone(r));

      // ✅ NUEVO: agrega renglones_count
      const countMap1 = await fetchRenglonesCount(
        filtered1.map((x) => x.pedido_id)
      );
      const enriched1 = filtered1.map((x) => ({
        ...x,
        renglones_count: countMap1?.[x.pedido_id] ?? 0,
      }));

      setRows(enriched1);
    } catch (e) {
      console.error("P3Lista fetchList error:", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoria]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const toma = (r.toma_resumen || "").toString().toLowerCase();
      const nombre = (r.cliente_nombre || "").toString().toLowerCase();
      return toma.includes(q) || nombre.includes(q);
    });
  }, [rows, search]);

  // estilos responsive
  const S = makeStyles(isMobile);

  return (
    <div style={S.wrap}>
      <div style={S.topBar}>
        <button onClick={onBack} style={S.btnCrema}>
          ←
        </button>

        <div style={S.barTitle}>{title}</div>

        <button onClick={fetchList} style={S.btnCrema}>
          {loading ? "..." : "↻"}
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔎 Buscar por toma o nombre"
        style={S.searchInput}
      />

      {filteredRows.length === 0 && !loading && (
        <div style={S.emptyText}>
          No hay pedidos aquí{search.trim() ? " (con ese filtro)" : ""}.
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {filteredRows.map((r, idx) => {
          const tomaNum = formatTomaNum(r.toma_resumen);

          // ✅ Glow solo al que sigue en URGENTES
          const isNext = categoria === "URGENTE" && idx === 0;

          const inicioRaw = pickInicioUrgenteRaw(r);
          const dInicioUrg = parseDate(inicioRaw);

          // ✅ LIVE: en URGENTE usamos nowTick
          const now = categoria === "URGENTE" ? nowTick : Date.now();

          const elapsedMs =
            categoria === "URGENTE" && dInicioUrg
              ? now - dInicioUrg.getTime()
              : null;

          const elapsedTxt =
            categoria === "URGENTE" && elapsedMs != null
              ? msToPretty(elapsedMs)
              : null;

          // ✅ semáforo + warning (solo urgentes)
          const urgLevel =
            categoria === "URGENTE" && elapsedMs != null
              ? getUrgLevel(elapsedMs)
              : "YELLOW";

          const isOverLimit =
            categoria === "URGENTE" &&
            elapsedMs != null &&
            URGENTE_LIMITE_MIN > 0 &&
            elapsedMs >= URGENTE_LIMITE_MIN * 60 * 1000;

          const rowStyle = isNext ? { ...S.rowBase, ...S.rowGlow } : S.rowBase;

          const pillBoxStyle =
            categoria === "URGENTE"
              ? getUrgPillStyles(S, urgLevel)
              : S.timePillYellow;

          const bigTextStyle =
            categoria === "URGENTE"
              ? getUrgTextStyles(S, urgLevel)
              : S.pillBigYellow;

          const iconColor =
            urgLevel === "GREEN"
              ? THEME.green
              : urgLevel === "RED"
              ? THEME.red
              : THEME.yellow;

          // ✅ renglones (conteo)
          const renglones = Number.isFinite(Number(r.renglones_count))
            ? Number(r.renglones_count)
            : 0;

          // ✅ PILL izquierdo (sin "resta": solo tiempo transcurrido + semáforo)
          const leftPillContent =
            categoria === "URGENTE" ? (
              <div style={{ display: "grid", gap: 2, textAlign: "center" }}>
                <div style={bigTextStyle}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      justifyContent: "center",
                    }}
                  >
                    {isOverLimit ? (
                      <WarningIcon color={THEME.red} size={16} />
                    ) : (
                      <ClockIcon color={iconColor} size={16} />
                    )}
                    {elapsedTxt || "+0s"}
                  </span>
                </div>
              </div>
            ) : categoria === "GENERAL" ? (
              <div style={{ display: "grid", gap: 2, textAlign: "center" }}>
                <div style={S.pillBigYellow}>
                  {r.horario_entrega || "--:--"}
                </div>
                <div style={S.pillSmallYellow}>
                  {r.fecha_entrega || "--/--/----"}
                </div>
              </div>
            ) : (
              // HOY: solo horario AMARILLO
              <div style={S.pillBigYellow}>{r.horario_entrega || "--:--"}</div>
            );

          return (
            <button
              key={r.pedido_id}
              onClick={() => onOpenPedido(r.pedido_id)}
              style={rowStyle}
            >
              {isMobile ? (
                // ====== MOBILE LAYOUT (2 filas) ======
                <div style={S.mobileWrap}>
                  <div style={S.mobileTopRow}>
                    <div style={pillBoxStyle}>{leftPillContent}</div>
                    <div style={S.tomaPill}>{tomaNum}</div>
                    <div style={S.chev}>›</div>
                  </div>

                  <div style={S.mobileBottomRow}>
                    <div style={S.nameRowMobile}>
                      <div style={S.namePillFlex}>{r.cliente_nombre}</div>
                      <div style={S.renglonesPill}>RENGLONES: {renglones}</div>
                    </div>
                  </div>

                  <div style={S.mobileChipsRow}>
                    <TaskChipMobile
                      label="Retoque"
                      pending={!!r.pendiente_retocado}
                    />
                    <TaskChipMobile
                      label="Impresión"
                      pending={!!r.pendiente_impreso}
                    />
                    <TaskChipMobile
                      label="Calendario"
                      pending={!!r.pendiente_calendario}
                    />
                  </div>
                </div>
              ) : (
                // ====== DESKTOP LAYOUT (1 fila) ======
                <div style={S.rowMain}>
                  <div style={pillBoxStyle}>{leftPillContent}</div>

                  <div style={S.midCol}>
                    <div style={S.line1Pills}>
                      <span style={S.tomaPill}>{tomaNum}</span>
                      <span style={S.namePill}>{r.cliente_nombre}</span>
                      <span style={S.renglonesPill}>
                        RENGLONES: {renglones}
                      </span>
                    </div>

                    <div style={S.line2}>
                      <TaskChip
                        label="Retoque"
                        pending={!!r.pendiente_retocado}
                      />
                      <TaskChip
                        label="Impresión"
                        pending={!!r.pendiente_impreso}
                      />
                      <TaskChip
                        label="Calendario"
                        pending={!!r.pendiente_calendario}
                      />
                    </div>
                  </div>

                  <div style={S.chev}>›</div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TaskChip({ label, pending }) {
  if (pending) return <span style={chipPending}>{label}</span>;
  return <span style={chipDone}>✅ {label}</span>;
}

function TaskChipMobile({ label, pending }) {
  if (pending) return <span style={chipPendingMobile}>{label}</span>;
  return <span style={chipDoneMobile}>✅ {label}</span>;
}

function makeStyles(isMobile) {
  return {
    wrap: {
      padding: isMobile ? 12 : 14,
      borderRadius: 18,
      background: THEME.bg,
      boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
      border: `1px solid ${THEME.goldSoft}`,
    },

    topBar: {
      position: "sticky",
      top: 0,
      zIndex: 5,
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
      background: THEME.bg2,
      borderRadius: 16,
      padding: isMobile ? 10 : 10,
      border: `1px solid ${THEME.goldSoft}`,
      backdropFilter: "blur(10px)",
    },

    barTitle: {
      flex: 1,
      textAlign: "center",
      fontWeight: 950,
      fontSize: 16,
      letterSpacing: 0.8,
      color: THEME.crema,
      textShadow: "0 1px 0 rgba(0,0,0,0.3)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },

    btnCrema: {
      width: isMobile ? 44 : "auto",
      height: isMobile ? 44 : "auto",
      padding: isMobile ? 0 : "10px 12px",
      borderRadius: 14,
      border: `1px solid ${THEME.gold}`,
      background: THEME.crema,
      color: "rgba(20,24,28,0.95)",
      cursor: "pointer",
      fontWeight: 950,
      boxShadow: "0 8px 22px rgba(0,0,0,0.25)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: isMobile ? 18 : 14,
    },

    searchInput: {
      width: "100%",
      padding: isMobile ? "12px 12px" : "12px 14px",
      borderRadius: 14,
      border: `1px solid ${THEME.gold}`,
      background: THEME.crema,
      color: "rgba(20,24,28,0.95)",
      fontWeight: 950,
      marginBottom: 12,
      outline: "none",
      boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
      fontSize: isMobile ? 14 : 15,
    },

    emptyText: {
      color: THEME.textMute,
      fontWeight: 800,
      marginBottom: 8,
    },

    rowBase: {
      width: "100%",
      padding: isMobile ? 12 : 14,
      borderRadius: 18,
      border: "1px solid rgba(255,255,255,0.10)",
      background: THEME.cardA,
      color: THEME.text,
      cursor: "pointer",
      textAlign: "left",
    },

    rowGlow: {
      border: `1px solid ${THEME.aqua}`,
      boxShadow:
        "0 0 0 2px rgba(0,255,208,0.16), 0 18px 48px rgba(0,255,208,0.12)",
      background: THEME.cardB,
    },

    rowMain: {
      display: "flex",
      alignItems: "center",
      gap: 12,
    },

    // ✅ default amarillo
    timePillYellow: {
      width: 86,
      height: 60,
      borderRadius: 18,
      border: `1px solid ${THEME.yellowBorder}`,
      background: THEME.yellowSoft,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 950,
      flexShrink: 0,
    },

    // ✅ verde
    timePillGreen: {
      width: 86,
      height: 60,
      borderRadius: 18,
      border: `1px solid ${THEME.greenBorder}`,
      background: THEME.greenSoft,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 950,
      flexShrink: 0,
    },

    // ✅ rojo
    timePillRed: {
      width: 86,
      height: 60,
      borderRadius: 18,
      border: `1px solid ${THEME.redBorder}`,
      background: THEME.redSoft,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 950,
      flexShrink: 0,
    },

    // Texto amarillo
    pillBigYellow: {
      fontSize: 16,
      fontWeight: 950,
      letterSpacing: 0.4,
      lineHeight: "16px",
      color: THEME.yellow,
      textAlign: "center",
    },
    pillSmallYellow: {
      fontSize: 11,
      fontWeight: 950,
      opacity: 0.95,
      lineHeight: "11px",
      color: THEME.yellow,
      textAlign: "center",
    },

    // Texto verde
    pillBigGreen: {
      fontSize: 16,
      fontWeight: 950,
      letterSpacing: 0.4,
      lineHeight: "16px",
      color: THEME.green,
      textAlign: "center",
    },

    // Texto rojo
    pillBigRed: {
      fontSize: 16,
      fontWeight: 950,
      letterSpacing: 0.4,
      lineHeight: "16px",
      color: THEME.red,
      textAlign: "center",
    },

    midCol: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      minWidth: 0,
    },

    line1Pills: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      alignItems: "center",
    },

    tomaPill: {
      padding: "8px 12px",
      borderRadius: 999,
      border: `1px solid ${THEME.aquaBorder}`,
      background: "rgba(0,255,208,0.18)",
      fontWeight: 950,
      fontSize: 16,
      letterSpacing: 0.8,
      color: THEME.text,
      flexShrink: 0,
    },

    namePill: {
      padding: "8px 14px",
      borderRadius: 999,
      border: `1px solid ${THEME.goldSoft}`,
      background: "rgba(212,175,55,0.10)",
      fontWeight: 950,
      fontSize: 16,
      color: THEME.crema,
      letterSpacing: 0.4,
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },

    // ✅ NUEVO: pill RENGLONES (verde llamativo)
    renglonesPill: {
      padding: "8px 12px",
      borderRadius: 999,
      border: `1px solid ${THEME.greenBorder}`,
      background: THEME.greenSoft,
      fontWeight: 1000,
      fontSize: 13,
      color: THEME.green,
      letterSpacing: 0.4,
      flexShrink: 0,
      whiteSpace: "nowrap",
      boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
    },

    line2: { display: "flex", gap: 8, flexWrap: "wrap" },

    chev: {
      fontSize: 22,
      opacity: 0.7,
      fontWeight: 950,
      color: THEME.crema,
      flexShrink: 0,
    },

    mobileWrap: { display: "grid", gap: 10 },

    mobileTopRow: {
      display: "flex",
      alignItems: "center",
      gap: 10,
    },

    mobileBottomRow: {
      display: "flex",
      alignItems: "center",
    },

    // ✅ NUEVO: fila nombre + renglones en mobile
    nameRowMobile: {
      width: "100%",
      display: "flex",
      gap: 10,
      alignItems: "center",
      minWidth: 0,
    },

    // nombre flexible (para que deje espacio al pill verde)
    namePillFlex: {
      flex: 1,
      minWidth: 0,
      padding: "10px 14px",
      borderRadius: 999,
      border: `1px solid ${THEME.goldSoft}`,
      background: "rgba(212,175,55,0.10)",
      fontWeight: 950,
      fontSize: 16,
      color: THEME.crema,
      letterSpacing: 0.2,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },

    mobileChipsRow: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
    },
  };
}

// Chips (desktop)
const chipPending = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.05)",
  fontWeight: 950,
  fontSize: 12,
  color: THEME.textSoft,
};

const chipDone = {
  padding: "8px 12px",
  borderRadius: 999,
  border: `1px solid ${THEME.okBorder}`,
  background: THEME.okSoft,
  fontWeight: 950,
  fontSize: 12,
  color: THEME.text,
};

// Chips (mobile)
const chipPendingMobile = {
  ...chipPending,
  padding: "8px 10px",
  fontSize: 12,
};

const chipDoneMobile = {
  ...chipDone,
  padding: "8px 10px",
  fontSize: 12,
};

// ✅ ÍCONO reloj
function ClockIcon({ size = 16, color = "#FFD84A" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ display: "inline-block" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
        stroke={color}
        strokeWidth="2"
        opacity="0.95"
      />
      <path
        d="M12 6V12L16 14"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />
    </svg>
  );
}

// ✅ ÍCONO warning
function WarningIcon({ size = 16, color = "#FF4D4D" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ display: "inline-block" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 3L22 21H2L12 3Z"
        stroke={color}
        strokeWidth="2"
        opacity="0.95"
      />
      <path
        d="M12 9V13"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.95"
      />
      <path
        d="M12 17H12.01"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.95"
      />
    </svg>
  );
}
