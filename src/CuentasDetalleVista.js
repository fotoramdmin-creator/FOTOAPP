// src/CuentasDetalleVista.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import logoCuadro from "./assets/FOTO RAMIREZ NUEVO CUADRO.png";

import {
  buildCortePdfBlob,
  shareCortePdf,
  downloadBlobUrl,
} from "./ticketCortePdf";

const money = (n) => {
  const x = Number(n || 0);
  if (!isFinite(x)) return "$0.00";
  return x.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
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

export default function CuentasDetalleVista({ dia, onBack }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // ✅ Caja para cambio (se queda en caja)
  const [caja, setCaja] = useState("0");

  // ==========================
  // ✅ MODAL TICKET estilo Orden en Curso
  // ==========================
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketBlobUrl, setTicketBlobUrl] = useState("");
  const [ticketGenStatus, setTicketGenStatus] = useState("");
  const [printing, setPrinting] = useState(false);
  const ticketWinRef = useRef(null);

  function closeTicketModal() {
    setTicketModalOpen(false);
    setTicketGenStatus("");
    if (ticketBlobUrl) {
      try {
        URL.revokeObjectURL(ticketBlobUrl);
      } catch {}
    }
    setTicketBlobUrl("");
  }

  async function ensureCortePdfUrl() {
    if (!dia) return "";
    if (ticketBlobUrl) return ticketBlobUrl;

    setTicketGenStatus("Generando PDF…");

    const blob = await buildCortePdfBlob({
      dia,
      entradas: resumen.entradas,
      salidas: resumen.salidas,
      neto: resumen.neto,
      caja: cajaNum,
      aRetirar,
    });

    const url = URL.createObjectURL(blob);
    setTicketBlobUrl(url);
    setTicketGenStatus("✅ PDF listo.");
    return url;
  }

  async function openTicketInNewTabSafe() {
    try {
      const w = window.open("about:blank", "_blank", "noopener,noreferrer");
      if (!w) {
        alert(
          "Tu navegador bloqueó la ventana. Activa pop-ups para esta página y vuelve a intentar."
        );
        return;
      }
      ticketWinRef.current = w;

      const url = await ensureCortePdfUrl();
      if (!url) return;

      try {
        w.location.href = url;
      } catch {
        w.document.write(
          `<html><head><title>Corte</title></head><body style="margin:0">
             <a href="${url}" target="_self">Abrir corte</a>
           </body></html>`
        );
        w.document.close();
      }
    } catch (e) {
      console.error(e);
      alert("No pude abrir el corte.");
    }
  }

  async function downloadTicketPdf() {
    try {
      const url = await ensureCortePdfUrl();
      if (!url) return;
      downloadBlobUrl(url, `corte_${dia || "dia"}.pdf`);
    } catch (e) {
      console.error(e);
      alert("No pude descargar el corte.");
    }
  }

  async function shareTicketMobile() {
    // ✅ esto es lo que te abre el share sheet para RAWBT en celular
    try {
      setPrinting(true);
      setTicketGenStatus("Preparando para compartir…");

      await shareCortePdf({
        dia,
        entradas: resumen.entradas,
        salidas: resumen.salidas,
        neto: resumen.neto,
        caja: cajaNum,
        aRetirar,
        filename: `corte_${dia || "dia"}.pdf`,
      });

      setTicketGenStatus("✅ Listo para RAWBT / compartir.");
    } catch (e) {
      console.error(e);
      alert(e?.message || "No se pudo compartir el corte.");
      setTicketGenStatus("❌ No se pudo compartir.");
    } finally {
      setPrinting(false);
    }
  }

  // ==========================
  // DATOS
  // ==========================
  const fetchDetalle = async () => {
    if (!dia) return;
    setLoading(true);
    setErr("");
    try {
      const start = `${dia}T00:00:00`;
      const endD = new Date(`${dia}T00:00:00`);
      endD.setDate(endD.getDate() + 1);
      const end = endD.toISOString();

      const { data, error } = await supabase
        .from("cuentas_movs")
        .select(
          "fecha,dia_mx,direccion,monto,tipo_mov,nota,cliente_nombre,n_toma,usuario_nombre"
        )
        .gte("fecha", start)
        .lt("fecha", end)
        .order("fecha", { ascending: true });

      if (error) throw error;
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.message || "Error cargando detalle");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetalle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia]);

  const resumen = useMemo(() => {
    const entradas = rows
      .filter((r) => r.direccion === "ENTRADA")
      .reduce((a, r) => a + Number(r.monto || 0), 0);

    const salidas = rows
      .filter((r) => r.direccion === "SALIDA")
      .reduce((a, r) => a + Math.abs(Number(r.monto || 0)), 0);

    const neto = entradas - salidas;
    return { entradas, salidas, neto };
  }, [rows]);

  const cajaNum = useMemo(() => {
    const x = Number(caja || 0);
    return isFinite(x) ? x : 0;
  }, [caja]);

  const aRetirar = useMemo(() => {
    const x = Number(resumen.neto || 0) - cajaNum;
    return isFinite(x) ? x : 0;
  }, [resumen.neto, cajaNum]);

  // ✅ ABRIR MODAL (como Orden en curso)
  const onPrint = async () => {
    setTicketModalOpen(true);
    setTicketGenStatus("Generando PDF…");
    try {
      await ensureCortePdfUrl();
    } catch (e) {
      console.error(e);
      setTicketGenStatus("❌ No se pudo generar el PDF.");
    }
  };

  return (
    <div style={S.page}>
      {/* ✅ MODAL TICKET (SIN VISTA PREVIA) */}
      {ticketModalOpen && (
        <div style={S.modalOverlay} onClick={closeTicketModal}>
          <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalTop}>
              <div style={S.modalTitle}>
                Corte · {dia || "—"}{" "}
                {ticketGenStatus ? `· ${ticketGenStatus}` : ""}
              </div>

              <div style={S.modalBtns}>
                <button
                  type="button"
                  style={S.btnCream}
                  onClick={shareTicketMobile}
                  disabled={printing}
                  title="En celular abre el share para RAWBT"
                >
                  📲 Compartir / RAWBT
                </button>

                <button
                  type="button"
                  style={S.btnGhost}
                  onClick={openTicketInNewTabSafe}
                  disabled={!dia}
                  title="Abre el PDF en otra pestaña para imprimir"
                >
                  🖨️ Abrir / Imprimir
                </button>

                <button
                  type="button"
                  style={S.btnGhost}
                  onClick={downloadTicketPdf}
                  disabled={!dia}
                >
                  ⬇️ Descargar
                </button>

                <button
                  type="button"
                  style={S.btnDanger}
                  onClick={closeTicketModal}
                >
                  ✖ Cerrar
                </button>
              </div>
            </div>

            <div style={S.modalBody}>
              <div style={S.modalHint}>
                En celular usa <b>Compartir / RAWBT</b>. En compu puedes{" "}
                <b>Abrir/Imprimir</b> o <b>Descargar</b>.
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={S.header}>
        <img src={logoCuadro} alt="Foto Ramírez" style={S.logo} />
        <div style={S.hTitle}>CUENTAS · DETALLE</div>
        <div style={S.hSub}>
          Día: <b>{fmtDia(dia)}</b>{" "}
          <span style={{ opacity: 0.7 }}>({dia})</span>
        </div>

        <div style={S.headerTools}>
          <button style={S.btnGhost} onClick={onBack} type="button">
            ⬅️ Regresar
          </button>

          <button
            style={S.btnCream}
            onClick={fetchDetalle}
            disabled={loading}
            type="button"
          >
            {loading ? "Cargando..." : "Recargar"}
          </button>

          <button
            style={S.btnCream}
            onClick={onPrint}
            disabled={printing}
            type="button"
          >
            {printing ? "Preparando..." : "Imprimir ticket"}
          </button>
        </div>

        {err ? <div style={S.err}>{err}</div> : null}
      </div>

      <div style={S.summaryCard}>
        <div style={S.kpiGrid}>
          <div style={S.kpi}>
            <div style={S.kpiLabel}>ENTRADAS</div>
            <div style={S.kpiVal}>{money(resumen.entradas)}</div>
          </div>

          <div style={S.kpi}>
            <div style={S.kpiLabel}>SALIDAS</div>
            <div style={S.kpiVal}>{money(resumen.salidas)}</div>
          </div>

          <div style={S.kpi}>
            <div style={S.kpiLabel}>NETO</div>
            <div style={S.kpiValStrong}>{money(resumen.neto)}</div>
          </div>

          <div style={S.kpi}>
            <div style={S.kpiLabel}>CAJA</div>
            <input
              style={S.kpiInput}
              value={caja}
              onChange={(e) => setCaja(e.target.value)}
              inputMode="numeric"
              placeholder="Ej: 400"
            />
            <div style={S.kpiHint}>Se queda para cambio</div>
          </div>

          <div style={{ ...S.kpi, gridColumn: "1 / -1" }}>
            <div style={S.kpiLabel}>A RETIRAR (NETO - CAJA)</div>
            <div style={S.kpiValStrong}>{money(aRetirar)}</div>
          </div>
        </div>
      </div>

      <div style={S.list}>
        {rows.map((r, idx) => {
          const dir = r.direccion || "—";
          const isEntrada = dir === "ENTRADA";

          const cliente = r.cliente_nombre || "—";
          const toma = r.n_toma || "—";
          const usuario = r.usuario_nombre || "—";

          return (
            <div
              key={`${r.fecha || "x"}-${idx}`}
              style={{
                ...S.item,
                ...(isEntrada ? S.itemIn : S.itemOut),
              }}
            >
              <div style={S.itemTop}>
                <div>
                  <div style={S.itemTitle}>
                    {isEntrada ? "ENTRADA" : "SALIDA"} ·{" "}
                    <span style={{ opacity: 0.9 }}>{money(r.monto)}</span>
                  </div>
                  <div style={S.itemSub}>
                    {r.tipo_mov ? <b>{r.tipo_mov}</b> : "—"} ·{" "}
                    {r.fecha ? fmtDT(r.fecha) : "—"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={S.pill}>{cliente}</div>
                  <div style={S.pillGold}>TOMA: {toma}</div>
                </div>
              </div>

              <div style={S.metaGrid}>
                <div style={S.metaRow}>
                  <span style={S.tag}>Usuario</span>
                  <span style={S.val}>{usuario}</span>
                </div>

                <div style={S.metaRow}>
                  <span style={S.tag}>Nota</span>
                  <span style={S.val}>{r.nota || "—"}</span>
                </div>
              </div>
            </div>
          );
        })}

        {!loading && !rows.length ? (
          <div style={S.empty}>
            <div style={S.emptyTitle}>Sin movimientos</div>
            <div style={S.emptySub}>
              No hay registros para este día en <b>cuentas_movs</b>.
            </div>
            <button style={S.btnCream} onClick={fetchDetalle} type="button">
              Reintentar
            </button>
          </div>
        ) : null}
      </div>

      <div style={{ height: 28 }} />
    </div>
  );
}

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
  hTitle: { fontSize: 22, fontWeight: 950, letterSpacing: 0.7 },
  hSub: { marginTop: 2, opacity: 0.78, fontSize: 13 },

  headerTools: { display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" },

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
  btnDanger: {
    background: "rgba(255,70,70,0.12)",
    color: "#ffd2d2",
    border: "1px solid rgba(255,70,70,0.30)",
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

  summaryCard: {
    marginTop: 10,
    borderRadius: 18,
    padding: 12,
    background: "rgba(18,18,18,0.92)",
    border: "1px solid rgba(212,175,55,0.22)",
    boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
    backdropFilter: "blur(8px)",
  },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
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

  kpiInput: {
    marginTop: 6,
    width: "100%",
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(245,241,232,0.16)",
    background: "rgba(0,0,0,0.25)",
    color: "#f5f1e8",
    fontWeight: 950,
    outline: "none",
  },
  kpiHint: { marginTop: 6, opacity: 0.75, fontSize: 11, fontWeight: 800 },

  list: { marginTop: 12, display: "grid", gap: 10 },

  item: {
    borderRadius: 18,
    padding: 12,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(245,241,232,0.12)",
    boxShadow: "0 10px 22px rgba(0,0,0,0.35)",
  },
  itemIn: { border: "1px solid rgba(0,180,170,0.22)" },
  itemOut: { border: "1px solid rgba(255,90,90,0.22)" },

  itemTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  itemTitle: { fontSize: 15, fontWeight: 950, letterSpacing: 0.2 },
  itemSub: { marginTop: 3, fontSize: 12, opacity: 0.8, fontWeight: 800 },

  pill: {
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(245,241,232,0.06)",
    border: "1px solid rgba(245,241,232,0.12)",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  pillGold: {
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(212,175,55,0.10)",
    border: "1px solid rgba(212,175,55,0.25)",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  metaGrid: { marginTop: 10, display: "grid", gap: 6 },
  metaRow: {
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
  val: { fontWeight: 900, fontSize: 12, opacity: 0.95 },

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

  // ===== Modal (tipo Orden en Curso) =====
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    zIndex: 9999,
  },
  modalCard: {
    width: "min(820px, 100%)",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(12,15,20,0.96)",
    overflow: "hidden",
    boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
  },
  modalTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: 12,
    borderBottom: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    flexWrap: "wrap",
  },
  modalTitle: {
    fontWeight: 950,
    letterSpacing: ".3px",
    fontSize: 14,
    overflowWrap: "anywhere",
    color: "#f5f1e8",
  },
  modalBtns: { display: "flex", gap: 10, flexWrap: "wrap" },
  modalBody: { padding: "14px 12px" },
  modalHint: {
    opacity: 0.82,
    fontSize: 13,
    lineHeight: 1.35,
    color: "#f5f1e8",
  },
};
