// src/App.js
import React, { useState } from "react";

/* ✅ LOGIN */
import LoginVista from "./LoginVista";

/* 🔹 MENÚ (archivo alterno por bug de CodeSandbox) */
import Menu from "./MenuX";

/* 🔹 VISTAS EXISTENTES */
import TomaPedidos from "./TomaPedidos";
import OrdenEnCursoP2 from "./OrdenEnCursoP2";
import ProduccionP3 from "./ProduccionP3";

/* 🔹 ENTREGA */
import EntregaVista from "./EntregaVista";

/* ✅ BÚSQUEDA / ARCHIVO */
import BusquedaVista from "./BusquedaVista";
import ArchivoVista from "./ArchivoVista";

/* ✅ CUENTAS */
import CuentasVista from "./CuentasVista";
import CuentasDetalleVista from "./CuentasDetalleVista";

/* ✅ RETIRO (PRIVADO) */
import RetiroCajaVista from "./RetiroCajaVista";

/* ✅ CONFIGURACIÓN (NUEVO) */
import ConfiguracionVista from "./ConfiguracionVista";

/* 🔹 QUICK HOME */
import QuickHomeButton from "./QuickHomeButton";

/* 🔹 (opcionales, si los sigues usando por separado) */
import P3Dashboard from "./P3Dashboard";
import P3Lista from "./P3Lista";
import P3Detalle from "./P3Detalle";

export default function App() {
  // ✅ Arranca en login. Si ya hay sesión guardada, brinca a menú.
  const [vista, setVista] = useState(() => {
    try {
      const s = JSON.parse(sessionStorage.getItem("FR_SESSION") || "null");
      return s?.id ? "menu" : "login";
    } catch {
      return "login";
    }
  });

  // ✅ Sesión en memoria
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("FR_SESSION") || "null");
    } catch {
      return null;
    }
  });

  // 🔐 Esto fuerza que CUENTAS pida PIN cada vez que entras desde MENÚ
  const [cuentasKey, setCuentasKey] = useState(0);

  // Para navegar a detalle de un día
  const [cuentasDia, setCuentasDia] = useState(null);

  const Wrap = ({ children }) => (
    <div style={{ minHeight: "100vh" }}>{children}</div>
  );

  // ✅ Cerrar sesión (borra sesión + pin ok)
  const logout = () => {
    sessionStorage.removeItem("FR_SESSION");
    sessionStorage.removeItem("FR_PIN_OK");
    setSession(null);
    setCuentasKey(0);
    setCuentasDia(null);
    setVista("login");
  };

  // ✅ ENTRAR A CUENTAS DESDE MENÚ (aquí se incrementa el key)
  const openCuentas = () => {
    setCuentasKey((k) => k + 1);
    setVista("cuentas");
  };

  // ✅ ABRIR DETALLE (NO incrementa key)
  const openCuentasDetalle = (dia) => {
    setCuentasDia(dia);
    setVista("cuentas_detalle");
  };

  // ✅ REGRESAR DE DETALLE A CUENTAS (NO incrementa key)
  const backToCuentas = () => setVista("cuentas");

  return (
    <Wrap>
      {/* ✅ LOGIN */}
      {vista === "login" && (
        <LoginVista
          onLogin={(sess) => {
            setSession(sess);
            setVista("menu");
          }}
        />
      )}

      {/* ✅ QUICK GLOBAL (se ve en TODAS excepto LOGIN y MENU) */}
      {vista !== "menu" && vista !== "login" && (
        <div style={{ position: "fixed", top: 12, left: 12, zIndex: 9999 }}>
          <div
            onClickCapture={() => setVista("menu")}
            style={{ cursor: "pointer" }}
          >
            <QuickHomeButton />
          </div>
        </div>
      )}

      {/* ✅ MENÚ */}
      {vista === "menu" && (
        <Menu
          setVista={(key) => {
            // Si en el menú eligen CUENTAS, usamos openCuentas()
            if (key === "cuentas") return openCuentas();

            // Si el menú manda logout (por seguridad)
            if (key === "__logout__") return logout();

            setVista(key);
          }}
          session={session}
        />
      )}

      {/* ✅ TOMA PEDIDOS */}
      {vista === "toma" && <TomaPedidos setVista={setVista} />}

      {/* ✅ ORDEN EN CURSO (P2) */}
      {vista === "orden" && <OrdenEnCursoP2 setVista={setVista} />}

      {/* ✅ PRODUCCIÓN (P3) */}
      {vista === "p3" && <ProduccionP3 setVista={setVista} />}

      {/* ✅ ENTREGA */}
      {vista === "entrega" && <EntregaVista />}

      {/* ✅ BÚSQUEDA */}
      {vista === "busqueda" && <BusquedaVista />}

      {/* ✅ ARCHIVO */}
      {vista === "archivo" && <ArchivoVista />}

      {/* ✅ CUENTAS (corte diario) */}
      {vista === "cuentas" && (
        <CuentasVista
          cuentasKey={cuentasKey}
          onOpenDetalle={openCuentasDetalle}
        />
      )}

      {/* ✅ CUENTAS DETALLE */}
      {vista === "cuentas_detalle" && (
        <CuentasDetalleVista dia={cuentasDia} onBack={backToCuentas} />
      )}

      {/* ✅ RETIRO DE CAJA (PRIVADO) */}
      {vista === "retiro" && (
        <RetiroCajaVista session={session} onBack={() => setVista("menu")} />
      )}

      {/* ✅ CONFIGURACIÓN (REAL) */}
      {vista === "config" && (
        <ConfiguracionVista session={session} onBack={() => setVista("menu")} />
      )}

      {/* 🔹 OPCIONALES (si los usas por separado) */}
      {vista === "p3_dashboard" && <P3Dashboard setVista={setVista} />}
      {vista === "p3_lista" && <P3Lista setVista={setVista} />}
      {vista === "p3_detalle" && <P3Detalle setVista={setVista} />}

      {/* 🔹 PLACEHOLDERS (NO rompen si aún no existen vistas reales) */}
      {vista === "servicios" && (
        <div style={{ padding: 16 }}>
          <h2>Servicios</h2>
          <button onClick={() => setVista("menu")}>⬅️ Volver</button>
        </div>
      )}

      {/* 🔹 FALLBACK */}
      {[
        "login",
        "menu",
        "toma",
        "orden",
        "p3",
        "entrega",
        "busqueda",
        "archivo",
        "cuentas",
        "cuentas_detalle",
        "retiro",
        "config",
        "p3_dashboard",
        "p3_lista",
        "p3_detalle",
        "servicios",
      ].includes(vista) ? null : (
        <div style={{ padding: 16 }}>
          <h2>Vista no encontrada</h2>
          <div>
            Valor actual: <b>{vista}</b>
          </div>
          <button onClick={() => setVista("menu")}>⬅️ Volver</button>
        </div>
      )}
    </Wrap>
  );
}
