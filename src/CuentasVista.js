// src/CuentasVista.js
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import logoCuadro from "./assets/FOTO RAMIREZ NUEVO CUADRO.png";

const money = (n) => {
  const x = Number(n || 0);
  if (!isFinite(x)) return "$0.00";
  return x.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
};

const pad2 = (n) => String(n).padStart(2, "0");

// yyyy-mm-dd en hora local
const ymdLocal = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
};

const fmtDia = (v) => {
  if (!v) return "";
  try {
    const d = new Date(`${v}T00:00:00`);
    return d.toLocaleDateString("es-MX", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return String(v);
  }
};

const fmtDT = (v) => {
  if (!v) return "";
  try {
    const d = new Date(v);
    return d.toLocaleString("es-MX", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(v);
  }
};

const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

const startOfQuincena = (d) => {
  const day = d.getDate();
  // Qna 1: 1-15 | Qna 2: 16-fin
  return day <= 15
    ? new Date(d.getFullYear(), d.getMonth(), 1)
    : new Date(d.getFullYear(), d.getMonth(), 16);
};

export default function CuentasVista({ onOpenDetalle }) {
  // Selección temporal (sumar)
  const [selected, setSelected] = useState({}); // { 'YYYY-MM-DD': true }

  // Datos
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Contemplado persistente
  const [contemplados, setContemplados] = useState({});
  const [savingDia, setSavingDia] = useState({}); // { 'YYYY-MM-DD': true }

  // UI: filtros/orden/busqueda
  const [onlyNoCont, setOnlyNoCont] = useState(false);
  const [search, setSearch] = useState("");
  const [orderDesc, setOrderDesc] = useState(true);

  const fetchContemplados = async (dias) => {
    try {
      if (!dias?.length) {
        setContemplados({});
        return;
      }
      const { data, error } = await supabase
        .from("corte_contemplado")
        .select("dia, contemplado_at")
        .in("dia", dias);

      if (error) throw error;

      const map = {};
      (data || []).forEach((x) => {
        if (x?.dia)
          map[x.dia] = { contemplado: true, contemplado_at: x.contemplado_at };
      });
      setContemplados(map);
    } catch (e) {
      console.warn("No se pudieron cargar contemplados:", e?.message || e);
    }
  };

  const fetchRows = async () => {
    setLoading(true);
    setErr("");
    try {
      const { data, error } = await supabase
        .from("corte_diario")
        .select("dia, ingresos, retiros, neto")
        .order("dia", { ascending: !orderDesc })
        .limit(240);

      if (error) throw error;
      const list = Array.isArray(data) ? data : [];
      setRows(list);

      const dias = list.map((r) => r.dia).filter(Boolean);
      await fetchContemplados(dias);
    } catch (e) {
      setErr(e?.message || "Error cargando corte diario");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderDesc]);

  const toggleDia = (dia) => setSelected((s) => ({ ...s, [dia]: !s[dia] }));
  const clearSel = () => setSelected({});

  const selectedDias = useMemo(
    () => Object.keys(selected).filter((k) => selected[k]),
    [selected]
  );

  const resumen = useMemo(() => {
    if (!selectedDias.length)
      return { count: 0, ingresos: 0, retiros: 0, neto: 0 };
    const setSel = new Set(selectedDias);
    const pick = rows.filter((r) => setSel.has(r.dia));
    const ingresos = pick.reduce((a, r) => a + Number(r.ingresos || 0), 0);
    const retiros = pick.reduce((a, r) => a + Number(r.retiros || 0), 0);
    const neto = pick.reduce((a, r) => a + Number(r.neto || 0), 0);
    return { count: pick.length, ingresos, retiros, neto };
  }, [rows, selectedDias]);

  const toggleContemplado = async (dia) => {
    if (!dia) return;
    setSavingDia((m) => ({ ...m, [dia]: true }));

    const ya = !!contemplados[dia]?.contemplado;

    try {
      if (ya) {
        const { error } = await supabase
          .from("corte_contemplado")
          .delete()
          .eq("dia", dia);

        if (error) throw error;

        setContemplados((m) => {
          const copy = { ...m };
          delete copy[dia];
          return copy;
        });
      } else {
        const { data, error } = await supabase
          .from("corte_contemplado")
          .insert([{ dia, contemplado: true }])
          .select("dia, contemplado_at")
          .single();

        if (error) throw error;

        setContemplados((m) => ({
          ...m,
          [dia]: {
            contemplado: true,
            contemplado_at: data?.contemplado_at || null,
          },
        }));
      }
    } catch (e) {
      window.alert(e?.message || "No se pudo actualizar CONTEMPLADO");
    } finally {
      setSavingDia((m) => ({ ...m, [dia]: false }));
    }
  };

  // ===== filtros rápidos (selección temporal) =====
  const selectRango = (fromDia, toDia) => {
    if (!fromDia || !toDia) return;
    const from = new Date(`${fromDia}T00:00:00`);
    const to = new Date(`${toDia}T00:00:00`);

    const a = new Date(from);
    const map = {};
    while (a <= to) {
      map[ymdLocal(a)] = true;
      a.setDate(a.getDate() + 1);
    }
    setSelected(map);
  };

  const quickHoy = () => {
    const hoy = ymdLocal(new Date());
    setSelected({ [hoy]: true });
  };
  const quickAyer = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const ayer = ymdLocal(d);
    setSelected({ [ayer]: true });
  };
  const quick7 = () => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 6);
    selectRango(ymdLocal(from), ymdLocal(to));
  };
  const quickMes = () => {
    const now = new Date();
    const from = startOfMonth(now);
    selectRango(ymdLocal(from), ymdLocal(now));
  };
  const quickQna = () => {
    const now = new Date();
    const from = startOfQuincena(now);
    selectRango(ymdLocal(from), ymdLocal(now));
  };

  const filteredRows = useMemo(() => {
    const q = String(search || "").trim();
    return rows.filter((r) => {
      const dia = r.dia || "";
      const isCont = !!contemplados[dia]?.contemplado;

      if (onlyNoCont && isCont) return false;
      if (q && !String(dia).includes(q)) return false;
      return true;
    });
  }, [rows, onlyNoCont, search, contemplados]);

  const hasSel = resumen.count > 0;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <img src={logoCuadro} alt="Foto Ramírez" style={S.logo} />
        <div style={S.hTitle}>CUENTAS</div>
        <div style={S.hSub}>Resumen diario de entradas y salidas</div>

        <div style={S.quickRow}>
          <button style={S.qBtn} onClick={quickHoy}>
            Hoy
          </button>
          <button style={S.qBtn} onClick={quickAyer}>
            Ayer
          </button>
          <button style={S.qBtn} onClick={quick7}>
            Últ. 7
          </button>
          <button style={S.qBtn} onClick={quickMes}>
            Este mes
          </button>
          <button style={S.qBtn} onClick={quickQna}>
            Qna
          </button>
        </div>

        <div style={S.headerTools}>
          <button style={S.btnCream} onClick={fetchRows} disabled={loading}>
            {loading ? "Cargando..." : "Recargar"}
          </button>

          <button
            style={{
              ...S.btnGhost,
              opacity: hasSel ? 1 : 0.55,
              cursor: hasSel ? "pointer" : "not-allowed",
            }}
            onClick={hasSel ? clearSel : undefined}
            title={
              hasSel ? "Limpiar selección" : "Selecciona días para limpiar"
            }
          >
            Limpiar
          </button>

          <button style={S.btnGhost} onClick={() => setOrderDesc((v) => !v)}>
            Orden: {orderDesc ? "DESC" : "ASC"}
          </button>
        </div>

        <div style={S.filtersRow}>
          <label style={S.switchWrap}>
            <input
              type="checkbox"
              checked={onlyNoCont}
              onChange={(e) => setOnlyNoCont(e.target.checked)}
              style={S.switch}
            />
            <span style={S.switchText}>Solo NO contemplados</span>
          </label>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar fecha (ej: 2026-01 o 2026-01-26)"
            style={S.search}
            inputMode="text"
          />
        </div>

        {err ? <div style={S.err}>{err}</div> : null}
      </div>

      <div style={S.stickyWrap}>
        <div style={S.summaryCard}>
          <div style={S.summaryTop}>
            <div>
              <div style={S.mut}>Días seleccionados</div>
              <div style={S.big}>{resumen.count}</div>
            </div>
            <div style={S.chips}>
              <div style={S.chip}>
                <span style={S.chipDot} />
                {hasSel ? "SUMA ACTIVA" : "TOCA DÍAS PARA SUMAR"}
              </div>
            </div>
          </div>

          <div style={S.kpiGrid}>
            <div style={S.kpi}>
              <div style={S.kpiLabel}>ENTRÓ</div>
              <div style={S.kpiVal}>{money(resumen.ingresos)}</div>
            </div>
            <div style={S.kpi}>
              <div style={S.kpiLabel}>SALIÓ</div>
              <div style={S.kpiVal}>{money(resumen.retiros)}</div>
            </div>
            <div style={S.kpi}>
              <div style={S.kpiLabel}>NETO</div>
              <div style={S.kpiValStrong}>{money(resumen.neto)}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={S.list}>
        {filteredRows.map((r) => {
          const dia = r.dia;
          const isSel = !!selected[dia];
          const cont = contemplados[dia];
          const isCont = !!cont?.contemplado;
          const isSaving = !!savingDia[dia];

          const ingresos = Number(r.ingresos || 0);
          const retiros = Number(r.retiros || 0);
          const neto = Number(r.neto || 0);
          const netoPos = neto >= 0;

          return (
            <div
              key={dia}
              style={{
                ...S.item,
                ...(isSel ? S.itemSel : null),
                ...(isCont ? S.itemCont : null),
              }}
              onClick={() => toggleDia(dia)}
              role="button"
              tabIndex={0}
            >
              <div style={S.itemTop}>
                <div style={S.left}>
                  <div style={S.checkWrap}>
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggleDia(dia)}
                      onClick={(e) => e.stopPropagation()}
                      style={S.chk}
                      aria-label={`Seleccionar ${dia}`}
                    />
                  </div>

                  <div>
                    <div style={S.dateLine}>
                      <div style={S.dateMain}>{fmtDia(dia)}</div>
                      <div style={S.dateRaw}>{dia}</div>
                    </div>
                    <div style={S.tapHint}>
                      {isSel
                        ? "Seleccionado para sumar"
                        : "Toca para seleccionar"}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {isCont ? (
                    <div style={S.badgeCont}>
                      CONTEMPLADO ✓
                      {cont?.contemplado_at ? (
                        <span style={S.badgeContAt}>
                          {" "}
                          {fmtDT(cont.contemplado_at)}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <div
                    style={{
                      ...S.badge,
                      ...(netoPos ? S.badgeOk : S.badgeBad),
                    }}
                  >
                    {netoPos ? "NETO +" : "NETO -"}
                  </div>
                </div>
              </div>

              <div style={S.amountGrid}>
                <div style={S.amountRow}>
                  <span style={S.tag}>Entró</span>
                  <span style={S.val}>{money(ingresos)}</span>
                </div>
                <div style={S.amountRow}>
                  <span
                    style={{ ...S.tag, ...(retiros > 0 ? S.tagWarn : null) }}
                  >
                    Salió
                  </span>
                  <span style={S.val}>{money(retiros)}</span>
                </div>
                <div style={S.amountRow}>
                  <span style={S.tag}>Neto</span>
                  <span
                    style={{ ...S.valStrong, ...(netoPos ? null : S.valNeg) }}
                  >
                    {money(neto)}
                  </span>
                </div>
              </div>

              <div style={{ ...S.actionsRow, display: "flex", gap: 10 }}>
                <button
                  type="button"
                  style={{
                    ...(isCont ? S.btnGrey : S.btnCreamSmall),
                    opacity: isSaving ? 0.7 : 1,
                    cursor: isSaving ? "wait" : "pointer",
                    flex: 1,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isSaving) toggleContemplado(dia);
                  }}
                >
                  {isSaving
                    ? "Guardando..."
                    : isCont
                    ? "Quitar contemplado"
                    : "Contemplar"}
                </button>

                <button
                  type="button"
                  style={{ ...S.btnGhost, flex: 1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetalle && onOpenDetalle(dia);
                  }}
                >
                  Detalle
                </button>
              </div>
            </div>
          );
        })}

        {!loading && !filteredRows.length ? (
          <div style={S.empty}>
            <div style={S.emptyTitle}>Sin resultados</div>
            <div style={S.emptySub}>
              Ajusta filtros o revisa registros en <b>corte_diario</b>.
            </div>
            <button style={S.btnCream} onClick={fetchRows}>
              Reintentar
            </button>
          </div>
        ) : null}
      </div>

      <div style={{ height: 28 }} />
    </div>
  );
}

/* ====== Estilo FOTO RAMÍREZ ====== */
const S = {
  page: {
    minHeight: "100vh",
    background: `
      radial-gradient(circle at 18% 12%, rgba(0,180,170,0.10), transparent 42%),
      radial-gradient(circle at 78% 22%, rgba(255,255,255,0.04), transparent 48%),
      linear-gradient(180deg, #0b0b0b 0%, #141414 100%)
    `,
    color: "#f5f1e8",
    padding: 12,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
  },

  header: {
    borderRadius: 18,
    padding: 12,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(212,175,55,0.24)",
    boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
  },
  logo: { width: 120, display: "block", marginBottom: 8 },
  hTitle: { fontSize: 24, fontWeight: 950, letterSpacing: 0.7 },
  hSub: { marginTop: 2, opacity: 0.78, fontSize: 13 },

  quickRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 },
  qBtn: {
    borderRadius: 999,
    padding: "8px 10px",
    background: "rgba(245,241,232,0.06)",
    border: "1px solid rgba(245,241,232,0.12)",
    color: "#f5f1e8",
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: 0.2,
    cursor: "pointer",
  },

  headerTools: { display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" },
  filtersRow: { display: "grid", gap: 10, marginTop: 10 },

  switchWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(245,241,232,0.06)",
    border: "1px solid rgba(245,241,232,0.12)",
  },
  switch: { width: 20, height: 20, cursor: "pointer" },
  switchText: { fontWeight: 900, fontSize: 13, opacity: 0.95 },

  search: {
    width: "100%",
    borderRadius: 14,
    padding: "12px 12px",
    border: "1px solid rgba(245,241,232,0.20)",
    background: "rgba(0,0,0,0.30)",
    color: "#f5f1e8",
    outline: "none",
    fontSize: 14,
    fontWeight: 800,
  },

  btnCream: {
    background: "linear-gradient(180deg, #fff7e6 0%, #f3ead6 100%)",
    color: "#1b1b1b",
    border: "1px solid rgba(212,175,55,0.55)",
    borderRadius: 14,
    padding: "10px 14px",
    fontWeight: 900,
    letterSpacing: 0.2,
    cursor: "pointer",
    boxShadow: "0 8px 16px rgba(0,0,0,0.35)",
  },
  btnCreamSmall: {
    background: "linear-gradient(180deg, #fff7e6 0%, #f3ead6 100%)",
    color: "#1b1b1b",
    border: "1px solid rgba(212,175,55,0.55)",
    borderRadius: 14,
    padding: "10px 12px",
    fontWeight: 950,
    letterSpacing: 0.2,
    cursor: "pointer",
    boxShadow: "0 8px 16px rgba(0,0,0,0.25)",
  },
  btnGrey: {
    background: "rgba(245,241,232,0.08)",
    color: "#f5f1e8",
    border: "1px solid rgba(245,241,232,0.18)",
    borderRadius: 14,
    padding: "10px 12px",
    fontWeight: 950,
    letterSpacing: 0.2,
    cursor: "pointer",
  },
  btnGhost: {
    background: "transparent",
    color: "#f5f1e8",
    border: "1px solid rgba(245,241,232,0.22)",
    borderRadius: 14,
    padding: "10px 14px",
    fontWeight: 900,
    letterSpacing: 0.2,
    cursor: "pointer",
  },

  err: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(255,70,70,0.12)",
    border: "1px solid rgba(255,70,70,0.22)",
    color: "#ffd2d2",
    fontSize: 13,
  },

  stickyWrap: { position: "sticky", top: 8, zIndex: 50, marginTop: 10 },

  summaryCard: {
    borderRadius: 18,
    padding: 12,
    background: "rgba(18,18,18,0.92)",
    border: "1px solid rgba(212,175,55,0.22)",
    boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
    backdropFilter: "blur(8px)",
  },
  summaryTop: { display: "flex", justifyContent: "space-between", gap: 12 },
  mut: { opacity: 0.78, fontSize: 12 },
  big: { fontSize: 26, fontWeight: 950, marginTop: 2 },

  chips: { display: "flex", alignItems: "center" },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 999,
    background: "rgba(245,241,232,0.06)",
    border: "1px solid rgba(245,241,232,0.12)",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.3,
    opacity: 0.9,
  },
  chipDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "rgba(212,175,55,0.9)",
    boxShadow: "0 0 0 3px rgba(212,175,55,0.18)",
  },

  kpiGrid: {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 8,
  },
  kpi: {
    borderRadius: 14,
    padding: 10,
    background: "rgba(245,241,232,0.06)",
    border: "1px solid rgba(245,241,232,0.12)",
  },
  kpiLabel: { opacity: 0.8, fontSize: 12, fontWeight: 800 },
  kpiVal: { marginTop: 4, fontSize: 14, fontWeight: 950 },
  kpiValStrong: { marginTop: 4, fontSize: 15, fontWeight: 950 },

  list: { marginTop: 12, display: "grid", gap: 10 },

  item: {
    borderRadius: 18,
    padding: 12,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(245,241,232,0.12)",
    boxShadow: "0 10px 22px rgba(0,0,0,0.35)",
    cursor: "pointer",
  },
  itemSel: {
    border: "1px solid rgba(212,175,55,0.55)",
    background: "rgba(255,247,230,0.06)",
  },
  itemCont: {
    border: "1px solid rgba(0,180,170,0.22)",
    background: "rgba(0,180,170,0.06)",
  },

  itemTop: { display: "flex", justifyContent: "space-between", gap: 10 },
  left: { display: "flex", gap: 10, alignItems: "flex-start" },

  checkWrap: { paddingTop: 2 },
  chk: { width: 20, height: 20, cursor: "pointer" },

  dateLine: {
    display: "flex",
    gap: 10,
    alignItems: "baseline",
    flexWrap: "wrap",
  },
  dateMain: { fontSize: 16, fontWeight: 950, letterSpacing: 0.2 },
  dateRaw: { opacity: 0.6, fontSize: 12 },

  tapHint: { marginTop: 2, opacity: 0.7, fontSize: 12 },

  badge: {
    height: 28,
    padding: "0 10px",
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    fontWeight: 950,
    fontSize: 12,
    letterSpacing: 0.3,
    border: "1px solid rgba(245,241,232,0.12)",
    background: "rgba(245,241,232,0.06)",
    whiteSpace: "nowrap",
  },
  badgeOk: { border: "1px solid rgba(0,180,170,0.35)" },
  badgeBad: { border: "1px solid rgba(255,90,90,0.35)" },

  badgeCont: {
    height: 28,
    padding: "0 10px",
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontWeight: 950,
    fontSize: 12,
    letterSpacing: 0.3,
    border: "1px solid rgba(0,180,170,0.35)",
    background: "rgba(0,180,170,0.10)",
    whiteSpace: "nowrap",
  },
  badgeContAt: { opacity: 0.85, fontSize: 11, fontWeight: 900 },

  amountGrid: { marginTop: 10, display: "grid", gap: 6 },
  amountRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },

  tag: {
    opacity: 0.78,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid rgba(212,175,55,0.22)",
    padding: "3px 9px",
    borderRadius: 999,
  },
  tagWarn: { border: "1px solid rgba(255,90,90,0.28)" },

  val: { fontWeight: 950, fontSize: 13 },
  valStrong: { fontWeight: 950, fontSize: 14 },
  valNeg: { color: "#ffb3b3" },

  actionsRow: { marginTop: 10 },

  empty: {
    marginTop: 16,
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(245,241,232,0.12)",
    textAlign: "center",
  },
  emptyTitle: { fontSize: 18, fontWeight: 950 },
  emptySub: { opacity: 0.8, marginTop: 6, fontSize: 13, lineHeight: 1.35 },
};
