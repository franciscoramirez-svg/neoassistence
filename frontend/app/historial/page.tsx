"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("neoassistence_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default function HistorialPage() {
  const router = useRouter();
  const [user, setUser] = useState(getStoredUser);
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"records" | "permisos" | "incidencias">("records");
  const [records, setRecords] = useState<any[]>([]);
  const [permisos, setPermisos] = useState<any[]>([]);
  const [incidencias, setIncidencias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && !user) router.push("/login"); }, [mounted, user, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      apiRequest<any[]>("/records").then(r => (r as any)?.data?.items || []).catch(() => []),
      apiRequest<any[]>(`/permisos?empleado=${user.name}`).catch(() => []),
      apiRequest<any[]>(`/incidencias?empleado=${user.name}`).catch(() => []),
    ]).then(([rec, per, inc]) => {
      setRecords(rec.filter((r: any) => r.empleado === user.name));
      setPermisos(per || []);
      setIncidencias(inc || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  if (!mounted || !user) return <main className="page-shell"><div className="skeleton" style={{width:"100%",height:300,borderRadius:24}} /></main>;

  const goBack = user?.role === "admin" ? "/dashboard" : user?.role?.includes("supervisor") ? "/supervisor" : "/empleado";

  return (
    <main className="page-shell">
      <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",marginBottom:8}}>
        <Link href={goBack} style={{color:"#5ef2ff",fontSize:13,textDecoration:"none"}}>← Volver</Link>
        <button onClick={()=>{localStorage.removeItem("neoassistence_user");router.push("/login")}} style={{background:"none",border:"none",color:"#ff8c9e",cursor:"pointer"}}>Cerrar sesión</button>
      </nav>

      <div className="glass" style={{padding:24,marginBottom:20}}>
        <p style={{color:"#5ef2ff",textTransform:"uppercase",letterSpacing:"0.18em"}}>Mi historial</p>
        <h1 style={{margin:"8px 0"}}>{user.name}</h1>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {(["records", "permisos", "incidencias"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex:1, padding:"10px", borderRadius:10,
            border: tab === t ? "1px solid rgba(94,242,255,0.4)" : "1px solid rgba(255,255,255,0.1)",
            background: tab === t ? "rgba(94,242,255,0.12)" : "transparent",
            color: tab === t ? "#5ef2ff" : "#9bb4ca", cursor:"pointer", fontSize:13
          }}>
            {t === "records" ? "📋 Asistencia" : t === "permisos" ? "🏖️ Permisos" : "⚠️ Incidencias"}
          </button>
        ))}
      </div>

      <div className="glass" style={{padding:24,borderRadius:16}}>
        {loading ? (
          <div className="skeleton" style={{width:"100%",height:200,borderRadius:16}} />
        ) : tab === "records" ? (
          records.length === 0 ? <p style={{color:"#9bb4ca",textAlign:"center"}}>Sin registros</p> : (
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead><tr style={{borderBottom:"1px solid rgba(94,242,255,0.15)"}}>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Fecha</th>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Tipo</th>
                  <th style={{textAlign:"center",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Estatus</th>
                </tr></thead>
                <tbody>
                  {records.slice(0, 50).map((r: any) => (
                    <tr key={r.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                      <td style={{padding:"8px",color:"white"}}>{new Date(r.fecha_hora).toLocaleString("es-MX")}</td>
                      <td style={{padding:"8px",color:"#9bb4ca"}}>{r.tipo}</td>
                      <td style={{padding:"8px",textAlign:"center",color: r.estatus === "A Tiempo" ? "#9cffb5" : r.estatus?.includes("Retardo") ? "#ff8c9e" : r.estatus === "Permiso" ? "#5ef2ff" : "#ffcc5e"}}>{r.estatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tab === "permisos" ? (
          permisos.length === 0 ? <p style={{color:"#9bb4ca",textAlign:"center"}}>Sin permisos</p> : (
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead><tr style={{borderBottom:"1px solid rgba(94,242,255,0.15)"}}>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Tipo</th>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Inicio</th>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Fin</th>
                  <th style={{textAlign:"center",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Estado</th>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Comentario</th>
                </tr></thead>
                <tbody>
                  {permisos.map((p: any) => (
                    <tr key={p.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                      <td style={{padding:"8px",color:"white"}}>{p.tipo === "vacacion" ? "Vacación" : "Permiso"}</td>
                      <td style={{padding:"8px",color:"#9bb4ca"}}>{p.fecha_inicio}</td>
                      <td style={{padding:"8px",color:"#9bb4ca"}}>{p.fecha_fin}</td>
                      <td style={{padding:"8px",textAlign:"center",color: p.estatus === "aprobado" ? "#9cffb5" : p.estatus === "rechazado" ? "#ff8c9e" : "#ffcc5e"}}>{p.estatus}</td>
                      <td style={{padding:"8px",color:"#9bb4ca"}}>{p.admin_comentario || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          incidencias.length === 0 ? <p style={{color:"#9bb4ca",textAlign:"center"}}>Sin incidencias</p> : (
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead><tr style={{borderBottom:"1px solid rgba(94,242,255,0.15)"}}>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Tipo</th>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Fecha</th>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Motivo</th>
                  <th style={{textAlign:"center",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Estado</th>
                </tr></thead>
                <tbody>
                  {incidencias.map((i: any) => (
                    <tr key={i.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                      <td style={{padding:"8px",color:"white"}}>{i.tipo}</td>
                      <td style={{padding:"8px",color:"#9bb4ca"}}>{i.fecha}</td>
                      <td style={{padding:"8px",color:"#9bb4ca",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{i.motivo || "—"}</td>
                      <td style={{padding:"8px",textAlign:"center",color: i.estatus === "aprobada" ? "#9cffb5" : i.estatus === "rechazada" ? "#ff8c9e" : "#ffcc5e"}}>{i.estatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </main>
  );
}
