import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

export default function P3Detalle({ pedidoId, onBack }) {
  const [pedido, setPedido] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  const [sendingBack, setSendingBack] = useState(false);

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 520 : true
  );

  useEffect(() => {
    const onR = () => setIsMobile(window.innerWidth <= 520);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  const isUrgente = !!pedido?.urgente;
  const tomaResumen = useMemo(() => buildTomaResumen(rows), [rows]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [{ data: p, error: e1 }, { data: d, error: e2 }] =
        await Promise.all([
          supabase
            .from("pedidos")
            .select(
              "id,cliente_nombre,urgente,fecha_entrega,horario_entrega,fecha_inicio_urgente"
            )
            .eq("id", pedidoId)
            .single(),
          supabase
            .from("detalles_pedido")
            .select(
              "id,pedido_id,tamano,tipo,cantidad,papel,ropa,especificaciones,n_toma,retocado,impreso,calendario,created_at"
            )
            .eq("pedido_id", pedidoId)
            .order("created_at", { ascending: true }),
        ]);

      if (e1) throw e1;
      if (e2) throw e2;

      setPedido(p);
      setRows(d ?? []);
    } finally {
      setLoading(false);
    }
  };

  // Urgente: Calendario NO APLICA (UI bloqueado), pero en BD debe quedar true
  const ensureCalendarioUrgenteTrue = async () => {
    if (!isUrgente) return;
    await supabase
      .from("detalles_pedido")
      .update({ calendario: true })
      .eq("pedido_id", pedidoId)
      .eq("calendario", false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId]);

  useEffect(() => {
    if (pedido?.urgente) ensureCalendarioUrgenteTrue().then(fetchAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido?.urgente]);

  const toggle = async (detalleId, field, value) => {
    if (isUrgente && field === "calendario") return;

    setRows((prev) =>
      prev.map((r) => (r.id === detalleId ? { ...r, [field]: value } : r))
    );

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id ?? null;
    const now = new Date().toISOString();

    const patch = { [field]: value };

    if (field === "retocado") {
      patch.retocado_at = value ? now : null;
      patch.retocado_usuario = value ? userId : null;
    }
    if (field === "impreso") {
      patch.impreso_at = value ? now : null;
      patch.impreso_usuario = value ? userId : null;
    }
    if (field === "calendario") {
      patch.calendario_at = value ? now : null;
      patch.calendario_usuario = value ? userId : null;
    }

    const { error } = await supabase
      .from("detalles_pedido")
      .update(patch)
      .eq("id", detalleId);

    if (error) {
      await fetchAll();
      alert("Error guardando. Revisa conexión.");
    }
  };

  const marcarTodo = async () => {
    setSavingAll(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id ?? null;
      const now = new Date().toISOString();

      const patch = {
        retocado: true,
        impreso: true,
        calendario: true,
        retocado_at: now,
        impreso_at: now,
        calendario_at: now,
        retocado_usuario: userId,
        impreso_usuario: userId,
        calendario_usuario: userId,
      };

      const { error } = await supabase
        .from("detalles_pedido")
        .update(patch)
        .eq("pedido_id", pedidoId);
      if (error) throw error;

      await fetchAll();
      alert("Listo ✅ (si ya quedó concluido, ya desaparecerá de Producción)");
    } catch {
      alert("Error al marcar todo. Revisa.");
    } finally {
      setSavingAll(false);
    }
  };

  // ✅ REGRESAR A P2 (solo React, NO SQL)
  const regresarAP2 = async () => {
    if (!pedidoId) return;

    const ok = window.confirm(
      "¿REGRESAR ESTE PEDIDO A P2?\n\nSe quitará de Producción y volverá a Orden en Curso del fotógrafo."
    );
    if (!ok) return;

    setSendingBack(true);
    try {
      // 1) regresa flujo a P2
      // 2) por seguridad, quitamos necesita_revision si existe (no rompe si no existe? -> puede dar error)
      //    entonces lo hacemos en 2 pasos: primero p_2listo, luego intenta necesita_revision.
      const { error: e1 } = await supabase
        .from("pedidos")
        .update({ p_2listo: false })
        .eq("id", pedidoId);

      if (e1) throw e1;

      // Intenta limpiar necesita_revision SOLO si existe.
      // Si no existe, ignoramos el error.
      const { error: e2 } = await supabase
        .from("pedidos")
        .update({ necesita_revision: false })
        .eq("id", pedidoId);

      if (e2) {
        // si tu tabla no tiene esa columna, no pasa nada
        console.warn("necesita_revision update ignored:", e2);
      }

      alert("✅ Listo. Ya regresó a P2.");
      onBack?.(); // vuelve a lista P3
    } catch (e) {
      console.error(e);
      alert("❌ No se pudo regresar. Revisa consola.");
    } finally {
      setSendingBack(false);
    }
  };

  const S = makeStyles(isMobile, isUrgente);

  return (
    <div style={S.wrap}>
      {/* Topbar */}
      <div style={S.topBar}>
        <button onClick={onBack} style={S.btnCremaSmall}>
          ← Lista
        </button>

        <div style={S.barTitle}>
          {isUrgente ? "⚡ URGENTE" : "PRODUCCIÓN"}
          <span style={S.barDot}>•</span>
          {pedido?.horario_entrega || "--:--"}
          <span style={S.barDot}>•</span>
          {tomaResumen}
        </div>

        <button onClick={fetchAll} style={S.btnCremaSmall}>
          {loading ? "..." : "↻"}
        </button>
      </div>

      {/* Hero */}
      <div style={S.hero}>
        <div style={S.heroTop}>
          <div style={S.heroTitle}>{pedido?.cliente_nombre || ""}</div>
          <span style={S.badgeUrg}>{isUrgente ? "⚡ URGENTE" : "GENERAL"}</span>
        </div>

        <div style={S.heroSub}>
          <span style={S.tag}>Entrega</span>
          <b style={S.heroB}>{pedido?.fecha_entrega || ""}</b>
          <b style={S.heroB}>{pedido?.horario_entrega || ""}</b>
          <span style={S.sep}>•</span>
          <span style={S.tag}>Estado</span>
          <b style={S.heroB}>{isUrgente ? "Prioridad" : "Normal"}</b>
        </div>

        {isUrgente && pedido?.fecha_inicio_urgente ? (
          <div style={S.heroSub2}>
            <span style={S.tag}>Inicio</span>
            <b style={S.heroB}>
              {new Date(pedido.fecha_inicio_urgente).toLocaleString()}
            </b>
          </div>
        ) : null}

        {/* ✅ botón regresar a P2 */}
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <button
            onClick={regresarAP2}
            disabled={sendingBack}
            style={S.btnDanger}
          >
            {sendingBack ? "Regresando..." : "↩️ REGRESAR A P2 (Corrección)"}
          </button>
          <div style={S.hintMini}>
            Úsalo si Producción detecta error. Se quita de P3 y vuelve a P2.
          </div>
        </div>
      </div>

      {/* Renglones */}
      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((r, idx) => (
          <div key={r.id} style={S.lineCard}>
            <div style={S.lineHeader}>
              <div style={S.lineHeaderLeft}>
                <span style={S.lineIndex}>Renglón {idx + 1}</span>
                <span style={S.meta}>
                  {r.tamano} · {r.tipo} · x{r.cantidad}
                </span>
              </div>

              <div style={S.tomaMiniPill}>
                TOMA{" "}
                <span style={{ fontWeight: 950 }}>
                  {r.n_toma ? String(r.n_toma) : "PEND"}
                </span>
              </div>
            </div>

            <div style={S.infoGrid}>
              <InfoBox k="Papel" v={r.papel || "-"} strong={false} S={S} />
              <InfoBox k="Ropa" v={r.ropa || "-"} strong={false} S={S} />
              <InfoBox
                k="Toma"
                v={r.n_toma ? String(r.n_toma) : "PEND"}
                strong
                S={S}
              />
            </div>

            {r.especificaciones ? (
              <div style={S.spec}>
                <span style={S.specTitle}>Especificaciones</span>
                <div style={S.specBody}>{r.especificaciones}</div>
              </div>
            ) : null}

            {/* Checklist */}
            <div style={S.checks}>
              <CheckChip
                label="Retocado"
                value={!!r.retocado}
                onClick={() => toggle(r.id, "retocado", !r.retocado)}
                S={S}
              />
              <CheckChip
                label="Impreso"
                value={!!r.impreso}
                onClick={() => toggle(r.id, "impreso", !r.impreso)}
                S={S}
              />
              <CheckChip
                label={isUrgente ? "Calendario (NO APLICA)" : "Calendario"}
                value={isUrgente ? true : !!r.calendario}
                disabled={isUrgente}
                onClick={() => toggle(r.id, "calendario", !r.calendario)}
                S={S}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Acción final */}
      <div style={{ marginTop: 16 }}>
        <button onClick={marcarTodo} disabled={savingAll} style={S.btnPrimary}>
          {savingAll ? "Marcando..." : "✅ MARCAR TODO COMO LISTO"}
        </button>
        <div style={S.hint}>
          Si ya quedó concluido, desaparecerá de Producción automáticamente.
        </div>
      </div>
    </div>
  );
}

function InfoBox({ k, v, strong, S }) {
  return (
    <div style={S.infoBox}>
      <div style={S.infoKey}>{k}</div>
      <div style={{ ...S.infoVal, fontWeight: strong ? 950 : 850 }}>{v}</div>
    </div>
  );
}

function CheckChip({ label, value, onClick, disabled, S }) {
  return (
    <button
      onClick={() => !disabled && onClick()}
      style={{
        ...S.chipBtn,
        cursor: disabled ? "not-allowed" : "pointer",
        border: value ? `1px solid ${S.okBorder}` : S.borderSoft,
        background: disabled ? S.disabledBg : value ? S.okBg : S.softBg,
        opacity: disabled ? 0.9 : 1,
      }}
    >
      <span style={{ fontWeight: 950 }}>{label}</span>
      <span style={{ marginLeft: 8, opacity: 0.92, fontWeight: 950 }}>
        {value ? "LISTO" : "PEND"}
      </span>
    </button>
  );
}

function buildTomaResumen(rows) {
  const tomas = [
    ...new Set(
      (rows || []).map((r) => (r.n_toma || "").trim()).filter(Boolean)
    ),
  ];
  const hasPend = (rows || []).some(
    (r) => !r.n_toma || !String(r.n_toma).trim()
  );
  if (hasPend) return "TOMA PEND";
  if (tomas.length === 1) return `TOMA ${tomas[0]}`;
  if (tomas.length > 1) return `TOMAS ${tomas.join(",")}`;
  return "TOMA PEND";
}

/* ====== TEMA / ESTILOS FOTO RAMÍREZ (mobile-first) ====== */
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
  okBorder: "rgba(0,255,120,0.45)",
  okSoft: "rgba(0,255,120,0.18)",
  dangerBorder: "rgba(255,80,80,0.55)",
  dangerBg: "rgba(255,80,80,0.14)",
  dangerText: "rgba(255,220,220,0.98)",
};

function makeStyles(isMobile, isUrgente) {
  const borderSoft = "1px solid rgba(255,255,255,0.12)";
  const softBg = "rgba(255,255,255,0.04)";
  const disabledBg = "rgba(255,255,255,0.03)";
  const okBorder = THEME.okBorder;
  const okBg = THEME.okSoft;

  return {
    borderSoft,
    softBg,
    disabledBg,
    okBorder,
    okBg,

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
      padding: 10,
      border: `1px solid ${THEME.goldSoft}`,
      backdropFilter: "blur(10px)",
    },

    btnCremaSmall: {
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid ${THEME.gold}`,
      background: THEME.crema,
      color: "rgba(20,24,28,0.95)",
      cursor: "pointer",
      fontWeight: 950,
      boxShadow: "0 8px 22px rgba(0,0,0,0.25)",
      whiteSpace: "nowrap",
    },

    barTitle: {
      flex: 1,
      textAlign: "center",
      fontWeight: 950,
      fontSize: isMobile ? 13 : 14,
      letterSpacing: 0.4,
      color: THEME.crema,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },

    barDot: { margin: "0 6px", opacity: 0.55 },

    hero: {
      padding: 14,
      borderRadius: 18,
      border: `1px solid ${THEME.goldSoft}`,
      background: "rgba(255,255,255,0.03)",
      marginBottom: 12,
    },

    heroTop: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      justifyContent: "space-between",
      flexWrap: "wrap",
    },

    heroTitle: { fontWeight: 950, fontSize: 18, color: THEME.text },

    badgeUrg: {
      padding: "6px 10px",
      borderRadius: 999,
      border: `1px solid ${isUrgente ? THEME.aquaBorder : THEME.goldSoft}`,
      background: isUrgente ? THEME.aquaSoft : "rgba(212,175,55,0.10)",
      fontWeight: 950,
      fontSize: 12,
      color: THEME.crema,
      whiteSpace: "nowrap",
    },

    heroSub: {
      marginTop: 10,
      opacity: 0.92,
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      alignItems: "center",
      color: THEME.textSoft,
    },

    heroSub2: {
      marginTop: 8,
      opacity: 0.9,
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      alignItems: "center",
      color: THEME.textSoft,
    },

    heroB: { color: THEME.text, fontWeight: 950 },

    sep: { opacity: 0.35, margin: "0 6px" },

    tag: {
      padding: "4px 10px",
      borderRadius: 999,
      border: `1px solid ${THEME.aquaBorder}`,
      background: THEME.aquaSoft,
      fontWeight: 950,
      fontSize: 12,
      color: THEME.text,
    },

    btnDanger: {
      width: "100%",
      padding: "14px 14px",
      borderRadius: 18,
      border: `1px solid ${THEME.dangerBorder}`,
      background: THEME.dangerBg,
      color: THEME.dangerText,
      cursor: "pointer",
      fontWeight: 950,
      fontSize: 15,
    },

    hintMini: {
      color: THEME.textMute,
      fontWeight: 850,
      fontSize: 12,
      textAlign: "center",
    },

    lineCard: {
      padding: 14,
      borderRadius: 18,
      border: "1px solid rgba(255,255,255,0.10)",
      background: THEME.cardA,
      boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
    },

    lineHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
    },

    lineHeaderLeft: {
      display: "grid",
      gap: 6,
    },

    lineIndex: {
      fontWeight: 950,
      color: THEME.crema,
      letterSpacing: 0.2,
    },

    meta: {
      opacity: 0.92,
      fontWeight: 850,
      color: THEME.textSoft,
    },

    tomaMiniPill: {
      padding: "8px 12px",
      borderRadius: 999,
      border: `1px solid ${THEME.aquaBorder}`,
      background: "rgba(0,255,208,0.14)",
      fontWeight: 900,
      color: THEME.text,
      whiteSpace: "nowrap",
    },

    infoGrid: {
      display: "grid",
      gridTemplateColumns: isMobile
        ? "repeat(3, minmax(0, 1fr))"
        : "repeat(auto-fit, minmax(140px, 1fr))",
      gap: 10,
      marginTop: 12,
    },

    infoBox: {
      borderRadius: 16,
      border: `1px solid ${THEME.goldSoft}`,
      background: "rgba(0,0,0,0.22)",
      padding: 12,
    },

    infoKey: {
      fontSize: 12,
      opacity: 0.78,
      fontWeight: 900,
      color: THEME.crema,
    },

    infoVal: { marginTop: 6, fontSize: 14, fontWeight: 900, color: THEME.text },

    spec: {
      marginTop: 12,
      padding: 12,
      borderRadius: 16,
      border: `1px solid ${THEME.goldSoft}`,
      background: "rgba(0,0,0,0.22)",
    },

    specTitle: {
      fontWeight: 950,
      fontSize: 12,
      opacity: 0.9,
      color: THEME.crema,
    },

    specBody: {
      marginTop: 8,
      opacity: 0.95,
      fontWeight: 850,
      lineHeight: 1.35,
      color: THEME.text,
      whiteSpace: "pre-wrap",
    },

    checks: {
      marginTop: 12,
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
      gap: 10,
    },

    chipBtn: {
      padding: "12px 12px",
      borderRadius: 16,
      color: THEME.text,
      fontWeight: 950,
      width: "100%",
      textAlign: "left",
      background: softBg,
    },

    btnPrimary: {
      width: "100%",
      padding: "16px 14px",
      borderRadius: 18,
      border: `1px solid ${THEME.gold}`,
      background: THEME.crema,
      color: "rgba(20,24,28,0.95)",
      cursor: "pointer",
      fontWeight: 950,
      fontSize: 16,
      boxShadow: "0 14px 28px rgba(0,0,0,0.28)",
    },

    hint: {
      marginTop: 10,
      color: THEME.textMute,
      fontWeight: 850,
      fontSize: 12,
      textAlign: "center",
    },
  };
}
