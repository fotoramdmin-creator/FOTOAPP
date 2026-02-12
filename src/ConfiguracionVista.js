// src/ConfiguracionVista.js
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const num = (v) => {
  const x = Number(v);
  return isFinite(x) ? x : 0;
};

/* ✅ IMPORTANTE:
   PasswordInput FUERA del componente para que NO se re-monte
   en cada render (eso era lo que cortaba el foco letra por letra).
*/
function PasswordInput({
  showPasswords,
  setShowPasswords,
  value,
  onChange,
  placeholder,
}) {
  return (
    <div style={{ position: "relative" }}>
      <input
        type={showPasswords ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "12px 44px 12px 12px",
          borderRadius: 12,
        }}
      />

      <button
        type="button"
        // ✅ Evita que el botón robe foco (PC y móvil)
        onMouseDown={(e) => e.preventDefault()}
        onTouchStart={(e) => e.preventDefault()}
        onClick={() => setShowPasswords((v) => !v)}
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 18,
          opacity: 0.75,
        }}
        title={showPasswords ? "Ocultar" : "Mostrar"}
      >
        {showPasswords ? "🙈" : "👁️"}
      </button>
    </div>
  );
}

export default function ConfiguracionVista({ session, onBack }) {
  const isAdmin = session?.admin === true;

  // ====== Navegación interna ======
  // home | password | precios | agregar
  const [tab, setTab] = useState("home");

  // ====== Usuarios (para selector admin) ======
  const [usuarios, setUsuarios] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchUsuarios = async () => {
    setLoadingUsers(true);
    const { data, error } = await supabase
      .from("usuarios_lista")
      .select("id,codigo,nombre,username,tipo,admin,activo")
      .order("nombre", { ascending: true });

    const rows = !error && Array.isArray(data) ? data : [];
    setUsuarios(isAdmin ? rows : rows.filter((u) => u.id === session?.id));
    setLoadingUsers(false);
  };

  useEffect(() => {
    fetchUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ====== Cambiar contraseña ======
  const [usuarioSelId, setUsuarioSelId] = useState(session?.id || "");
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPass, setSavingPass] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    if (!usuarioSelId && session?.id) setUsuarioSelId(session.id);
  }, [session?.id, usuarioSelId]);

  const onCambiarPassword = async () => {
    if (!usuarioSelId) return alert("Selecciona usuario");
    if (!actual || !nueva || !confirm) return alert("Llena todos los campos");
    if (nueva !== confirm) return alert("La nueva contraseña no coincide");
    if (String(nueva).length < 4)
      return alert("La nueva contraseña está muy corta");

    if (!isAdmin && usuarioSelId !== session?.id) {
      return alert("Solo puedes cambiar tu contraseña");
    }

    setSavingPass(true);
    const { error } = await supabase.rpc("cambiar_password", {
      p_usuario_id: usuarioSelId,
      p_actual: actual,
      p_nueva: nueva,
    });
    setSavingPass(false);

    if (error) return alert(error.message || "Error al cambiar contraseña");

    alert("Contraseña actualizada ✅");
    setActual("");
    setNueva("");
    setConfirm("");
    setShowPasswords(false);
  };

  // ====== Precios (ADMIN) ======
  const [precios, setPrecios] = useState([]);
  const [loadingPrecios, setLoadingPrecios] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [q, setQ] = useState("");

  const fetchPrecios = async () => {
    setLoadingPrecios(true);
    const { data, error } = await supabase
      .from("catalogo_precios")
      .select(
        "id,tamano,cantidad,precio_base,aumento_urgente,aumento_kenfor,activo"
      )
      .order("tamano", { ascending: true })
      .order("cantidad", { ascending: true });

    setPrecios(!error && Array.isArray(data) ? data : []);
    setLoadingPrecios(false);
  };

  const filteredPrecios = useMemo(() => {
    const s = String(q || "")
      .trim()
      .toUpperCase();
    if (!s) return precios;
    return precios.filter((r) =>
      String(r.tamano || "")
        .toUpperCase()
        .includes(s)
    );
  }, [precios, q]);

  const patchPrecio = (id, patch) => {
    setPrecios((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };

  const savePrecio = async (r) => {
    if (!isAdmin) return;

    const tam = String(r.tamano || "").trim();
    if (!tam) return alert("Falta TAMAÑO");
    const cant = Math.max(1, Math.floor(num(r.cantidad)));

    const payload = {
      tamano: tam.toUpperCase(),
      cantidad: cant,
      precio_base: num(r.precio_base),
      aumento_urgente: num(r.aumento_urgente),
      aumento_kenfor: num(r.aumento_kenfor),
      activo: !!r.activo,
    };

    setSavingId(r.id);
    const { data, error } = await supabase
      .from("catalogo_precios")
      .update(payload)
      .eq("id", r.id)
      .select(
        "id,tamano,cantidad,precio_base,aumento_urgente,aumento_kenfor,activo"
      )
      .single();
    setSavingId(null);

    if (error) return alert(error.message || "Error al guardar");
    setPrecios((prev) => prev.map((x) => (x.id === r.id ? data : x)));
  };

  // ====== Agregar paquete (ADMIN) ======
  const [aTamano, setATamano] = useState("");
  const [aCantidad, setACantidad] = useState("1");
  const [aPrecioBase, setAPrecioBase] = useState("0");
  const [aUrg, setAUrg] = useState("0");
  const [aKen, setAKen] = useState("0");
  const [aActivo, setAActivo] = useState(true);
  const [creating, setCreating] = useState(false);

  const createPaquete = async () => {
    if (!isAdmin) return;
    const tam = String(aTamano || "").trim();
    if (!tam) return alert("Falta TAMAÑO");
    const cant = Math.max(1, Math.floor(num(aCantidad)));

    setCreating(true);
    const { error } = await supabase.from("catalogo_precios").insert({
      tamano: tam.toUpperCase(),
      cantidad: cant,
      precio_base: num(aPrecioBase),
      aumento_urgente: num(aUrg),
      aumento_kenfor: num(aKen),
      activo: !!aActivo,
    });
    setCreating(false);

    if (error) return alert(error.message || "Error al crear paquete");

    alert("Paquete creado ✅");
    setATamano("");
    setACantidad("1");
    setAPrecioBase("0");
    setAUrg("0");
    setAKen("0");
    setAActivo(true);

    // refresca lista
    await fetchPrecios();
    setTab("precios");
  };

  // ====== UI helpers ======
  const CardBtn = ({ title, subtitle, onClick, disabled }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        textAlign: "left",
        padding: 14,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(180deg, #fff7e6 0%, #f3ead6 100%)",
        color: "#1b1b1b",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{ fontWeight: 1000, fontSize: 16 }}>{title}</div>
      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{subtitle}</div>
    </button>
  );

  const TopBar = ({ title }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 10,
      }}
    >
      <button
        type="button"
        onClick={() => (tab === "home" ? onBack?.() : setTab("home"))}
        style={{ padding: "10px 12px", borderRadius: 12, fontWeight: 900 }}
      >
        ←
      </button>
      <div>
        <div style={{ fontSize: 20, fontWeight: 1000 }}>{title}</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          {session?.nombre || session?.username || "-"} ·{" "}
          {isAdmin ? "ADMIN" : "USUARIO"}
        </div>
      </div>
    </div>
  );

  // ✅ NUEVO: Label arriba de inputs (para que se vean los nombres)
  const FieldLabel = ({ children }) => (
    <div
      style={{
        fontSize: 12,
        fontWeight: 900,
        opacity: 0.85,
        marginBottom: 6,
        letterSpacing: 0.4,
      }}
    >
      {children}
    </div>
  );

  // ====== Render ======
  if (tab === "home") {
    return (
      <div style={{ padding: 12 }}>
        <TopBar title="Configuración" />

        <div style={{ display: "grid", gap: 12 }}>
          <CardBtn
            title="Cambiar contraseña"
            subtitle="Actualiza tu contraseña (o de cualquier usuario si eres admin)."
            onClick={() => setTab("password")}
          />

          <CardBtn
            title="Actualización de precios"
            subtitle="Editar precios existentes del catálogo."
            onClick={async () => {
              if (!isAdmin) return;
              await fetchPrecios();
              setTab("precios");
            }}
            disabled={!isAdmin}
          />

          <CardBtn
            title="Aumentar paquete"
            subtitle="Crear un nuevo tamaño/paquete en el catálogo."
            onClick={() => setTab("agregar")}
            disabled={!isAdmin}
          />
        </div>

        {!isAdmin && (
          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
            Las opciones de precios/paquetes solo están disponibles para ADMIN.
          </div>
        )}
      </div>
    );
  }

  if (tab === "password") {
    return (
      <div style={{ padding: 12 }}>
        <TopBar title="Cambiar contraseña" />

        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 1000, marginBottom: 10 }}>Datos</div>

          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                Usuario
              </div>
              <select
                value={usuarioSelId}
                onChange={(e) => setUsuarioSelId(e.target.value)}
                disabled={!isAdmin}
                style={{ width: "100%", padding: 12, borderRadius: 12 }}
              >
                {loadingUsers ? (
                  <option>Cargando…</option>
                ) : (
                  usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} · {u.username} {u.admin ? "(ADMIN)" : ""}
                    </option>
                  ))
                )}
              </select>

              {!isAdmin && (
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                  Solo puedes cambiar tu contraseña.
                </div>
              )}
            </div>

            <PasswordInput
              showPasswords={showPasswords}
              setShowPasswords={setShowPasswords}
              placeholder="Contraseña actual"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
            />
            <PasswordInput
              showPasswords={showPasswords}
              setShowPasswords={setShowPasswords}
              placeholder="Nueva contraseña"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
            />
            <PasswordInput
              showPasswords={showPasswords}
              setShowPasswords={setShowPasswords}
              placeholder="Confirmar nueva contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />

            <button
              onClick={onCambiarPassword}
              disabled={savingPass}
              type="button"
              style={{
                padding: 12,
                borderRadius: 14,
                fontWeight: 1000,
                cursor: "pointer",
                opacity: savingPass ? 0.7 : 1,
              }}
            >
              {savingPass ? "Guardando…" : "Actualizar contraseña"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ✅ SOLO CAMBIO AQUÍ: labels arriba de los inputs en "precios" */
  if (tab === "precios") {
    return (
      <div style={{ padding: 12 }}>
        <TopBar title="Actualización de precios" />

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar tamaño…"
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 12,
            marginBottom: 12,
          }}
        />

        {loadingPrecios ? (
          <div style={{ opacity: 0.8 }}>Cargando…</div>
        ) : filteredPrecios.length === 0 ? (
          <div style={{ opacity: 0.8 }}>Sin registros.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {filteredPrecios.map((r) => (
              <div
                key={r.id}
                style={{
                  padding: 12,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                <div style={{ display: "grid", gap: 10 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 110px",
                      gap: 10,
                    }}
                  >
                    <div>
                      <FieldLabel>TAMAÑO</FieldLabel>
                      <input
                        value={r.tamano || ""}
                        onChange={(e) =>
                          patchPrecio(r.id, { tamano: e.target.value })
                        }
                        placeholder="Tamaño"
                        style={{ padding: 12, borderRadius: 12, width: "100%" }}
                      />
                    </div>

                    <div>
                      <FieldLabel>CANTIDAD</FieldLabel>
                      <input
                        value={r.cantidad ?? 1}
                        onChange={(e) =>
                          patchPrecio(r.id, { cantidad: e.target.value })
                        }
                        inputMode="numeric"
                        placeholder="Cantidad"
                        style={{ padding: 12, borderRadius: 12, width: "100%" }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: 10,
                    }}
                  >
                    <div>
                      <FieldLabel>PRECIO BASE</FieldLabel>
                      <input
                        value={r.precio_base ?? 0}
                        onChange={(e) =>
                          patchPrecio(r.id, { precio_base: e.target.value })
                        }
                        inputMode="decimal"
                        placeholder="Precio base"
                        style={{ padding: 12, borderRadius: 12, width: "100%" }}
                      />
                    </div>

                    <div>
                      <FieldLabel>URGENTE</FieldLabel>
                      <input
                        value={r.aumento_urgente ?? 0}
                        onChange={(e) =>
                          patchPrecio(r.id, { aumento_urgente: e.target.value })
                        }
                        inputMode="decimal"
                        placeholder="Aumento urgente"
                        style={{ padding: 12, borderRadius: 12, width: "100%" }}
                      />
                    </div>

                    <div>
                      <FieldLabel>KENFOR</FieldLabel>
                      <input
                        value={r.aumento_kenfor ?? 0}
                        onChange={(e) =>
                          patchPrecio(r.id, { aumento_kenfor: e.target.value })
                        }
                        inputMode="decimal"
                        placeholder="Aumento Kenfor"
                        style={{ padding: 12, borderRadius: 12, width: "100%" }}
                      />
                    </div>
                  </div>

                  <div
                    style={{ display: "flex", gap: 10, alignItems: "center" }}
                  >
                    <label
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <input
                        type="checkbox"
                        checked={!!r.activo}
                        onChange={(e) =>
                          patchPrecio(r.id, { activo: e.target.checked })
                        }
                      />
                      <span style={{ fontWeight: 900 }}>Activo</span>
                    </label>

                    <div style={{ flex: 1 }} />

                    <button
                      type="button"
                      onClick={() => savePrecio(r)}
                      disabled={savingId === r.id}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        fontWeight: 1000,
                        opacity: savingId === r.id ? 0.7 : 1,
                      }}
                    >
                      {savingId === r.id ? "Guardando…" : "Guardar"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // tab === "agregar"
  return (
    <div style={{ padding: 12 }}>
      <TopBar title="Aumentar paquete" />

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          padding: 12,
        }}
      >
        <div style={{ fontWeight: 1000, marginBottom: 10 }}>Nuevo paquete</div>

        <div style={{ display: "grid", gap: 10 }}>
          <input
            value={aTamano}
            onChange={(e) => setATamano(e.target.value)}
            placeholder="Tamaño (ej. CALIA 2)"
            style={{ width: "100%", padding: 12, borderRadius: 12 }}
          />

          <input
            value={aCantidad}
            onChange={(e) => setACantidad(e.target.value)}
            inputMode="numeric"
            placeholder="Cantidad"
            style={{ width: "100%", padding: 12, borderRadius: 12 }}
          />

          <input
            value={aPrecioBase}
            onChange={(e) => setAPrecioBase(e.target.value)}
            inputMode="decimal"
            placeholder="Precio base"
            style={{ width: "100%", padding: 12, borderRadius: 12 }}
          />

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            <input
              value={aUrg}
              onChange={(e) => setAUrg(e.target.value)}
              inputMode="decimal"
              placeholder="Aumento urgente"
              style={{ padding: 12, borderRadius: 12 }}
            />
            <input
              value={aKen}
              onChange={(e) => setAKen(e.target.value)}
              inputMode="decimal"
              placeholder="Aumento Kenfor"
              style={{ padding: 12, borderRadius: 12 }}
            />
          </div>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={!!aActivo}
              onChange={(e) => setAActivo(e.target.checked)}
            />
            <span style={{ fontWeight: 900 }}>Activo</span>
          </label>

          <button
            type="button"
            onClick={createPaquete}
            disabled={creating}
            style={{
              padding: 12,
              borderRadius: 14,
              fontWeight: 1000,
              cursor: "pointer",
              opacity: creating ? 0.7 : 1,
            }}
          >
            {creating ? "Creando…" : "Crear paquete"}
          </button>
        </div>
      </div>
    </div>
  );
}
