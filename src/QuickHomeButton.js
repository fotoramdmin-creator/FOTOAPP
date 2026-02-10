// src/QuickHomeButton.js
import React, { useState } from "react";

export default function QuickHomeButton({ onHome, side = "left" }) {
  const [hover, setHover] = useState(false);

  const isLeft = side === "left";

  return (
    <button
      onClick={onHome}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "fixed",
        top: "45%",
        zIndex: 9999,
        ...(isLeft ? { left: 0 } : { right: 0 }),

        transform: hover
          ? "translateX(0)"
          : isLeft
          ? "translateX(-62%)"
          : "translateX(62%)",

        border: "1px solid rgba(0,160,150,0.45)",
        background: hover ? "rgba(0,180,170,0.28)" : "rgba(0,180,170,0.15)",

        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",

        borderRadius: isLeft ? "0 12px 12px 0" : "12px 0 0 12px",
        padding: "10px 14px",

        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.6,

        color: "rgba(0,120,115,0.9)",
        cursor: "pointer",
      }}
      aria-label="Ir a Inicio"
      title="Inicio"
    >
      INICIO
    </button>
  );
}
