// src/ticketCortePdf.js
import { jsPDF } from "jspdf";
import defaultLogo from "./assets/logo.png";

// ========= Helpers =========
const fmtMoney = (n) => {
  const x = Number(n || 0);
  if (!isFinite(x)) return "$0.00";
  return x.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
};

const fmtDia = (dia) => {
  if (!dia) return "";
  try {
    const d = dia instanceof Date ? dia : new Date(dia);
    if (isNaN(d.getTime())) return String(dia);
    return d.toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "2-digit",
    });
  } catch {
    return String(dia);
  }
};

const loadImageInfo = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        w: img.naturalWidth || img.width,
        h: img.naturalHeight || img.height,
      });
    img.onerror = reject;
    img.src = src;
  });

const imageToDataURL = async (src) => {
  const res = await fetch(src, { cache: "no-store" });
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
};

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return url; // por si se quiere abrir también
};

const openOrNavigateWindow = (url, win) => {
  try {
    if (win && !win.closed) {
      win.location.href = url;
      return true;
    }
  } catch {}
  try {
    const w2 = window.open(url, "_blank", "noopener,noreferrer");
    return !!w2;
  } catch {
    return false;
  }
};

// ========= Layout =========
function buildLayout(
  { dia, entradas, ingresos, salidas, neto, caja, aRetirar },
  doc
) {
  const PAGE_W = 58;
  const M = 4;
  const contentW = PAGE_W - M * 2;

  const TITLE_SIZE = 12;
  const BODY_SIZE = 10;
  const SMALL_SIZE = 8.8;

  const LH = 4.6;
  const GAP_SM = 2.0;
  const GAP_MD = 3.0;

  const HR_PAD_TOP = 3.2;
  const HR_PAD_BOT = 4.2;
  const HR_AFTER_JUMP = 1.4;

  const ent = Number(
    ingresos !== undefined && ingresos !== null ? ingresos : entradas
  );
  const entSafe = isFinite(ent) ? ent : 0;

  const sal = Number(salidas || 0);
  const salSafe = isFinite(sal) ? sal : 0;

  const net = Number(
    neto !== undefined && neto !== null ? neto : entSafe - salSafe
  );
  const netSafe = isFinite(net) ? net : 0;

  const cajaNum = Number(caja || 0);
  const cajaSafe = isFinite(cajaNum) ? cajaNum : 0;

  const ret =
    aRetirar !== undefined && aRetirar !== null
      ? Number(aRetirar)
      : netSafe - cajaSafe;
  const retSafe = isFinite(ret) ? ret : netSafe - cajaSafe;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(TITLE_SIZE);
  const titleLines = doc.splitTextToSize("CORTE DE CAJA", contentW);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(SMALL_SIZE);
  const diaLabel = fmtDia(dia);
  const diaLines = doc.splitTextToSize(
    diaLabel ? `Día: ${diaLabel}` : "",
    contentW
  );

  doc.setFontSize(BODY_SIZE);

  const rows = [
    ["Entradas", fmtMoney(entSafe)],
    ["Salidas", fmtMoney(salSafe)],
    ["Neto", fmtMoney(netSafe)],
    ["Caja", fmtMoney(cajaSafe)],
    ["A retirar", fmtMoney(retSafe)],
  ];

  return {
    PAGE_W,
    M,
    contentW,
    TITLE_SIZE,
    BODY_SIZE,
    SMALL_SIZE,
    LH,
    GAP_SM,
    GAP_MD,
    HR_PAD_TOP,
    HR_PAD_BOT,
    HR_AFTER_JUMP,
    titleLines,
    diaLines: diaLabel ? diaLines : [],
    rows,
  };
}

function computeNeededHeight(layout, logoDimsMm) {
  const {
    M,
    LH,
    GAP_SM,
    GAP_MD,
    HR_PAD_TOP,
    HR_PAD_BOT,
    HR_AFTER_JUMP,
    titleLines,
    diaLines,
    rows,
  } = layout;

  let h = 0;
  h += M;

  if (logoDimsMm?.h) h += logoDimsMm.h + GAP_MD;

  h += titleLines.length * LH + GAP_SM;

  if (diaLines.length) h += diaLines.length * (LH - 0.6) + GAP_MD;
  else h += GAP_SM;

  h += HR_PAD_TOP + 0.4 + HR_PAD_BOT + HR_AFTER_JUMP;

  h += rows.length * (LH + 0.8);

  h += GAP_MD;
  h += HR_PAD_TOP + 0.4 + HR_PAD_BOT + HR_AFTER_JUMP;

  h += (LH - 0.8) * 2;

  h += M;

  return Math.max(96, Math.ceil(h));
}

function makeLeaderDots(doc, availableMm) {
  if (availableMm <= 0) return "";
  const dotW = doc.getTextWidth(".");
  if (!dotW) return "";
  const n = Math.floor(availableMm / dotW);
  if (n <= 0) return "";
  return ".".repeat(Math.min(n, 120));
}

function hr(doc, x1, x2, y) {
  doc.setDrawColor(0);
  doc.setLineWidth(0.25);
  doc.line(x1, y, x2, y);
}

function drawTicket(doc, layout, logoDataUrl, logoDimsMm) {
  const {
    PAGE_W,
    M,
    TITLE_SIZE,
    BODY_SIZE,
    SMALL_SIZE,
    LH,
    GAP_SM,
    GAP_MD,
    HR_PAD_TOP,
    HR_PAD_BOT,
    HR_AFTER_JUMP,
    titleLines,
    diaLines,
    rows,
  } = layout;

  let y = M;

  if (logoDataUrl && logoDimsMm?.w && logoDimsMm?.h) {
    const x = (PAGE_W - logoDimsMm.w) / 2;
    doc.addImage(logoDataUrl, "PNG", x, y, logoDimsMm.w, logoDimsMm.h);
    y += logoDimsMm.h + GAP_MD;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(TITLE_SIZE);
  titleLines.forEach((line) => {
    const tw = doc.getTextWidth(line);
    doc.text(line, (PAGE_W - tw) / 2, y);
    y += LH;
  });
  y += GAP_SM;

  if (diaLines.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(SMALL_SIZE);
    diaLines.forEach((line) => {
      doc.text(line, M, y);
      y += LH - 0.6;
    });
    y += GAP_MD;
  }

  y += HR_PAD_TOP;
  hr(doc, M, PAGE_W - M, y);
  y += HR_PAD_BOT + HR_AFTER_JUMP;

  const valueRightX = PAGE_W - M;
  const valuePadding = 2.0;

  rows.forEach(([label, value], idx) => {
    const isStrong = idx === rows.length - 1;

    doc.setFont("helvetica", isStrong ? "bold" : "normal");
    doc.setFontSize(isStrong ? BODY_SIZE + 0.8 : BODY_SIZE);

    const labelW = doc.getTextWidth(label);
    const valueW = doc.getTextWidth(value);

    const valueLeftX = valueRightX - valueW;
    const dotsStartX = M + labelW + 1.8;
    const dotsEndX = valueLeftX - valuePadding;

    const available = Math.max(0, dotsEndX - dotsStartX);
    const dotsStr = makeLeaderDots(doc, available);

    doc.text(label, M, y);
    if (dotsStr) doc.text(dotsStr, dotsStartX, y);
    doc.text(value, valueRightX, y, { align: "right" });

    y += LH + 0.8;
  });

  y += GAP_MD;
  y += HR_PAD_TOP;
  hr(doc, M, PAGE_W - M, y);
  y += HR_PAD_BOT + HR_AFTER_JUMP;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);

  const now = new Date().toLocaleString("es-MX");
  const footer1 = "FOTO RAMÍREZ";
  const footer2 = `Generado: ${now}`;

  const f1w = doc.getTextWidth(footer1);
  doc.text(footer1, (PAGE_W - f1w) / 2, y);
  y += LH - 0.8;

  doc.text(footer2, M, y);
}

// ========= Public API =========
// ✅ PASA targetWindow si abriste la pestaña antes (para evitar bloqueos)
export async function imprimirTicketCorte({
  dia,
  entradas,
  ingresos,
  salidas,
  neto,
  caja = 0,
  aRetirar,
  logoSrc,
  targetWindow, // ✅ NUEVO
}) {
  try {
    let logoDataUrl = null;
    let logoDimsMm = null;

    const chosenLogo = logoSrc || defaultLogo;

    try {
      const [info, dataUrl] = await Promise.all([
        loadImageInfo(chosenLogo),
        imageToDataURL(chosenLogo),
      ]);
      logoDataUrl = dataUrl;

      const maxW = 44;
      const maxH = 20;
      const ratio = info.w / info.h;

      let w = maxW;
      let h = w / ratio;

      if (h > maxH) {
        h = maxH;
        w = h * ratio;
      }

      logoDimsMm = { w: Number(w.toFixed(2)), h: Number(h.toFixed(2)) };
    } catch {
      logoDataUrl = null;
      logoDimsMm = null;
    }

    const tmp = new jsPDF({ unit: "mm", format: [58, 320], compress: true });
    const layout = buildLayout(
      { dia, entradas, ingresos, salidas, neto, caja, aRetirar },
      tmp
    );
    const neededH = computeNeededHeight(layout, logoDimsMm);

    const doc = new jsPDF({
      unit: "mm",
      format: [58, neededH],
      compress: true,
    });

    const layoutFinal = buildLayout(
      { dia, entradas, ingresos, salidas, neto, caja, aRetirar },
      doc
    );
    drawTicket(doc, layoutFinal, logoDataUrl, logoDimsMm);

    const blob = doc.output("blob");
    const filename = "corte-caja.pdf";

    // ✅ 1) Descarga forzada SIEMPRE
    const blobUrl = triggerDownload(blob, filename);

    // ✅ 2) Si abriste pestaña antes, la navega (esto sí pasa bloqueos)
    openOrNavigateWindow(blobUrl, targetWindow);

    // ✅ 3) Share (si existe) como extra (no estorba)
    try {
      const file = new File([blob], filename, { type: "application/pdf" });
      const canShareFiles =
        !!navigator.share &&
        !!navigator.canShare &&
        (() => {
          try {
            return navigator.canShare({ files: [file] });
          } catch {
            return false;
          }
        })();

      if (canShareFiles) {
        await navigator.share({
          files: [file],
          title: "Corte de caja",
          text: "Ticket de corte de caja",
        });
      }
    } catch {
      // no pasa nada
    }
  } catch (err) {
    console.error("Error al generar ticket de corte:", err);
    alert("No se pudo generar el ticket. Revisa consola para ver el error.");
    try {
      if (targetWindow && !targetWindow.closed) targetWindow.close();
    } catch {}
  }
}
