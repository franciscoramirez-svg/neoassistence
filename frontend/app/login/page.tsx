"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../lib/api";


export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const raw = identifier.trim();
      const neoMatch = raw.match(/^neo\s*(\d+)$/i);
      const digitsMatch = raw.match(/^\d+$/);
      let employee_number: string | null = null;
      let name = "";
      if (neoMatch) {
        employee_number = neoMatch[1];
      } else if (digitsMatch) {
        employee_number = raw;
      } else {
        name = raw;
      }
      const body = { name, pin, employee_number };
      const response = await apiRequest<{ ok: boolean; user: { role: string; name: string } }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
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
      } else {
        router.push("/empleado");
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
        <p style={{ color: "#9bb4ca" }}>Ingresa con tu usuario y PIN.</p>

        <label style={{display:"block",marginBottom:8}}>Usuario</label>
        <input value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="NEO0102 o tu número o tu nombre" style={{width:"100%",padding:14,borderRadius:16,border:"1px solid rgba(94,242,255,0.18)",marginBottom:16,background:"rgba(10,21,38,0.8)",color:"white",fontSize:14}} />

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
