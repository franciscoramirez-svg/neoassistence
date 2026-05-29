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
      let employee_number: string | null = null;
      let name = "";
      if (neoMatch) {
        employee_number = neoMatch[1];
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
    <main style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:"-30%",left:"-20%",width:"70%",height:"70%",borderRadius:"50%",background:"radial-gradient(circle,rgba(0,242,254,0.12),transparent 70%)",pointerEvents:"none"}} />
      <div style={{position:"absolute",bottom:"-30%",right:"-20%",width:"70%",height:"70%",borderRadius:"50%",background:"radial-gradient(circle,rgba(179,136,255,0.1),transparent 70%)",pointerEvents:"none"}} />

      <img src="/images/logo_modo_oscuro.fw.png" alt="NEOMOTIC" style={{height:48,marginBottom:8}} />
      <p style={{textAlign:"center",color:"#9bb4ca",marginBottom:28,fontSize:14}}>Control de Asistencia</p>

      <form onSubmit={handleSubmit} className="glass" style={{maxWidth:440,width:"100%",padding:28}}>
        <h2 style={{margin:"0 0 4px",fontSize:18}}>Acceso seguro</h2>
        <p style={{color:"#9bb4ca",margin:"0 0 20px",fontSize:13}}>Ingresa con tu usuario y PIN.</p>

        <label style={{display:"block",marginBottom:6,fontSize:13,color:"#9bb4ca"}}>Usuario</label>
        <input value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="NEO0102 o tu nombre" style={{width:"100%",padding:14,borderRadius:12,border:"1px solid rgba(0,242,254,0.15)",marginBottom:16,background:"rgba(10,21,38,0.8)",color:"white",fontSize:14,outline:"none"}} />

        <label style={{display:"block",marginBottom:6,fontSize:13,color:"#9bb4ca"}}>PIN</label>
        <input type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="Ingresa tu PIN" style={{width:"100%",padding:14,borderRadius:12,border:"1px solid rgba(0,242,254,0.15)",marginBottom:16,background:"rgba(10,21,38,0.8)",color:"white",fontSize:14,outline:"none"}} />

        {error ? <p style={{color:"#ff8c9e",fontSize:13,margin:"0 0 12px"}}>{error}</p> : null}

        <button type="submit" disabled={loading} style={{width:"100%",padding:"16px 20px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#00f2fe,#b388ff)",color:"#fff",fontSize:15,fontWeight:600,cursor:loading?"not-allowed":"pointer",opacity:loading?0.6:1}}>
          {loading ? "Ingresando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
