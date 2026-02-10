// src/ticket/ticketBuilder.js

function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  });
}

function formatDate(date) {
  if (!date) return "";
  try {
    return String(date).slice(0, 10);
  } catch {
    return "";
  }
}

function formatTime(time) {
  if (!time) return "";
  return String(time).slice(0, 5);
}

/**
 * Construye el texto del ticket térmico
 * @param {Object} pedido - datos del pedido (tabla pedidos)
 * @param {Array} renglones - detalles del pedido
 * @returns {string}
 */
export function buildTicketText({ pedido, renglones }) {
  if (!pedido) return "";

  const lines = [];

  // =========================
  // ENCABEZADO
  // =========================
  lines.push("FOTO RAMIREZ");
  lines.push("------------------------------");

  // Cliente
  if (pedido.cliente_nombre) {
    lines.push(`Cliente: ${String(pedido.cliente_nombre).toUpperCase()}`);
  }

  // Fecha del pedido
  const fechaPedido = pedido.fecha_creacion || pedido.created_at || null;
  if (fechaPedido) {
    lines.push(`Fecha pedido: ${formatDate(fechaPedido)}`);
  }

  lines.push("");

  // =========================
  // ENTREGA
  // =========================
  if (pedido.urgente) {
    lines.push("Entrega: 15 a 20 minutos");
  } else {
    const f = formatDate(pedido.fecha_entrega);
    const h = formatTime(pedido.horario_entrega);
    if (f || h) {
      lines.push(`Entrega: ${f}${h ? " " + h : ""}`);
    }
  }

  lines.push("");
  lines.push("DETALLE");
  lines.push("------------------------------");

  // =========================
  // DETALLE DE RENG LONES
  // =========================
  if (Array.isArray(renglones) && renglones.length > 0) {
    renglones.forEach((d) => {
      const tamano = d.tamano || d.detalle_tamano || "";
      const cantidad = d.cantidad != null ? `(${d.cantidad})` : "";
      const tipo = d.tipo || "";
      const papel = d.papel || "";
      const toma = d.n_toma ? ` Toma:${d.n_toma}` : "";

      lines.push(`${tamano} ${cantidad} ${tipo} ${papel}${toma}`.trim());

      if (d.especificaciones) {
        lines.push(`  ${d.especificaciones}`);
      }
      if (d.ropa) {
        lines.push(`  Ropa: ${d.ropa}`);
      }
    });
  } else {
    lines.push("Sin renglones");
  }

  lines.push("");
  lines.push("------------------------------");

  // =========================
  // TOTALES / PAGOS
  // =========================
  const total =
    pedido.total_final ?? pedido.total ?? pedido.total_calculado ?? 0;

  const anticipo = Number(pedido.anticipo || 0);
  const liquidacion = Number(pedido.liquidacion || 0);
  const totalPagado = Number(pedido.total_pagado || 0);
  const resta = Number(pedido.resta || 0);
  const pagado = Boolean(pedido.pagado) || resta <= 0;

  lines.push(`TOTAL: ${money(total)}`);

  if (pagado) {
    lines.push("ESTATUS: PAGADO");
  } else {
    if (anticipo > 0) {
      lines.push(`ANTICIPO: ${money(anticipo)}`);
    }
    if (liquidacion > 0) {
      lines.push(`LIQUIDACION: ${money(liquidacion)}`);
    }
    if (totalPagado > 0) {
      lines.push(`TOTAL PAGADO: ${money(totalPagado)}`);
    }
    lines.push(`RESTA: ${money(resta)}`);
  }

  lines.push("");
  lines.push("------------------------------");
  lines.push("Gracias por su preferencia");
  lines.push("Foto Ramirez");

  return lines.join("\n");
}
