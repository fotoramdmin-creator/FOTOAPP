import React, { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "./supabaseClient";
import logoFR from "./assets/FOTO RAMIREZ NUEVO CUADRO.png";

/**
 * FOTO RAMÍREZ · Toma de pedidos (Mobile first)
 * - Retomar pedidos incompletos (sin pagos)
 * - Insertar detalles directo a detalles_pedido (llenando precio_unitario/subtotal)
 * - Pagos: registrar en tabla pagos y refrescar totales desde pedidos
 */

const STEPS = [
  { id: 0, label: "Usuario" },
  { id: 1, label: "Presupuesto" },
  { id: 2, label: "Cliente" },
  { id: 3, label: "Carrito" },
  { id: 4, label: "Pago" },
];

const PAGO_TIPOS = [
  { value: "A_CUENTA", label: "A cuenta" },
  { value: "LIQUIDACION", label: "Liquidación" },
];

function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function plusMinutesHHMM(min) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + Number(min || 0));
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

const DRAFT_KEY = "foto_ramirez_toma_pedidos_draft_v3";

export default function TomaPedidos() {
  // --- Usuario por CÓDIGO ---
  const [userCode, setUserCode] = useState("1");
  const [usuario, setUsuario] = useState(null);
  const [userStatus, setUserStatus] = useState("Listo.");

  // --- Catálogo ---
  const [catalogStatus, setCatalogStatus] = useState("Cargando catálogo…");
  const [catalogo, setCatalogo] = useState([]);
  const [catalogError, setCatalogError] = useState("");

  // --- Steps ---
  const [step, setStep] = useState(0);

  // --- Presupuesto / Form renglón ---
  const [fTamano, setFTamano] = useState("INFANTIL");
  const [fCantidad, setFCantidad] = useState(6);
  const [fTipo, setFTipo] = useState("COLOR");
  const [fPapel, setFPapel] = useState("MATE");
  const [fKenfor, setFKenfor] = useState(false);
  const [fUrgente, setFUrgente] = useState(false);
  const [fRopa, setFRopa] = useState("");
  const [fEspecificaciones, setFEspecificaciones] = useState("");

  // Especial manual
  const [isManual, setIsManual] = useState(false);
  const [manualDesc, setManualDesc] = useState("Credencial 2.5x3.5");
  const [manualPrecio, setManualPrecio] = useState(75); // ✅ precio del PAQUETE (total del renglón)
  const [manualCantidad, setManualCantidad] = useState(1);

  // --- Carrito ---
  const [carrito, setCarrito] = useState([]);
  const [descuentoPct, setDescuentoPct] = useState(0);

  // ✅ EDIT MODE: guarda qué renglón se está editando
  const [editingLocalId, setEditingLocalId] = useState("");

  // --- Pedido (DB) ---
  const [pedidoId, setPedidoId] = useState(""); // interno (NO se muestra)
  const [pedidoStatus, setPedidoStatus] = useState("");

  // Datos cliente
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState(todayISO());
  const [horaEntrega, setHoraEntrega] = useState("12:30");

  // ✅ FIX TEL
  const telRef = useRef(null);
  const changeRef = useRef(null);
  function getTelefonoActual() {
    const raw =
      (telRef.current && typeof telRef.current.value === "string"
        ? telRef.current.value
        : clienteTelefono) || "";
    return String(raw).trim();
  }

  // --- Pago ---
  const [pagoTipo, setPagoTipo] = useState("A_CUENTA");
  const [pagoMonto, setPagoMonto] = useState("");
  const [pagoNota, setPagoNota] = useState("");
  const [pagoStatus, setPagoStatus] = useState("");
  const [pagos, setPagos] = useState([]);
  const [efectivoRecibido, setEfectivoRecibido] = useState("");

  // ✅ Totales reales desde pedidos
  const [pedidoTotales, setPedidoTotales] = useState(null);

  // --- Retomar (multi-dispositivo) ---
  const [retomarStatus, setRetomarStatus] = useState("");
  const [pedidosIncompletos, setPedidosIncompletos] = useState([]);
  const [pedidosStatus, setPedidosStatus] = useState("");

  // ----------------------------
  // Draft local
  // ----------------------------
  function saveDraft(next = {}) {
    try {
      const draft = {
        step,
        userCode,
        usuario,
        carrito,
        descuentoPct,
        pedidoId,
        clienteNombre,
        clienteTelefono,
        fechaEntrega,
        horaEntrega,
        pagoTipo,
        pagoMonto,
        pagoNota,
        efectivoRecibido,
        editingLocalId,
        ...next,
        _savedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {
      console.warn("No se pudo guardar draft:", e);
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("No se pudo leer draft:", e);
      return null;
    }
  }

  useEffect(() => {
    const d = loadDraft();
    if (!d) return;

    if (typeof d.step === "number") setStep(d.step);
    if (typeof d.userCode === "string") setUserCode(d.userCode);

    if (d.usuario?.id) {
      setUsuario(d.usuario);
      setUserStatus(`✅ Bienvenido, ${d.usuario.nombre}`);
    }

    if (Array.isArray(d.carrito)) setCarrito(d.carrito);
    if (d.descuentoPct != null) setDescuentoPct(d.descuentoPct);

    if (typeof d.pedidoId === "string") setPedidoId(d.pedidoId);

    if (typeof d.clienteNombre === "string") setClienteNombre(d.clienteNombre);
    if (typeof d.clienteTelefono === "string")
      setClienteTelefono(d.clienteTelefono);

    if (typeof d.fechaEntrega === "string") setFechaEntrega(d.fechaEntrega);
    if (typeof d.horaEntrega === "string") setHoraEntrega(d.horaEntrega);

    if (typeof d.pagoTipo === "string") setPagoTipo(d.pagoTipo);
    if (typeof d.pagoMonto === "string") setPagoMonto(d.pagoMonto);
    if (typeof d.pagoNota === "string") setPagoNota(d.pagoNota);
    if (typeof d.efectivoRecibido === "string")
      setEfectivoRecibido(d.efectivoRecibido);

    if (typeof d.editingLocalId === "string")
      setEditingLocalId(d.editingLocalId);
  }, []);

  useEffect(() => {
    saveDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    step,
    userCode,
    usuario,
    carrito,
    descuentoPct,
    pedidoId,
    clienteNombre,
    clienteTelefono,
    fechaEntrega,
    horaEntrega,
    pagoTipo,
    pagoMonto,
    pagoNota,
    efectivoRecibido,
    editingLocalId,
  ]);

  // ----------------------------
  // Limpieza
  // ----------------------------
  function resetPedidoParaNuevoCliente() {
    setStep(0);

    setPedidoId("");
    setPedidoStatus("");
    setPagos([]);
    setPedidoTotales(null);

    setClienteNombre("");
    setClienteTelefono("");
    setFechaEntrega(todayISO());
    setHoraEntrega("12:30");

    setCarrito([]);
    setDescuentoPct(0);

    setPagoTipo("A_CUENTA");
    setPagoMonto("");
    setPagoNota("");
    setPagoStatus("");
    setEfectivoRecibido("");

    setIsManual(false);
    setFTamano("INFANTIL");
    setFCantidad(6);
    setFTipo("COLOR");
    setFPapel("MATE");
    setFKenfor(false);
    setFUrgente(false);
    setFRopa("");
    setFEspecificaciones("");
    setManualDesc("Credencial 2.5x3.5");
    setManualPrecio(75);
    setManualCantidad(1);

    setEditingLocalId("");

    setRetomarStatus("");

    clearDraft();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ----------------------------
  // Usuario por código
  // ----------------------------
  async function loadUsuarioByCodigo(codigoStr) {
    setUserStatus("Consultando usuario…");
    setUsuario(null);

    const codigo = Number(codigoStr);
    if (!Number.isFinite(codigo) || codigo <= 0) {
      setUserStatus("❌ Código inválido.");
      return;
    }

    const { data, error } = await supabase
      .from("usuarios")
      .select("id,codigo,nombre,admin,activo,tipo")
      .eq("codigo", codigo)
      .maybeSingle();

    if (error) {
      console.error(error);
      setUserStatus("❌ Error consultando usuarios.");
      return;
    }

    if (!data) {
      setUserStatus("❌ No existe ese código de usuario.");
      return;
    }

    if (data.activo === false) {
      setUserStatus("❌ Usuario inactivo.");
      setUsuario(data);
      return;
    }

    setUsuario(data);
    setUserStatus(`✅ Bienvenido, ${data.nombre}`);
    saveDraft({ usuario: data });
  }

  useEffect(() => {
    if (!usuario?.id) loadUsuarioByCodigo(userCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------
  // Catálogo
  // ----------------------------
  async function loadCatalogo() {
    setCatalogStatus("Cargando catálogo…");
    setCatalogError("");

    const { data, error } = await supabase
      .from("catalogo_precios")
      .select("*")
      .order("tamano", { ascending: true })
      .order("cantidad", { ascending: true });

    if (error) {
      console.error(error);
      setCatalogStatus("❌ Error catálogo.");
      setCatalogError(String(error.message || error));
      setCatalogo([]);
      return;
    }

    setCatalogo(Array.isArray(data) ? data : []);
    setCatalogStatus("✅ Catálogo listo.");
  }

  useEffect(() => {
    loadCatalogo();
  }, []);

  const tamanosDisponibles = useMemo(() => {
    const set = new Set();
    for (const r of catalogo) {
      const t = (r.tamano ?? r["Tamaño"] ?? r["TAMANO"] ?? "")
        .toString()
        .trim();
      if (t) set.add(t.toUpperCase());
    }
    return Array.from(set).sort();
  }, [catalogo]);

  const cantidadesParaTamano = useMemo(() => {
    const map = new Map();
    for (const r of catalogo) {
      const t = (r.tamano ?? r["Tamaño"] ?? r["TAMANO"] ?? "")
        .toString()
        .trim()
        .toUpperCase();
      const c = Number(r.cantidad ?? r["CANTIDAD"]);
      if (!t || !Number.isFinite(c)) continue;
      if (!map.has(t)) map.set(t, new Set());
      map.get(t).add(c);
    }
    return map;
  }, [catalogo]);

  function findPriceRow(tamano, cantidad) {
    const T = (tamano || "").toString().trim().toUpperCase();
    const C = Number(cantidad);

    return catalogo.find((r) => {
      const rt = (r.tamano ?? r["Tamaño"] ?? r["TAMANO"] ?? "")
        .toString()
        .trim()
        .toUpperCase();
      const rc = Number(r.cantidad ?? r["CANTIDAD"]);
      return rt === T && rc === C;
    });
  }

  function calcLinePrice({ tamano, cantidad, kenfor, urgente }) {
    const row = findPriceRow(tamano, cantidad);
    if (!row) return { ok: false, precio_final: 0 };

    const pb = Number(row.precio_base ?? row["PRECIO BASE"] ?? 0);
    const au = Number(row.aumento_urgente ?? row["AUMENTO URGENTE"] ?? 0);
    const ak = Number(row.aumento_kenfor ?? row["AUMENTO KENFOR"] ?? 0);

    const precio_final = pb + (urgente ? au : 0) + (kenfor ? ak : 0);
    return { ok: true, precio_final };
  }

  useEffect(() => {
    const t = (fTamano || "").toUpperCase();
    const set = cantidadesParaTamano.get(t);
    if (!set || set.size === 0) return;
    const opts = Array.from(set).sort((a, b) => a - b);
    if (!set.has(Number(fCantidad))) setFCantidad(opts[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fTamano, cantidadesParaTamano]);

  // ----------------------------
  // Carrito
  // ----------------------------
  function addToCarrito() {
    const updating = Boolean(editingLocalId);

    const newId = () =>
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + "_" + String(Math.random());

    if (isManual) {
      // ✅ ESPECIAL: PRECIO ES POR PAQUETE (TOTAL DEL RENGLÓN)
      const pu = Number(manualPrecio || 0); // paquete
      const qty = Number(manualCantidad || 1); // se conserva para describir / imprimir / control
      const subtotal = pu; // ✅ NO MULTIPLICAR

      const item = {
        localId: updating ? editingLocalId : newId(),
        mode: "MANUAL",
        tamano: `ESPECIAL: ${manualDesc}`.trim(),
        cantidad: qty,
        tipo: "MANUAL",
        papel: fKenfor ? "KENFOR" : fPapel,
        kenfor: Boolean(fKenfor),
        urgente: Boolean(fUrgente),
        ropa: fRopa.trim(),
        especificaciones: `${fEspecificaciones.trim()}${
          fEspecificaciones.trim() ? " | " : ""
        }MANUAL`,
        precio_unitario: pu, // se guarda igual (paquete) para no perderlo
        subtotal, // ✅ total del renglón
      };

      if (updating) {
        setCarrito((prev) =>
          prev.map((x) => (x.localId === editingLocalId ? item : x))
        );
        setEditingLocalId("");
      } else {
        setCarrito((prev) => [...prev, item]);
      }
      return;
    }

    const t = (fTamano || "").toString().trim().toUpperCase();
    const c = Number(fCantidad);
    if (!t) return alert("Elige un tamaño.");
    if (!Number.isFinite(c)) return alert("Elige cantidad.");

    const price = calcLinePrice({
      tamano: t,
      cantidad: c,
      kenfor: fKenfor,
      urgente: fUrgente,
    });
    if (!price.ok)
      return alert("No encontré ese tamaño/cantidad en el catálogo.");

    const pu = Number(price.precio_final || 0);
    const item = {
      localId: updating ? editingLocalId : newId(),
      mode: "CATALOGO",
      tamano: t,
      cantidad: c,
      tipo: (fTipo || "").toString().trim().toUpperCase(),
      papel: fKenfor
        ? "KENFOR"
        : (fPapel || "").toString().trim().toUpperCase(),
      kenfor: Boolean(fKenfor),
      urgente: Boolean(fUrgente),
      ropa: fRopa.trim(),
      especificaciones: fEspecificaciones.trim(),
      precio_unitario: pu,
      subtotal: pu,
    };

    if (updating) {
      setCarrito((prev) =>
        prev.map((x) => (x.localId === editingLocalId ? item : x))
      );
      setEditingLocalId("");
    } else {
      setCarrito((prev) => [...prev, item]);
    }
  }

  function removeFromCarrito(localId) {
    setCarrito((prev) => prev.filter((x) => x.localId !== localId));
    if (editingLocalId && localId === editingLocalId) setEditingLocalId("");
  }

  function editCarritoItemById(localId) {
    const it = carrito.find((x) => x.localId === localId);
    if (!it) return;

    setEditingLocalId(it.localId);

    if (it.mode === "MANUAL") {
      setIsManual(true);
      const desc = (it.tamano || "").toString().replace(/^ESPECIAL:\s*/i, "");
      setManualDesc(desc || "Especial");
      setManualCantidad(Number(it.cantidad || 1));
      // ✅ en manual guardamos paquete en precio_unitario (y subtotal igual)
      setManualPrecio(Number(it.precio_unitario || it.subtotal || 0));
      setFKenfor(Boolean(it.kenfor || it.papel === "KENFOR"));
      setFUrgente(Boolean(it.urgente));
      setFRopa(it.ropa || "");
      setFEspecificaciones(
        (it.especificaciones || "")
          .toString()
          .replace(/\|\s*MANUAL$/i, "")
          .trim()
      );
    } else {
      setIsManual(false);
      setFTamano((it.tamano || "INFANTIL").toString().toUpperCase());
      setFCantidad(Number(it.cantidad || 6));
      setFTipo((it.tipo || "COLOR").toString().toUpperCase());
      const isK = Boolean(it.kenfor || it.papel === "KENFOR");
      setFKenfor(isK);
      setFPapel(isK ? "MATE" : (it.papel || "MATE").toString().toUpperCase());
      setFUrgente(Boolean(it.urgente));
      setFRopa(it.ropa || "");
      setFEspecificaciones(it.especificaciones || "");
    }

    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ----------------------------
  // Totales UI (local)
  // ----------------------------
  const totalBrutoLocal = useMemo(
    () => carrito.reduce((acc, it) => acc + Number(it.subtotal || 0), 0),
    [carrito]
  );

  const descuentoMontoLocal = useMemo(() => {
    const pct = Math.max(0, Math.min(100, Number(descuentoPct || 0)));
    return (totalBrutoLocal * pct) / 100;
  }, [totalBrutoLocal, descuentoPct]);

  const totalFinalLocal = useMemo(
    () => Math.max(0, totalBrutoLocal - descuentoMontoLocal),
    [totalBrutoLocal, descuentoMontoLocal]
  );

  const totalPagadoLocal = useMemo(
    () => pagos.reduce((acc, p) => acc + Number(p.monto || 0), 0),
    [pagos]
  );

  const restaLocal = useMemo(
    () => Math.max(0, totalFinalLocal - totalPagadoLocal),
    [totalFinalLocal, totalPagadoLocal]
  );

  const cambioEstePago = useMemo(() => {
    const monto = Number(pagoMonto || 0);
    const recibido = Number(efectivoRecibido || 0);
    if (!Number.isFinite(monto) || monto <= 0) return 0;
    if (!Number.isFinite(recibido) || recibido <= 0) return 0;
    return Math.max(0, recibido - monto);
  }, [pagoMonto, efectivoRecibido]);

  const precioRenglon = useMemo(() => {
    // ✅ en manual mostramos el precio del paquete
    if (isManual) return Number(manualPrecio || 0);
    const p = calcLinePrice({
      tamano: fTamano,
      cantidad: fCantidad,
      kenfor: fKenfor,
      urgente: fUrgente,
    });
    return p.ok ? Number(p.precio_final || 0) : 0;
  }, [isManual, manualPrecio, fTamano, fCantidad, fKenfor, fUrgente]);

  // ----------------------------
  // ✅ Traer totales reales de pedidos (DB)
  // ----------------------------
  async function cargarTotalesPedidoDB(pid) {
    const id = String(pid || "").trim();
    if (!id) return;

    const { data, error } = await supabase
      .from("pedidos")
      .select(
        "id,descuento,total_bruto,total_final,anticipo,liquidacion,total_pagado,resta,pagado"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("cargarTotalesPedidoDB error:", error);
      return;
    }
    setPedidoTotales(data || null);
  }

  // ----------------------------
  // ✅ Crear pedido
  // ----------------------------
  async function crearPedidoNuevo() {
    setPedidoStatus("");

    if (!usuario?.id) return alert("Primero valida el usuario.");
    if (!clienteNombre.trim()) return alert("Falta nombre del cliente.");
    if (carrito.length === 0) return alert("Carrito vacío.");

    const anyUrgente = carrito.some((it) => Boolean(it.urgente));
    const fechaFinal = anyUrgente ? todayISO() : fechaEntrega;
    const horaFinal = anyUrgente ? plusMinutesHHMM(20) : horaEntrega;

    if (anyUrgente) {
      setFechaEntrega(fechaFinal);
      setHoraEntrega(horaFinal);
    }

    const telLimpio = getTelefonoActual();

    setPedidoStatus("Creando pedido…");

    const { data, error } = await supabase
      .from("pedidos")
      .insert([
        {
          cliente_nombre: clienteNombre.trim(),
          cliente_telefono: telLimpio === "" ? null : telLimpio,
          fecha_entrega: fechaFinal,
          horario_entrega: horaFinal,
          urgente: anyUrgente,
          descuento: Number(descuentoPct || 0),
          creado_por: usuario.id,
        },
      ])
      .select("id")
      .maybeSingle();

    if (error) {
      console.error(error);
      setPedidoStatus(`❌ Error creando pedido: ${error.message}`);
      return;
    }

    setPedidoId(data.id);
    setPedidoStatus("✅ Pedido creado.");
    setStep(3);
    saveDraft({ pedidoId: data.id, step: 3 });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function actualizarPedidoExistente() {
    setPedidoStatus("");

    if (!usuario?.id) return alert("Usuario inválido.");
    if (!pedidoId) return alert("No hay pedido a actualizar.");
    if (!clienteNombre.trim()) return alert("Falta nombre del cliente.");
    if (carrito.length === 0) return alert("Carrito vacío.");

    const anyUrgente = carrito.some((it) => Boolean(it.urgente));
    const fechaFinal = anyUrgente ? todayISO() : fechaEntrega;
    const horaFinal = anyUrgente ? plusMinutesHHMM(20) : horaEntrega;

    if (anyUrgente) {
      setFechaEntrega(fechaFinal);
      setHoraEntrega(horaFinal);
    }

    const telLimpio = getTelefonoActual();

    setPedidoStatus("Actualizando pedido…");

    const { error } = await supabase
      .from("pedidos")
      .update({
        cliente_nombre: clienteNombre.trim(),
        cliente_telefono: telLimpio === "" ? null : telLimpio,
        fecha_entrega: fechaFinal,
        horario_entrega: horaFinal,
        urgente: anyUrgente,
        descuento: Number(descuentoPct || 0),
        necesita_revision: false,
      })
      .eq("id", pedidoId);

    if (error) {
      console.error(error);
      setPedidoStatus(`❌ Error actualizando: ${error.message}`);
      return;
    }

    setPedidoStatus("✅ Pedido actualizado.");
    setStep(3);
    saveDraft({ step: 3, fechaEntrega: fechaFinal, horaEntrega: horaFinal });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ✅ NUEVO: Guardar solo entrega (sin registrar pago)
  async function guardarCambiosSinPago() {
    setPagoStatus("");

    if (!usuario?.id) return alert("Usuario inválido.");
    if (!pedidoId) return alert("No hay pedido.");
    if (!clienteNombre.trim()) return alert("Falta nombre del cliente.");

    const anyUrgente = carrito.some((it) => Boolean(it.urgente));
    const fechaFinal = anyUrgente ? todayISO() : fechaEntrega;
    const horaFinal = anyUrgente ? plusMinutesHHMM(20) : horaEntrega;

    if (anyUrgente) {
      setFechaEntrega(fechaFinal);
      setHoraEntrega(horaFinal);
    }

    const telLimpio = getTelefonoActual();

    setPagoStatus("Guardando cambios…");

    const { error } = await supabase
      .from("pedidos")
      .update({
        cliente_nombre: clienteNombre.trim(),
        cliente_telefono: telLimpio === "" ? null : telLimpio,
        fecha_entrega: fechaFinal,
        horario_entrega: horaFinal,
        urgente: anyUrgente,
      })
      .eq("id", pedidoId);

    if (error) {
      console.error(error);
      setPagoStatus(`❌ Error guardando: ${error.message}`);
      return;
    }

    setPagoStatus("✅ Cambios guardados.");
    await cargarTotalesPedidoDB(pedidoId);
    await cargarPagos();
    saveDraft({ fechaEntrega: fechaFinal, horaEntrega: horaFinal });
  }

  // ----------------------------
  // ✅ ENVIAR DETALLES
  // ----------------------------
  async function enviarDetallesAlPedido() {
    if (!usuario?.id) return alert("Usuario inválido.");
    if (!pedidoId) return alert("No hay pedido creado/retomado.");
    if (carrito.length === 0) return alert("Carrito vacío.");

    setPedidoStatus("Enviando detalles…");

    const { error: eDel } = await supabase
      .from("detalles_pedido")
      .delete()
      .eq("pedido_id", pedidoId);

    if (eDel) {
      console.error(eDel);
      setPedidoStatus(`❌ Error limpiando detalles: ${eDel.message}`);
      return;
    }

    const rows = carrito.map((it) => ({
      pedido_id: pedidoId,
      tamano: it.tamano,
      tipo: it.tipo,
      cantidad: Number(it.cantidad || 1),
      papel: it.papel,
      urgente: Boolean(it.urgente),
      ropa: it.ropa || null,
      especificaciones: it.especificaciones || null,
      precio_unitario: Number(it.precio_unitario || 0),
      subtotal: Number(it.subtotal || 0),
      creado_por: usuario.id,
    }));

    const { error: eIns } = await supabase.from("detalles_pedido").insert(rows);

    if (eIns) {
      console.error(eIns);
      setPedidoStatus(`❌ Error guardando detalles: ${eIns.message}`);
      return;
    }

    await cargarTotalesPedidoDB(pedidoId);

    setPedidoStatus("✅ Detalles enviados.");
    setStep(4);
    saveDraft({ step: 4 });
    await cargarPagos();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ----------------------------
  // Pagos
  // ----------------------------
  async function cargarPagos() {
    if (!pedidoId) return;
    const { data, error } = await supabase
      .from("pagos")
      .select("id,created_at,monto,tipo,nota,usuario_id")
      .eq("pedido_id", pedidoId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }
    setPagos(Array.isArray(data) ? data : []);
  }

  // ✅ Cuando hay pedido, carga pagos y totales DB
  useEffect(() => {
    if (pedidoId) {
      cargarPagos();
      cargarTotalesPedidoDB(pedidoId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId]);

  // ✅ Cuando aparece CAMBIO (cambioEstePago > 0), hace scroll a ese bloque
  useEffect(() => {
    if (cambioEstePago > 0 && changeRef.current) {
      changeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [cambioEstePago]);

  async function registrarPago() {
    if (!usuario?.id) return alert("Usuario inválido.");
    if (!pedidoId) return alert("No hay pedido.");
    const monto = Number(pagoMonto);
    if (!Number.isFinite(monto) || monto <= 0) return alert("Monto inválido.");

    setPagoStatus("Registrando pago…");

    const { data, error } = await supabase
      .from("pagos")
      .insert([
        {
          pedido_id: pedidoId,
          monto,
          tipo: pagoTipo,
          nota: pagoNota || null,
          usuario_id: usuario.id,
        },
      ])
      .select("id")
      .maybeSingle();

    if (error) {
      console.error(error);
      setPagoStatus(`❌ Error: ${error.message}`);
      return;
    }

    setPagoStatus(`✅ Pago registrado. ID: ${data?.id || "(ok)"}`);

    setPagoMonto("");
    setPagoNota("");
    setEfectivoRecibido("");

    await cargarPagos();
    await cargarTotalesPedidoDB(pedidoId);
  }

  // ----------------------------
  // Retomar incompletos
  // ----------------------------
  function pickField(obj, keys, fallback = "") {
    for (const k of keys) {
      if (obj && obj[k] != null && obj[k] !== "") return obj[k];
    }
    return fallback;
  }

  async function retomarPedidoPorIdInterno(pid) {
    const id = String(pid || "").trim();
    if (!id) return;

    setRetomarStatus("Retomando pedido…");

    const { data: pedido, error: ePedido } = await supabase
      .from("pedidos")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (ePedido) {
      console.error(ePedido);
      setRetomarStatus("❌ Error leyendo pedido.");
      return;
    }
    if (!pedido) {
      setRetomarStatus("❌ No existe ese pedido.");
      return;
    }

    const { data: detalles, error: eDet } = await supabase
      .from("detalles_pedido")
      .select("*")
      .eq("pedido_id", id);

    if (eDet) console.error(eDet);

    const { data: pagosDb, error: ePagos } = await supabase
      .from("pagos")
      .select("id,created_at,monto,tipo,nota,usuario_id")
      .eq("pedido_id", id)
      .order("created_at", { ascending: false });

    if (ePagos) console.error(ePagos);

    const newId = () =>
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + "_" + String(Math.random());

    const carritoReconstruido = (detalles || []).map((d) => {
      const tamano = String(pickField(d, ["tamano"], "") || "");
      const tipo = String(pickField(d, ["tipo"], "") || "");
      const papel = String(pickField(d, ["papel"], "") || "");
      const urgente = Boolean(pickField(d, ["urgente"], false));
      const ropa = pickField(d, ["ropa"], "") || "";
      const especificaciones = pickField(d, ["especificaciones"], "") || "";
      const cantidad = Number(pickField(d, ["cantidad"], 1)) || 1;

      const pu = Number(pickField(d, ["precio_unitario"], 0)) || 0;
      const st = Number(pickField(d, ["subtotal"], 0)) || 0;

      const isManualMode =
        String(tipo).toUpperCase() === "MANUAL" ||
        String(tamano).toUpperCase().includes("ESPECIAL");

      return {
        localId: newId(),
        mode: isManualMode ? "MANUAL" : "CATALOGO",
        tamano,
        cantidad,
        tipo,
        papel,
        kenfor: String(papel).toUpperCase() === "KENFOR",
        urgente,
        ropa,
        especificaciones,
        precio_unitario: pu,
        subtotal: st,
      };
    });

    const nombre = pickField(pedido, ["cliente_nombre"], "");
    const tel = pickField(pedido, ["cliente_telefono"], "");
    const fEnt = pickField(pedido, ["fecha_entrega"], todayISO());
    const hEnt = pickField(pedido, ["horario_entrega"], "12:30");
    const desc = Number(pickField(pedido, ["descuento"], 0)) || 0;

    setPedidoId(id);
    setClienteNombre(String(nombre || ""));
    setClienteTelefono(String(tel || ""));
    setFechaEntrega(String(fEnt || todayISO()).slice(0, 10));
    setHoraEntrega(String(hEnt || "12:30"));
    setDescuentoPct(desc);

    setCarrito(carritoReconstruido);
    setPagos(Array.isArray(pagosDb) ? pagosDb : []);

    setEditingLocalId("");
    setStep(1);

    await cargarTotalesPedidoDB(id);

    saveDraft({
      pedidoId: id,
      clienteNombre: String(nombre || ""),
      clienteTelefono: String(tel || ""),
      fechaEntrega: String(fEnt || todayISO()).slice(0, 10),
      horaEntrega: String(hEnt || "12:30"),
      descuentoPct: desc,
      carrito: carritoReconstruido,
      step: 1,
      editingLocalId: "",
    });

    setRetomarStatus(
      `✅ Pedido retomado: ${String(nombre || "").toUpperCase() || "Cliente"}`
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function eliminarPedidoIncompleto(pid) {
    const id = String(pid || "").trim();
    if (!id) return;

    const ok = window.confirm(
      "¿Eliminar este pedido incompleto? Esto no se puede deshacer."
    );
    if (!ok) return;

    setRetomarStatus("Eliminando pedido…");

    await supabase.from("detalles_pedido").delete().eq("pedido_id", id);

    const { error } = await supabase.from("pedidos").delete().eq("id", id);

    if (error) {
      console.error(error);
      setRetomarStatus(`❌ No se pudo eliminar: ${error.message}`);
      return;
    }

    setRetomarStatus("✅ Pedido eliminado.");
    await cargarPedidosIncompletos();
  }

  async function cargarPedidosIncompletos() {
    setPedidosStatus("Cargando pedidos incompletos…");

    const { data: pedidos, error: e1 } = await supabase
      .from("pedidos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40);

    if (e1) {
      console.error(e1);
      setPedidosStatus("❌ Error cargando pedidos.");
      setPedidosIncompletos([]);
      return;
    }

    const list = Array.isArray(pedidos) ? pedidos : [];
    if (list.length === 0) {
      setPedidosIncompletos([]);
      setPedidosStatus("✅ Listo.");
      return;
    }

    const ids = list.map((p) => p.id).filter(Boolean);
    const { data: pagosDb, error: e2 } = await supabase
      .from("pagos")
      .select("pedido_id")
      .in("pedido_id", ids);

    if (e2) {
      console.error(e2);
      setPedidosIncompletos([]);
      setPedidosStatus("✅ Listo.");
      return;
    }

    const pagosSet = new Set((pagosDb || []).map((x) => x.pedido_id));

    // ✅ CAMBIO ACORDADO:
    // - Incompletos = sin pagos OR necesita_revision = true
    const incompletos = list.filter(
      (p) => !pagosSet.has(p.id) || p.necesita_revision === true
    );

    setPedidosIncompletos(incompletos);
    setPedidosStatus("✅ Listo.");
  }

  useEffect(() => {
    if (step === 0) cargarPedidosIncompletos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ----------------------------
  // Bloqueos (pasos)
  // ----------------------------
  const locks = useMemo(() => {
    return {
      1: !usuario?.id,
      2: !usuario?.id || carrito.length === 0,
      3: !usuario?.id || carrito.length === 0,
      4: !pedidoId,
    };
  }, [usuario?.id, carrito.length, pedidoId]);

  function goStep(target) {
    if (locks[target]) return;
    setStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const canBack = step > 0;

  const pedidoEsUrgenteLocal = useMemo(
    () => carrito.some((it) => Boolean(it.urgente)),
    [carrito]
  );

  const totalFinalPantalla =
    pedidoTotales?.total_final != null
      ? pedidoTotales.total_final
      : totalFinalLocal;
  const totalPagadoPantalla =
    pedidoTotales?.total_pagado != null
      ? pedidoTotales.total_pagado
      : totalPagadoLocal;
  const restaPantalla =
    pedidoTotales?.resta != null ? pedidoTotales.resta : restaLocal;

  // ✅ NUEVO: si ya hay pago, en Step 4 debe permitir "Guardar cambios"
  const tienePago = Number(totalPagadoPantalla || 0) > 0;

  const primaryAction = useMemo(() => {
    if (step === 0) {
      return {
        label: "Validar y continuar",
        onClick: async () => {
          await loadUsuarioByCodigo(userCode);
          setTimeout(() => {
            if (!locks[1]) goStep(1);
          }, 0);
        },
        disabled: false,
      };
    }

    if (step === 1) {
      return {
        label: "Siguiente (Cliente)",
        onClick: () => goStep(2),
        disabled: locks[2],
      };
    }

    if (step === 2) {
      const esRetomado = Boolean(pedidoId);
      return {
        label: esRetomado ? "Actualizar pedido" : "Crear pedido",
        onClick: esRetomado ? actualizarPedidoExistente : crearPedidoNuevo,
        disabled: !usuario?.id || !clienteNombre.trim() || carrito.length === 0,
      };
    }

    if (step === 3) {
      return {
        label: "Enviar detalles y pasar a pago",
        onClick: enviarDetallesAlPedido,
        disabled: !pedidoId || carrito.length === 0 || !usuario?.id,
      };
    }

    if (step === 4) {
      // ✅ si ya tiene pago -> NO obliga a registrar otro pago
      if (tienePago) {
        return {
          label: "Guardar cambios",
          onClick: guardarCambiosSinPago,
          disabled: !pedidoId || !usuario?.id || !clienteNombre.trim(),
        };
      }

      return {
        label: "Registrar pago",
        onClick: registrarPago,
        disabled:
          !pedidoId ||
          !Number.isFinite(Number(pagoMonto)) ||
          Number(pagoMonto) <= 0,
      };
    }

    return { label: "Continuar", onClick: () => {}, disabled: true };
  }, [
    step,
    userCode,
    locks,
    usuario?.id,
    clienteNombre,
    carrito.length,
    pedidoId,
    pagoMonto,
    tienePago,
    fechaEntrega,
    horaEntrega,
  ]);

  const secondaryAction = useMemo(() => {
    if (step === 4) {
      return {
        label: "Finalizar y nuevo cliente",
        onClick: resetPedidoParaNuevoCliente,
        disabled: false,
      };
    }
    return null;
  }, [step]);

  // ----------------------------
  // UI
  // ----------------------------
  return (
    <div className="mRoot">
      <style>{`
        :root{
          /* ===== Fondo oscuro serio ===== */
          --bg0:#07090C;
          --bg1:#0B0E13;

          /* ===== Azul grisáceo (principal) ===== */
          --blueGray:#6F8094;
          --blueGray2:#93A3B6;
          --blueGrayBorder: rgba(111,128,148,0.55);
          --blueGraySoft: rgba(111,128,148,0.16);

          /* Texto */
          --text: rgba(244,246,250,0.95);
          --muted: rgba(244,246,250,0.65);

          /* Cards */
          --cardWhite:  #F4ECD8;
          --cardWhite2: #EADDC2;

          --ink:#0C1220;

          /* Olive button */
          --olive:#6F7E3A;
          --olive2:#8FA34A;
          --oliveBorder: rgba(143,163,74,0.55);

          /* Accents */
          --ok:#2BFF88;
          --okBg: rgba(43,255,136,0.12);
          --warn:#FFD166;
          --warnBg: rgba(255,209,102,0.12);
          --danger:#FF4D6D;
          --dangerBg: rgba(255,77,109,0.12);

          --shadow: 0 18px 45px rgba(0,0,0,0.55);
          --softShadow: 0 12px 28px rgba(0,0,0,0.45);

          --r: 18px;
          --r2: 14px;
        }

        *{ box-sizing:border-box; }
        html, body, #root{ height:100%; }
        body{
          margin:0;
          background:
            radial-gradient(1000px 600px at 25% -10%, rgba(111,128,148,0.14), transparent 60%),
            radial-gradient(900px 520px at 85% 0%, rgba(111,128,148,0.10), transparent 62%),
            linear-gradient(180deg, var(--bg0), var(--bg1));
          color:var(--text);
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
        }
        html, body { max-width:100%; overflow-x:hidden; }

        .mRoot{
          min-height: 100vh;
          padding: 12px 12px calc(150px + env(safe-area-inset-bottom));
        }
        
        /* ===== Header: logo + titulo ===== */
        .header{
          position: sticky; top:0; z-index:20;
          background: rgba(7,9,12,0.72);
          backdrop-filter: blur(14px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding: 10px 0 12px;
          margin: 0 0 10px 0;
        }
        .topRow{
          display:flex; align-items:center; justify-content:space-between; gap:10px;
          padding: 0 2px 10px;
        }
        .brandLeft{
          display:flex; align-items:center; gap:10px;
          min-width:0;
        }

        /* 🖼 Logo real Foto Ramírez (SIN FONDO) */
        .logoBox{
          width: 90px;
          height: 62px;
          border-radius: 0;
          overflow: visible;
          display:flex;
          align-items:center;
          justify-content:center;
        
          background: transparent;
          border: none;
          box-shadow: none;
        }
        
        .logoBox img{
          width: 300%;
          height: 150%;
          object-fit: contain;
          display:block;
        }

        .brandTitle{
          font-weight: 980;
          font-size: 14px;
          letter-spacing: 0.7px;
          text-transform: uppercase;
          text-shadow:
            0 2px 0 rgba(0,0,0,0.55),
            0 10px 22px rgba(0,0,0,0.35);
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }
        .brandSub{
          font-size:12px; color: var(--muted);
          margin-top:2px;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }

        .badge{
          font-size:12px; padding:7px 11px; border-radius:999px;
          border:1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          white-space:nowrap;
          max-width:100%;
          box-shadow: 0 10px 20px rgba(0,0,0,0.35);
        }
        .badgeOk{ border-color: rgba(43,255,136,0.28); background: var(--okBg); }
        .badgeWarn{ border-color: rgba(255,209,102,0.26); background: var(--warnBg); }
        .badgeErr{ border-color: rgba(255,77,109,0.26); background: var(--dangerBg); }
        .badgeTotal{
          background: linear-gradient(180deg, #F4E7C7, #EED9A6);
          border: 1px solid rgba(0,0,0,0.10);
          color: rgba(0,0,0,0.85);
        }
        .badgeTotal b{ color: rgba(0,0,0,0.92); }
        
        /* ===== Barra pasos integrada al fondo ===== */
        .timelineShell{
          border-radius: 999px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          padding: 6px;
          box-shadow: 0 16px 34px rgba(0,0,0,0.35);
        }
        .timeline{
          display:flex; gap:8px; overflow:auto;
          -webkit-overflow-scrolling: touch;
        }
        .timeline::-webkit-scrollbar{ height: 0px; }

        .stepBtn{
          flex: 0 0 auto;
          min-width: 118px;
          text-align:left;
          padding: 10px 12px;
          border-radius: 999px;
          border:1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color:var(--text);
          box-shadow: 0 10px 22px rgba(0,0,0,0.20);
          transition: transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease;
          transform: scale(0.985);
          will-change: transform;
        }
        .stepBtnActive{
          transform: scale(1.04);
          border: 1px solid rgba(111,128,148,0.85);
          background: linear-gradient(
            180deg,
            rgba(200,215,230,0.95),
            rgba(175,195,215,0.95)
          );
          color: rgba(20,30,40,0.95);
          box-shadow:
            0 18px 38px rgba(0,0,0,0.44),
            0 0 0 2px rgba(120,150,180,0.35) inset;
          animation: pop .18s ease-out;
        }
        
        @keyframes pop{
          0%{ transform: scale(0.985); }
          70%{ transform: scale(1.06); }
          100%{ transform: scale(1.04); }
        }
        .stepBtnLocked{ opacity:0.45; }
        .stepNum{ font-weight:950; color: rgba(147,163,182,0.95); font-size:12px; }
        .stepLbl{ font-weight:950; font-size:13px; margin-top:2px; }
        .stepMeta{ font-size:12px; opacity:0.70; margin-top:2px; }

        /* ===== Cards base ===== */
        .card{
          border:1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          border-radius: var(--r);
          padding: 12px;
          margin-bottom: 12px;
          max-width:100%;
          overflow-x:hidden;
          box-shadow: var(--shadow);
        }
        .cardTitle{
          font-weight:950;
          font-size:14px;
          letter-spacing:0.25px;
        }
        .mut{ opacity:0.78; font-size:12px; margin-top:4px; color: var(--muted); }
        .row{ display:grid; gap:10px; margin-top:10px; width:100%; max-width:100%; }
        .label{
          font-size:12px;
          opacity:0.82;
          font-weight:900;
          color: rgba(244,246,250,0.75);
        }

        /* ===== Precio del renglón (Card protagonista) ===== */
.priceCard{
  margin-top: 10px;
  padding: 16px;
  border-radius: var(--r);
  background:
    radial-gradient(140px 60px at 50% 0%, rgba(255,255,255,0.18), transparent 65%),
    linear-gradient(180deg, rgba(143,163,74,0.95), rgba(111,126,58,0.92));
  border: 1px solid rgba(111,126,58,0.75);
  text-align: center;

  box-shadow:
    0 20px 44px rgba(0,0,0,0.45),
    0 0 0 1px rgba(255,255,255,0.12) inset;
}

.priceLabel{
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.4px;
  color: rgba(255,255,255,0.85);
}

.priceValue{
  margin: 6px 0;
  font-size: 26px;
  font-weight: 980;
  color: #ffffff;
  text-shadow:
    0 2px 0 rgba(0,0,0,0.45),
    0 10px 24px rgba(0,0,0,0.45);

  animation: pricePop .18s ease-out;
}

.priceSub{
  font-size: 12px;
  opacity: 0.85;
  color: rgba(255,255,255,0.75);
}

@keyframes pricePop{
  0%{ transform: scale(0.96); }
  70%{ transform: scale(1.06); }
  100%{ transform: scale(1); }
}

        /* ===== Inputs / Selects (para steps 1..4 siguen igual) ===== */
        .input, select{
          width:100%;
          max-width:100%;
          padding: 14px 12px;
          border-radius: var(--r2);
          border:1px solid rgba(255,255,255,0.10);
          background: rgba(0,0,0,0.28);
          color:var(--text);
          outline:none;
          font-size:16px;
          box-shadow: 0 10px 20px rgba(0,0,0,0.25);
          transition: box-shadow .12s ease, border-color .12s ease;
        }
        .input:focus, select:focus{
          border-color: rgba(111,128,148,0.55);
          box-shadow:
            0 0 0 6px rgba(111,128,148,0.18),
            0 12px 24px rgba(0,0,0,0.30);
        }

        .btn{
          width:100%;
          max-width:100%;
          padding: 14px 14px;
          border-radius: 16px;
          border:1px solid rgba(111,128,148,0.52);
          background:
            radial-gradient(180px 60px at 30% 0%, rgba(147,163,182,0.22), transparent 60%),
            linear-gradient(135deg, rgba(111,128,148,0.24), rgba(111,128,148,0.10));
          color: rgba(244,246,250,0.96);
          font-weight:950;
          font-size:16px;
          cursor:pointer;
          min-width:0;
          box-shadow:
            0 18px 40px rgba(0,0,0,0.48),
            0 0 0 1px rgba(111,128,148,0.10) inset;
          transition: transform .12s ease, filter .12s ease, box-shadow .12s ease;
        }
        .btn:hover{ filter: brightness(1.05); }
        .btn:active{ transform: translateY(1px); }
        .btn:disabled{ opacity:0.45; cursor:not-allowed; }
              
        /* 🛒 Botón Agregar al carrito */
.btnCart{
  border: 1px solid rgba(111,126,58,0.70);
  background:
    radial-gradient(140px 60px at 50% 0%, rgba(255,255,255,0.18), transparent 65%),
    linear-gradient(180deg, rgba(143,163,74,0.95), rgba(111,126,58,0.90));
  color: rgba(255,255,255,0.96);

  box-shadow:
    0 18px 40px rgba(0,0,0,0.35),
    0 0 0 1px rgba(255,255,255,0.12) inset;

  display:flex;
  align-items:center;
  justify-content:center;
  gap:14px;

  min-height: 60px;
  padding: 18px 20px;
  font-size: 16px;
}

/* Ícono SVG del carrito (NEGRO) */
.cartIcon{
  width: 26px;
  height: 26px;
  fill: #0C1220;
}

/* Signo + negro */
.cartPlus{
  font-size: 26px;
  font-weight: 900;
  color: #0C1220;
}

        /* ===== STEP 0 específico ===== */
        .cardWhite{
          position: relative;
          background: linear-gradient(180deg, var(--cardWhite), var(--cardWhite2));
          border: 2px solid var(--blueGrayBorder);
          border-radius: 43px;
          color: var(--ink);
          box-shadow:
            0 22px 50px rgba(0,0,0,0.45),
            0 0 0 1px rgba(111,128,148,0.25),
            0 12px 32px rgba(111,128,148,0.20);
          overflow: visible;
        }
        
        .cardWhite .cardTitle,
        .cardWhite .mut,
        .cardWhite .label{
          color: rgba(12,18,32,0.92);
        }
        .cardWhite .mut{ opacity:0.75; }

        .userGrid{
          display:grid;
          grid-template-columns: 1fr 96px;
          gap: 12px;
          align-items: stretch;
          margin-top: 10px;
        }

        .userLeft{
          display:grid;
          grid-template-columns: 1fr;
          gap: 10px;
          min-width:0;
        }

        .shortInput{
          width: 58%;
          min-width: 170px;
          max-width: 260px;
          padding: 12px 12px;
          border-radius: 14px;
          border: 2px solid rgba(111,128,148,0.45);
          background: rgba(255,255,255,0.92);
          color: rgba(12,18,32,0.95);
          outline: none;
          font-size: 16px;
          font-weight: 800;
          box-shadow: 0 10px 20px rgba(0,0,0,0.12);
          transition: box-shadow .12s ease, border-color .12s ease;
        }
        .shortInput:focus{
          border-color: rgba(111,128,148,0.85);
          box-shadow:
            0 0 0 6px rgba(111,128,148,0.18),
            0 12px 24px rgba(0,0,0,0.14);
        }

        /* Botón verde olivo con degradado + viñeta tenue */
.btnOlive{
  border: 1px solid rgba(111,126,58,0.70);
  background:
    radial-gradient(140px 60px at 50% 0%, rgba(255,255,255,0.18), transparent 65%),
    linear-gradient(180deg, rgba(143,163,74,0.95), rgba(111,126,58,0.90));
  color: rgba(255,255,255,0.96);
  box-shadow:
    0 18px 40px rgba(0,0,0,0.35),
    0 0 0 1px rgba(255,255,255,0.12) inset;
  transition: filter .12s ease, transform .12s ease;
}
.btnOlive:hover{ filter: brightness(1.06); }
.btnOlive:active{ transform: translateY(1px); }

        .welcomeOrb{
          position: relative;
          align-self: stretch;
          justify-self: end;
          width: 156px;
          height: 156px;
          border-radius: 999px;
          background:
            radial-gradient(34px 34px at 32% 30%, rgba(255,255,255,0.18), transparent 60%),
            linear-gradient(180deg, rgba(12,14,18,0.95), rgba(8,10,14,0.95));
          border: 3px solid rgba(212,175,55,0.85);
          box-shadow:
            0 26px 60px rgba(0,0,0,0.60),
            0 0 0 1px rgba(212,175,55,0.35);
          margin-right: -44px;
          margin-top: -28px;
          display:flex;
          align-items:center;
          justify-content:center;
          text-align:center;
          padding: 14px;
          animation: goldPulse 3.8s ease-in-out infinite;
        }

@keyframes goldPulse{
  0%{
    border-color: rgba(212,175,55,0.75);
    box-shadow:
      0 26px 60px rgba(0,0,0,0.60),
      0 0 0 1px rgba(212,175,55,0.25),
      0 0 14px rgba(212,175,55,0.18);
  }
  50%{
    border-color: rgba(240,200,90,0.95);
    box-shadow:
      0 28px 64px rgba(0,0,0,0.62),
      0 0 0 2px rgba(240,200,90,0.40),
      0 0 26px rgba(240,200,90,0.35);
  }
  100%{
    border-color: rgba(212,175,55,0.75);
    box-shadow:
      0 26px 60px rgba(0,0,0,0.60),
      0 0 0 1px rgba(212,175,55,0.25),
      0 0 14px rgba(212,175,55,0.18);
  }
}

.w1{
  font-weight: 900;
  font-size: 12px;
  opacity: 0.75;
  color: rgba(244,246,250,0.85);
}

.w2{
  margin-top: 8px;
  font-weight: 950;
  font-size: 15px;
  letter-spacing: 0.4px;
  color: var(--ok);
  text-shadow:
    0 0 6px rgba(43,255,136,0.45),
    0 0 14px rgba(43,255,136,0.25);
  animation: userGlow 2.6s ease-in-out infinite;
}

@keyframes userGlow{
  0%{
    opacity: 0.85;
    text-shadow:
      0 0 4px rgba(43,255,136,0.30),
      0 0 8px rgba(43,255,136,0.20);
  }
  50%{
    opacity: 1;
    text-shadow:
      0 0 10px rgba(43,255,136,0.85),
      0 0 22px rgba(43,255,136,0.55);
  }
  100%{
    opacity: 0.85;
    text-shadow:
      0 0 4px rgba(43,255,136,0.30),
      0 0 8px rgba(43,255,136,0.20);
  }
}

.w2Pop{ animation: popUser .45s ease-out; }

@keyframes popUser{
  0%{
    transform: scale(0.85);
    opacity: 0;
    text-shadow: none;
  }
  60%{
    transform: scale(1.08);
    opacity: 1;
    text-shadow:
      0 0 14px rgba(43,255,136,0.9),
      0 0 28px rgba(43,255,136,0.55);
  }
  100%{
    transform: scale(1);
    opacity: 1;
    text-shadow:
      0 0 10px rgba(43,255,136,0.75),
      0 0 20px rgba(43,255,136,0.45);
  }
}

        .statusPill{
          border-radius: 999px;
          padding: 8px 10px;
          border: 1px solid rgba(111,128,148,0.28);
          background: rgba(111,128,148,0.10);
          color: rgba(12,18,32,0.82);
          font-weight: 800;
          font-size: 12px;
        }
        .statusOk{ border-color: rgba(43,255,136,0.28); background: rgba(43,255,136,0.10); }
        .statusWarn{ border-color: rgba(255,209,102,0.30); background: rgba(255,209,102,0.12); }
        .statusErr{ border-color: rgba(255,77,109,0.26); background: rgba(255,77,109,0.10); }

        .cardSlate{
          border: 1px solid rgba(111,128,148,0.30);
          background:
            radial-gradient(520px 220px at 40% 0%, rgba(111,128,148,0.18), transparent 65%),
            rgba(255,255,255,0.03);
        }

        .item{
          border:1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          border-radius: var(--r2);
          padding: 12px;
          margin-top:10px;
          box-shadow: 0 14px 30px rgba(0,0,0,0.40);
        }
        .itemTop{ display:flex; justify-content:space-between; gap:10px; }
        .itemTop > div{ min-width:0; }
        .itemTitle{
          font-weight:950; font-size:13px;
          overflow-wrap:anywhere;
          word-break:break-word;
        }
        .itemSub{
          opacity:0.72; font-size:12px; margin-top:4px;
          overflow-wrap:anywhere;
          word-break:break-word;
          color: var(--muted);
        }
        .itemActions{
          margin-top:10px;
          display:flex;
          gap:10px;
          flex-wrap:wrap;
        }
        .itemActions .btn{ flex: 1 1 140px; }

@media (max-width: 560px){
  .itemActions{ flex-direction: row; }
  .itemActions .btn{
    flex: 1 1 120px;
    padding: 10px 12px;
    font-size: 14px;
  }
}

        .bottomBar{
          position: fixed; left:0; right:0; bottom:0; z-index:30;
          background: rgba(7,9,12,0.82);
          backdrop-filter: blur(14px);
          border-top: 1px solid rgba(255,255,255,0.06);
          padding: 10px 12px;
          box-shadow: 0 -18px 34px rgba(0,0,0,0.45);
        }
        .bottomInner{
          max-width: 560px;
          margin: 0 auto;
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap:10px;
          align-items:center;
        }
        .single{ grid-template-columns: 1fr; }

        /* 📱 Ajuste fino del círculo y texto SOLO en celular */
@media (max-width: 480px){
  .welcomeOrb{
    width: 110px;
    height: 110px;
    margin-right: -22px;
    margin-top: -16px;
    padding: 10px;
  }

  .welcomeOrb .w1{ font-size: 10px; }

  .welcomeOrb .w2{
    font-size: 13px;
    line-height: 1.15;
    max-width: 90px;
    word-wrap: break-word;
    overflow-wrap: break-word;
    text-align: center;
  }
}

/* Botón negro: Recargar catálogo */
.btnReload{
  background: linear-gradient(180deg, #111, #000);
  border: 1px solid rgba(255,255,255,0.15);
  color: #fff;
  box-shadow:
    0 14px 30px rgba(0,0,0,0.6),
    0 0 0 1px rgba(255,255,255,0.05) inset;
}
.btnReload:hover{ filter: brightness(1.08); }

/* ========================================= */
/* ✅ FIX: CHIPS (Kenfor/Urgente/Especial)   */
/* ========================================= */
.chips{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
}
.chip{
  display:flex;
  align-items:center;
  gap:10px;
  padding: 12px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.05);
  box-shadow: 0 12px 24px rgba(0,0,0,0.25);
  font-weight: 900;
  color: rgba(244,246,250,0.92);
  user-select:none;
}
.chip input{
  width:18px;
  height:18px;
  accent-color: #8FA34A;
}
.chip:has(input:checked){
  border-color: rgba(143,163,74,0.55);
  background: rgba(143,163,74,0.12);
}
.chipUrgente:has(input:checked){
  border-color: rgba(255,209,102,0.55);
  background: rgba(255,209,102,0.14);
}
.chipEspecial:has(input:checked){
  border-color: rgba(111,128,148,0.55);
  background: rgba(111,128,148,0.14);
}

/* ========================================= */
/* ✅ FIX: BOTONES EDITAR/ELIMINAR COLORES    */
/* ========================================= */
.btnGhost{
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.06);
  background-image: none;
  color: rgba(244,246,250,0.96);
  box-shadow: 0 12px 26px rgba(0,0,0,0.34);
}
.btnGhost:hover{ filter: brightness(1.06); }

.itemActions button.btn.btnGhost.btnEdit{
  background: linear-gradient(180deg, #4a76a3, #34567c) !important;
  background-image: none !important;
  border-color: #6f94b6 !important;
  color: #fff !important;
}
.itemActions button.btn.btnGhost.btnDelete{
  background: linear-gradient(180deg, #b43a3a, #8a2626) !important;
  background-image: none !important;
  border-color: #ff4d4d !important;
  color: #fff !important;
}
.itemActions button.btn.btnGhost.btnEdit,
.itemActions button.btn.btnGhost.btnDelete{
  text-shadow: 0 2px 10px rgba(0,0,0,0.35);
}

/* =========================
   DESCUENTO Y TOTAL — PILL BONITO
   ========================= */

.totalsBox{
  margin-top: 6px;
  display: grid;
  gap: 10px;
}

/* PILL BASE */
.totRow{
  display:flex;
  align-items:center;
  justify-content:space-between;

  padding: 12px 18px;
  border-radius: 999px;

  background:
    linear-gradient(
      180deg,
      rgba(255,255,255,0.18),
      rgba(255,255,255,0.06)
    );

  border: 1px solid rgba(111,128,148,0.45);

  box-shadow:
    0 14px 30px rgba(0,0,0,0.45),
    0 0 0 1px rgba(255,255,255,0.06) inset;
}

/* LABEL */
.totLbl{
  font-size: 13px;
  font-weight: 900;
  color: rgba(244,246,250,0.92);
}

/* VALOR */
.totVal{
  font-size: 14px;
  font-weight: 950;
  color: rgba(244,246,250,0.96);
  white-space: nowrap;
}

/* 🔴 DESCUENTO EN ROJO */
.totalsBox .totRow:nth-child(2) .totVal{
  color: var(--danger);
  text-shadow:
    0 0 px rgba(255,77,109,0.55),
    0 0 22px rgba(255,77,109,0.35);
}

/* 🟢 TOTAL FINAL DESTACADO */
.totFinal{
  border-color: rgba(212,175,55,0.60);
}

.totFinal .totVal{
  font-size: 16px;
  color: var(--ok);
  text-shadow:
    0 0 px rgba(43,255,136,0.55),
    0 0 26px rgba(43,255,136,0.35);
}

/* =========================
   ✅ STEP 4 (PAGO) – UI ordenada
   ========================= */

.payGrid{
  display: grid;
  gap: 12px;
  margin-top: 12px;
}

/* Cajas KPI grandes */
.focusBox{
  border: 1px solid rgba(111,128,148,0.28);
  background:
    radial-gradient(520px 180px at 50% 0%, rgba(111,128,148,0.14), transparent 60%),
    rgba(255,255,255,0.04);
  border-radius: 18px;
  padding: 14px 14px;
  box-shadow: 0 16px 34px rgba(0,0,0,0.40);
}

.focusTitle{
  font-size: 12px;
  font-weight: 950;
  letter-spacing: .4px;
  color: rgba(244,246,250,0.72);
  text-transform: uppercase;
}

.focusValue{
  margin-top: 6px;
  font-size: 22px;
  font-weight: 980;
  letter-spacing: .4px;
  color: rgba(255,245,225,0.98);
  text-shadow: 0 2px 0 rgba(0,0,0,0.40), 0 10px 24px rgba(0,0,0,0.35);
}

/* RESTA en ámbar si falta pagar */
.restaBoxAmber{
  border-color: rgba(255,209,102,0.30);
  background:
    radial-gradient(520px 180px at 50% 0%, rgba(255,209,102,0.12), transparent 60%),
    rgba(255,209,102,0.06);
}

/* Anticipo / Liquidación en dos columnas */
.kpiRow{
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.kpi{
  border: 1px solid rgba(255,255,255,0.06);
  background: rgba(255,255,255,0.03);
  border-radius: 16px;
  padding: 12px;
}

.kpiMain{
  font-size: 12px;
  font-weight: 900;
  color: rgba(244,246,250,0.70);
}

.kpiVal{
  margin-top: 6px;
  font-size: 16px;
  font-weight: 950;
  color: rgba(244,246,250,0.92);
}

/* ✅ Caja de CAMBIO (protagonista) */
.changeBox{
  border: 1px solid rgba(43,255,136,0.35);
  background:
    radial-gradient(520px 180px at 50% 0%, rgba(43,255,136,0.14), transparent 60%),
    rgba(43,255,136,0.07);
  box-shadow:
    0 18px 40px rgba(0,0,0,0.45),
    0 0 0 2px rgba(43,255,136,0.18) inset;
}

.changeValue{
  color: var(--ok);
  text-shadow:
    0 0 10px rgba(43,255,136,0.70),
    0 0 24px rgba(43,255,136,0.35);
  animation: changePop .18s ease-out;
}

@keyframes changePop{
  0%{ transform: scale(0.96); opacity: 0.7; }
  100%{ transform: scale(1); opacity: 1; }
}

`}</style>

      {/* HEADER + TIMELINE */}
      <div className="header">
        <div className="wrap">
          <div className="topRow">
            <div className="brandLeft">
              <div className="logoBox" title="Foto Ramírez">
                <img src={logoFR} alt="Foto Ramírez" />
              </div>

              <div style={{ minWidth: 0 }}>
                <div className="brandTitle">TOMA PEDIDOS</div>
                <div className="brandSub">
                  {usuario?.nombre ? `👋 ${usuario.nombre}` : "Sin usuario"} ·{" "}
                  {catalogStatus}
                </div>
              </div>
            </div>

            <div className="badge badgeTotal">
              Total: <b>{money(totalFinalLocal)}</b>
            </div>
          </div>

          <div className="timelineShell">
            <div className="timeline">
              {STEPS.map((s, idx) => {
                const active = step === s.id;
                const locked = Boolean(locks[s.id]);
                const done = step > s.id;

                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`stepBtn ${active ? "stepBtnActive" : ""} ${
                      locked ? "stepBtnLocked" : ""
                    }`}
                    onClick={() => goStep(s.id)}
                    disabled={locked}
                    title={locked ? "Bloqueado" : "Ir a paso"}
                  >
                    <div className="stepNum">{idx + 1}.</div>
                    <div className="stepLbl">{s.label}</div>
                    <div className="stepMeta">
                      {locked
                        ? "Bloqueado"
                        : active
                        ? "Aquí"
                        : done
                        ? "Listo"
                        : "Pendiente"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="wrap">
        {/* STEP 0 (NUEVO DISEÑO) */}
        {step === 0 && (
          <>
            <div className="card cardWhite">
              <div className="cardTitle">Usuario</div>
              <div className="mut">Escribe el número de usuario y valida.</div>

              <div className="userGrid">
                <div className="userLeft">
                  <div>
                    <div className="label">Código de usuario</div>
                    <input
                      className="shortInput"
                      value={userCode}
                      onChange={(e) => setUserCode(e.target.value)}
                      placeholder="Ej: 1"
                      inputMode="numeric"
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btnOlive"
                    onClick={() => loadUsuarioByCodigo(userCode)}
                  >
                    Validar usuario
                  </button>

                  {Boolean(userStatus) &&
                    !String(userStatus).startsWith("✅") && (
                      <div
                        className={`statusPill ${
                          String(userStatus || "").startsWith("❌")
                            ? "statusErr"
                            : "statusWarn"
                        }`}
                      >
                        {userStatus}
                      </div>
                    )}

                  {catalogError ? (
                    <div className="badge badgeErr">{catalogError}</div>
                  ) : null}

                  <button
                    type="button"
                    className="btn btnReload"
                    onClick={loadCatalogo}
                  >
                    Recargar catálogo
                  </button>
                </div>

                <div className="welcomeOrb">
                  <div>
                    <div className="w1">Bienvenido</div>
                    <div className={`w2 ${usuario?.nombre ? "w2Pop" : ""}`}>
                      {usuario?.nombre ? String(usuario.nombre) : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card cardSlate">
              <div
                className="cardTitle"
                style={{ display: "flex", gap: 10, alignItems: "center" }}
              >
                <span>Pedidos incompletos</span>
                <span
                  className="badge badgeWarn"
                  style={{ whiteSpace: "nowrap" }}
                >
                  ⚠ Revisar
                </span>
              </div>

              <div className="mut">
                {pedidosStatus || "Aquí solo aparecen pedidos SIN pagos."}
              </div>

              <div className="row">
                <button
                  type="button"
                  className="btn btnGhost"
                  onClick={cargarPedidosIncompletos}
                >
                  Actualizar lista
                </button>

                {retomarStatus ? (
                  <div className="badge badgeWarn">{retomarStatus}</div>
                ) : null}

                {pedidosIncompletos.length === 0 ? (
                  <div className="mut">✅ No hay pedidos incompletos.</div>
                ) : (
                  pedidosIncompletos.map((p) => {
                    const nombre = pickField(p, ["cliente_nombre"], "—");
                    const tel = pickField(p, ["cliente_telefono"], "");
                    const fEnt = pickField(p, ["fecha_entrega"], "");
                    const hEnt = pickField(p, ["horario_entrega"], "");
                    const urg = Boolean(pickField(p, ["urgente"], false));
                    const created = p.created_at
                      ? new Date(p.created_at).toLocaleString("es-MX")
                      : "";

                    return (
                      <div key={String(p.id)} className="item">
                        <div className="itemTop">
                          <div>
                            <div className="itemTitle">
                              {String(nombre || "").toUpperCase()}
                              {urg ? " · URGENTE" : ""}
                            </div>
                            <div className="itemSub">
                              {created ? `Creado: ${created}` : ""}
                            </div>
                            <div className="itemSub">
                              Entrega: {fEnt ? String(fEnt).slice(0, 10) : "—"}{" "}
                              {hEnt ? `· ${hEnt}` : ""}
                              {tel ? ` · Tel: ${tel}` : ""}
                            </div>
                          </div>
                        </div>

                        <div className="itemActions">
                          <button
                            type="button"
                            className="btn btnGhost btnEdit"
                            onClick={() => retomarPedidoPorIdInterno(p.id)}
                          >
                            Retomar
                          </button>

                          <button
                            type="button"
                            className="btn btnGhost btnDelete"
                            onClick={() => eliminarPedidoIncompleto(p.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <div>
            <div className="card cardSlate">
              <div className="cardTitle">Presupuesto</div>
              <div className="mut">Arma un renglón y agrégalo al carrito.</div>

              <div className="row">
                <div>
                  <div className="label">Tamaño</div>
                  <select
                    value={fTamano}
                    onChange={(e) => setFTamano(e.target.value)}
                  >
                    {(tamanosDisponibles.length
                      ? tamanosDisponibles
                      : ["INFANTIL"]
                    ).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="label">Cantidad (fotos)</div>
                  <select
                    value={fCantidad}
                    onChange={(e) => setFCantidad(Number(e.target.value))}
                  >
                    {(
                      Array.from(
                        cantidadesParaTamano.get(
                          (fTamano || "").toUpperCase()
                        ) || [3, 6, 9]
                      ) || []
                    )
                      .sort((a, b) => a - b)
                      .map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                  </select>
                </div>

                {!isManual && (
                  <div>
                    <div className="label">Tipo</div>
                    <select
                      value={fTipo}
                      onChange={(e) => setFTipo(e.target.value)}
                    >
                      <option value="COLOR">COLOR</option>
                      <option value="BYN">BYN</option>
                    </select>
                  </div>
                )}

                {!isManual && (
                  <div>
                    <div className="label">Papel</div>
                    <select
                      value={fPapel}
                      onChange={(e) => setFPapel(e.target.value)}
                    >
                      <option value="MATE">MATE</option>
                      <option value="BRILLOSO">BRILLOSO</option>
                    </select>
                  </div>
                )}

                <div className="chips">
                  <label className="chip">
                    <input
                      type="checkbox"
                      checked={fKenfor}
                      onChange={(e) => setFKenfor(e.target.checked)}
                    />
                    Kenfor
                  </label>

                  <label className="chip chipUrgente">
                    <input
                      type="checkbox"
                      checked={fUrgente}
                      onChange={(e) => setFUrgente(e.target.checked)}
                    />
                    Urgente
                  </label>

                  <label className="chip chipEspecial">
                    <input
                      type="checkbox"
                      checked={isManual}
                      onChange={(e) => setIsManual(e.target.checked)}
                    />
                    Especial (manual)
                  </label>
                </div>

                <div>
                  <div className="label">Ropa (opcional)</div>
                  <input
                    className="input"
                    value={fRopa}
                    onChange={(e) => setFRopa(e.target.value)}
                    placeholder="clara / oscura"
                  />
                </div>

                <div>
                  <div className="label">Especificaciones (opcional)</div>
                  <input
                    className="input"
                    value={fEspecificaciones}
                    onChange={(e) => setFEspecificaciones(e.target.value)}
                    placeholder="fondo blanco, etc."
                  />
                </div>

                {!isManual ? (
                  <div className="priceCard">
                    <div className="priceLabel">Precio del renglón</div>
                    <div key={precioRenglon} className="priceValue">
                      {money(precioRenglon)}
                    </div>
                  </div>
                ) : (
                  <div className="card" style={{ margin: 0 }}>
                    <div className="cardTitle">Especial (manual)</div>
                    <div className="row">
                      <div>
                        <div className="label">Descripción</div>
                        <input
                          className="input"
                          value={manualDesc}
                          onChange={(e) => setManualDesc(e.target.value)}
                        />
                      </div>
                      <div>
                        <div className="label">Cantidad</div>
                        <input
                          className="input"
                          value={manualCantidad}
                          onChange={(e) => setManualCantidad(e.target.value)}
                          inputMode="numeric"
                        />
                      </div>
                      <div>
                        <div className="label">Precio del paquete</div>
                        <input
                          className="input"
                          value={manualPrecio}
                          onChange={(e) => setManualPrecio(e.target.value)}
                          inputMode="decimal"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="btn btnCart"
                  onClick={addToCarrito}
                >
                  <svg
                    className="cartIcon"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2zM7.17 14h9.66c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 21.29 5H6.21l-.94-2H1v2h3l3.6 7.59-1.35 2.44C5.52 15.37 6.48 17 8 17h12v-2H8l1.17-2z" />
                  </svg>
                  <span>
                    {editingLocalId ? "Guardar cambios" : "Agregar al carrito"}
                  </span>
                  <span className="cartPlus">＋</span>
                </button>
              </div>
            </div>

            {/* ===== Carrito ===== */}
            <div className="card">
              <div className="cardTitle">
                Carrito{clienteNombre?.trim() ? ` de: ${clienteNombre}` : ""}
              </div>

              <div className="mut">
                Renglones: <b>{carrito.length}</b> · Total:{" "}
                <b>{money(totalFinalLocal)}</b>
              </div>

              {carrito.length === 0 ? (
                <div className="mut" style={{ marginTop: 10 }}>
                  Aún no agregas renglones.
                </div>
              ) : (
                <div>
                  {carrito
                    .slice(-2)
                    .reverse()
                    .map((it) => (
                      <div key={it.localId} className="item">
                        <div className="itemTop">
                          <div>
                            <div className="itemTitle">
                              {it.tamano} · {it.cantidad} · {it.tipo} ·{" "}
                              {it.papel}
                              {it.urgente ? " · URGENTE" : ""}
                            </div>
                            <div className="itemSub">
                              {it.especificaciones
                                ? `Esp: ${it.especificaciones}`
                                : "Sin esp"}
                              {it.ropa ? ` · Ropa: ${it.ropa}` : ""}
                            </div>
                          </div>
                          <div
                            style={{ fontWeight: 950, whiteSpace: "nowrap" }}
                          >
                            {money(it.subtotal)}
                          </div>
                        </div>

                        <div className="itemActions">
                          <button
                            type="button"
                            className="btn btnGhost btnEdit"
                            onClick={() => editCarritoItemById(it.localId)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btnGhost btnDelete"
                            onClick={() => removeFromCarrito(it.localId)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}

                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="btn btnGhost"
                      onClick={() => goStep(3)}
                    >
                      Ver / editar carrito completo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ===== Descuento ===== */}
            <div
              className={`card discountCard ${
                descuentoPct > 0 ? "hasDiscount" : ""
              }`}
            >
              <div className="discountHead">
                <div className="cardTitle" style={{ margin: 0 }}>
                  Descuento y total
                </div>

                <div className="discountChips">
                  <button onClick={() => setDescuentoPct(0)}>0%</button>
                  <button onClick={() => setDescuentoPct(5)}>5%</button>
                  <button onClick={() => setDescuentoPct(10)}>10%</button>
                  <button onClick={() => setDescuentoPct(15)}>15%</button>
                </div>
              </div>

              <div className="discountGrid">
                <div>
                  <div className="label">Descuento (%)</div>
                  <input
                    className="discountInput"
                    type="number"
                    value={descuentoPct}
                    onChange={(e) =>
                      setDescuentoPct(Number(e.target.value || 0))
                    }
                  />
                </div>

                <div className="totalsBox">
                  <div className="totRow">
                    <div className="totLbl">Total bruto</div>
                    <div className="totVal">{money(totalBrutoLocal)}</div>
                  </div>
                  <div className="totRow">
                    <div className="totLbl">Descuento</div>
                    <div className="totVal">-{money(descuentoMontoLocal)}</div>
                  </div>
                  <div className="totRow totFinal">
                    <div className="totLbl">Total final</div>
                    <div className="totVal">{money(totalFinalLocal)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="card">
            <div className="cardTitle">Datos del cliente</div>
            <div className="mut">
              Total: <b>{money(totalFinalLocal)}</b> · Renglones:{" "}
              <b>{carrito.length}</b>
            </div>

            <div className="row">
              <div>
                <div className="label">Nombre</div>
                <input
                  className="input"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  placeholder="Ej: AZUL RAMIREZ"
                />
              </div>

              <div>
                <div className="label">Teléfono (opcional)</div>
                <input
                  className="input"
                  ref={telRef}
                  value={clienteTelefono}
                  onChange={(e) => setClienteTelefono(e.target.value)}
                  onBlur={(e) => setClienteTelefono(e.target.value)}
                  placeholder="Ej: 722..."
                  inputMode="numeric"
                />
              </div>

              {pedidoEsUrgenteLocal ? (
                <div className="badge badgeWarn">
                  ⚡ URGENTE: entrega estimada 15–20 min (no se agenda
                  fecha/hora)
                </div>
              ) : null}

              <div>
                <div className="label">Fecha de entrega</div>
                <input
                  className="input"
                  type="date"
                  value={fechaEntrega}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                  disabled={pedidoEsUrgenteLocal}
                />
              </div>

              <div>
                <div className="label">Hora de entrega</div>
                <input
                  className="input"
                  type="time"
                  value={horaEntrega}
                  onChange={(e) => setHoraEntrega(e.target.value)}
                  disabled={pedidoEsUrgenteLocal}
                />
              </div>

              {pedidoStatus ? (
                <div className="badge badgeWarn">{pedidoStatus}</div>
              ) : null}

              <div
                className={`badge ${
                  clienteTelefono?.trim() ? "badgeOk" : "badgeWarn"
                }`}
              >
                📞 Tel:{" "}
                <b>{clienteTelefono?.trim() ? clienteTelefono : "(vacío)"}</b>
              </div>

              {pedidoId ? (
                <div className="badge badgeOk">
                  🔁 Modo retomar: este pedido se actualizará (mismo cliente).
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="card">
            <div className="cardTitle">
              Carrito{clienteNombre?.trim() ? ` de: ${clienteNombre}` : ""}
            </div>
            <div className="mut">
              {pedidoId
                ? "Pedido listo para enviar detalles."
                : "Primero crea/actualiza el pedido en Cliente."}
            </div>

            {carrito.length === 0 ? (
              <div className="mut" style={{ marginTop: 10 }}>
                Carrito vacío.
              </div>
            ) : (
              carrito.map((it) => (
                <div key={it.localId} className="item">
                  <div className="itemTop">
                    <div>
                      <div className="itemTitle">
                        {it.tamano} · {it.cantidad} · {it.tipo} · {it.papel}
                        {it.urgente ? " · URGENTE" : ""}
                      </div>
                      <div className="itemSub">
                        {it.especificaciones
                          ? `Esp: ${it.especificaciones}`
                          : "Sin esp"}
                        {it.ropa ? ` · Ropa: ${it.ropa}` : ""}
                      </div>
                    </div>
                    <div style={{ fontWeight: 950, whiteSpace: "nowrap" }}>
                      {money(it.subtotal)}
                    </div>
                  </div>

                  <div className="itemActions">
                    <button
                      type="button"
                      className="btn btnGhost btnEdit"
                      onClick={() => editCarritoItemById(it.localId)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn btnGhost btnDelete"
                      onClick={() => removeFromCarrito(it.localId)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            )}

            {pedidoStatus ? (
              <div className="badge badgeWarn" style={{ marginTop: 10 }}>
                {pedidoStatus}
              </div>
            ) : null}
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div className="card">
            <div className="cardTitle">Pago</div>
            <div className="mut">
              Cliente: <b>{clienteNombre?.trim() ? clienteNombre : "—"}</b>
            </div>

            {pedidoTotales ? null : (
              <div className="badge badgeWarn" style={{ marginTop: 10 }}>
                ℹ️ Totales DB en proceso… (si acabas de enviar detalles, espera
                1–2 segundos y se actualiza)
              </div>
            )}

            {tienePago ? (
              <div className="badge badgeOk" style={{ marginTop: 10 }}>
                ✅ Este pedido ya tiene pagos. Puedes solo{" "}
                <b>Guardar cambios</b> (por ejemplo fecha/hora de entrega) sin
                registrar otro pago.
              </div>
            ) : null}

            <div className="row" style={{ marginTop: 12 }}>
              <div className="focusBox">
                <div className="focusTitle">TOTAL FINAL</div>
                <div className="focusValue">{money(totalFinalPantalla)}</div>
              </div>

              <div
                className="focusBox"
                style={{
                  borderColor: "rgba(43,255,136,0.30)",
                  background:
                    "radial-gradient(520px 180px at 50% 0%, rgba(43,255,136,0.12), transparent 60%), rgba(43,255,136,0.06)",
                }}
              >
                <div className="focusTitle">PAGADO</div>
                <div className="focusValue" style={{ color: "var(--ok)" }}>
                  {money(totalPagadoPantalla)}
                </div>
              </div>

              <div
                className={`focusBox ${
                  restaPantalla > 0 ? "restaBoxAmber" : ""
                }`}
              >
                <div className="focusTitle">
                  {restaPantalla > 0 ? "RESTA" : "PEDIDO LIQUIDADO"}
                </div>
                <div
                  className="focusValue"
                  style={{
                    color: restaPantalla > 0 ? "var(--warn)" : "var(--ok)",
                  }}
                >
                  {money(restaPantalla)}
                </div>
              </div>

              <div className="kpiRow">
                <div className="kpi">
                  <div className="kpiMain">Anticipo</div>
                  <div className="kpiVal">
                    {money(pedidoTotales?.anticipo || 0)}
                  </div>
                </div>
                <div className="kpi">
                  <div className="kpiMain">Liquidación</div>
                  <div className="kpiVal">
                    {money(pedidoTotales?.liquidacion || 0)}
                  </div>
                </div>
              </div>

              {cambioEstePago > 0 ? (
                <div ref={changeRef} className="focusBox changeBox">
                  <div className="focusTitle">CAMBIO A ENTREGAR</div>
                  <div className="focusValue changeValue">
                    {money(cambioEstePago)}
                  </div>
                </div>
              ) : null}

              <div>
                <div className="label">Tipo</div>
                <select
                  value={pagoTipo}
                  onChange={(e) => setPagoTipo(e.target.value)}
                >
                  {PAGO_TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="label">Monto a registrar</div>
                <input
                  className="input"
                  value={pagoMonto}
                  onChange={(e) => setPagoMonto(e.target.value)}
                  inputMode="decimal"
                  placeholder="Ej: 120"
                  disabled={tienePago}
                />
              </div>

              <div>
                <div className="label">Efectivo recibido (opcional)</div>
                <input
                  className="input"
                  value={efectivoRecibido}
                  onChange={(e) => setEfectivoRecibido(e.target.value)}
                  inputMode="decimal"
                  placeholder="Ej: 500"
                  disabled={tienePago}
                />
              </div>

              <div>
                <div className="label">Nota (opcional)</div>
                <input
                  className="input"
                  value={pagoNota}
                  onChange={(e) => setPagoNota(e.target.value)}
                  placeholder="Ej: billete 500"
                  disabled={tienePago}
                />
              </div>

              {pagoStatus ? (
                <div
                  className={`badge ${
                    pagoStatus.startsWith("✅") ? "badgeOk" : "badgeWarn"
                  }`}
                >
                  {pagoStatus}
                </div>
              ) : null}

              {pagos.length ? (
                <div className="card" style={{ margin: 0 }}>
                  <div className="cardTitle">Pagos registrados</div>
                  <div className="mut">Total pagos: {pagos.length}</div>
                  {pagos.map((p) => (
                    <div key={p.id} className="item">
                      <div className="itemTitle">
                        {String(p.tipo || "").toUpperCase()} · {money(p.monto)}
                      </div>
                      <div className="itemSub">
                        {p.created_at
                          ? new Date(p.created_at).toLocaleString("es-MX")
                          : ""}
                        {p.nota ? ` · ${p.nota}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM BAR */}
      <div className="bottomBar">
        <div
          className={`bottomInner ${
            !secondaryAction && !canBack ? "single" : ""
          }`}
        >
          {canBack ? (
            <button
              type="button"
              className="btn btnGhost"
              onClick={() => goStep(step - 1)}
            >
              ← Atrás
            </button>
          ) : null}

          <button
            type="button"
            className="btn btnOlive"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
          >
            {primaryAction.label}
          </button>

          {secondaryAction ? (
            <button
              type="button"
              className="btn btnGhost"
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
              style={{ gridColumn: "1 / -1" }}
            >
              {secondaryAction.label}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
