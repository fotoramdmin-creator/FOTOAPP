// src/ticket/printRawbt.js

/**
 * Abre RAWBT (Android) con un texto para previsualizar / imprimir.
 * Requiere que RAWBT esté instalada.
 *
 * NOTA: RAWBT suele aceptar texto por intent URI.
 * Si por tu versión no abre, te doy el plan B (compartir/copiar).
 */
export function openRawbtWithText(text) {
  const t = String(text || "").trim();
  if (!t) {
    alert("No hay contenido de ticket.");
    return;
  }

  // 1) Intent para RAWBT (Android)
  const intentUrl =
    "intent:#Intent;scheme=rawbt;" +
    "package=ru.a402d.rawbtprinter;" +
    "S.text=" +
    encodeURIComponent(t) +
    ";end";

  try {
    window.location.href = intentUrl;
  } catch (e) {
    console.warn("RAWBT intent failed:", e);
    alert("No se pudo abrir RAWBT en este dispositivo.");
  }
}

/**
 * Plan B: Copiar al portapapeles (por si RAWBT no abre en tu Android)
 */
export async function copyTicketToClipboard(text) {
  const t = String(text || "").trim();
  if (!t) return;

  try {
    await navigator.clipboard.writeText(t);
    alert("Ticket copiado al portapapeles.");
  } catch {
    alert("No se pudo copiar. Copia manualmente el texto.");
  }
}
