"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("neoassistence_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

const BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://192.168.1.85:8000";

export default function EmpleadoPage() {
  const router = useRouter();
  const [user, setUser] = useState(getStoredUser);
  const [mounted, setMounted] = useState(false);
  const [employee, setEmployee] = useState<any>(null);
  const [branchName, setBranchName] = useState("");

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (mounted && !user) router.push("/login");
  }, [mounted, user, router]);

  useEffect(() => {
    if (!user) return;
    apiRequest<any>(`/employees`).then((emps) => {
      const found = emps.find((e: any) => e.id === user.id || e.nombre === user.name);
      if (found) {
        setEmployee(found);
        if (found.sucursal_id) {
          apiRequest<any[]>(`/branches`).then((branches) => {
            const b = branches.find((br: any) => br.id === found.sucursal_id);
            if (b) setBranchName(b.nombre);
          }).catch(() => {});
        }
      }
    }).catch(() => {});
  }, [user]);

  const isSupervisor = user?.role?.toLowerCase().includes("supervisor");
  const goBack = user?.role === "admin" ? "/dashboard" : "/supervisor";

  if (!mounted || !user) {
    return (
      <main className="page-shell" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
        <div className="skeleton" style={{width:280,height:300,borderRadius:24}} />
      </main>
    );
  }

  const badge = employee?.numero_empleado || (user.id ? `NEOM-${user.id.slice(0,8).toUpperCase()}` : "NEOM-00000");
  const fotoUrl = employee?.foto_url ? `${BASE}${employee.foto_url}` : null;

  return (
    <main className="page-shell" style={{padding:16, maxWidth:480, margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <h1 style={{color:"#d08aff",fontSize:20,margin:0}}>NEOMOTIC</h1>
        <div style={{display:"flex",gap:8}}>
          {(isSupervisor || user?.role === "admin") && <button onClick={()=>router.push(goBack)} style={{padding:"8px 14px",borderRadius:8,border:"1px solid rgba(94,242,255,0.3)",background:"transparent",color:"#5ef2ff",fontSize:12}}>Volver</button>}
          <button onClick={()=>{localStorage.removeItem("neoassistence_user"); router.push("/login");}} style={{padding:"8px 14px",borderRadius:8,border:"1px solid rgba(255,140,158,0.3)",background:"transparent",color:"#ff8c9e",fontSize:12}}>Salir</button>
        </div>
      </div>

      <div className="glass" style={{padding:24,borderRadius:20,marginBottom:16,background:"linear-gradient(135deg, rgba(94,242,255,0.08), rgba(208,138,255,0.08))",border:"1px solid rgba(94,242,255,0.2)"}}>
        <div style={{display:"flex",gap:20,alignItems:"center"}}>
          <div style={{width:96,height:96,borderRadius:"50%",background:fotoUrl ? "transparent" : "linear-gradient(135deg, #5ef2ff, #d08aff)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0,border:"2px solid rgba(94,242,255,0.4)"}}>
            {fotoUrl ? (
              <img src={fotoUrl} alt="foto" style={{width:"100%",height:"100%",objectFit:"cover"}} />
            ) : (
              <span style={{fontSize:36,color:"white",fontWeight:"bold"}}>{user.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div style={{flex:1}}>
            <p style={{color:"white",fontSize:20,margin:0,fontWeight:"bold"}}>{user.name}</p>
            <p style={{color:"#9bb4ca",fontSize:13,margin:"4px 0",textTransform:"capitalize"}}>{user.role}</p>
          </div>
        </div>

        <div style={{marginTop:20,paddingTop:16,borderTop:"1px solid rgba(255,255,255,0.08)"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <span style={{color:"#9bb4ca",fontSize:12}}>No. Empleado</span>
            <span style={{color:"white",fontSize:14,fontWeight:"bold",fontFamily:"monospace"}}>{badge}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <span style={{color:"#9bb4ca",fontSize:12}}>Sucursal</span>
            <span style={{color:"#5ef2ff",fontSize:13}}>{branchName || "No asignada"}</span>
          </div>
        </div>
      </div>

      <div className="glass" style={{padding:20,borderRadius:16,marginBottom:16}}>
        <h2 style={{color:"#5ef2ff",fontSize:15,marginTop:0}}>Credencial Digital</h2>
        <p style={{color:"#9bb4ca",fontSize:12,lineHeight:1.5,fontStyle:"italic"}}>
          Identificación oficial laboral. Este documento es propiedad de NEOMOTIC 
          y debe ser presentado ante el personal de seguridad cuando sea requerido.
        </p>
      </div>

      <button onClick={()=>router.push("/yts")} style={{width:"100%",padding:"16px",borderRadius:16,border:"1px solid rgba(255,204,94,0.3)",background:"rgba(255,204,94,0.08)",color:"white",fontSize:15,fontWeight:"bold",cursor:"pointer"}}>
        Yo Trabajo Seguro
      </button>
      <button onClick={()=>router.push("/permisos")} style={{width:"100%",padding:"16px",borderRadius:16,border:"1px solid rgba(156,255,181,0.3)",background:"rgba(156,255,181,0.08)",color:"white",fontSize:15,fontWeight:"bold",cursor:"pointer",marginTop:8}}>
        Permisos y Vacaciones
      </button>
    </main>
  );
}
