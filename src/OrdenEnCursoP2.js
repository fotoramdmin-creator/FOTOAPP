import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

import { buildTicketText } from "./ticketBuilder";
import { copyTicketToClipboard } from "./printRawbt";
import { buildTicketPdfBlob } from "./ticketPdfBuilder";

/** ⚠️ Importante:
 * - En pantalla NO mostramos dinero.
 * - El ticket/nota virtual para el cliente sí puede incluirlo.
 */

function onlyDigits(s) {
  return String(s || "").replace(/\D+/g, "");
}

function formatPhoneForWa(raw) {
  const d = onlyDigits(raw);
  if (!d) return "";
  if (d.length === 10) return `52${d}`;
  if (d.length === 12 && d.startsWith("52")) return d;
  if (d.length === 13 && d.startsWith("052")) return `52${d.slice(3)}`;
  return d;
}

function fmtDate(d) {
  if (!d) return "";
  try {
    return String(d).slice(0, 10);
  } catch {
    return "";
  }
}

function fmtTimeFromISO(iso) {
  if (!iso) return "";
  try {
    const dt = new Date(iso);
    if (isNaN(dt.getTime())) return "";
    return dt.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function fmtDateTimeMX(isoOrDate) {
  if (!isoOrDate) return "";
  try {
    const dt = new Date(isoOrDate);
    if (isNaN(dt.getTime())) return "";
    return dt.toLocaleString("es-MX", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** ✅ Ícono elegante (NO depende de FontAwesome) */
function IconClienteGold({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ flex: "0 0 auto" }}
      className="iconClienteGold"
    >
      <path
        fill="currentColor"
        d="M12 12c2.761 0 5-2.463 5-5.5S14.761 1 12 1 7 3.463 7 6.5 9.239 12 12 12zm0 2c-4.418 0-8 2.91-8 6.5C4 22.433 4.448 23 5 23h14c.552 0 1-.567 1-1.5 0-3.59-3.582-6.5-8-6.5z"
      />
    </svg>
  );
}

export default function OrdenEnCursoP2() {
  const [modo, setModo] = useState("LISTA"); // LISTA | DETALLE
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const [q, setQ] = useState("");
  const [lista, setLista] = useState([]);

  const [pedidoId, setPedidoId] = useState(null);
  const [pedido, setPedido] = useState(null);
  const [renglones, setRenglones] = useState([]);

  // n_toma por renglón (detalles_pedido)
  const [nTomaPorDetalle, setNTomaPorDetalle] = useState({}); // { [detalleId]: "123" }

  // ✅ feedback visual al guardar
  const [savedPulse, setSavedPulse] = useState({}); // { [detalleId]: true }

  // ============================
  // ✅ TICKET (PC + RAWBT)
  // - En PC (Chrome + Codesandbox iframe) NO se puede previsualizar PDF en modal (bloquea).
  // - Solución: generar PDF y dar:
  //   1) Abrir/Imprimir en pestaña (o ventana) (sin bloquear popups)
  //   2) Descargar
  //   3) Cerrar
  // - RAWBT: sigue por texto (copyTicketToClipboard)
  // ============================
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketBlobUrl, setTicketBlobUrl] = useState("");
  const [ticketGenStatus, setTicketGenStatus] = useState("");
  const ticketWinRef = useRef(null);

  function closeTicketModal() {
    setTicketModalOpen(false);
    setTicketGenStatus("");
    if (ticketWinRef.current && !ticketWinRef.current.closed) {
      try {
        // no cerramos la pestaña del usuario
      } catch {}
    }
    if (ticketBlobUrl) {
      try {
        URL.revokeObjectURL(ticketBlobUrl);
      } catch {}
    }
    setTicketBlobUrl("");
  }

  async function ensureTicketPdfUrl() {
    if (!pedido) return "";
    if (ticketBlobUrl) return ticketBlobUrl;

    setTicketGenStatus("Generando PDF…");
    const blob = await buildTicketPdfBlob({ pedido, renglones });
    const url = URL.createObjectURL(blob);
    setTicketBlobUrl(url);
    setTicketGenStatus("✅ PDF listo.");
    return url;
  }

  async function openTicketInNewTabSafe() {
    // ✅ abre ventana “sin bloqueo” (sincrónico) y luego le asigna el blob url
    try {
      const w = window.open("about:blank", "_blank", "noopener,noreferrer");
      if (!w) {
        alert(
          "Tu navegador bloqueó la ventana. Activa pop-ups para esta página y vuelve a intentar."
        );
        return;
      }
      ticketWinRef.current = w;

      const url = await ensureTicketPdfUrl();
      if (!url) return;

      try {
        w.location.href = url;
      } catch {
        // fallback: si no deja asignar location
        w.document.write(
          `<html><head><title>Ticket</title></head><body style="margin:0">
             <a href="${url}" target="_self">Abrir ticket</a>
           </body></html>`
        );
        w.document.close();
      }
    } catch (e) {
      console.error(e);
      alert("No pude abrir el ticket.");
    }
  }

  async function downloadTicketPdf() {
    try {
      const url = await ensureTicketPdfUrl();
      if (!url) return;

      const a = document.createElement("a");
      a.href = url;
      a.download = `ticket_${pedidoId || "pedido"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error(e);
      alert("No pude descargar el ticket.");
    }
  }

  // =====================
  // LISTA (orden de llegada / FIFO)
  // =====================
  async function cargarLista() {
    setLoading(true);
    setStatus("Cargando órdenes…");

    const { data, error } = await supabase
      .from("orden_en_curso_fotografo_resumen")
      .select("*")
      .limit(200);

    if (error) {
      console.error("LISTA error:", error);
      setLista([]);
      setStatus("❌ Error cargando lista.");
      setLoading(false);
      return;
    }

    const rows = Array.isArray(data) ? data : [];

    // ✅ Orden: COMO LLEGARON (FIFO) → por fecha_creacion / created_at ASC
    rows.sort((a, b) => {
      const da =
        a.fecha_creacion || a.pedido_fecha || a.fecha || a.created_at || "";
      const db =
        b.fecha_creacion || b.pedido_fecha || b.fecha || b.created_at || "";

      if (da && db) return String(da).localeCompare(String(db)); // ASC
      if (da && !db) return -1;
      if (!da && db) return 1;

      const ia = String(a.pedido_id ?? a.id ?? "");
      const ib = String(b.pedido_id ?? b.id ?? "");
      return ia.localeCompare(ib);
    });

    setLista(rows);
    setStatus("✅ Lista lista.");
    setLoading(false);
  }

  useEffect(() => {
    cargarLista();
  }, []);

  // =====================
  // DETALLE
  // =====================
  async function cargarDetalle(id) {
    const pid = String(id || "").trim();
    if (!pid) return;

    setLoading(true);
    setStatus("Cargando detalle…");

    const { data, error } = await supabase
      .from("orden_en_curso_fotografo")
      .select("*")
      .eq("pedido_id", pid);

    if (error) {
      console.error("DETALLE vista error:", error);
      setPedido(null);
      setRenglones([]);
      setStatus("❌ Error cargando detalle.");
      setLoading(false);
      return;
    }

    let rows = Array.isArray(data) ? data : [];

    // Orden por detalle_id (estable)
    rows = rows.sort((a, b) => {
      const aId = String(a.detalle_id ?? a.id ?? "");
      const bId = String(b.detalle_id ?? b.id ?? "");
      return aId.localeCompare(bId);
    });

    setRenglones(rows);

    // precargar n_toma por renglón
    const map = {};
    for (const r of rows) {
      const did = r.detalle_id ?? r.id;
      map[String(did)] = r.n_toma == null ? "" : String(r.n_toma);
    }
    setNTomaPorDetalle(map);

    // base (desde vista)
    const first = rows[0] || null;
    const pBase = first
      ? {
          id: first.pedido_id ?? first.id ?? pid,
          cliente_nombre: first.cliente_nombre,
          cliente_telefono: first.cliente_telefono,
          fecha_entrega: first.fecha_entrega,
          horario_entrega: first.horario_entrega,
          urgente: Boolean(first.pedido_urgente ?? first.urgente),
          p_2listo: Boolean(first.p_2listo),
          ticket_whatsapp: first.ticket_whatsapp,
          ticket_impreso: first.ticket_impreso,
          fecha_inicio_urgente: first.fecha_inicio_urgente,
        }
      : { id: pid };

    // datos reales (incluye dinero, PERO NO SE MUESTRA EN UI)
    const { data: pDb, error: eDb } = await supabase
      .from("pedidos")
      .select(
        [
          "id",
          "cliente_nombre",
          "cliente_telefono",
          "fecha_entrega",
          "horario_entrega",
          "urgente",
          "fecha_creacion",
          "created_at",
          "fecha_inicio_urgente",
          "total_final",
          "total_bruto",
          "descuento",
          "anticipo",
          "liquidacion",
          "total_pagado",
          "resta",
          "pagado",
          "ticket_whatsapp",
          "ticket_impreso",
          "p_2listo",
          // ✅ flags de revisión
          "necesita_revision",
          "motivo_revision",
          "necesita_revision_at",
        ].join(",")
      )
      .eq("id", pid)
      .maybeSingle();

    if (eDb) console.warn("pedidos fetch warn:", eDb);

    setPedido({ ...pBase, ...(pDb || {}) });

    // reset ticket modal por pedido
    if (ticketBlobUrl) {
      try {
        URL.revokeObjectURL(ticketBlobUrl);
      } catch {}
    }
    setTicketBlobUrl("");
    setTicketModalOpen(false);
    setTicketGenStatus("");

    setStatus("✅ Detalle listo.");
    setLoading(false);
  }

  function abrirPedido(id) {
    setPedidoId(String(id));
    setModo("DETALLE");
    setPedido(null);
    setRenglones([]);
    setNTomaPorDetalle({});
    setSavedPulse({});
    closeTicketModal();
    cargarDetalle(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function volverLista() {
    setModo("LISTA");
    setPedidoId(null);
    setPedido(null);
    setRenglones([]);
    setNTomaPorDetalle({});
    setSavedPulse({});
    closeTicketModal();
    setStatus("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    cargarLista();
  }

  // =====================
  // FILTRO
  // =====================
  const listaFiltrada = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return lista;

    return lista.filter((x) => {
      const nombre = String(x.cliente_nombre || "").toLowerCase();
      const tel = String(x.cliente_telefono || "").toLowerCase();
      const pid = String(x.pedido_id || x.id || "").toLowerCase();
      return nombre.includes(s) || tel.includes(s) || pid.includes(s);
    });
  }, [lista, q]);

  // =====================
  // Helpers (texto)
  // =====================
  function renderEntregaLine(p) {
    const urg = Boolean(p?.urgente);
    if (urg) {
      const inicioISO = p?.fecha_inicio_urgente || null;
      const hhmm = inicioISO ? fmtTimeFromISO(inicioISO) : "";
      return `⚡ URGENTE · 15–20 min${hhmm ? ` · inicio ${hhmm}` : ""}`;
    }
    const f = p?.fecha_entrega ? fmtDate(p.fecha_entrega) : "(pendiente)";
    const h = String(p?.horario_entrega || "").trim() || "(pendiente)";
    return `📅 Entrega · ${f} · ${h}`;
  }

  function renderFechaPedidoLine(p) {
    const iso = p?.fecha_creacion || p?.created_at || "";
    const dt = fmtDateTimeMX(iso);
    return `🧾 Pedido · ${dt || "(pendiente)"}`;
  }

  // =====================
  // DB actions
  // =====================
  async function marcarInicioUrgenteSiFalta() {
    if (!pedidoId) return null;
    if (!pedido?.urgente) return null;
    if (pedido?.fecha_inicio_urgente) return pedido.fecha_inicio_urgente;

    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from("pedidos")
      .update({ fecha_inicio_urgente: nowIso })
      .eq("id", pedidoId)
      .is("fecha_inicio_urgente", null);

    if (error) {
      console.warn("No pude setear fecha_inicio_urgente:", error);
      return null;
    }

    setPedido((prev) => ({ ...(prev || {}), fecha_inicio_urgente: nowIso }));
    return nowIso;
  }

  async function guardarNTomaDetalle(detalleId) {
    const did = String(detalleId || "").trim();
    if (!did) return;

    const val = String(nTomaPorDetalle[did] ?? "").trim();

    setLoading(true);
    setStatus("Guardando N. de toma…");

    const { error } = await supabase
      .from("detalles_pedido")
      .update({ n_toma: val === "" ? null : val })
      .eq("id", did);

    if (error) {
      console.error(error);
      setStatus(`❌ Error guardando toma: ${error.message}`);
      setLoading(false);
      return;
    }

    if (pedido?.urgente) await marcarInicioUrgenteSiFalta();

    // ✅ feedback visual (pulse)
    setSavedPulse((prev) => ({ ...prev, [did]: true }));
    setTimeout(() => {
      setSavedPulse((prev) => {
        const next = { ...prev };
        delete next[did];
        return next;
      });
    }, 650);

    setStatus("✅ N. de toma guardado.");
    await cargarDetalle(pedidoId);
    setLoading(false);
  }

  async function cerrarPedido() {
    if (!pedidoId) return;

    const ok = window.confirm("¿Cerrar este pedido? (solo para fotógrafo)");
    if (!ok) return;

    setLoading(true);
    setStatus("Cerrando pedido…");

    const { error } = await supabase
      .from("pedidos")
      .update({ p_2listo: true })
      .eq("id", pedidoId);

    if (error) {
      console.error(error);
      setStatus(`❌ Error: ${error.message}`);
      setLoading(false);
      return;
    }

    setStatus("✅ Pedido cerrado.");
    setLoading(false);
    volverLista();
  }

  // ✅✅✅ REGRESAR P2 -> P1 (MOSTRADOR)
  async function regresarPedidoAP1() {
    if (!pedidoId) return;

    const motivo =
      window.prompt(
        "Motivo para regresar a mostrador (P1):",
        "REVISAR DATOS"
      ) || "REVISAR DATOS";

    setLoading(true);
    setStatus("Regresando a mostrador…");

    const { error } = await supabase
      .from("pedidos")
      .update({
        necesita_revision: true,
        motivo_revision: String(motivo).trim().toUpperCase(),
        necesita_revision_at: new Date().toISOString(),
        p_2listo: false,
      })
      .eq("id", pedidoId);

    if (error) {
      console.error(error);
      setStatus("❌ Error regresando a mostrador.");
      setLoading(false);
      return;
    }

    setStatus("✅ Pedido regresado a mostrador.");
    setLoading(false);
    volverLista();
  }

  // =====================
  // NOTA VIRTUAL (WhatsApp) — MENSAJE
  // ✅ Si es urgente y NO tiene inicio, se marca inicio EN ESE MOMENTO
  // =====================
  function buildNotaCortaText(pOverride) {
    const p = pOverride || pedido;
    const nombre = String(p?.cliente_nombre || "").trim() || "Cliente";

    // ✅ incluir N. de toma en el mensaje corto
    const lines = renglones.map((d) => {
      const detalleId = String(d.detalle_id ?? d.id);
      const nToma = String(nTomaPorDetalle[detalleId] ?? "").trim();
      const tamano = d.tamano || d.detalle_tamano || "—";
      const tipo = d.tipo || "—";
      const cantidad = d.cantidad ?? "—";
      const papel = d.papel || "—";
      return `- ${tamano} (x${cantidad}) · ${tipo} · ${papel}${
        nToma ? ` · Toma ${nToma}` : ""
      }`;
    });

    const parts = [];
    parts.push("FOTO RAMIREZ");
    parts.push("--------------------------------");
    parts.push(`Cliente: ${String(nombre).toUpperCase()}`);
    parts.push(renderFechaPedidoLine(p));
    parts.push(renderEntregaLine(p));
    parts.push("");
    parts.push("Detalle:");
    parts.push(lines.length ? lines.join("\n") : "- (sin renglones)");
    parts.push("");
    parts.push("Gracias por su preferencia");
    parts.push("Foto Ramirez");

    return parts.join("\n");
  }

  async function notaVirtualMsg() {
    if (!pedido) return;

    setLoading(true);
    setStatus("Preparando WhatsApp…");

    try {
      let pLocal = pedido;

      if (pLocal?.urgente && !pLocal?.fecha_inicio_urgente) {
        const nowIso = new Date().toISOString();
        const { error } = await supabase
          .from("pedidos")
          .update({ fecha_inicio_urgente: nowIso, ticket_whatsapp: true })
          .eq("id", pedidoId)
          .is("fecha_inicio_urgente", null);

        if (!error) {
          pLocal = {
            ...pLocal,
            fecha_inicio_urgente: nowIso,
            ticket_whatsapp: true,
          };
          setPedido(pLocal);
        } else {
          console.warn(
            "No pude setear inicio urgente al enviar WhatsApp:",
            error
          );
        }
      } else {
        try {
          await supabase
            .from("pedidos")
            .update({ ticket_whatsapp: true })
            .eq("id", pedidoId);
        } catch {}
      }

      const rawPhone = pLocal?.cliente_telefono;
      const phone = formatPhoneForWa(rawPhone);
      const text = buildNotaCortaText(pLocal);
      const encoded = encodeURIComponent(text);

      if (!phone) {
        try {
          await navigator.clipboard.writeText(text);
          alert(
            "No hay teléfono del cliente. Copié el mensaje al portapapeles."
          );
        } catch {
          alert("No hay teléfono del cliente. Copia el mensaje manualmente.");
        }
        setStatus("✅ Mensaje listo.");
        return;
      }

      window.open(
        `https://wa.me/${phone}?text=${encoded}`,
        "_blank",
        "noopener,noreferrer"
      );
      setStatus("✅ WhatsApp abierto.");
    } catch (e) {
      console.error(e);
      setStatus("❌ No pude preparar WhatsApp.");
    } finally {
      setLoading(false);
    }
  }

  // =====================
  // ✅ IMPRIMIR / VER EN COMPU (PDF)
  // - Abre modal con botones: Abrir/Imprimir (pestaña), Descargar, Cerrar
  // - Marca ticket_impreso en DB
  // =====================
  async function imprimirTicketEnCompu() {
    if (!pedido) return;

    setTicketModalOpen(true);
    setTicketGenStatus("Generando PDF…");

    setLoading(true);
    setStatus("Generando ticket…");

    try {
      // Genera y guarda url (pero no intenta embebido)
      const blob = await buildTicketPdfBlob({ pedido, renglones });
      const url = URL.createObjectURL(blob);
      setTicketBlobUrl(url);
      setTicketGenStatus("✅ PDF listo (abre o descarga).");

      try {
        await supabase
          .from("pedidos")
          .update({ ticket_impreso: true })
          .eq("id", pedidoId);
      } catch (e) {
        console.warn("No pude marcar ticket_impreso:", e);
      }

      setStatus("✅ Ticket listo.");
    } catch (e) {
      console.error(e);
      setTicketGenStatus("❌ No se pudo generar el PDF.");
      setStatus("❌ No se pudo generar el ticket.");
      alert("No pude generar el ticket.");
    } finally {
      setLoading(false);
    }
  }

  // =====================
  // RAWBT (texto)
  // =====================
  async function copiarTicketTexto() {
    const text = buildTicketText({ pedido, renglones });
    await copyTicketToClipboard(text);
  }

  // =====================
  // UI
  // =====================
  return (
    <div className="p2Root">
      <style>{`
        :root{
          --bg:#0B0F14;
          --panel: rgba(255,255,255,0.04);
          --panel2: rgba(255,255,255,0.03);
          --border: rgba(255,255,255,0.10);
          --text:#E9F1F1;

          --aqua:#27E0D6;
          --aquaBorder: rgba(39,224,214,0.40);
          --aquaBg: rgba(39,224,214,0.10);

          --amber:#FFD166;
          --amberBorder: rgba(255,209,102,0.38);
          --amberBg: rgba(255,209,102,0.12);

          --green:#2BFF88;
          --greenBorder: rgba(43,255,136,0.42);
          --greenBg: rgba(43,255,136,0.10);

          --danger:#FF4D6D;
          --dangerBorder: rgba(255,77,109,0.55);
          --dangerBg: rgba(255,77,109,0.10);

          /* Dorado institucional */
          --gold:#D6B46A;
          --goldBorder: rgba(214,180,106,0.55);

          /* Azul gris (texto claro) */
          --slateText: rgba(190,210,220,0.95);
          --slateBorder: rgba(95,124,138,0.55);

          /* Negro */
          --blackBtn: rgba(0,0,0,0.85);
          --blackBtn2: rgba(0,0,0,0.55);
        }

        *{ box-sizing:border-box; }
        html, body { max-width:100%; overflow-x:hidden; }

        .p2Root{ max-width:560px; margin:0 auto; padding: 12px 12px 24px; color: var(--text); }

        .card{
          border:1px solid var(--border);
          background: var(--panel);
          border-radius: 18px;
          padding: 12px;
          margin: 12px 0;
          overflow:hidden;
        }

        .topRow{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
        .title{
          font-weight: 950;
          letter-spacing: .2px;
          font-size: 15px;
        }
        .sub{
          opacity:.72;
          font-size:12px;
          margin-top:6px;
          line-height:1.35;
        }

        .badge{
          font-size:12px;
          padding: 8px 10px;
          border-radius: 999px;
          border:1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          display:inline-flex;
          align-items:center;
          gap:8px;
          max-width:100%;
          overflow-wrap:anywhere;
        }
        .badgeAqua{ border-color: var(--aquaBorder); background: var(--aquaBg); }
        .badgeAmber{ border-color: var(--amberBorder); background: var(--amberBg); }
        .badgeErr{ border-color: rgba(255,77,109,0.35); background: var(--dangerBg); }

        .row{ display:grid; gap:10px; margin-top:10px; }

        .input{
          width:100%;
          padding: 14px 12px;
          border-radius: 14px;
          border:1px solid rgba(255,255,255,0.12);
          background: rgba(0,0,0,0.25);
          color: var(--text);
          font-size: 16px;
          outline:none;
        }
        .input:focus{
          border-color: rgba(39,224,214,0.45);
          box-shadow: 0 0 0 6px rgba(39,224,214,0.10);
        }

        /* Botones base */
        .btn{
          width:100%;
          padding: 14px;
          border-radius: 14px;
          border:1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.06);
          color: var(--text);
          font-weight: 900;
          font-size: 16px;
          cursor:pointer;
        }
        .btn:disabled{ opacity:.5; cursor:not-allowed; }

        .btnOpen{
          border: 2px solid var(--goldBorder);
          background: linear-gradient(135deg, rgba(245,248,250,0.95), rgba(230,235,240,0.90));
          color: rgba(95,124,138,0.95);
          font-weight: 950;
          letter-spacing: .3px;
          font-size: 20px;
        }

        .btnSave{
          border: 2px solid var(--greenBorder);
          background: linear-gradient(135deg, rgba(210,245,225,0.95), rgba(180,235,205,0.90));
          color: #000000;
          font-weight: 950;
          letter-spacing: .3px;
          font-size: 18px;
        }

        .btnSavedPulse{ animation: savePulse 650ms ease-out 1; }
        @keyframes savePulse{
          0%{ transform: scale(1); filter: brightness(1); }
          40%{ transform: scale(1.03); filter: brightness(1.08); }
          100%{ transform: scale(1); filter: brightness(1); }
        }

        .btnRefresh{
          border:2px solid var(--slateBorder);
          background: linear-gradient(180deg, var(--blackBtn), var(--blackBtn2));
          color: var(--slateText);
          font-weight: 950;
          letter-spacing: .2px;
        }

        .btnGhost{
          border:1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.04);
        }
        .btnDanger{
          border:1px solid var(--dangerBorder);
          background: var(--dangerBg);
        }
        .btnWhats{
          border:1px solid var(--greenBorder);
          background: var(--greenBg);
        }
        .btnAmber{
          border:1px solid var(--amberBorder);
          background: var(--amberBg);
        }

        /* ✅ botón regresar P2 -> P1 */
        .btnBackP1{
          border:2px solid var(--amberBorder);
          background: rgba(255,209,102,0.10);
          font-weight: 950;
          letter-spacing: .2px;
        }

        .item{
          border:1px solid rgba(255,255,255,0.10);
          background: var(--panel2);
          border-radius: 16px;
          padding: 12px;
          margin-top:10px;
          overflow:hidden;
        }

        .itemNext{
          border-color: rgba(43,255,136,0.38);
          box-shadow: 0 0 0 2px rgba(43,255,136,0.08), 0 0 22px rgba(43,255,136,0.10);
          animation: nextGlow 1400ms ease-in-out infinite;
        }
        @keyframes nextGlow{
          0%{ box-shadow: 0 0 0 2px rgba(43,255,136,0.08), 0 0 16px rgba(43,255,136,0.08); }
          50%{ box-shadow: 0 0 0 2px rgba(43,255,136,0.12), 0 0 24px rgba(43,255,136,0.14); }
          100%{ box-shadow: 0 0 0 2px rgba(43,255,136,0.08), 0 0 16px rgba(43,255,136,0.08); }
        }

        .nextName{ color: rgba(190,255,220,0.98); }

        .itemTop{ display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
        .itemTop > div{ min-width:0; }

        .p2Cliente{
          font-size:18px;
          font-weight: 950;
          letter-spacing: .6px;
          text-transform: uppercase;
          line-height:1.12;
          overflow-wrap:anywhere;
          display:flex;
          align-items:center;
          gap:8px;
        }

        .iconClienteGold{ color: #d4af37; opacity: .95; }

        .clienteNombreBig{
          font-size:22px;
          font-weight: 980;
          letter-spacing: .8px;
          text-transform: uppercase;
          line-height:1.10;
          overflow-wrap:anywhere;
          display:flex;
          align-items:center;
          gap:8px;
        }

        .p2Renglon{
          font-size:15px;
          font-weight: 900;
          letter-spacing: .25px;
          line-height:1.15;
          overflow-wrap:anywhere;
        }

        .p2Sub{
          opacity:.74;
          font-size:12px;
          margin-top:6px;
          line-height:1.35;
          overflow-wrap:anywhere;
        }

        .p2Esp{
          opacity:.92;
          font-size:15px;
          font-weight: 900;
          letter-spacing: .15px;
          margin-top:8px;
          line-height:1.25;
          overflow-wrap:anywhere;
        }

        .chipRow{ display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
        .chip{
          font-size:12px;
          padding: 6px 10px;
          border-radius: 999px;
          border:1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
        }

        .chipUrg{
          border-color: var(--amberBorder);
          background: var(--amberBg);
          font-size: 14px;
          padding: 8px 12px;
          font-weight: 950;
          letter-spacing: .2px;
        }

        .actions{ display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; }
        .actions .btn{ flex:1 1 160px; min-width:0; }

        .tomaRow{ display:grid; grid-template-columns: 1fr auto; gap:10px; margin-top:10px; align-items:center; }
        .p2Toma{
          font-size:20px;
          font-weight: 950;
          letter-spacing: 1px;
          text-align:center;
          padding: 16px 12px;
          border-radius: 16px;
        }
        .p2TomaEmpty{ border-color: var(--amberBorder); }
        .p2TomaFilled{
          border-color: var(--greenBorder);
          box-shadow: 0 0 0 6px rgba(43,255,136,0.08);
        }

        .entregaBig{
          font-size:16px;
          font-weight: 950;
          letter-spacing: .2px;
          opacity: 0.95;
        }

        /* ===== Modal Ticket ===== */
        .modalOverlay{
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.65);
          display:flex;
          align-items:center;
          justify-content:center;
          padding: 14px;
          z-index: 9999;
        }
        .modalCard{
          width: min(820px, 100%);
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(12,15,20,0.96);
          overflow:hidden;
          box-shadow: 0 12px 40px rgba(0,0,0,0.55);
        }
        .modalTop{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          padding: 12px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.03);
        }
        .modalTitle{
          font-weight: 950;
          letter-spacing: .3px;
          font-size: 14px;
          overflow-wrap:anywhere;
        }
        .modalBtns{
          display:flex;
          gap:10px;
          flex-wrap:wrap;
        }
        .modalBody{
          padding: 14px 12px;
        }
        .modalHint{
          opacity:.82;
          font-size: 13px;
          line-height: 1.35;
        }

        @media (max-width:560px){
          .actions{ flex-direction:column; }
          .actions .btn{ width:100%; flex:1 1 auto; }
          .tomaRow{ grid-template-columns: 1fr; }
          .modalBtns{ width:100%; }
          .modalBtns .btn{ width:100%; }
        }
      `}</style>

      {/* ✅ MODAL TICKET (SIN VISTA PREVIA) */}
      {ticketModalOpen && (
        <div className="modalOverlay" onClick={closeTicketModal}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalTop">
              <div className="modalTitle">
                Ticket · {pedidoId || "—"}{" "}
                {ticketGenStatus ? `· ${ticketGenStatus}` : ""}
              </div>
              <div className="modalBtns">
                <button
                  className="btn btnAmber"
                  onClick={openTicketInNewTabSafe}
                  disabled={!pedido}
                  title="Abre el PDF en otra pestaña para imprimir"
                >
                  🖨️ Abrir / Imprimir
                </button>
                <button
                  className="btn btnGhost"
                  onClick={downloadTicketPdf}
                  disabled={!pedido}
                >
                  ⬇️ Descargar
                </button>
                <button className="btn btnDanger" onClick={closeTicketModal}>
                  ✖ Cerrar
                </button>
              </div>
            </div>
            <div className="modalBody">
              <div className="modalHint">
                ⚠️ En CodeSandbox/Chrome a veces se bloquea la vista previa del
                PDF dentro del modal por el iframe. Por eso aquí solo lo{" "}
                <b>abrimos en otra pestaña</b> o lo <b>descargamos</b>.
                <br />
                {ticketBlobUrl ? (
                  <>
                    <br />✅ Ya está generado. Si te bloquea la pestaña: activa
                    pop-ups para esta página.
                  </>
                ) : (
                  <>
                    <br />
                    {ticketGenStatus || "Generando…"}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {modo === "LISTA" && (
        <>
          <div className="card">
            <div className="topRow">
              <div>
                <div className="title">Foto Ramírez · Orden en curso</div>
                <div className="sub">Ver qué tomar y capturar N. de toma.</div>
              </div>
              <div className="badge badgeAqua">{loading ? "…" : "LISTA"}</div>
            </div>

            <div className="row">
              <input
                className="input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre / tel / id…"
              />

              <button
                className="btn btnRefresh"
                onClick={cargarLista}
                disabled={loading}
              >
                {loading ? "Cargando…" : "Actualizar lista"}
              </button>

              {status ? (
                <div
                  className={`badge ${
                    status.startsWith("❌") ? "badgeErr" : "badgeAmber"
                  }`}
                >
                  {status}
                </div>
              ) : null}
            </div>
          </div>

          <div className="card">
            <div className="topRow">
              <div>
                <div className="title">Pedidos</div>
                <div className="sub">
                  Total: <b>{listaFiltrada.length}</b>
                </div>
              </div>
              <div className="badge">Ordenado por llegada</div>
            </div>

            {listaFiltrada.length === 0 ? (
              <div className="sub" style={{ marginTop: 10 }}>
                No hay pedidos en la lista.
              </div>
            ) : (
              listaFiltrada.map((p, idx) => {
                const pid = p.pedido_id ?? p.id;
                const nombre = String(p.cliente_nombre || "—").toUpperCase();
                const urgente = Boolean(p.urgente);

                const entregaText = urgente
                  ? "⚡ URGENTE · 15–20 min"
                  : p.fecha_entrega || p.horario_entrega
                  ? `📅 Entrega · ${String(p.fecha_entrega || "").slice(
                      0,
                      10
                    )} · ${p.horario_entrega || "(hora)"}`
                  : "📅 Entrega · (pendiente)";

                const isNext = idx === 0;

                return (
                  <div
                    key={String(pid)}
                    className={`item ${isNext ? "itemNext" : ""}`}
                  >
                    <div className="itemTop">
                      <div>
                        <div
                          className={`p2Cliente ${isNext ? "nextName" : ""}`}
                        >
                          <IconClienteGold size={18} />
                          <span>{nombre}</span>
                          {urgente ? " ⚡" : ""}
                        </div>

                        <div className="chipRow">
                          {urgente ? (
                            <span className="chip chipUrg">URGENTE</span>
                          ) : null}
                        </div>

                        <div className={`p2Sub entregaBig`}>{entregaText}</div>
                      </div>
                    </div>

                    <div className="actions">
                      <button
                        className="btn btnOpen"
                        onClick={() => abrirPedido(pid)}
                        disabled={loading}
                      >
                        Abrir
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {modo === "DETALLE" && (
        <>
          <div className="card">
            <div className="topRow">
              <div>
                <div className="title">Detalle</div>
                <div className="sub">Captura N. de toma por renglón.</div>
              </div>
              <div className="badge badgeAqua">
                {pedidoId ? "DETALLE" : "—"}
              </div>
            </div>

            <div className="actions">
              <button
                className="btn btnGhost"
                onClick={volverLista}
                disabled={loading}
              >
                ← Regresar
              </button>
              <button
                className="btn btnGhost"
                onClick={() => cargarDetalle(pedidoId)}
                disabled={loading}
              >
                Recargar
              </button>
            </div>

            {status ? (
              <div
                style={{ marginTop: 10 }}
                className={`badge ${
                  status.startsWith("❌") ? "badgeErr" : "badgeAmber"
                }`}
              >
                {status}
              </div>
            ) : null}
          </div>

          <div className="card">
            <div className="title">Cliente</div>

            <div style={{ marginTop: 10 }} className="clienteNombreBig">
              <IconClienteGold size={20} />
              <span>
                {pedido?.cliente_nombre
                  ? String(pedido.cliente_nombre).toUpperCase()
                  : "—"}
              </span>
              {pedido?.urgente ? " ⚡" : ""}
            </div>

            <div className="p2Sub" style={{ marginTop: 8 }}>
              {renderFechaPedidoLine(pedido)}
            </div>

            <div
              className={`badge ${pedido?.urgente ? "badgeAmber" : ""}`}
              style={{ marginTop: 10 }}
            >
              <span className="entregaBig">{renderEntregaLine(pedido)}</span>
            </div>

            <div className="actions" style={{ marginTop: 12 }}>
              <button
                className="btn btnWhats"
                onClick={notaVirtualMsg}
                disabled={loading || !pedido}
              >
                💬 Nota virtual (mensaje)
              </button>

              {/* ✅ ESTE ES EL BUENO PARA COMPU: abre modal y te deja imprimir/descargar */}
              <button
                className="btn btnAmber"
                onClick={imprimirTicketEnCompu}
                disabled={loading || !pedido}
              >
                🖨️ IMPRIMIR TICKET
              </button>

              {/* ✅ RAWBT (texto) */}
              <button
                className="btn btnGhost"
                onClick={copiarTicketTexto}
                disabled={loading || !pedido}
              >
                Copiar ticket (texto)
              </button>
            </div>
          </div>

          <div className="card">
            <div className="topRow">
              <div>
                <div className="title">Renglones</div>
                <div className="sub">
                  Total renglones: <b>{renglones.length}</b>
                </div>
              </div>
              <div className="badge">Captura toma</div>
            </div>

            {renglones.length === 0 ? (
              <div className="sub" style={{ marginTop: 10 }}>
                No hay detalles aún.
              </div>
            ) : (
              renglones.map((d) => {
                const detalleId = d.detalle_id ?? d.id;
                const did = String(detalleId);

                const tamano = d.tamano || d.detalle_tamano || "—";
                const tipo = d.tipo || "—";
                const cantidad = d.cantidad ?? "—";
                const papel = d.papel || "—";
                const ropa = d.ropa ? `Ropa: ${d.ropa}` : "";
                const esp = d.especificaciones
                  ? `Esp: ${d.especificaciones}`
                  : "";
                const urg = Boolean(d.urgente || d.detalle_urgente);

                const tomaVal = String(nTomaPorDetalle[did] ?? "").trim();
                const tomaClass = tomaVal ? "p2TomaFilled" : "p2TomaEmpty";

                const pulse = Boolean(savedPulse[did]);

                return (
                  <div key={did} className="item">
                    <div className="p2Renglon">
                      {tamano} · x{cantidad} · {tipo} · {papel}{" "}
                      {urg ? "⚡ URGENTE" : ""}
                    </div>

                    <div className="p2Esp">
                      {esp || "Sin esp"}
                      {ropa ? ` · ${ropa}` : ""}
                    </div>

                    <div className="tomaRow">
                      <input
                        className={`input p2Toma ${tomaClass}`}
                        value={nTomaPorDetalle[did] ?? ""}
                        onChange={(e) =>
                          setNTomaPorDetalle((prev) => ({
                            ...prev,
                            [did]: e.target.value,
                          }))
                        }
                        placeholder="N° DE TOMA"
                        inputMode="numeric"
                      />

                      <button
                        className={`btn btnSave ${
                          pulse ? "btnSavedPulse" : ""
                        }`}
                        onClick={() => guardarNTomaDetalle(did)}
                        disabled={loading}
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="card">
            <button
              className="btn btnDanger"
              onClick={cerrarPedido}
              disabled={loading}
            >
              ✅ CERRAR PEDIDO
            </button>

            <button
              className="btn btnBackP1"
              style={{ marginTop: 10 }}
              onClick={regresarPedidoAP1}
              disabled={loading}
            >
              ↩️ REGRESAR A MOSTRADOR (P1)
            </button>

            <div className="sub" style={{ marginTop: 8 }}>
              “Cerrar” = listo fotógrafo. · “Regresar” = vuelve a P1 para
              corrección.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
