// src/ArchivoVista.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import logoCuadro from "./assets/FOTO RAMIREZ NUEVO CUADRO.png";

/**
 * ARCHIVO (Guía de carpetas) - Foto Ramírez style
 * - 1 barra de búsqueda: nombre o número de toma
 * - Resultados: NOMBRE, N. TOMA, FECHA REALIZACIÓN, CARPETA (MES AÑO)
 * - Fuente correcta: vista SQL `archivo_index` (Supabase)
 *   columnas: pedido_id, nombre, n_toma, fecha_realizacion
 * - Sin acciones, sin edición, sin detalles.
 */

const pad2 = (n) => String(n).padStart(2, "0");

const fmtDia = (v) => {
  if (!v) return "";
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  } catch {
    return String(v);
  }
};

const carpetaFromFecha = (fecha) => {
  if (!fecha) return "";
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString("es-MX", { month: "long", year: "numeric" })
    .toUpperCase();
};

export default function ArchivoVista() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const qClean = useMemo(() => q.trim(), [q]);

  // Debounce simple
  const tRef = useRef(null);
  useEffect(() => {
    if (tRef.current) clearTimeout(tRef.current);

    if (!qClean) {
      setRows([]);
      setMsg("");
      setLoading(false);
      return;
    }

    tRef.current = setTimeout(() => {
      runSearch(qClean);
    }, 260);

    return () => {
      if (tRef.current) clearTimeout(tRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qClean]);

  const runSearch = async (term) => {
    setLoading(true);
    setMsg("");

    const safe = term.replaceAll("%", "\\%");

    const { data, error } = await supabase
      .from("archivo_index") // ✅ OJO: esta vista debe existir en Supabase
      .select("pedido_id,nombre,n_toma,fecha_realizacion")
      .or(`nombre.ilike.%${safe}%,n_toma.ilike.%${safe}%`)
      .order("fecha_realizacion", { ascending: false })
      .limit(25);

    if (error) {
      setRows([]);
      setMsg(error?.message || "No se pudo buscar. Revisa Supabase.");
      setLoading(false);
      return;
    }

    const normalized = (data || []).map((r) => ({
      id: r.pedido_id,
      nombre: r.nombre,
      toma: r.n_toma,
      fecha: r.fecha_realizacion,
      carpeta: carpetaFromFecha(r.fecha_realizacion),
    }));

    setRows(normalized);
    if (!normalized.length) setMsg("Sin resultados.");
    setLoading(false);
  };

  const showHint = !qClean && !loading;

  return (
    <div style={styles.page}>
      {/* ===== Header FR ===== */}
      <div style={styles.hero}>
        <div style={styles.brandRow}>
          <div style={styles.logoWrap}>
            <img src={logoCuadro} alt="Foto Ramírez" style={styles.logo} />
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={styles.title}>ARCHIVO</div>
            <div style={styles.sub}>
              Guía rápida para encontrar la <b>carpeta</b> (mes/año) del
              cliente.
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={styles.searchWrap}>
          <div style={styles.searchInner}>
            <div style={styles.searchIcon}>⌕</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o número de toma…"
              style={styles.search}
            />
            {q ? (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setRows([]);
                  setMsg("");
                }}
                style={styles.clearBtn}
                aria-label="Limpiar búsqueda"
              >
                ✕
              </button>
            ) : null}
          </div>

          {loading ? (
            <div style={styles.loadingRow}>
              <div style={styles.dot} />
              <div style={styles.loading}>Buscando…</div>
            </div>
          ) : null}

          {msg ? <div style={styles.msg}>{msg}</div> : null}

          {showHint ? (
            <div style={styles.hint}>
              Tip: escribe <b>“Antonio”</b> o <b>“3969”</b> y te digo la{" "}
              <b>CARPETA</b>.
            </div>
          ) : null}
        </div>
      </div>

      {/* ===== Results ===== */}
      <div style={styles.list}>
        {rows.map((r) => (
          <div key={r.id} style={styles.card}>
            <div style={styles.cardTop}>
              <div style={styles.nombre}>{r.nombre || "—"}</div>
              <div style={styles.badge}>ARCHIVO</div>
            </div>

            <div style={styles.grid}>
              <div style={styles.k}>N. TOMA</div>
              <div style={styles.v}>{r.toma || "—"}</div>

              <div style={styles.k}>FECHA</div>
              <div style={styles.v}>{fmtDia(r.fecha) || "—"}</div>

              <div style={styles.k}>CARPETA</div>
              <div style={styles.folder}>{r.carpeta || "—"}</div>
            </div>

            <div style={styles.goldLine} />
          </div>
        ))}
      </div>

      <div style={{ height: 24 }} />
    </div>
  );
}

const styles = {
  page: {
    padding: 12,
    maxWidth: 560,
    margin: "0 auto",
  },

  hero: {
    borderRadius: 22,
    padding: 14,
    border: "1px solid rgba(212,175,55,0.20)",
    background:
      "radial-gradient(circle at 20% 10%, rgba(0,180,170,0.10), transparent 45%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.06), transparent 55%), linear-gradient(180deg, rgba(15,15,15,0.96) 0%, rgba(26,26,26,0.92) 100%)",
    boxShadow: "0 12px 26px rgba(0,0,0,0.45)",
    marginBottom: 12,
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

  searchWrap: {
    position: "sticky",
    top: 0,
    zIndex: 2,
  },
  searchInner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 12px",
    borderRadius: 16,
    border: "1px solid rgba(212,175,55,0.22)",
    background:
      "linear-gradient(180deg, rgba(255,247,230,0.08) 0%, rgba(255,247,230,0.04) 100%)",
  },
  searchIcon: {
    fontSize: 16,
    opacity: 0.85,
    color: "#fff7e6",
    userSelect: "none",
  },
  search: {
    width: "100%",
    fontSize: 16,
    padding: "2px 0",
    border: "none",
    outline: "none",
    background: "transparent",
    color: "#fff7e6",
    fontWeight: 700,
    letterSpacing: 0.2,
  },
  clearBtn: {
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff7e6",
    borderRadius: 12,
    padding: "6px 10px",
    cursor: "pointer",
    fontWeight: 900,
  },

  loadingRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(0,180,170,0.95)",
    boxShadow: "0 0 0 4px rgba(0,180,170,0.12)",
  },
  loading: {
    fontSize: 12,
    color: "rgba(245,241,232,0.85)",
    fontWeight: 800,
    letterSpacing: 0.3,
  },
  msg: {
    marginTop: 10,
    fontSize: 12,
    color: "rgba(245,241,232,0.85)",
    opacity: 0.95,
  },
  hint: {
    marginTop: 10,
    fontSize: 12,
    color: "rgba(245,241,232,0.82)",
    opacity: 0.95,
  },

  list: {
    display: "grid",
    gap: 10,
    marginTop: 10,
  },
  card: {
    borderRadius: 20,
    padding: 12,
    border: "1px solid rgba(212,175,55,0.18)",
    background:
      "linear-gradient(180deg, rgba(255,247,230,0.10) 0%, rgba(255,247,230,0.06) 100%)",
    boxShadow: "0 10px 22px rgba(0,0,0,0.35)",
    position: "relative",
    overflow: "hidden",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  nombre: {
    fontSize: 16,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: 0.35,
    color: "#fff7e6",
    minWidth: 0,
  },
  badge: {
    flex: "0 0 auto",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: 0.6,
    border: "1px solid rgba(212,175,55,0.45)",
    background: "rgba(0,0,0,0.30)",
    color: "#fff7e6",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "90px 1fr",
    rowGap: 8,
    columnGap: 10,
    alignItems: "center",
    paddingTop: 8,
    borderTop: "1px dashed rgba(255,255,255,0.12)",
  },
  k: {
    fontSize: 12,
    opacity: 0.82,
    fontWeight: 800,
    color: "rgba(245,241,232,0.80)",
    letterSpacing: 0.25,
  },
  v: {
    fontSize: 13,
    fontWeight: 900,
    textAlign: "right",
    color: "#fff7e6",
    letterSpacing: 0.2,
  },
  folder: {
    fontSize: 13,
    fontWeight: 950,
    textAlign: "right",
    letterSpacing: 0.6,
    color: "rgba(212,175,55,0.98)",
  },
  goldLine: {
    height: 2,
    marginTop: 12,
    borderRadius: 999,
    background:
      "linear-gradient(90deg, rgba(212,175,55,0.0) 0%, rgba(212,175,55,0.55) 40%, rgba(212,175,55,0.0) 100%)",
  },
};
