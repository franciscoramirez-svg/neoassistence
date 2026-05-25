"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

type RecordItem = {
  id: string; empleado: string; tipo: string; estatus: string; fecha_hora: string;
};

function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("neoassistence_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default function SupervisorPage() {
  const router = useRouter();
  const [user, setUser] = useState(getStoredUser);
  const [mounted, setMounted] = useState(false);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && !user) router.push("/login"); }, [mounted, user, router]);

  useEffect(() => {
    if (!user) return;
    apiRequest<{ data: { items: RecordItem[] } }>("/records")
      .then(r => { setRecords(r.data?.items || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  function handleLogout() {
    localStorage.removeItem("neoassistence_user");
    router.push("/login");
  }

  if (!mounted || !user) {
    return (
      <main className="page-shell" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
        <div className="skeleton" style={{width:280,height:200,borderRadius:24}} />
      </main>
    );
  }

  const hoy = new Date().toISOString().split("T")[0];
  const hoyRecords = records.filter(r => r.fecha_hora?.startsWith(hoy));
  const entradas = hoyRecords.filter(r => r.tipo === "Entrada").length;
  const salidas = hoyRecords.filter(r => r.tipo === "Salida").length;
  const retardos = hoyRecords.filter(r => r.estatus?.includes("Retardo")).length;
  const aTiempo = entradas - retardos;
  const totalHoy = hoyRecords.length;

  const stats = [
    { label: "Total hoy", value: totalHoy, color: "#5ef2ff" },
    { label: "Entradas", value: entradas, color: "#9cffb5" },
    { label: "A tiempo", value: aTiempo, color: "#9cffb5" },
    { label: "Retardos", value: retardos, color: "#ff8c9e" },
    { label: "Salidas", value: salidas, color: "#d08aff" },
  ];

  return (
    <main className="page-shell" style={{padding:16}}>
      <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",marginBottom:8}}>
        <img src="/images/logo_modo_oscuro.fw.png" alt="NEOMOTIC" style={{height:32}} />
        <button onClick={handleLogout} style={{background:"none",border:"none",color:"#ff8c9e",cursor:"pointer",fontSize:14}}>Cerrar sesión</button>
      </nav>

      <p style={{color:"#9bb4ca",fontSize:14,marginBottom:16}}>Bienvenido, {user.name}</p>

      {loading ? (
        <div className="skeleton" style={{width:"100%",height:400,borderRadius:24}} />
      ) : (
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(100px, 1fr))",gap:10,marginBottom:20}}>
            {stats.map(s => (
              <div key={s.label} className="glass" style={{padding:"14px 10px",textAlign:"center",borderRadius:16}}>
                <p style={{margin:0,fontSize:24,fontWeight:700,color:s.color}}>{s.value}</p>
                <p style={{margin:"4px 0 0",fontSize:11,color:"#9bb4ca",textTransform:"uppercase",letterSpacing:"0.08em"}}>{s.label}</p>
              </div>
            ))}
          </div>

          <div style={{width:"100%",display:"flex",flexDirection:"column",gap:10}}>
            <button onClick={()=>router.push("/kiosko")} style={{width:"100%",padding:"16px",borderRadius:14,border:"1px solid rgba(94,242,255,0.3)",background:"linear-gradient(135deg, rgba(94,242,255,0.12), rgba(156,255,181,0.06))",color:"white",fontSize:15,fontWeight:"bold",cursor:"pointer"}}>
              Kiosko
            </button>
            <button onClick={()=>router.push("/empleado")} style={{width:"100%",padding:"16px",borderRadius:14,border:"1px solid rgba(208,138,255,0.3)",background:"rgba(208,138,255,0.08)",color:"white",fontSize:15,fontWeight:"bold",cursor:"pointer"}}>
              Ver Credenciales
            </button>
            <button onClick={()=>router.push("/yts")} style={{width:"100%",padding:"16px",borderRadius:14,border:"1px solid rgba(255,204,94,0.3)",background:"rgba(255,204,94,0.08)",color:"white",fontSize:15,fontWeight:"bold",cursor:"pointer"}}>
              Yo Trabajo Seguro
            </button>
            <button onClick={()=>router.push("/permisos")} style={{width:"100%",padding:"16px",borderRadius:14,border:"1px solid rgba(156,255,181,0.3)",background:"rgba(156,255,181,0.08)",color:"white",fontSize:15,fontWeight:"bold",cursor:"pointer"}}>
              Permisos y Vacaciones
            </button>
          </div>
        </>
      )}
    </main>
  );
}
