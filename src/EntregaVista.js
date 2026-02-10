// src/EntregaVista.js
import React, { useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import logoCuadro from "./assets/FOTO RAMIREZ NUEVO CUADRO.png";

const fmtMoney = (n) => {
  const x = Number(n || 0);
  if (!isFinite(x)) return "$0.00";
  return x.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
};

const num = (v) => {
  const x = Number(v);
  return isFinite(x) ? x : 0;
};

export default function EntregaVista() {
  const [q, setQ] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [errMsg, setErrMsg] = useState("");

  // Modal COBRAR
  const [cobrarOpen, setCobrarOpen] = useState(false);
  const [rowSel, setRowSel] = useState(null);
  const [tipoPago, setTipoPago] = useState("LIQUIDACION"); // LIQUIDACION | A_CUENTA
  const [monto, setMonto] = useState("");
  const [recibido, setRecibido] = useState("");
  const [nota, setNota] = useState("");
  const [savingPago, setSavingPago] = useState(false);

  const qTrim = q.trim();

  // ====== ESTILOS FOTO RAMÍREZ ======
  // ✅ Ajuste SOLO para CELULAR (sin tocar lógica/estilos base):
  // - Search bar: botones 100% visibles con wrap y flex-basis
  // - Cards: header se apila en móvil (para que no choque payBox)
  // - Acciones: botones a 100% en móvil si no caben
  // - Logo PNG: altura menor en móvil y tamaño controlado
  const S = {
    page: {
      minHeight: "100vh",
      padding: 14,
      background: `
        radial-gradient(circle at 20% 20%, rgba(0,180,170,0.12), transparent 40%),
        radial-gradient(circle at 80% 30%, rgba(255,255,255,0.05), transparent 45%),
        linear-gradient(180deg, #0f0f0f 0%, #1a1a1a 100%)
      `,
    },
    wrap: { maxWidth: 980, margin: "0 auto" },

    // ✅ LOGO TENUE (solo primera pantalla)
    logoWrap: {
      display: "grid",
      placeItems: "center",
      marginTop: 10,
      marginBottom: 18,
      pointerEvents: "none",
      userSelect: "none",
    },
    logo: {
      fontSize: 64,
      fontWeight: 1000,
      letterSpacing: 2,
      color: "rgba(255,255,255,0.08)",
      textTransform: "uppercase",
      lineHeight: 1,
    },
    logoSub: {
      marginTop: 6,
      fontSize: 16,
      fontWeight: 900,
      letterSpacing: 3,
      color: "rgba(255,255,255,0.06)",
      textTransform: "uppercase",
    },

    // barra
    searchRow: {
      display: "flex",
      gap: 10,
      alignItems: "stretch",
      flexWrap: "wrap", // ✅ permite que baje a otra línea en celular
    },
    input: {
      flex: "1 1 240px", // ✅ clave para mobile (no se come a los botones)
      minWidth: 240,
      padding: 14,
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(255,255,255,0.08)",
      color: "#f5f5f5",
      fontSize: 16,
      outline: "none",
      boxShadow: "0 10px 22px rgba(0,0,0,0.35)",
    },

    // botones estilo crema + dorado
    btnCrema: (disabled = false) => ({
      padding: "14px 16px",
      borderRadius: 16,
      border: "1px solid rgba(205,170,95,0.9)",
      background: disabled
        ? "linear-gradient(180deg, #cfc7b6 0%, #bfb6a3 100%)"
        : "linear-gradient(180deg, #fff7e6 0%, #f3ead6 100%)",
      color: "#1b1b1b",
      fontWeight: 900,
      cursor: disabled ? "not-allowed" : "pointer",
      boxShadow: "0 10px 22px rgba(0,0,0,0.35)",
      minWidth: 120,
      flex: "1 1 140px", // ✅ mobile: que se acomode y no se corte
    }),
    btnGhost: {
      padding: "14px 16px",
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.18)",
      background: "rgba(255,255,255,0.10)",
      color: "#f0f0f0",
      fontWeight: 900,
      cursor: "pointer",
      boxShadow: "0 10px 22px rgba(0,0,0,0.35)",
      minWidth: 110,
      flex: "1 1 140px", // ✅ mobile: que se acomode y no se corte
    },

    // NEGRO elegante (para COBRAR y acciones)
    btnNegro: (disabled = false) => ({
      padding: "10px 12px",
      borderRadius: 14,
      border: "1px solid rgba(205,170,95,0.55)",
      background: disabled ? "rgba(255,255,255,0.18)" : "#0f0f0f",
      color: disabled ? "rgba(255,255,255,0.65)" : "#fff",
      fontWeight: 950,
      cursor: disabled ? "not-allowed" : "pointer",
      boxShadow: "0 12px 26px rgba(0,0,0,0.45)",
      flex: "1 1 160px", // ✅ mobile: acciones acomodables
    }),

    // ✅ VERDE (ENTREGAR) - SIN CAMBIAR (cuando listo)
    btnVerde: (disabled = false) => ({
      padding: "10px 12px",
      borderRadius: 14,
      border: "1px solid rgba(0,170,90,0.85)",
      background: disabled
        ? "rgba(255,255,255,0.18)"
        : "linear-gradient(180deg, #39e27b 0%, #12b85a 100%)",
      color: disabled ? "rgba(255,255,255,0.65)" : "#06210f",
      fontWeight: 950,
      cursor: disabled ? "not-allowed" : "pointer",
      boxShadow: "0 12px 26px rgba(0,0,0,0.45)",
      flex: "1 1 160px", // ✅ mobile: acciones acomodables
    }),

    // ✅ GRIS visible para NO LISTO (con warning)
    btnGrisWarn: (disabled = false) => ({
      padding: "10px 12px",
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.22)",
      background: disabled
        ? "rgba(255,255,255,0.18)"
        : "linear-gradient(180deg, #4a4a4a 0%, #2f2f2f 100%)",
      color: disabled ? "rgba(255,255,255,0.65)" : "#fff",
      fontWeight: 950,
      cursor: disabled ? "not-allowed" : "pointer",
      boxShadow: "0 12px 26px rgba(0,0,0,0.45)",
      flex: "1 1 160px", // ✅ mobile: acciones acomodables
    }),

    // card
    card: {
      borderRadius: 22,
      padding: 14,
      background: "linear-gradient(180deg, #fff7e6 0%, #f3ead6 100%)",
      border: "1px solid rgba(205,170,95,0.70)",
      boxShadow: "0 16px 30px rgba(0,0,0,0.40)",
    },
    cardHeader: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "flex-start",
      flexWrap: "wrap", // ✅ mobile: evita que payBox empuje todo
    },
    headerLeft: { flex: "1 1 260px", minWidth: 240 },
    headerRight: {
      flex: "1 1 220px",
      minWidth: 220,
      textAlign: "right",
      color: "#1d1d1d",
    },

    title: { fontWeight: 950, fontSize: 16, color: "#1d1d1d" },
    sub: { marginTop: 4, fontSize: 13, opacity: 0.9, color: "#2a2a2a" },

    // ✅ N. TOMA más grande y bold
    tomaLine: {
      marginTop: 6,
      fontSize: 18,
      fontWeight: 1000,
      color: "#111",
      letterSpacing: 0.2,
    },
    tomaValue: {
      fontSize: 22,
      fontWeight: 1000,
      color: "#0f0f0f",
      letterSpacing: 0.4,
    },

    urgent: {
      marginLeft: 8,
      fontSize: 12,
      fontWeight: 950,
      color: "#b00020",
      letterSpacing: 0.4,
    },

    payBox: { textAlign: "right", color: "#1d1d1d" },
    payState: { fontWeight: 1000 },
    payLine: { fontSize: 13, opacity: 0.92 },
    payMini: { fontSize: 12, opacity: 0.78 },

    // ✅ DEBE rojo más llamativo
    debeRed: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      color: "#b00020",
      fontWeight: 1000,
    },

    chipsRow: { marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" },
    chip: (kind) => {
      let bg = "rgba(255,255,255,0.65)";
      let bd = "rgba(0,0,0,0.18)";
      let color = "#1d1d1d";
      if (kind === "ok") {
        bg = "rgba(0,180,90,0.16)";
        bd = "rgba(0,180,90,0.35)";
      }
      if (kind === "warn") {
        bg = "rgba(255,140,0,0.14)";
        bd = "rgba(255,140,0,0.35)";
      }
      if (kind === "info") {
        bg = "rgba(40,120,255,0.12)";
        bd = "rgba(40,120,255,0.30)";
      }
      return {
        padding: "7px 12px",
        borderRadius: 999,
        border: `1px solid ${bd}`,
        background: bg,
        color,
        fontWeight: 950,
        fontSize: 12,
      };
    },

    resumen: {
      marginTop: 10,
      padding: 12,
      borderRadius: 16,
      background: "#0f0f0f",
      color: "#fff",
      whiteSpace: "pre-wrap",
      fontSize: 13,
      lineHeight: 1.35,
      border: "1px solid rgba(205,170,95,0.28)",
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
    },

    actions: {
      marginTop: 12,
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
    },

    // modal
    modalOverlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,.55)",
      display: "grid",
      placeItems: "center",
      padding: 12,
      zIndex: 99999,
    },
    modal: {
      width: "min(620px, 96vw)",
      borderRadius: 22,
      padding: 14,
      background: "linear-gradient(180deg, #fff7e6 0%, #f3ead6 100%)",
      border: "1px solid rgba(205,170,95,0.80)",
      boxShadow: "0 18px 40px rgba(0,0,0,0.55)",
    },
    modalTop: {
      display: "flex",
      justifyContent: "space-between",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap", // ✅ móvil: que no truene el title
    },
    modalTitle: { fontWeight: 950, fontSize: 16, color: "#1d1d1d" },
    modalClose: {
      border: "1px solid rgba(0,0,0,0.15)",
      background: "rgba(255,255,255,0.75)",
      borderRadius: 12,
      padding: "6px 10px",
      cursor: "pointer",
      fontWeight: 950,
    },
    tabs: { marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" },
    tabBtn: (active) => ({
      padding: "8px 12px",
      borderRadius: 999,
      border: `1px solid ${active ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.20)"}`,
      background: active ? "#0f0f0f" : "rgba(255,255,255,0.75)",
      color: active ? "#fff" : "#1d1d1d",
      fontWeight: 950,
      cursor: "pointer",
      flex: "1 1 140px", // ✅ móvil: tabs no se cortan
    }),
    fieldLabel: { fontSize: 13, fontWeight: 950, color: "#1d1d1d" },
    field: (disabled = false) => ({
      width: "100%",
      padding: 10,
      borderRadius: 14,
      border: "1px solid rgba(0,0,0,0.18)",
      background: disabled ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.85)",
      color: "#1d1d1d",
      outline: "none",
    }),

    // ✅ CAMBIO grande, negrita y verde
    cambioBig: {
      marginTop: 6,
      fontSize: 18,
      fontWeight: 1000,
      color: "#0ea84f",
      letterSpacing: 0.2,
    },

    modalFooter: {
      marginTop: 14,
      display: "flex",
      justifyContent: "flex-end",
      gap: 10,
      flexWrap: "wrap", // ✅ móvil: botones del modal no se salen
    },

    // ✅ contenedor del PNG (control mobile)
    pngBox: {
      position: "relative",
      width: "100%",
      height: 150, // ✅ un poco menos para celular
      marginBottom: 10,
      overflow: "hidden",
      pointerEvents: "none",
      userSelect: "none",
    },
    pngImg: {
      position: "absolute",
      left: "50%",
      top: "80%",
      transform: "translate(-50%, -50%)",
      width: "500%",
      maxWidth: 900,
      opacity: 0.1,
      filter: "grayscale(0%)",
    },
  };

  async function buscar() {
    if (!qTrim) return;

    setHasSearched(true);
    setLoading(true);
    setErrMsg("");
    setRows([]);

    try {
      const { data, error } = await supabase
        .from("entrega_busqueda")
        .select("*")
        .or(`cliente_nombre.ilike.%${qTrim}%,n_toma.ilike.%${qTrim}%`)
        // ✅ REGLA: EN ENTREGA NO MOSTRAR LOS YA ENTREGADOS
        // (usa entregado boolean + entregado_at por si tu view lo trae)
        .eq("entregado", false)
        .is("entregado_at", null)
        .limit(80);

      if (error) throw error;

      setRows(data || []);
    } catch (e) {
      console.error("ENTREGA buscar error:", e);
      setRows([]);
      setErrMsg(
        e?.message ||
          "Error al buscar. Revisa permisos (RLS) y que exista la view entrega_busqueda."
      );
    } finally {
      setLoading(false);
    }
  }

  function limpiar() {
    setQ("");
    setRows([]);
    setErrMsg("");
    setHasSearched(false);
    setCobrarOpen(false);
    setRowSel(null);
  }

  function openCobrar(r) {
    const resta = num(r.resta);
    setRowSel(r);
    setTipoPago("LIQUIDACION");
    setMonto(String(resta));
    setRecibido("");
    setNota("");
    setCobrarOpen(true);
  }

  function onTipoPagoChange(next) {
    setTipoPago(next);
    const resta = rowSel ? num(rowSel.resta) : 0;
    if (next === "LIQUIDACION") setMonto(String(resta));
    else setMonto("");
  }

  const montoAplicar = useMemo(() => {
    if (!rowSel) return 0;
    const resta = num(rowSel.resta);
    if (tipoPago === "LIQUIDACION") return resta;
    const m = num(monto);
    if (m <= 0) return 0;
    return Math.min(m, resta);
  }, [tipoPago, monto, rowSel]);

  const cambio = useMemo(() => {
    const r = num(recibido);
    const m = montoAplicar;
    if (r <= 0 || m <= 0) return 0;
    return Math.max(0, r - m);
  }, [recibido, montoAplicar]);

  async function registrarPago() {
    if (!rowSel) return;

    const resta = num(rowSel.resta);
    if (resta <= 0) {
      alert("Este pedido ya no tiene resta.");
      return;
    }
    if (montoAplicar <= 0) {
      alert("Ingresa un monto válido.");
      return;
    }
    if (recibido !== "" && num(recibido) < montoAplicar) {
      alert("El recibido no puede ser menor al monto a aplicar.");
      return;
    }

    setSavingPago(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const usuario_id = userRes?.user?.id || null;

      const notaFinal =
        (nota || "").trim() ||
        (recibido !== ""
          ? `Recibió ${fmtMoney(recibido)} · Aplica ${fmtMoney(
              montoAplicar
            )} · Cambio ${fmtMoney(cambio)}`
          : null);

      const { error } = await supabase.from("pagos").insert([
        {
          pedido_id: rowSel.pedido_id,
          fecha_pago: new Date().toISOString(),
          monto: montoAplicar,
          tipo: tipoPago,
          nota: notaFinal || null,
          usuario_id,
        },
      ]);

      if (error) throw error;

      await buscar();
      setCobrarOpen(false);
      setRowSel(null);
    } catch (e) {
      console.error("ENTREGA registrarPago error:", e);
      alert(e?.message || "Error registrando pago.");
    } finally {
      setSavingPago(false);
    }
  }

  async function marcarEntregado(r) {
    const listo = !!r.listo_entrega;
    if (!listo) {
      alert("Aún NO está listo para entregar (faltan pasos de producción).");
      return;
    }

    const debe = num(r.resta) > 0;
    if (debe) {
      const ok = window.confirm(
        `Este pedido AÚN DEBE ${fmtMoney(
          r.resta
        )}.\n¿Seguro que quieres marcarlo como ENTREGADO?`
      );
      if (!ok) return;
    }

    try {
      const { data: userRes } = await supabase.auth.getUser();
      const usuario_id = userRes?.user?.id || null;

      const { error } = await supabase
        .from("pedidos")
        .update({
          entregado: true,
          entregado_at: new Date().toISOString(),
          entregado_usuario: usuario_id,
        })
        .eq("id", r.pedido_id);

      if (error) throw error;

      await buscar();
    } catch (e) {
      console.error("ENTREGA marcarEntregado error:", e);
      alert(e?.message || "Error marcando ENTREGADO.");
    }
  }

  const list = useMemo(() => rows || [], [rows]);

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        {/* ✅ LOGO SOLO PRIMERA PANTALLA */}
        {!hasSearched && (
          <div style={S.logoWrap}>
            <div style={S.logo}>FOTO RAMÍREZ</div>
            <div style={S.logoSub}>ENTREGA</div>
          </div>
        )}

        {/* LOGO PNG TENUE – SOLO ANTES DE BUSCAR */}
        {!hasSearched && (
          <div style={S.pngBox}>
            <img src={logoCuadro} alt="Foto Ramírez" style={S.pngImg} />
          </div>
        )}

        {/* Barra */}
        <div style={S.searchRow}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por N. de toma o Nombre..."
            style={S.input}
            onKeyDown={(e) => {
              if (e.key === "Enter") buscar();
            }}
          />

          <button
            onClick={buscar}
            disabled={!qTrim || loading}
            style={S.btnCrema(!qTrim || loading)}
          >
            {loading ? "Buscando..." : "Buscar"}
          </button>

          {hasSearched && (
            <button onClick={limpiar} style={S.btnGhost}>
              Limpiar
            </button>
          )}
        </div>

        {/* Solo después de buscar */}
        {!hasSearched ? null : (
          <>
            {errMsg ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 18,
                  background: "rgba(255,60,60,0.12)",
                  border: "1px solid rgba(255,60,60,0.35)",
                  color: "#ffd7d7",
                  fontWeight: 950,
                  whiteSpace: "pre-wrap",
                }}
              >
                {errMsg}
              </div>
            ) : null}

            {!loading && !errMsg && list.length === 0 ? (
              <div
                style={{
                  marginTop: 12,
                  color: "rgba(255,255,255,0.8)",
                  fontWeight: 900,
                }}
              >
                Sin resultados para “{qTrim}”.
              </div>
            ) : null}

            {list.length > 0 ? (
              <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                {list.map((r) => {
                  const debe = num(r.resta) > 0;
                  const listo = !!r.listo_entrega;
                  const entregado = !!r.entregado;

                  const faltas = [
                    num(r.faltan_retocado) > 0
                      ? `Retocado (${r.faltan_retocado})`
                      : null,
                    num(r.faltan_impreso) > 0
                      ? `Impreso (${r.faltan_impreso})`
                      : null,
                    num(r.faltan_calendario) > 0
                      ? `Calendario (${r.faltan_calendario})`
                      : null,
                  ].filter(Boolean);

                  return (
                    <div key={r.pedido_id} style={S.card}>
                      <div style={S.cardHeader}>
                        <div style={S.headerLeft}>
                          <div style={S.title}>
                            {r.cliente_nombre || "(Sin nombre)"}
                            {r.urgente ? (
                              <span style={S.urgent}>URGENTE</span>
                            ) : null}
                          </div>

                          {/* ✅ N. TOMA grande y bold */}
                          <div style={S.tomaLine}>
                            N. TOMA:{" "}
                            <span style={S.tomaValue}>{r.n_toma || "-"}</span>
                          </div>

                          <div style={S.sub}>
                            Entrega: <b>{r.fecha_entrega || "-"}</b>{" "}
                            {r.horario_entrega ? `· ${r.horario_entrega}` : ""}
                          </div>
                        </div>

                        <div style={S.headerRight}>
                          <div style={S.payState}>
                            {r.pagado ? (
                              "PAGADO ✅"
                            ) : debe ? (
                              <span style={S.debeRed}>⛔ DEBE</span>
                            ) : (
                              "—"
                            )}
                          </div>
                          <div style={S.payLine}>
                            Resta: <b>{fmtMoney(r.resta)}</b>
                          </div>
                          <div style={S.payMini}>
                            Total: {fmtMoney(r.total_final)} · A/C:{" "}
                            {fmtMoney(r.anticipo)}
                          </div>
                        </div>
                      </div>

                      <div style={S.chipsRow}>
                        <span style={S.chip(listo ? "ok" : "warn")}>
                          {listo ? "LISTO PARA ENTREGAR ✅" : "NO LISTO ⏳"}
                        </span>

                        {!listo && faltas.length > 0 ? (
                          <span style={S.chip("warn")}>
                            Falta: {faltas.join(" · ")}
                          </span>
                        ) : null}

                        {entregado ? (
                          <span style={S.chip("info")}>
                            ENTREGADO ✅{" "}
                            {r.entregado_at
                              ? `· ${new Date(r.entregado_at).toLocaleString(
                                  "es-MX"
                                )}`
                              : ""}
                          </span>
                        ) : null}
                      </div>

                      {r.pedido_resumen ? (
                        <div style={S.resumen}>{r.pedido_resumen}</div>
                      ) : null}

                      <div style={S.actions}>
                        {!entregado && debe && (
                          <button
                            onClick={() => openCobrar(r)}
                            style={S.btnNegro(false)}
                          >
                            💳 Cobrar
                          </button>
                        )}

                        {!entregado && (
                          <button
                            onClick={() => marcarEntregado(r)}
                            style={
                              listo ? S.btnVerde(false) : S.btnGrisWarn(false)
                            }
                          >
                            {listo ? "✅ Entregar" : "⚠️ Entregar"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* Modal cobrar */}
            {cobrarOpen && rowSel && (
              <div style={S.modalOverlay} onClick={() => setCobrarOpen(false)}>
                <div style={S.modal} onClick={(e) => e.stopPropagation()}>
                  <div style={S.modalTop}>
                    <div style={S.modalTitle}>
                      Cobrar · {rowSel.cliente_nombre} · Toma{" "}
                      {rowSel.n_toma || "-"}
                    </div>
                    <button
                      style={S.modalClose}
                      onClick={() => setCobrarOpen(false)}
                    >
                      X
                    </button>
                  </div>

                  <div
                    style={{ marginTop: 10, fontWeight: 950, color: "#1d1d1d" }}
                  >
                    Resta actual: {fmtMoney(rowSel.resta)}
                  </div>

                  <div style={S.tabs}>
                    {[
                      { k: "LIQUIDACION", t: "Liquidación" },
                      { k: "A_CUENTA", t: "A cuenta" },
                    ].map((x) => (
                      <button
                        key={x.k}
                        onClick={() => onTipoPagoChange(x.k)}
                        style={S.tabBtn(tipoPago === x.k)}
                      >
                        {x.t}
                      </button>
                    ))}
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    <div>
                      <div style={S.fieldLabel}>Monto a aplicar</div>
                      <input
                        value={
                          tipoPago === "LIQUIDACION"
                            ? String(num(rowSel.resta))
                            : monto
                        }
                        onChange={(e) => setMonto(e.target.value)}
                        disabled={tipoPago === "LIQUIDACION"}
                        placeholder="Ej: 100"
                        style={S.field(tipoPago === "LIQUIDACION")}
                      />
                      {tipoPago === "A_CUENTA" && montoAplicar > 0 ? (
                        <div
                          style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}
                        >
                          Se aplicará: <b>{fmtMoney(montoAplicar)}</b>
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <div style={S.fieldLabel}>Recibido (efectivo)</div>
                      <input
                        value={recibido}
                        onChange={(e) => setRecibido(e.target.value)}
                        placeholder="Ej: 200"
                        style={S.field(false)}
                      />

                      {/* ✅ CAMBIO grande, bold, verde */}
                      <div style={S.cambioBig}>Cambio: {fmtMoney(cambio)}</div>
                    </div>

                    <div>
                      <div style={S.fieldLabel}>Nota (opcional)</div>
                      <input
                        value={nota}
                        onChange={(e) => setNota(e.target.value)}
                        placeholder="Ej: Pagó en efectivo"
                        style={S.field(false)}
                      />
                    </div>
                  </div>

                  <div style={S.modalFooter}>
                    <button
                      onClick={() => setCobrarOpen(false)}
                      disabled={savingPago}
                      style={S.btnNegro(savingPago)}
                    >
                      Cancelar
                    </button>

                    <button
                      onClick={registrarPago}
                      disabled={savingPago}
                      style={S.btnNegro(false)}
                    >
                      {savingPago ? "Guardando..." : "Registrar pago"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
