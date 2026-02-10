import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

/**
 * ENTREGA (Mostrador)
 * - Busca por n_toma o cliente_nombre en view: entrega_busqueda
 * - Muestra detalle (pedido_resumen), producción (listo_entrega y pendientes), dinero (resta/pagado)
 * - Cobra (insert en pagos; triggers recalculan pedidos)
 * - Entregar (RPC marcar_entregado)
 */

const fmtMoney = (n) => {
  const x = Number(n || 0);
  return x.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
};

const Tabs = [
  { key: "PENDIENTES", label: "Pendientes" },
  { key: "LISTOS", label: "Listos" },
  { key: "DEBEN", label: "Deben" },
  { key: "ENTREGADOS", label: "Entregados" },
  { key: "TODOS", label: "Todos" },
];

export default function Entrega() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("PENDIENTES");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // modal cobrar
  const [cobrarOpen, setCobrarOpen] = useState(false);
  const [rowSel, setRowSel] = useState(null);
  const [montoRecibido, setMontoRecibido] = useState("");
  const [notaPago, setNotaPago] = useState("");
  const [savingPago, setSavingPago] = useState(false);

  const qTrim = q.trim();

  async function fetchEntrega() {
    setLoading(true);
    try {
      let query = supabase.from("entrega_busqueda").select("*").limit(80);

      // Si hay búsqueda, filtra en SQL; si no, trae lo más reciente por fecha de entrega.
      if (qTrim) {
        // buscar por nombre o n_toma
        query = query.or(
          `cliente_nombre.ilike.%${qTrim}%,n_toma.ilike.%${qTrim}%`
        );
      } else {
        query = query.order("fecha_entrega", {
          ascending: true,
          nullsFirst: false,
        });
      }

      const { data, error } = await query;
      if (error) throw error;

      setRows(data || []);
    } catch (e) {
      console.error(e);
      alert("Error cargando ENTREGA. Revisa consola.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEntrega();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtro por tabs (client-side para no complicar SQL)
  const filtered = useMemo(() => {
    const list = rows || [];
    const now = new Date();

    return list
      .filter((r) => {
        const entregado = !!r.entregado;
        const listo = !!r.listo_entrega;
        const debe = Number(r.resta || 0) > 0;

        if (tab === "ENTREGADOS") return entregado;
        if (tab === "LISTOS") return !entregado && listo;
        if (tab === "DEBEN") return !entregado && debe;
        if (tab === "PENDIENTES") return !entregado;
        return true; // TODOS
      })
      .sort((a, b) => {
        // orden: primero no entregados, luego por fecha_entrega, luego por creación
        const ae = a.entregado ? 1 : 0;
        const be = b.entregado ? 1 : 0;
        if (ae !== be) return ae - be;

        const fa = a.fecha_entrega ? new Date(a.fecha_entrega) : now;
        const fb = b.fecha_entrega ? new Date(b.fecha_entrega) : now;
        if (fa.getTime() !== fb.getTime()) return fa.getTime() - fb.getTime();

        const ca = a.fecha_creacion ? new Date(a.fecha_creacion) : now;
        const cb = b.fecha_creacion ? new Date(b.fecha_creacion) : now;
        return cb.getTime() - ca.getTime();
      });
  }, [rows, tab]);

  function openCobrar(r) {
    setRowSel(r);
    setMontoRecibido("");
    setNotaPago("");
    setCobrarOpen(true);
  }

  async function registrarPago() {
    if (!rowSel) return;
    const resta = Number(rowSel.resta || 0);

    const recibido = montoRecibido === "" ? resta : Number(montoRecibido);
    if (!isFinite(recibido) || recibido <= 0) {
      alert("Monto recibido inválido.");
      return;
    }

    // Si quieres permitir pagos parciales aquí, deja esto.
    // Si quieres forzar liquidación completa, valida recibido >= resta
    const monto = Math.min(recibido, resta);

    setSavingPago(true);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const usuario_id = userRes?.user?.id || null;

      const { error } = await supabase.from("pagos").insert([
        {
          pedido_id: rowSel.pedido_id,
          fecha_pago: new Date().toISOString(),
          monto,
          tipo: "LIQUIDACION",
          nota: notaPago || null,
          usuario_id,
        },
      ]);
      if (error) throw error;

      // refrescar
      await fetchEntrega();
      setCobrarOpen(false);
    } catch (e) {
      console.error(e);
      alert("Error registrando pago. Revisa consola.");
    } finally {
      setSavingPago(false);
    }
  }

  async function marcarEntregado(r) {
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const usuario = userRes?.user?.id || null;

      // Regla sugerida: SOLO entregar si está listo. (Si quieres permitir entregar no listo, quita este check)
      if (!r.listo_entrega) {
        alert("Aún NO está listo para entregar (faltan pasos de producción).");
        return;
      }

      // Si DEBE, confirmación (no bloquea: tú decides)
      const debe = Number(r.resta || 0) > 0;
      if (debe) {
        const ok = window.confirm(
          `Este pedido AÚN DEBE ${fmtMoney(
            r.resta
          )}.\n¿Seguro que quieres marcar como ENTREGADO?`
        );
        if (!ok) return;
      }

      const { error } = await supabase.rpc("marcar_entregado", {
        p_pedido_id: r.pedido_id,
        p_usuario: usuario,
      });
      if (error) throw error;

      await fetchEntrega();
    } catch (e) {
      console.error(e);
      alert("Error marcando ENTREGADO. Revisa consola.");
    }
  }

  return (
    <div style={{ padding: 12, maxWidth: 920, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>ENTREGA</h2>
        <button onClick={fetchEntrega} disabled={loading}>
          {loading ? "Cargando..." : "Recargar"}
        </button>
      </div>

      {/* Buscador */}
      <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por N. de toma o Nombre..."
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 10,
            border: "1px solid #ccc",
            fontSize: 16,
          }}
        />
        <button
          onClick={fetchEntrega}
          disabled={loading}
          style={{ padding: "12px 14px", borderRadius: 10 }}
        >
          Buscar
        </button>
        <button
          onClick={() => {
            setQ("");
            setTab("PENDIENTES");
            // trae ordenado por fecha entrega
            setTimeout(fetchEntrega, 0);
          }}
          style={{ padding: "12px 14px", borderRadius: 10 }}
        >
          Limpiar
        </button>
      </div>

      {/* Tabs */}
      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {Tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 10px",
              borderRadius: 999,
              border: "1px solid #ccc",
              background: tab === t.key ? "#111" : "#fff",
              color: tab === t.key ? "#fff" : "#111",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {filtered.length === 0 && (
          <div style={{ opacity: 0.7, padding: 12 }}>
            Sin resultados{qTrim ? ` para “${qTrim}”` : ""}.
          </div>
        )}

        {filtered.map((r) => {
          const debe = Number(r.resta || 0) > 0;
          const listo = !!r.listo_entrega;
          const entregado = !!r.entregado;

          const pendientesTxt = [
            r.faltan_retocado > 0 ? `Retocado: ${r.faltan_retocado}` : null,
            r.faltan_impreso > 0 ? `Impreso: ${r.faltan_impreso}` : null,
            r.faltan_calendario > 0
              ? `Calendario: ${r.faltan_calendario}`
              : null,
          ].filter(Boolean);

          return (
            <div
              key={r.pedido_id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 14,
                padding: 12,
                background: entregado ? "#f7f7f7" : "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>
                    {r.cliente_nombre || "(Sin nombre)"}{" "}
                    {r.urgente ? (
                      <span
                        style={{ marginLeft: 6, fontSize: 12, color: "#b00" }}
                      >
                        URGENTE
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>
                    N. TOMA: <b>{r.n_toma || "-"}</b> · Entrega:{" "}
                    <b>{r.fecha_entrega || "-"}</b>{" "}
                    {r.horario_entrega ? `· ${r.horario_entrega}` : ""}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    Pedido: {r.pedido_id}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800 }}>
                    {r.pagado ? "PAGADO ✅" : debe ? "DEBE 💰" : "—"}
                  </div>
                  <div style={{ fontSize: 13 }}>
                    Resta: <b>{fmtMoney(r.resta)}</b>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    Total: {fmtMoney(r.total_final)} · A/C:{" "}
                    {fmtMoney(r.anticipo)}
                  </div>
                </div>
              </div>

              {/* Producción */}
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid #ddd",
                    background: listo ? "#e9ffe9" : "#fff6e6",
                  }}
                >
                  {listo ? "LISTO PARA ENTREGAR ✅" : "NO LISTO ⏳"}
                </span>

                {pendientesTxt.length > 0 && (
                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid #ddd",
                      background: "#fff",
                    }}
                  >
                    Falta: {pendientesTxt.join(" · ")}
                  </span>
                )}

                {entregado && (
                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid #ddd",
                      background: "#eef3ff",
                    }}
                  >
                    ENTREGADO ✅{" "}
                    {r.entregado_at
                      ? `· ${new Date(r.entregado_at).toLocaleString("es-MX")}`
                      : ""}
                  </span>
                )}
              </div>

              {/* Resumen del pedido */}
              <pre
                style={{
                  marginTop: 10,
                  padding: 10,
                  background: "#0b0b0b",
                  color: "#fff",
                  borderRadius: 12,
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                  lineHeight: 1.35,
                }}
              >
                {r.pedido_resumen || "(Sin renglones)"}
              </pre>

              {/* Acciones */}
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {!entregado && debe && (
                  <button
                    onClick={() => openCobrar(r)}
                    style={{ padding: "10px 12px", borderRadius: 10 }}
                  >
                    💳 Cobrar
                  </button>
                )}

                {!entregado && (
                  <button
                    onClick={() => marcarEntregado(r)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: listo ? "#111" : "#999",
                      color: "#fff",
                      border: "1px solid #111",
                      cursor: "pointer",
                    }}
                  >
                    ✅ Entregar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal COBRAR */}
      {cobrarOpen && rowSel && (
        <div
          onClick={() => setCobrarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            display: "grid",
            placeItems: "center",
            padding: 12,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(560px, 96vw)",
              background: "#fff",
              borderRadius: 16,
              padding: 14,
              border: "1px solid #ddd",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 16 }}>
                Cobrar · {rowSel.cliente_nombre} · Toma {rowSel.n_toma || "-"}
              </div>
              <button onClick={() => setCobrarOpen(false)}>X</button>
            </div>

            <div style={{ marginTop: 10, fontSize: 14 }}>
              Resta actual: <b>{fmtMoney(rowSel.resta)}</b>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <label style={{ fontSize: 13 }}>
                Monto recibido (vacío = cobrar resta completa)
              </label>
              <input
                value={montoRecibido}
                onChange={(e) => setMontoRecibido(e.target.value)}
                placeholder="Ej: 200"
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #ccc",
                }}
              />

              <label style={{ fontSize: 13 }}>Nota (opcional)</label>
              <input
                value={notaPago}
                onChange={(e) => setNotaPago(e.target.value)}
                placeholder="Ej: Pagó en efectivo"
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #ccc",
                }}
              />
            </div>

            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setCobrarOpen(false)}
                disabled={savingPago}
              >
                Cancelar
              </button>
              <button
                onClick={registrarPago}
                disabled={savingPago}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "#111",
                  color: "#fff",
                  border: "1px solid #111",
                }}
              >
                {savingPago ? "Guardando..." : "Registrar pago"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
