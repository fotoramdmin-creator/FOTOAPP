// src/BusquedaVista.js
import React, { useMemo, useRef, useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import logoCuadro from "./assets/FOTO RAMIREZ NUEVO CUADRO.png";

/**
 * BÚSQUEDA (Estatus)
 * - Busca por: nombre / n_toma / teléfono
 * - Fuente: view busqueda_view (solo lectura)
 * - Muestra: estado, producción (faltas), pago, entregado, listo_entrega
 * - SIN acciones (no edita, no cobra, no entrega)
 */

const money = (n) => {
  const x = Number(n || 0);
  if (!isFinite(x)) return "$0.00";
  return x.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
};

const pad2 = (n) => String(n).padStart(2, "0");

const fmtDia = (v) => {
  if (!v) return "-";
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  } catch {
    return String(v);
  }
};

const fmtDT = (v) => {
  if (!v) return "-";
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleString("es-MX");
  } catch {
    return String(v);
  }
};

const safeText = (x) => String(x ?? "").trim();

export default function BusquedaVista() {
  const [q, setQ] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [errMsg, setErrMsg] = useState("");

  // filtros (rápidos)
  const [fEntregados, setFEntregados] = useState("TODOS"); // TODOS | NO | SI
  const [fUrgentes, setFUrgentes] = useState(false);
  const [fDebe, setFDebe] = useState(false);
  const [fListo, setFListo] = useState(false);

  const qTrim = q.trim();

  // Debounce (para eficiencia)
  const tRef = useRef(null);
  useEffect(() => {
    if (!hasSearched) return;
    if (tRef.current) clearTimeout(tRef.current);

    if (!qTrim) return;

    tRef.current = setTimeout(() => {
      buscar(qTrim);
    }, 260);

    return () => {
      if (tRef.current) clearTimeout(tRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qTrim]);

  async function buscar(termOverride) {
    const term = (termOverride ?? qTrim).trim();
    if (!term) return;

    setHasSearched(true);
    setLoading(true);
    setErrMsg("");

    try {
      const safe = term.replaceAll("%", "\\%");

      const { data, error } = await supabase
        // ✅ 1) LA VISTA BUENA
        .from("busqueda_view")
        .select("*")
        // ✅ 2) BUSCAR EN n_toma_busqueda (normalizado) + nombre + teléfono
        .or(
          `cliente_nombre.ilike.%${safe}%,n_toma_busqueda.ilike.%${safe}%,cliente_telefono.ilike.%${safe}%`
        )
        .order("fecha_creacion", { ascending: false })
        .limit(120);

      if (error) throw error;

      setRows(data || []);
    } catch (e) {
      console.error("BUSQUEDA buscar error:", e);
      setRows([]);
      setErrMsg(
        e?.message ||
          "Error al buscar. Revisa permisos (RLS) y que exista la view busqueda_view."
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

    // resetea filtros
    setFEntregados("TODOS");
    setFUrgentes(false);
    setFDebe(false);
    setFListo(false);
  }

  const filtered = useMemo(() => {
    let list = rows || [];

    // entregados
    if (fEntregados === "NO") list = list.filter((r) => !r.entregado);
    if (fEntregados === "SI") list = list.filter((r) => !!r.entregado);

    // urgentes
    if (fUrgentes) list = list.filter((r) => !!r.urgente);

    // debe
    if (fDebe) list = list.filter((r) => Number(r.resta || 0) > 0);

    // listo entrega
    if (fListo) list = list.filter((r) => !!r.listo_entrega);

    return list;
  }, [rows, fEntregados, fUrgentes, fDebe, fListo]);

  // ====== ESTILO FOTO RAMÍREZ (mobile first) ======
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

    hero: {
      borderRadius: 22,
      padding: 14,
      border: "1px solid rgba(212,175,55,0.20)",
      background:
        "radial-gradient(circle at 20% 10%, rgba(0,180,170,0.10), transparent 45%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.06), transparent 55%), linear-gradient(180deg, rgba(15,15,15,0.96) 0%, rgba(26,26,26,0.92) 100%)",
      boxShadow: "0 12px 26px rgba(0,0,0,0.45)",
    },
    brandRow: {
      display: "flex",
      gap: 12,
      alignItems: "center",
      marginBottom: 12,
    },
    logoWrap: {
      width: 56,
      height: 56,
      borderRadius: 16,
      border: "1px solid rgba(212,175,55,0.35)",
      background: "rgba(255,247,230,0.06)",
      boxShadow: "0 10px 22px rgba(0,0,0,0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "0 0 auto",
    },
    logo: {
      width: 48,
      height: 48,
      borderRadius: 12,
      objectFit: "cover",
    },
    title: {
      fontSize: 18,
      fontWeight: 950,
      letterSpacing: 0.6,
      color: "#fff7e6",
      lineHeight: 1.1,
    },
    sub: {
      fontSize: 12,
      opacity: 0.9,
      marginTop: 4,
      lineHeight: 1.25,
      color: "rgba(245,241,232,0.85)",
    },

    // barra
    searchRow: {
      display: "flex",
      gap: 10,
      alignItems: "stretch",
      flexWrap: "wrap",
      marginTop: 10,
    },
    input: {
      flex: "1 1 240px",
      minWidth: 240,
      padding: 14,
      borderRadius: 16,
      border: "1px solid rgba(212,175,55,0.22)",
      background: "rgba(255,247,230,0.08)",
      color: "#fff7e6",
      fontSize: 16,
      outline: "none",
      fontWeight: 800,
      letterSpacing: 0.2,
      boxShadow: "0 10px 22px rgba(0,0,0,0.35)",
    },
    btnCrema: (disabled = false) => ({
      padding: "14px 16px",
      borderRadius: 16,
      border: "1px solid rgba(205,170,95,0.9)",
      background: disabled
        ? "linear-gradient(180deg, #cfc7b6 0%, #bfb6a3 100%)"
        : "linear-gradient(180deg, #fff7e6 0%, #f3ead6 100%)",
      color: "#1b1b1b",
      fontWeight: 950,
      cursor: disabled ? "not-allowed" : "pointer",
      boxShadow: "0 10px 22px rgba(0,0,0,0.35)",
      minWidth: 120,
      flex: "1 1 140px",
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
      flex: "1 1 140px",
    },

    // filtros (chips)
    filtersRow: {
      marginTop: 10,
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
    },
    chip: (active, kind = "dark") => {
      const base = {
        padding: "8px 12px",
        borderRadius: 999,
        fontWeight: 950,
        fontSize: 12,
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
      };

      if (kind === "cream") {
        return {
          ...base,
          border: `1px solid ${
            active ? "rgba(205,170,95,0.95)" : "rgba(205,170,95,0.45)"
          }`,
          background: active
            ? "linear-gradient(180deg, #fff7e6 0%, #f3ead6 100%)"
            : "rgba(255,247,230,0.08)",
          color: active ? "#1b1b1b" : "rgba(245,241,232,0.92)",
        };
      }

      return {
        ...base,
        border: `1px solid ${
          active ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.14)"
        }`,
        background: active
          ? "rgba(255,255,255,0.12)"
          : "rgba(255,255,255,0.06)",
        color: "rgba(245,241,232,0.92)",
      };
    },

    // lista
    listWrap: { marginTop: 12, display: "grid", gap: 12 },

    card: {
      borderRadius: 22,
      padding: 14,
      background: "linear-gradient(180deg, #fff7e6 0%, #f3ead6 100%)",
      border: "1px solid rgba(205,170,95,0.70)",
      boxShadow: "0 16px 30px rgba(0,0,0,0.40)",
    },
    topRow: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "flex-start",
      flexWrap: "wrap",
    },
    left: { flex: "1 1 260px", minWidth: 240 },
    right: { flex: "1 1 220px", minWidth: 220, textAlign: "right" },

    name: { fontWeight: 1000, fontSize: 16, color: "#1d1d1d" },
    tomaLine: { marginTop: 6, fontSize: 16, fontWeight: 1000, color: "#111" },
    tomaValue: { fontSize: 20, fontWeight: 1000, color: "#0f0f0f" },

    small: { marginTop: 6, fontSize: 13, opacity: 0.9, color: "#2a2a2a" },

    badges: { marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" },
    badge: (type) => {
      let bg = "rgba(255,255,255,0.65)";
      let bd = "rgba(0,0,0,0.18)";
      let color = "#1d1d1d";

      if (type === "ok") {
        bg = "rgba(0,180,90,0.16)";
        bd = "rgba(0,180,90,0.35)";
      }
      if (type === "warn") {
        bg = "rgba(255,140,0,0.14)";
        bd = "rgba(255,140,0,0.35)";
      }
      if (type === "info") {
        bg = "rgba(40,120,255,0.12)";
        bd = "rgba(40,120,255,0.30)";
      }
      if (type === "danger") {
        bg = "rgba(220,50,70,0.12)";
        bd = "rgba(220,50,70,0.30)";
      }

      return {
        padding: "7px 12px",
        borderRadius: 999,
        border: `1px solid ${bd}`,
        background: bg,
        color,
        fontWeight: 1000,
        fontSize: 12,
      };
    },

    // footer mini info
    miniGrid: {
      marginTop: 10,
      paddingTop: 10,
      borderTop: "1px dashed rgba(0,0,0,0.18)",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      fontSize: 12,
      color: "#2a2a2a",
      fontWeight: 850,
    },
    miniItem: { display: "flex", justifyContent: "space-between", gap: 10 },
    miniK: { opacity: 0.85 },
    miniV: { fontWeight: 1000 },
  };

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        {/* HERO */}
        <div style={S.hero}>
          <div style={S.brandRow}>
            <div style={S.logoWrap}>
              <img src={logoCuadro} alt="Foto Ramírez" style={S.logo} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={S.title}>BÚSQUEDA</div>
              <div style={S.sub}>
                Busca pedidos y ve su <b>estatus</b> (toma, producción, listo,
                entregado).
              </div>
            </div>
          </div>

          {/* Barra */}
          <div style={S.searchRow}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por Nombre, N. de toma o Teléfono…"
              style={S.input}
              onKeyDown={(e) => {
                if (e.key === "Enter") buscar();
              }}
            />

            <button
              onClick={() => buscar()}
              disabled={!qTrim || loading}
              style={S.btnCrema(!qTrim || loading)}
              type="button"
            >
              {loading ? "Buscando..." : "Buscar"}
            </button>

            {hasSearched && (
              <button onClick={limpiar} style={S.btnGhost} type="button">
                Limpiar
              </button>
            )}
          </div>

          {/* Filtros (solo cuando ya buscaste) */}
          {hasSearched && (
            <div style={S.filtersRow}>
              <div
                style={S.chip(fEntregados === "TODOS", "cream")}
                onClick={() => setFEntregados("TODOS")}
              >
                TODOS
              </div>
              <div
                style={S.chip(fEntregados === "NO", "cream")}
                onClick={() => setFEntregados("NO")}
              >
                NO ENTREGADOS
              </div>
              <div
                style={S.chip(fEntregados === "SI", "cream")}
                onClick={() => setFEntregados("SI")}
              >
                ENTREGADOS
              </div>

              <div
                style={S.chip(fUrgentes)}
                onClick={() => setFUrgentes((v) => !v)}
              >
                URGENTES
              </div>
              <div style={S.chip(fDebe)} onClick={() => setFDebe((v) => !v)}>
                DEBEN
              </div>
              <div style={S.chip(fListo)} onClick={() => setFListo((v) => !v)}>
                LISTO ENTREGA
              </div>
            </div>
          )}

          {/* Mensajes */}
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

          {hasSearched && !loading && !errMsg && filtered.length === 0 ? (
            <div
              style={{
                marginTop: 12,
                color: "rgba(255,255,255,0.8)",
                fontWeight: 900,
              }}
            >
              Sin resultados para “{safeText(qTrim)}”.
            </div>
          ) : null}
        </div>

        {/* LISTA */}
        {hasSearched && filtered.length > 0 ? (
          <div style={S.listWrap}>
            {filtered.map((r) => {
              const debe = Number(r.resta || 0) > 0;
              const entregado = !!r.entregado;
              const listo = !!r.listo_entrega;
              const urgente = !!r.urgente;

              const estado = safeText(r.estado || "—").toUpperCase();

              const faltas = [
                Number(r.faltan_retocado || 0) > 0
                  ? `Retocado (${r.faltan_retocado})`
                  : null,
                Number(r.faltan_impreso || 0) > 0
                  ? `Impreso (${r.faltan_impreso})`
                  : null,
                Number(r.faltan_calendario || 0) > 0
                  ? `Calendario (${r.faltan_calendario})`
                  : null,
              ].filter(Boolean);

              return (
                <div key={r.pedido_id} style={S.card}>
                  <div style={S.topRow}>
                    <div style={S.left}>
                      <div style={S.name}>
                        {r.cliente_nombre || "(Sin nombre)"}
                      </div>

                      <div style={S.tomaLine}>
                        N. TOMA:{" "}
                        <span style={S.tomaValue}>{r.n_toma || "-"}</span>
                      </div>

                      <div style={S.small}>
                        Entrega: <b>{r.fecha_entrega || "-"}</b>
                        {r.horario_entrega ? ` · ${r.horario_entrega}` : ""}
                      </div>

                      <div style={S.small}>
                        Creación:{" "}
                        <b>{fmtDT(r.fecha_creacion || r.created_at)}</b>
                      </div>
                    </div>

                    <div style={S.right}>
                      <div style={{ fontWeight: 1000, color: "#1d1d1d" }}>
                        {r.pagado ? "PAGADO ✅" : debe ? "⛔ DEBE" : "—"}
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          fontWeight: 900,
                          color: "#1d1d1d",
                        }}
                      >
                        Resta: <b>{money(r.resta)}</b>
                      </div>
                      <div
                        style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}
                      >
                        Total: {money(r.total_final)} · A/C: {money(r.anticipo)}
                      </div>
                    </div>
                  </div>

                  <div style={S.badges}>
                    <span style={S.badge("info")}>{estado}</span>

                    {urgente ? (
                      <span style={S.badge("danger")}>URGENTE</span>
                    ) : null}

                    {entregado ? (
                      <span style={S.badge("ok")}>
                        ENTREGADO ✅{" "}
                        {r.entregado_at ? `· ${fmtDT(r.entregado_at)}` : ""}
                      </span>
                    ) : listo ? (
                      <span style={S.badge("ok")}>LISTO PARA ENTREGA ✅</span>
                    ) : (
                      <span style={S.badge("warn")}>NO LISTO ⏳</span>
                    )}

                    {!entregado && !listo && faltas.length > 0 ? (
                      <span style={S.badge("warn")}>
                        Falta: {faltas.join(" · ")}
                      </span>
                    ) : null}

                    {r.ticket_whatsapp ? (
                      <span style={S.badge("info")}>TICKET WHATSAPP ✅</span>
                    ) : null}

                    {r.ticket_impreso ? (
                      <span style={S.badge("info")}>TICKET IMPRESO ✅</span>
                    ) : null}

                    {r.p_2listo ? (
                      <span style={S.badge("info")}>P2 LISTO ✅</span>
                    ) : null}
                  </div>

                  <div style={S.miniGrid}>
                    <div style={S.miniItem}>
                      <span style={S.miniK}>Renglones</span>
                      <span style={S.miniV}>{Number(r.renglones || 0)}</span>
                    </div>
                    <div style={S.miniItem}>
                      <span style={S.miniK}>Retocado faltan</span>
                      <span style={S.miniV}>
                        {Number(r.faltan_retocado || 0)}
                      </span>
                    </div>
                    <div style={S.miniItem}>
                      <span style={S.miniK}>Impreso faltan</span>
                      <span style={S.miniV}>
                        {Number(r.faltan_impreso || 0)}
                      </span>
                    </div>
                    <div style={S.miniItem}>
                      <span style={S.miniK}>Calendario faltan</span>
                      <span style={S.miniV}>
                        {Number(r.faltan_calendario || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}
