"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../lib/api";


export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState<"name" | "number">("name");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body = loginMode === "number"
        ? { name: "", pin, employee_number: employeeNumber }
        : { name, pin, employee_number: null };
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
        <p style={{ color: "#9bb4ca" }}>Inicia sesión con tu número de empleado o nombre y PIN.</p>

        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <button type="button" onClick={()=>setLoginMode("number")} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid "+(loginMode==="number"?"rgba(94,242,255,0.4)":"rgba(94,242,255,0.18)"),background:loginMode==="number"?"rgba(94,242,255,0.1)":"transparent",color:loginMode==="number"?"#5ef2ff":"#9bb4ca",cursor:"pointer",fontSize:12}}>N° Empleado</button>
          <button type="button" onClick={()=>setLoginMode("name")} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid "+(loginMode==="name"?"rgba(94,242,255,0.4)":"rgba(94,242,255,0.18)"),background:loginMode==="name"?"rgba(94,242,255,0.1)":"transparent",color:loginMode==="name"?"#5ef2ff":"#9bb4ca",cursor:"pointer",fontSize:12}}>Nombre</button>
        </div>

        {loginMode === "name" ? (
          <>
            <label style={{display:"block",marginBottom:8}}>Nombre</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ejemplo: Juan Perez" style={{width:"100%",padding:14,borderRadius:16,border:"1px solid rgba(94,242,255,0.18)",marginBottom:16,background:"rgba(10,21,38,0.8)",color:"white"}} />
          </>
        ) : (
          <>
            <label style={{display:"block",marginBottom:8}}>Número de empleado</label>
            <input value={employeeNumber} onChange={e=>setEmployeeNumber(e.target.value)} placeholder="Ej: EMP-001" style={{width:"100%",padding:14,borderRadius:16,border:"1px solid rgba(94,242,255,0.18)",marginBottom:16,background:"rgba(10,21,38,0.8)",color:"white"}} />
          </>
        )}

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
