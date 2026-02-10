// src/ticketPdfBuilder.js
import { jsPDF } from "jspdf";
import logoUrl from "./assets/logo.png";

// ==== helpers ====
function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}
function fmtDate(d) {
  if (!d) return "";
  try {
    return String(d).slice(0, 10);
  } catch {
    return "";
  }
}
function fmtTime(t) {
  if (!t) return "";
  return String(t).slice(0, 5);
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

// Carga la imagen y regresa dataURL + dimensiones reales
async function loadImageData(url) {
  // fetch -> blob -> dataURL
  const res = await fetch(url, { cache: "no-store" });
  const blob = await res.blob();

  const dataUrl = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });

  // obtener size real con Image()
  const dims = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        w: img.naturalWidth || img.width,
        h: img.naturalHeight || img.height,
      });
    img.onerror = reject;
    img.src = dataUrl;
  });

  return { dataUrl, w: dims.w, h: dims.h };
}

// estimar alto del PDF (mm) según líneas
function estimateHeightMm({ logoH, linesCount }) {
  // margen + logo + separadores + texto
  // 1 línea ~ 4mm aprox (con font 10–11)
  const top = 6;
  const afterLogo = 4;
  const headerBlock = 18;
  const linesBlock = linesCount * 4.2;
  const bottom = 12;
  return Math.max(
    120,
    top + logoH + afterLogo + headerBlock + linesBlock + bottom
  );
}

/**
 * Construye un PDF de ticket (58mm) con LOGO GRANDE (opción C), sin estirar.
 * @param {Object} pedido
 * @param {Array} renglones
 * @returns {Promise<Blob>} PDF Blob
 */
export async function buildTicketPdfBlob({ pedido, renglones }) {
  if (!pedido) return new Blob([], { type: "application/pdf" });

  // ===== preparar texto (para estimar altura) =====
  const nombre = String(pedido?.cliente_nombre || "").trim() || "Cliente";
  const fechaPedidoISO = pedido.fecha_creacion || pedido.created_at || "";
  const urgente = Boolean(pedido.urgente);

  const total =
    pedido.total_final ??
    pedido.total ??
    pedido.total_calculado ??
    pedido.total_bruto ??
    0;

  const anticipo = Number(pedido.anticipo || 0);
  const liquidacion = Number(pedido.liquidacion || 0);
  const totalPagado = Number(pedido.total_pagado || 0);
  const resta = Number(pedido.resta || 0);
  const pagado = Boolean(pedido.pagado) || resta <= 0;

  const detalleLines = [];
  if (Array.isArray(renglones) && renglones.length) {
    renglones.forEach((d) => {
      const tam = d.tamano || d.detalle_tamano || "—";
      const cant = d.cantidad != null ? `(${d.cantidad})` : "";
      const tipo = d.tipo || "—";
      const papel = d.papel || "—";
      const toma = d.n_toma ? ` · Toma ${d.n_toma}` : "";

      detalleLines.push(`${tam} ${cant} · ${tipo} · ${papel}${toma}`.trim());

      if (d.especificaciones) detalleLines.push(`Esp: ${d.especificaciones}`);
      if (d.ropa) detalleLines.push(`Ropa: ${d.ropa}`);
      detalleLines.push(""); // espacio entre renglones
    });
  } else {
    detalleLines.push("(Sin renglones)");
  }

  const allLinesCount =
    10 + // header aprox
    detalleLines.length +
    10; // totales + footer

  // ===== cargar logo real (embebido) =====
  const { dataUrl, w: imgWpx, h: imgHpx } = await loadImageData(logoUrl);

  // ===== layout 58mm =====
  const paperW = 58; // mm
  const marginX = 3; // mm
  const maxW = paperW - marginX * 2;

  // Opción C: logo GRANDE, casi ancho completo
  const logoW = Math.min(52, maxW);
  const ratio = imgHpx / imgWpx;
  const logoH = logoW * ratio; // mantiene proporción (NO estira)

  // alto dinámico
  const paperH = estimateHeightMm({ logoH, linesCount: allLinesCount });

  const doc = new jsPDF({
    unit: "mm",
    format: [paperW, paperH],
  });

  // ===== dibujar logo =====
  const xLogo = (paperW - logoW) / 2;
  let y = 5;

  // Si tu logo es PNG con fondo negro y RAWBT lo “mancha”, puedes cambiarlo por PNG fondo blanco.
  doc.addImage(dataUrl, "PNG", xLogo, y, logoW, logoH);

  y += logoH + 3;

  // ===== encabezado =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("FOTO RAMIREZ", paperW / 2, y + 6, { align: "center" });
  y += 10;

  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.line(marginX, y, paperW - marginX, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  doc.text(`Cliente: ${nombre.toUpperCase()}`, marginX, y);
  y += 5;

  const fechaPedido = fmtDateTimeMX(fechaPedidoISO);
  if (fechaPedido) {
    doc.text(`Fecha de pedido: ${fechaPedido}`, marginX, y);
    y += 5;
  }

  if (urgente) {
    doc.text(`Entrega: 15 a 20 minutos`, marginX, y);
    y += 5;
  } else {
    const f = fmtDate(pedido.fecha_entrega);
    const h = fmtTime(pedido.horario_entrega);
    doc.text(`Entrega: ${f || "(pendiente)"} ${h || ""}`.trim(), marginX, y);
    y += 5;
  }

  y += 2;
  doc.line(marginX, y, paperW - marginX, y);
  y += 6;

  // ===== detalle =====
  doc.setFont("helvetica", "bold");
  doc.text("DETALLE", marginX, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  // texto con wrap automático
  const wrapWidth = maxW;
  const addWrappedLine = (text, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(String(text || ""), wrapWidth);
    lines.forEach((ln) => {
      doc.text(ln, marginX, y);
      y += 5;
    });
  };

  detalleLines.forEach((ln) => {
    if (!ln) {
      y += 2;
      return;
    }
    addWrappedLine(ln, false);
  });

  y += 2;
  doc.line(marginX, y, paperW - marginX, y);
  y += 7;

  // ===== totales =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`TOTAL: ${money(total)}`, marginX, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  if (!pagado) {
    if (anticipo > 0) {
      doc.text(`Anticipo: ${money(anticipo)}`, marginX, y);
      y += 5;
    }
    if (totalPagado > 0) {
      doc.text(`Total pagado: ${money(totalPagado)}`, marginX, y);
      y += 5;
    }
    if (liquidacion > 0) {
      doc.text(`Liquidación: ${money(liquidacion)}`, marginX, y);
      y += 5;
    }
    doc.text(`Resta: ${money(resta)}`, marginX, y);
    y += 5;
    doc.text(`Estatus: PENDIENTE`, marginX, y);
    y += 6;
  } else {
    doc.text(`Estatus: PAGADO`, marginX, y);
    y += 6;
  }

  y += 2;
  doc.line(marginX, y, paperW - marginX, y);
  y += 8;

  // ===== footer =====
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Gracias por su preferencia", paperW / 2, y, { align: "center" });
  y += 5;
  doc.text("Foto Ramirez", paperW / 2, y, { align: "center" });

  // blob final
  return doc.output("blob");
}
