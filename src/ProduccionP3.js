import React, { useMemo, useState } from "react";
import P3Dashboard from "./P3Dashboard";
import P3Lista from "./P3Lista";
import P3Detalle from "./P3Detalle";

/**
 * FOTO RAMÍREZ · PRODUCCIÓN (P3)
 * - Navegación: dashboard -> lista -> detalle
 * - UI: estilo Foto Ramírez (crema + dorado + azul gris suave) sin oscurecer “Inicio”
 * - Todo encapsulado dentro de .p3Root (no toca body global)
 */

export default function ProduccionP3({ onBack }) {
  const [screen, setScreen] = useState("dashboard");
  const [categoria, setCategoria] = useState(null); // URGENTE | HOY | GENERAL
  const [pedidoId, setPedidoId] = useState(null);

  const goDashboard = () => {
    setScreen("dashboard");
    setCategoria(null);
    setPedidoId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goLista = (cat) => {
    setCategoria(cat);
    setScreen("lista");
    setPedidoId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goDetalle = (id) => {
    setPedidoId(id);
    setScreen("detalle");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const breadcrumb = useMemo(() => {
    if (screen === "dashboard") return ["Inicio"];
    if (screen === "lista") return ["Inicio", categoria || "Lista"];
    return ["Inicio", categoria || "Lista", "Detalle"];
  }, [screen, categoria]);

  const catBadge = useMemo(() => {
    if (screen === "dashboard") return null;
    const c = String(categoria || "").toUpperCase();
    if (c === "URGENTE") return { label: "URGENTE", cls: "badgeAmber" };
    if (c === "HOY") return { label: "HOY", cls: "badgeAqua" };
    return { label: c || "GENERAL", cls: "badgeSlate" };
  }, [screen, categoria]);

  const headerTitle = useMemo(() => {
    if (screen === "dashboard") return "PRODUCCIÓN";
    if (screen === "lista") return "LISTA";
    return "DETALLE";
  }, [screen]);

  const headerSub = useMemo(() => {
    if (screen === "dashboard")
      return "Selecciona categoría y avanza producción.";
    if (screen === "lista")
      return "Abre un pedido para ver tomas y especificaciones.";
    return "Revisa detalle y avanza el flujo de producción.";
  }, [screen]);

  return (
    <div className="p3Root">
      <style>{`
        :root{
          /* Base Foto Ramírez (más claro en Inicio) */
          --bg1:#0C1117;
          --bg2:#101823;

          --card: rgba(255,255,255,0.05);
          --card2: rgba(255,255,255,0.035);
          --border: rgba(255,255,255,0.14);
          --text:#EAF2F2;

          /* Dorado institucional */
          --gold:#D6B46A;
          --goldBorder: rgba(214,180,106,0.58);
          --goldGlow: rgba(214,180,106,0.22);

          /* Crema */
          --cream1: rgba(250,248,242,0.96);
          --cream2: rgba(238,234,226,0.92);

          /* Azul gris (marca) */
          --slate:#5F7C8A;
          --slateText: rgba(92,122,138,0.95);
          --slateBorder: rgba(95,124,138,0.60);
          --slateBg: rgba(95,124,138,0.14);

          /* Aqua (detalles) */
          --aqua:#27E0D6;
          --aquaBorder: rgba(39,224,214,0.44);
          --aquaBg: rgba(39,224,214,0.11);

          /* Amber (urgente) */
          --amber:#FFD166;
          --amberBorder: rgba(255,209,102,0.40);
          --amberBg: rgba(255,209,102,0.14);

          /* Negro elegante para botones secundarios */
          --blackBtn: rgba(0,0,0,0.68);
          --blackBtn2: rgba(0,0,0,0.40);
        }

        *{ box-sizing:border-box; }
        .p3Root{
          max-width: 760px;
          margin: 0 auto;
          padding: 12px 12px 24px;
          color: var(--text);
        }

        /* Fondo suave SOLO para P3 (no body) */
        .p3Backdrop{
          border-radius: 20px;
          padding: 10px 10px 18px;
          background:
            radial-gradient(900px 320px at 18% 0%, rgba(214,180,106,0.18), transparent 58%),
            radial-gradient(800px 260px at 90% 10%, rgba(95,124,138,0.20), transparent 55%),
            linear-gradient(180deg, rgba(16,24,35,0.55), rgba(12,17,23,0.15));
          border: 1px solid rgba(255,255,255,0.06);
        }

        .p3Header{
          position: sticky;
          top: 0;
          z-index: 50;
          padding-top: 8px;
          padding-bottom: 10px;
          backdrop-filter: blur(10px);
          background: linear-gradient(180deg, rgba(12,17,23,0.55), rgba(12,17,23,0.15));
        }

        .hdrCard{
          border: 1px solid var(--border);
          background: linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03));
          border-radius: 18px;
          padding: 12px;
          box-shadow: 0 14px 40px rgba(0,0,0,0.22);
          overflow: hidden;
          position: relative;
        }

        /* Glow dorado + azul gris (más “Foto Ramírez”, menos oscuro) */
        .hdrCard::before{
          content:"";
          position:absolute;
          inset: -2px;
          background:
            radial-gradient(900px 260px at 18% 0%, var(--goldGlow), transparent 58%),
            radial-gradient(740px 240px at 92% 8%, rgba(95,124,138,0.22), transparent 55%);
          pointer-events:none;
        }

        .hdrTop{
          display:flex;
          align-items:center;
          gap:10px;
        }

        .brandDot{
          width: 12px;
          height: 12px;
          border-radius: 999px;
          border: 2px solid var(--goldBorder);
          background: linear-gradient(135deg, var(--cream1), var(--cream2));
          box-shadow: 0 0 0 6px rgba(214,180,106,0.12);
          flex: 0 0 auto;
        }

        .hdrTitles{ min-width:0; }
        .hdrTitle{
          font-weight: 980;
          letter-spacing: .7px;
          font-size: 16px;
          text-transform: uppercase;
          line-height: 1.05;
        }
        .hdrSub{
          margin-top: 6px;
          opacity: .80;
          font-size: 12px;
          line-height: 1.35;
        }

        .hdrRight{
          margin-left:auto;
          display:flex;
          align-items:center;
          gap:8px;
          flex-wrap:wrap;
          justify-content:flex-end;
        }

        .badge{
          font-size: 12px;
          padding: 8px 10px;
          border-radius: 999px;
          border:1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.05);
          display:inline-flex;
          align-items:center;
          gap:8px;
          max-width:100%;
          overflow-wrap:anywhere;
          font-weight: 900;
          letter-spacing: .2px;
          text-transform: uppercase;
        }
        .badgeAqua{ border-color: var(--aquaBorder); background: var(--aquaBg); }
        .badgeAmber{ border-color: var(--amberBorder); background: var(--amberBg); }
        .badgeSlate{ border-color: var(--slateBorder); background: var(--slateBg); color: rgba(205,225,235,0.92); }

        .btn{
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.16);
          background: rgba(255,255,255,0.06);
          color: var(--text);
          font-weight: 950;
          font-size: 14px;
          cursor: pointer;
          display:inline-flex;
          align-items:center;
          gap:8px;
          transition: transform 120ms ease, filter 120ms ease, background 120ms ease;
          user-select:none;
          -webkit-tap-highlight-color: transparent;
        }
        .btn:active{ transform: scale(0.985); filter: brightness(1.05); }

        /* Botón negro elegante (menos oscuro que antes) */
        .btnBack{
          border: 2px solid rgba(255,255,255,0.14);
          background: linear-gradient(180deg, var(--blackBtn), var(--blackBtn2));
          color: rgba(210,230,240,0.92);
        }

        /* ✅ INICIO — estilo Foto Ramírez (crema + borde dorado + letras azul gris) */
        .btnHome{
          border: 2px solid var(--goldBorder);
          background: linear-gradient(135deg, var(--cream1), var(--cream2));
          color: var(--slateText);
          font-weight: 980;
          letter-spacing: .3px;
          box-shadow: 0 0 0 0 rgba(0,0,0,0);
        }
        .btnHome:hover{
          filter: brightness(1.03);
        }

        .crumbRow{
          margin-top: 10px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          flex-wrap: wrap;
        }

        .crumb{
          display:flex;
          align-items:center;
          gap:8px;
          flex-wrap:wrap;
          opacity:.88;
          font-size: 12px;
        }
        .crumb b{ opacity:1; }
        .sep{ opacity:.45; }

        .contentWrap{
          animation: fadeUp 240ms ease-out 1;
          transform-origin: top center;
          margin-top: 8px;
        }
        @keyframes fadeUp{
          from{ opacity: .0; transform: translateY(6px); }
          to{ opacity: 1; transform: translateY(0px); }
        }

        @media (max-width:560px){
          .p3Root{ padding: 10px 10px 20px; }
          .btn{ width:auto; }
          .hdrRight{ gap:6px; }
        }
      `}</style>

      <div className="p3Backdrop">
        {/* Header */}
        <div className="p3Header">
          <div className="hdrCard">
            <div className="hdrTop">
              <div className="brandDot" />

              <div className="hdrTitles">
                <div className="hdrTitle">Foto Ramírez · {headerTitle}</div>
                <div className="hdrSub">{headerSub}</div>
              </div>

              <div className="hdrRight">
                {onBack ? (
                  <button
                    className="btn btnBack"
                    onClick={onBack}
                    title="Volver"
                  >
                    ←
                  </button>
                ) : (
                  <button
                    className="btn btnBack"
                    onClick={goDashboard}
                    title="Ir a inicio"
                  >
                    ⟲
                  </button>
                )}

                {catBadge ? (
                  <div className={`badge ${catBadge.cls}`}>
                    {catBadge.label}
                  </div>
                ) : (
                  <div className="badge badgeSlate">P3</div>
                )}

                {screen !== "dashboard" && (
                  <button className="btn btnHome" onClick={goDashboard}>
                    Inicio
                  </button>
                )}
              </div>
            </div>

            <div className="crumbRow">
              <div className="crumb">
                {breadcrumb.map((x, i) => (
                  <span key={`${x}-${i}`}>
                    {i === breadcrumb.length - 1 ? <b>{x}</b> : x}
                    {i < breadcrumb.length - 1 ? (
                      <span className="sep"> · </span>
                    ) : null}
                  </span>
                ))}
              </div>

              <div className="badge badgeSlate" style={{ opacity: 0.95 }}>
                {screen === "dashboard"
                  ? "Elige categoría"
                  : screen === "lista"
                  ? "Abre un pedido"
                  : "Revisa y avanza"}
              </div>
            </div>
          </div>
        </div>

        {/* Screens */}
        <div className="contentWrap">
          {screen === "dashboard" && <P3Dashboard onOpenCategoria={goLista} />}

          {screen === "lista" && (
            <P3Lista
              categoria={categoria}
              onBack={goDashboard}
              onOpenPedido={goDetalle}
            />
          )}

          {screen === "detalle" && (
            <P3Detalle pedidoId={pedidoId} onBack={() => setScreen("lista")} />
          )}
        </div>
      </div>
    </div>
  );
}
