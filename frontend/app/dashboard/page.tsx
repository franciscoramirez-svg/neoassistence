"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { apiRequest } from "@/lib/api";

type RecordItem = {
  id: string;
  empleado: string;
  tipo: string;
  estatus: string;
  fecha_hora: string;
  sucursal_id: string;
};

type Branch = {
  id: string;
  nombre: string;
  lat: number;
  lon: number;
};

function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("neoassistence_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(getStoredUser());
  const [mounted, setMounted] = useState(false);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterDate, setFilterDate] = useState("");

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && !user) router.push("/login"); }, [mounted, user, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      apiRequest<{ data: { items: RecordItem[] } }>("/records").then(r => r.data?.items || []),
      apiRequest<any>("/branches").then(r => r.data || []).catch(() => [])
    ]).then(([rec, bra]) => {
      setRecords(rec);
      setBranches(Array.isArray(bra) ? bra : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  if (!mounted || !user) return <main className="page-shell"><div style={{textAlign:"center",padding:40}}><div className="skeleton" style={{width:"100%",height:300,borderRadius:24}} /></div></main>;

  const today = new Date().toISOString().split("T")[0];
  const filteredRecords = records.filter(r => {
    if (r.fecha_hora?.startsWith(filterDate || today)) {
      if (!filterBranch || r.sucursal_id === filterBranch) return true;
    }
    return !filterBranch && r.fecha_hora?.startsWith(today);
  });

  const totalHoy = filteredRecords.length;
  const entradas = filteredRecords.filter(r => r.tipo === "Entrada").length;
  const salidas = filteredRecords.filter(r => r.tipo === "Salida").length;
  const retardos = filteredRecords.filter(r => r.estatus?.includes("Retardo")).length;
  const aTiempo = filteredRecords.filter(r => r.estatus === "A Tiempo").length;

  // Por sucursal
  const porSucursal = branches.map(b => ({
    nombre: b.nombre,
    total: records.filter(r => r.sucursal_id === b.id && r.fecha_hora?.startsWith(today)).length,
    retardo: records.filter(r => r.sucursal_id === b.id && r.fecha_hora?.startsWith(today) && r.estatus?.includes("Retardo")).length
  }));

  return (
    <main className="page-shell">
      <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",marginBottom:8}}>
        <img src="/images/logo_modo_oscuro.fw.png" alt="NEOMOTIC" style={{height:32}} />
        <span style={{color:"#9bb4ca"}}>{user.name}</span>
        <button onClick={()=>{localStorage.removeItem("neoassistence_user");router.push("/login");}} style={{background:"none",border:"none",color:"#ff8c9e",cursor:"pointer"}}>Cerrar sesión</button>
      </nav>

      <div className="glass" style={{padding:24,marginBottom:24}}>
        <h1 style={{margin:0,fontSize:28}}>📊 Dashboard</h1>
        <p style={{color:"#9bb4ca",marginTop:8}}>Resumen de asistencia en tiempo real</p>
      </div>

      {/* KPIs */}
      <section style={{display:"grid",gridTemplateColumns:"repeat(4, 1fr)",gap:16,marginBottom:24}}>
        <div className="glass" style={{padding:20,textAlign:"center"}}>
          <p style={{color:"#9bb4ca",margin:0,fontSize:14}}>Total Hoy</p>
          <p style={{color:"#5ef2ff",fontSize:36,margin:"8px 0",fontWeight:"bold"}}>{totalHoy}</p>
        </div>
        <div className="glass" style={{padding:20,textAlign:"center"}}>
          <p style={{color:"#9bb4ca",margin:0,fontSize:14}}>Entradas</p>
          <p style={{color:"#9cffb5",fontSize:36,margin:"8px 0",fontWeight:"bold"}}>{entradas}</p>
        </div>
        <div className="glass" style={{padding:20,textAlign:"center"}}>
          <p style={{color:"#9bb4ca",margin:0,fontSize:14}}>Salidas</p>
          <p style={{color:"#d08aff",fontSize:36,margin:"8px 0",fontWeight:"bold"}}>{salidas}</p>
        </div>
        <div className="glass" style={{padding:20,textAlign:"center"}}>
          <p style={{color:"#9bb4ca",margin:0,fontSize:14}}>Retardos</p>
          <p style={{color:retardos > 0 ? "#ff8c9e" : "#9cffb5",fontSize:36,margin:"8px 0",fontWeight:"bold"}}>{retardos}</p>
        </div>
      </section>

      {/* Por Sucursal - Estilo mapa visual */}
      <section className="glass" style={{padding:24,marginBottom:24}}>
        <h2 style={{marginTop:0,marginBottom:16}}>🗺️ Sucursales</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:16}}>
          {porSucursal.map(b => (
            <div key={b.nombre} style={{
              padding:20,
              borderRadius:16,
              background:"linear-gradient(135deg, rgba(94,242,255,0.08), rgba(156,255,181,0.04))",
              border:"1px solid rgba(94,242,255,0.2)",
              position:"relative",
              overflow:"hidden",
            }}>
              <div style={{
                position:"absolute",top:-15,right:-15,width:60,height:60,
                background: b.total > 0 ? "radial-gradient(circle, rgba(94,242,255,0.3), transparent)" : "none",
                borderRadius:"50%",
              }} />
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <p style={{margin:0,color:"#5ef2ff",fontWeight:"bold",fontSize:16}}>{b.nombre}</p>
                  <p style={{color:"#9bb4ca",marginTop:4,fontSize:12}}>{b.total} registros hoy</p>
                </div>
                <div style={{
                  width:44,height:44,borderRadius:"50%",
                  background: b.total > 0 ? "linear-gradient(135deg, #5ef2ff, #9cffb5)" : "rgba(94,242,255,0.1)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  boxShadow: b.total > 0 ? "0 0 15px rgba(94,242,255,0.5)" : "none",
                }}>
                  <span style={{color: b.total > 0 ? "#0a1526" : "#5ef2ff",fontSize:16,fontWeight:"bold"}}>{b.total}</span>
                </div>
              </div>
              <div style={{display:"flex",gap:12,marginTop:16}}>
                <div style={{flex:1,textAlign:"center",padding:10,borderRadius:8,background:"rgba(0,0,0,0.3)"}}>
                  <p style={{color:"#9bb4ca",margin:0,fontSize:10}}>Entr</p>
                  <p style={{color:"#9cffb5",margin:"2px 0 0",fontSize:16,fontWeight:"bold"}}>{records.filter(r => r.tipo === "Entrada" && r.sucursal_id === branches.find(b2 => b2.nombre === b.nombre)?.id).length || 0}</p>
                </div>
                <div style={{flex:1,textAlign:"center",padding:10,borderRadius:8,background:"rgba(0,0,0,0.3)"}}>
                  <p style={{color:"#9bb4ca",margin:0,fontSize:10}}>Sal</p>
                  <p style={{color:"#d08aff",margin:"2px 0 0",fontSize:16,fontWeight:"bold"}}>{records.filter(r => r.tipo === "Salida" && r.sucursal_id === branches.find(b2 => b2.nombre === b.nombre)?.id).length || 0}</p>
                </div>
                <div style={{flex:1,textAlign:"center",padding:10,borderRadius:8,background:"rgba(0,0,0,0.3)"}}>
                  <p style={{color:"#9bb4ca",margin:0,fontSize:10}}>Retraso</p>
                  <p style={{color:b.retardo > 0 ? "#ff8c9e" : "#9bb4ca",margin:"2px 0 0",fontSize:16,fontWeight:"bold"}}>{b.retardo}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Gráfica simple de asistencia */}
      <section className="glass" style={{padding:24,marginBottom:24}}>
        <h2 style={{marginTop:0,marginBottom:16}}>📈 Asistencia por Hora</h2>
        <div style={{display:"flex",alignItems:"flex-end",gap:4,height:150}}>
          {Array.from({length: 10}, (_, i) => {
            const hour = new Date();
            hour.setHours(hour.getHours() - 9 + i);
            const hourStr = hour.getHours().toString().padStart(2, "0") + ":00";
            const count = records.filter(r => r.fecha_hora?.includes(hourStr)).length;
            const max = Math.max(...Array.from({length: 10}, (_, j) => {
              const h = new Date();
              h.setHours(h.getHours() - 9 + j);
              return records.filter(r => r.fecha_hora?.includes(h.getHours().toString().padStart(2, "0") + ":00")).length;
            }), 1);
            return (
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <div style={{width:"100%",height:Math.max(4, (count / max) * 120),background:"linear-gradient(to top, #5ef2ff, #9cffb5)",borderRadius:4}} />
                <p style={{color:"#9bb4ca",fontSize:10,transform:"rotate(-45deg)"}}>{hourStr}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Acciones */}
      <section className="glass" style={{padding:24}}>
        <h2 style={{marginTop:0,marginBottom:16}}>⚡ Acciones</h2>
        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          <Link href="/kiosko" style={{padding:"14px 18px",borderRadius:12,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none"}}>📷 Kiosko</Link>
          <Link href="/reportes" style={{padding:"14px 18px",borderRadius:12,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none"}}>📊 Reportes</Link>
          <Link href="/mapa" style={{padding:"14px 18px",borderRadius:12,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none"}}>🗺️ Mapa</Link>
          <Link href="/admin/empleados" style={{padding:"14px 18px",borderRadius:12,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none"}}>Empleados</Link>
          <Link href="/yts" style={{padding:"14px 18px",borderRadius:12,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none"}}>YTS</Link>
          <Link href="/empleado" style={{padding:"14px 18px",borderRadius:12,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none"}}>Mi Credencial</Link>
          <Link href="/incidencias" style={{padding:"14px 18px",borderRadius:12,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none"}}>⚠️ Incidencias</Link>
        </div>
      </section>
    </main>
  );
}