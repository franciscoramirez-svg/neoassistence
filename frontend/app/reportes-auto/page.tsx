"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("neoassistence_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

type ReportConfig = {
  id: string;
  email_destino: string;
  hora_envio: string;
  dias_activos: string[];
  ultimo_envio: string | null;
};

export default function ReportesAutoPage() {
  const router = useRouter();
  const [user, setUser] = useState(getStoredUser());
  const [mounted, setMounted] = useState(false);
  const [config, setConfig] = useState<ReportConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  
  const [email, setEmail] = useState("");
  const [hora, setHora] = useState("08:00");
  const [dias, setDias] = useState<string[]>([]);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && !user) router.push("/login"); }, [mounted, user, router]);

  useEffect(() => {
    if (!user) return;
    apiRequest<any>("/reports/config").then(r => {
      setConfig(r);
      setEmail(r.email_destino || "");
      setHora(r.hora_envio || "08:00");
      setDias(r.dias_activos || ["lun", "mar", "mie", "jue", "vie"]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  const toggleDia = (dia: string) => {
    if (dias.includes(dia)) {
      setDias(dias.filter(d => d !== dia));
    } else {
      setDias([...dias, dia]);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setMessage("");
    try {
      await apiRequest<any>("/reports/config", {
        method: "POST",
        body: JSON.stringify({
          email_destino: email,
          hora_envio: hora,
          dias_activos: dias,
        }),
      });
      setMessage("✓ Configuración guardada");
    } catch (e: any) {
      setMessage("Error: " + (e?.message || "intenta de nuevo"));
    }
    setSaving(false);
  };

  const sendReport = async () => {
    if (!email.trim()) {
      setMessage("⚠️ Primero configura el email y guarda");
      return;
    }
    setMessage("Enviando...");
    try {
      const res = await apiRequest<any>("/reports/send", { method: "POST" });
      setMessage(res.message || "✓ Reporte enviado");
    } catch (e: any) {
      setMessage("Error: " + (e?.message || "sin configuración"));
    }
  };

  if (!mounted || !user) return (
    <main className="page-shell"><div style={{textAlign:"center",padding:40}}><div className="skeleton" style={{width:"100%",height:300,borderRadius:24}} /></div></main>
  );

  const diasSemana = [
    { key: "lun", label: "Lun" },
    { key: "mar", label: "Mar" },
    { key: "mie", label: "Mie" },
    { key: "jue", label: "Jue" },
    { key: "vie", label: "Vie" },
    { key: "sab", label: "Sab" },
    { key: "dom", label: "Dom" },
  ];

  return (
    <main className="page-shell">
      <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",marginBottom:8}}>
        <img src="/images/logo_modo_oscuro.fw.png" alt="NEOMOTIC" style={{height:32}} />
        <button onClick={() => { localStorage.removeItem("neoassistence_user"); router.push("/login"); }} style={{background:"none",border:"none",color:"#ff8c9e",cursor:"pointer"}}>Cerrar sesión</button>
      </nav>

      <Link href="/reportes" style={{color:"#5ef2ff",textDecoration:"none",display:"block",marginBottom:16}}>← Volver a Reportes</Link>

      <div className="glass" style={{padding:24,marginBottom:24}}>
        <h1 style={{margin:0,fontSize:28}}>📧 Auto-Reporte</h1>
        <p style={{color:"#9bb4ca",marginTop:8}}>Configura envío automático de reportes</p>
      </div>

      <div className="glass" style={{padding:24,marginBottom:24}}>
        <h2 style={{marginTop:0,marginBottom:16}}>⚙️ Configuración</h2>
        
        <div style={{marginBottom:20}}>
          <label style={{display:"block",marginBottom:8,color:"#9bb4ca"}}>Email de destino</label>
          <input 
            type="email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            placeholder="correo@empresa.com"
            style={{width:"100%",maxWidth:400,padding:14,borderRadius:12,border:"1px solid rgba(94,242,255,0.2)",background:"rgba(10,21,38,0.8)",color:"white"}}
          />
        </div>

        <div style={{marginBottom:20}}>
          <label style={{display:"block",marginBottom:8,color:"#9bb4ca"}}>Hora de envío</label>
          <input 
            type="time" 
            value={hora} 
            onChange={e => setHora(e.target.value)}
            style={{padding:14,borderRadius:12,border:"1px solid rgba(94,242,255,0.2)",background:"rgba(10,21,38,0.8)",color:"white"}}
          />
        </div>

        <div style={{marginBottom:20}}>
          <label style={{display:"block",marginBottom:8,color:"#9bb4ca"}}>Días activos</label>
          <div style={{display:"flex",gap:8}}>
            {diasSemana.map(d => (
              <button 
                key={d.key}
                onClick={() => toggleDia(d.key)}
                style={{
                  padding:"10px 16px",borderRadius:10,
                  border:"1px solid " + (dias.includes(d.key) ? "rgba(94,242,255,0.5)" : "rgba(94,242,255,0.2)"),
                  background: dias.includes(d.key) ? "rgba(94,242,255,0.2)" : "transparent",
                  color: dias.includes(d.key) ? "#5ef2ff" : "#9bb4ca",
                  cursor:"pointer",
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{display:"flex",gap:12}}>
          <button onClick={saveConfig} disabled={saving} style={{padding:"14px 24px",borderRadius:12,border:"1px solid rgba(94,242,255,0.3)",background:saving?"rgba(94,242,255,0.1)":"rgba(94,242,255,0.2)",color:"#5ef2ff",cursor:saving?"not-allowed":"pointer"}}>
            {saving ? "Guardando..." : "💾 Guardar"}
          </button>
          <button onClick={sendReport} style={{padding:"14px 24px",borderRadius:12,border:"1px solid rgba(156,255,181,0.3)",background:"rgba(156,255,181,0.1)",color:"#9cffb5",cursor:"pointer"}}>
            Enviar ahora
          </button>
          <button onClick={async ()=>{setMessage("Enviando...");try{const r=await apiRequest<any>("/reports/send?force=true",{method:"POST"});setMessage(r.message||"Enviado")}catch(e:any){setMessage("Error: "+e?.message)}}} style={{padding:"14px 24px",borderRadius:12,border:"1px solid rgba(255,204,94,0.3)",background:"rgba(255,204,94,0.1)",color:"#ffcc5e",cursor:"pointer"}}>
            Forzar envío
          </button>
        </div>

        {message && <p style={{marginTop:16,color:message.includes("✓") ? "#9cffb5" : "#ff8c9e"}}>{message}</p>}
      </div>

      <div className="glass" style={{padding:24}}>
        <h2 style={{marginTop:0,marginBottom:16}}>ℹ️ Información</h2>
        <ul style={{color:"#9bb4ca",lineHeight:1.8,paddingLeft:20}}>
          <li>El reporte se envía automáticamente cada día a la hora configurada</li>
          <li>Solo se envía en días activos seleccionados</li>
          <li>Contiene:total, entradas, salidas, retardos y resumen por sucursal</li>
          <li>Último envío: {config?.ultimo_envio || "Nunca"}</li>
        </ul>
      </div>
    </main>
  );
}