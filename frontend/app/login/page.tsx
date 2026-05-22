"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { apiRequest } from "../../lib/api";


export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await apiRequest<{ ok: boolean; user: { role: string; name: string } }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ name: name, pin }),
      });
      if (typeof window !== "undefined") {
        localStorage.setItem("neoassistence_user", JSON.stringify(response.user));
      }
      const role = response.user.role;
      if (role === "admin") {
        router.push("/dashboard");
      } else if (role === "kiosko") {
        router.push("/kiosko");
      } else if (role.toLowerCase().includes("supervisor")) {
        router.push("/supervisor");
      } else if (role === "employee" || role === "tecnico" || role === "auxiliar") {
        router.push("/empleado");
      } else {
        router.push("/kiosko");
      }
    } catch (err) {
      setError("Credenciales inválidas. Verifica tu nombre y PIN.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <img src="/images/logo_modo_oscuro.fw.png" alt="NEOMOTIC" style={{height:56,display:"block",margin:"0 auto 8px"}} />
      <p style={{textAlign:"center",color:"#9bb4ca",marginBottom:32}}>Control de Asistencia</p>

      <form
        onSubmit={handleSubmit}
        className="glass"
        style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}
      >
        <h2 style={{ marginTop: 0 }}>Acceso seguro</h2>
        <p style={{ color: "#9bb4ca" }}>Inicia sesión con tu nombre y PIN.</p>

        <label style={{ display: "block", marginBottom: 8 }}>Nombre</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ejemplo: Juan Perez"
          style={{ width: "100%", padding: 14, borderRadius: 16, border: "1px solid rgba(94,242,255,0.18)", marginBottom: 16, background: "rgba(10,21,38,0.8)", color: "white" }}
        />

        <label style={{ display: "block", marginBottom: 8 }}>PIN</label>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Ingresa tu PIN"
          style={{ width: "100%", padding: 14, borderRadius: 16, border: "1px solid rgba(94,242,255,0.18)", marginBottom: 16, background: "rgba(10,21,38,0.8)", color: "white" }}
        />

        {error ? <p style={{ color: "#ff8c9e" }}>{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 16,
            border: "1px solid rgba(94,242,255,0.28)",
            background: "linear-gradient(135deg, rgba(94,242,255,0.14), rgba(156,255,181,0.08))",
            color: "white",
            cursor: "pointer",
          }}
        >
          {loading ? "Ingresando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
