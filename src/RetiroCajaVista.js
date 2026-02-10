// src/RetiroCajaVista.js
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import logoCuadro from "./assets/FOTO RAMIREZ NUEVO CUADRO.png";

const money = (n) => {
  const x = Number(n || 0);
  if (!isFinite(x)) return "$0.00";
  return x.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
};

// ✅ MISMA REGLA QUE EN MenuX: session.admin === true
const isAdminSession = (s) => !!s && s.admin === true;

// Convierte Date -> "YYYY-MM-DDTHH:mm" (para input datetime-local)
const toLocalInputValue = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
};

// Convierte "YYYY-MM-DDTHH:mm" (local) -> ISO string (UTC)
const localInputToISO = (v) => {
  const d = new Date(v);
  if (!isFinite(d.getTime())) return null;
  return d.toISOString();
};

const fmtLocalFecha = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (!isFinite(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  } catch {
    return "";
  }
};

export default function RetiroCajaVista({ session, onBack }) {
  const isAdmin = useMemo(() => isAdminSession(session), [session]);

  // Form
  const [nombreSolicita, setNombreSolicita] = useState(
    () => session?.nombre || ""
  );
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState("");
  const [notas, setNotas] = useState("");
  const [fechaLocal, setFechaLocal] = useState(() =>
    toLocalInputValue(new Date())
  );

  // Lista
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const fetchRows = async () => {
    setLoading(true);
    setStatus("");
    try {
      const { data, error } = await supabase
        .from("retiros_caja")
        .select("id,fecha,dia_mx,monto,concepto,notas,estatus,usuario_id")
        .order("fecha", { ascending: false })
        .limit(200);

      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      setStatus(e?.message || "Error cargando retiros");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSubmit = () => {
    const m = Number(monto);
    if (!nombreSolicita.trim()) return false;
    if (!isFinite(m) || m <= 0) return false;
    if (!concepto.trim()) return false;
    const iso = localInputToISO(fechaLocal);
    if (!iso) return false;
    return true;
  };

  const crearRetiro = async () => {
    if (!canSubmit()) {
      setStatus("Revisa: nombre, monto, motivo y fecha.");
      return;
    }
    setSaving(true);
    setStatus("");
    try {
      const m = Number(monto);
      const isoFecha = localInputToISO(fechaLocal);

      const payload = {
        monto: m,
        concepto: concepto.trim(),
        notas: `Solicita: ${nombreSolicita.trim()}${
          notas.trim() ? " | " + notas.trim() : ""
        }`,
        estatus: "PENDIENTE",
        usuario_id: session?.id || null,
        fecha: isoFecha,
      };

      const { error } = await supabase.from("retiros_caja").insert([payload]);
      if (error) throw error;

      setMonto("");
      setConcepto("");
      setNotas("");
      setFechaLocal(toLocalInputValue(new Date()));
      setStatus("✅ Retiro registrado (PENDIENTE).");
      fetchRows();
    } catch (e) {
      setStatus(e?.message || "Error registrando retiro");
    } finally {
      setSaving(false);
    }
  };

  const aprobarRetiro = async (id) => {
    if (!isAdmin) return;
    setSaving(true);
    setStatus("");
    try {
      const patch = {
        estatus: "APROBADO",
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("retiros_caja")
        .update(patch)
        .eq("id", id);
      if (error) throw error;

      setStatus("✅ Retiro APROBADO.");
      fetchRows();
    } catch (e) {
      setStatus(e?.message || "Error aprobando retiro");
    } finally {
      setSaving(false);
    }
  };

  const rechazarRetiro = async (id) => {
    if (!isAdmin) return;
    setSaving(true);
    setStatus("");
    try {
      const patch = {
        estatus: "RECHAZADO",
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("retiros_caja")
        .update(patch)
        .eq("id", id);
      if (error) throw error;

      setStatus("✅ Retiro RECHAZADO.");
      fetchRows();
    } catch (e) {
      setStatus(e?.message || "Error rechazando retiro");
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div style={styles.page}>
        <div style={styles.hero}>
          <div style={styles.brandRow}>
            <div style={styles.logoWrap}>
              <img src={logoCuadro} alt="Foto Ramírez" style={styles.logo} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={styles.title}>RETIRO DE CAJA</div>
              <div style={styles.sub}>
                Sección <b>privada</b>. Solo administradores.
              </div>
            </div>
          </div>

          <div style={styles.alert}>
            No tienes permiso para ver esta sección.
          </div>

          <button onClick={onBack} type="button" style={styles.btnPrimary}>
            ⬅️ Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* ===== HERO FR ===== */}
      <div style={styles.hero}>
        <div style={styles.brandRow}>
          <div style={styles.logoWrap}>
            <img src={logoCuadro} alt="Foto Ramírez" style={styles.logo} />
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={styles.title}>RETIRO DE CAJA</div>
            <div style={styles.sub}>Registra retiros y aprueba pendientes.</div>
          </div>

          <div style={styles.badgePrivado}>PRIVADO</div>
        </div>

        {status ? <div style={styles.statusBox}>{status}</div> : null}

        {/* ===== FORM ===== */}
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Nueva solicitud</div>

          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={styles.label}>Fecha y hora del retiro</div>
              <input
                value={fechaLocal}
                onChange={(e) => setFechaLocal(e.target.value)}
                type="datetime-local"
                style={styles.input}
              />
            </div>

            <div>
              <div style={styles.label}>Nombre (quién pide)</div>
              <input
                value={nombreSolicita}
                onChange={(e) => setNombreSolicita(e.target.value)}
                placeholder="Ej: LALO"
                style={styles.input}
              />
            </div>

            <div>
              <div style={styles.label}>Cantidad</div>
              <input
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                inputMode="decimal"
                placeholder="Ej: 150"
                style={{ ...styles.input, fontWeight: 950 }}
              />
            </div>

            <div>
              <div style={styles.label}>Motivo (concepto)</div>
              <input
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Ej: PAPEL / INSUMOS / PAGO"
                style={styles.input}
              />
            </div>

            <div>
              <div style={styles.label}>Comentario (opcional)</div>
              <input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ej: compra rápida en papelería"
                style={styles.input}
              />
            </div>

            <button
              onClick={crearRetiro}
              disabled={saving}
              type="button"
              style={{
                ...styles.btnPrimary,
                opacity: saving ? 0.7 : 1,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Guardando..." : "➕ Registrar (PENDIENTE)"}
            </button>
          </div>
        </div>

        {/* ===== LIST HEADER ===== */}
        <div style={styles.listHeader}>
          <div style={styles.listTitle}>Retiros recientes</div>
          <button onClick={fetchRows} type="button" style={styles.btnGhost}>
            ↻ Recargar
          </button>
        </div>

        {/* ===== LIST ===== */}
        {loading ? (
          <div style={styles.muted}>Cargando...</div>
        ) : rows.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((r) => {
              const est = String(r.estatus || "").toUpperCase() || "PENDIENTE";

              const pill = {
                bg:
                  est === "APROBADO"
                    ? "rgba(0,180,170,0.18)"
                    : est === "RECHAZADO"
                    ? "rgba(240,80,80,0.16)"
                    : "rgba(255,255,255,0.10)",
                border:
                  est === "APROBADO"
                    ? "1px solid rgba(0,180,170,0.32)"
                    : est === "RECHAZADO"
                    ? "1px solid rgba(240,80,80,0.28)"
                    : "1px solid rgba(255,255,255,0.12)",
              };

              return (
                <div key={r.id} style={styles.card}>
                  <div style={styles.cardTop}>
                    <div style={styles.amount}>{money(r.monto)}</div>

                    <div
                      style={{
                        ...styles.pill,
                        background: pill.bg,
                        border: pill.border,
                      }}
                    >
                      {est}
                    </div>
                  </div>

                  <div style={styles.concepto}>{r.concepto || "RETIRO"}</div>

                  {r.notas ? <div style={styles.notas}>{r.notas}</div> : null}

                  <div style={styles.meta}>
                    {r.fecha ? `FECHA: ${fmtLocalFecha(r.fecha)}` : ""}
                    {r.dia_mx ? `  •  DÍA: ${r.dia_mx}` : ""}
                  </div>

                  {est === "PENDIENTE" ? (
                    <div style={styles.actionsRow}>
                      <button
                        onClick={() => aprobarRetiro(r.id)}
                        disabled={saving}
                        type="button"
                        style={{
                          ...styles.btnPrimary,
                          padding: "12px 12px",
                          flex: 1,
                          opacity: saving ? 0.7 : 1,
                        }}
                      >
                        ✅ Aprobar
                      </button>
                      <button
                        onClick={() => rechazarRetiro(r.id)}
                        disabled={saving}
                        type="button"
                        style={{
                          ...styles.btnGhost,
                          padding: "12px 12px",
                          flex: 1,
                          opacity: saving ? 0.7 : 1,
                        }}
                      >
                        ✖ Rechazar
                      </button>
                    </div>
                  ) : null}

                  <div style={styles.goldLine} />
                </div>
              );
            })}
          </div>
        ) : (
          <div style={styles.muted}>No hay retiros.</div>
        )}

        <div style={{ height: 14 }} />

        <button onClick={onBack} type="button" style={styles.btnGhostWide}>
          ⬅️ Volver
        </button>
      </div>

      <div style={{ height: 24 }} />
    </div>
  );
}

const styles = {
  page: {
    padding: 16,
    maxWidth: 560,
    margin: "0 auto",
  },

  // ===== HERO FR =====
  hero: {
    borderRadius: 22,
    padding: 14,
    border: "1px solid rgba(212,175,55,0.20)",
    background:
      "radial-gradient(circle at 18% 10%, rgba(0,180,170,0.11), transparent 45%), radial-gradient(circle at 82% 18%, rgba(255,255,255,0.06), transparent 55%), linear-gradient(180deg, rgba(15,15,15,0.96) 0%, rgba(26,26,26,0.92) 100%)",
    boxShadow: "0 12px 26px rgba(0,0,0,0.45)",
    color: "#fff7e6",
  },
  brandRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
    position: "relative",
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
    lineHeight: 1.1,
    color: "#fff7e6",
  },
  sub: {
    fontSize: 12,
    opacity: 0.9,
    marginTop: 4,
    lineHeight: 1.25,
    color: "rgba(245,241,232,0.85)",
  },
  badgePrivado: {
    marginLeft: "auto",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: 0.6,
    border: "1px solid rgba(212,175,55,0.45)",
    background: "rgba(0,0,0,0.30)",
    color: "#fff7e6",
    whiteSpace: "nowrap",
  },

  statusBox: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(212,175,55,0.28)",
    background: "rgba(255,247,230,0.06)",
    color: "#fff7e6",
    marginBottom: 12,
    fontWeight: 850,
  },
  alert: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(212,175,55,0.28)",
    background: "rgba(255,247,230,0.06)",
    color: "#fff7e6",
    marginBottom: 12,
    fontWeight: 850,
  },

  // ===== FORM PANEL =====
  panel: {
    borderRadius: 18,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    marginBottom: 14,
  },
  panelTitle: {
    fontWeight: 950,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  label: {
    fontSize: 12,
    opacity: 0.86,
    fontWeight: 900,
    letterSpacing: 0.2,
  },
  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.35)",
    color: "#fff7e6",
    fontWeight: 850,
    marginTop: 6,
    outline: "none",
  },

  // ===== Buttons =====
  btnPrimary: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(212,175,55,0.60)",
    background: "linear-gradient(180deg, #fff7e6 0%, #f3ead6 100%)",
    color: "#1b1b1b",
    fontWeight: 950,
    cursor: "pointer",
    width: "100%",
  },
  btnGhost: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff7e6",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  btnGhostWide: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff7e6",
    fontWeight: 950,
    cursor: "pointer",
    width: "100%",
  },

  // ===== List =====
  listHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  listTitle: {
    fontWeight: 950,
    letterSpacing: 0.3,
  },
  muted: {
    opacity: 0.86,
    fontWeight: 800,
  },

  card: {
    borderRadius: 18,
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
    gap: 12,
    alignItems: "center",
  },
  amount: {
    fontWeight: 950,
    letterSpacing: 0.2,
    fontSize: 16,
    color: "#fff7e6",
  },
  pill: {
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 950,
    fontSize: 12,
    letterSpacing: 0.5,
    color: "#fff7e6",
  },
  concepto: {
    fontWeight: 950,
    marginTop: 8,
    opacity: 0.95,
    letterSpacing: 0.2,
  },
  notas: {
    opacity: 0.88,
    marginTop: 6,
    fontWeight: 800,
  },
  meta: {
    opacity: 0.72,
    marginTop: 8,
    fontSize: 12,
    fontWeight: 850,
  },
  actionsRow: {
    display: "flex",
    gap: 10,
    marginTop: 10,
  },

  goldLine: {
    height: 2,
    marginTop: 12,
    borderRadius: 999,
    background:
      "linear-gradient(90deg, rgba(212,175,55,0.0) 0%, rgba(212,175,55,0.55) 40%, rgba(212,175,55,0.0) 100%)",
  },
};
