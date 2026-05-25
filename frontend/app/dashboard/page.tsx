"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from "recharts";

type RecordItem = { id: string; empleado: string; tipo: string; estatus: string; fecha_hora: string; sucursal_id: string; };
type Branch = { id: string; nombre: string; lat: number; lon: number; };

function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("neoassistence_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

const STATUS_COLORS: Record<string, string> = {
  "A Tiempo": "#9cffb5",
  "Retardo": "#ff8c9e",
  "OLVIDO REGISTRO": "#ffcc5e",
  "Permiso": "#5ef2ff",
  "Justificado": "#d08aff",
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(getStoredUser());
  const [mounted, setMounted] = useState(false);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
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

  if (!mounted || !user) return <main className="page-shell"><div className="skeleton" style={{width:"100%",height:300,borderRadius:24}} /></main>;

  const today = new Date().toISOString().split("T")[0];
  const last7 = getLast7Days();

  const filteredRecords = records.filter(r => {
    const dateMatch = r.fecha_hora?.startsWith(filterDate || today);
    if (!dateMatch) return false;
    if (!filterBranch) return true;
    return r.sucursal_id === filterBranch;
  });

  const totalHoy = filteredRecords.length;
  const entradas = filteredRecords.filter(r => r.tipo === "Entrada").length;
  const salidas = filteredRecords.filter(r => r.tipo === "Salida").length;
  const aTiempo = filteredRecords.filter(r => r.estatus === "A Tiempo").length;
  const retardos = filteredRecords.filter(r => r.estatus?.includes("Retardo")).length;

  const statusPie = Object.entries(
    filteredRecords.reduce((acc, r) => {
      const key = r.estatus?.includes("Retardo") ? "Retardo" : r.estatus === "A Tiempo" ? "A Tiempo" : r.estatus === "Permiso" ? "Permiso" : r.estatus?.includes("OLVIDO") ? "OLVIDO REGISTRO" : "Otros";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const barData = last7.map(d => {
    const dayRecords = records.filter(r => r.fecha_hora?.startsWith(d));
    return { date: d.slice(5), Entradas: dayRecords.filter(r => r.tipo === "Entrada").length, Salidas: dayRecords.filter(r => r.tipo === "Salida").length };
  });

  const trendData = last7.map(d => {
    const dayRecords = records.filter(r => r.fecha_hora?.startsWith(d));
    return { date: d.slice(5), total: dayRecords.length };
  });

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
        <h1 style={{margin:0,fontSize:28}}>Dashboard</h1>
        <p style={{color:"#9bb4ca",marginTop:8}}>Resumen de asistencia en tiempo real</p>
      </div>

      <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(120px, 1fr))",gap:12,marginBottom:24}}>
        {[
          { label: "Total Hoy", value: totalHoy, color: "#5ef2ff" },
          { label: "Entradas", value: entradas, color: "#9cffb5" },
          { label: "A Tiempo", value: aTiempo, color: "#9cffb5" },
          { label: "Retardos", value: retardos, color: "#ff8c9e" },
          { label: "Salidas", value: salidas, color: "#d08aff" },
        ].map(s => (
          <div key={s.label} className="glass" style={{padding:"16px 12px",textAlign:"center",borderRadius:16}}>
            <p style={{color:"#9bb4ca",margin:0,fontSize:12,textTransform:"uppercase",letterSpacing:"0.08em"}}>{s.label}</p>
            <p style={{color:s.color,fontSize:32,margin:"6px 0 0",fontWeight:"bold"}}>{s.value}</p>
          </div>
        ))}
      </section>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))",gap:20,marginBottom:24}}>
        <div className="glass" style={{padding:24}}>
          <h3 style={{margin:"0 0 16px",color:"#9bb4ca",fontSize:14}}>Asistencia diaria (7 días)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}>
              <XAxis dataKey="date" tick={{fill:"#9bb4ca",fontSize:11}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill:"#9bb4ca",fontSize:11}} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",borderRadius:8,color:"white"}} />
              <Bar dataKey="Entradas" fill="#5ef2ff" radius={[4,4,0,0]} />
              <Bar dataKey="Salidas" fill="#d08aff" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass" style={{padding:24}}>
          <h3 style={{margin:"0 0 16px",color:"#9bb4ca",fontSize:14}}>Estatus hoy</h3>
          {statusPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                  {statusPie.map((e, i) => <Cell key={i} fill={STATUS_COLORS[e.name] || "#9bb4ca"} />)}
                </Pie>
                <Tooltip contentStyle={{background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",borderRadius:8,color:"white"}} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p style={{color:"#9bb4ca",textAlign:"center",paddingTop:60}}>Sin datos hoy</p>
          )}
          <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:12,flexWrap:"wrap"}}>
            {statusPie.map(e => (
              <span key={e.name} style={{fontSize:11,color:"#9bb4ca"}}>
                <span style={{display:"inline-block",width:10,height:10,borderRadius:"50%",background:STATUS_COLORS[e.name]||"#9bb4ca",marginRight:4}} />
                {e.name}: {e.value}
              </span>
            ))}
          </div>
        </div>

        <div className="glass" style={{padding:24}}>
          <h3 style={{margin:"0 0 16px",color:"#9bb4ca",fontSize:14}}>Tendencia (7 días)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <XAxis dataKey="date" tick={{fill:"#9bb4ca",fontSize:11}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill:"#9bb4ca",fontSize:11}} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",borderRadius:8,color:"white"}} />
              <Line type="monotone" dataKey="total" stroke="#5ef2ff" strokeWidth={2} dot={{fill:"#5ef2ff",r:3}} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {porSucursal.length > 0 && (
        <section className="glass" style={{padding:24,marginBottom:24}}>
          <h2 style={{marginTop:0,marginBottom:16}}>Sucursales</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:16}}>
            {porSucursal.map(b => (
              <div key={b.nombre} style={{padding:20,borderRadius:16,background:"linear-gradient(135deg, rgba(94,242,255,0.08), rgba(156,255,181,0.04))",border:"1px solid rgba(94,242,255,0.2)",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:-15,right:-15,width:60,height:60,background:b.total>0?"radial-gradient(circle, rgba(94,242,255,0.3), transparent)":"none",borderRadius:"50%"}} />
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <p style={{margin:0,color:"#5ef2ff",fontWeight:"bold",fontSize:16}}>{b.nombre}</p>
                    <p style={{color:"#9bb4ca",marginTop:4,fontSize:12}}>{b.total} registros hoy</p>
                  </div>
                  <div style={{width:44,height:44,borderRadius:"50%",background:b.total>0?"linear-gradient(135deg, #5ef2ff, #9cffb5)":"rgba(94,242,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:b.total>0?"0 0 15px rgba(94,242,255,0.5)":"none"}}>
                    <span style={{color:b.total>0?"#0a1526":"#5ef2ff",fontSize:16,fontWeight:"bold"}}>{b.total}</span>
                  </div>
                </div>
                <div style={{display:"flex",gap:12,marginTop:16}}>
                  <div style={{flex:1,textAlign:"center",padding:10,borderRadius:8,background:"rgba(0,0,0,0.3)"}}>
                    <p style={{color:"#9bb4ca",margin:0,fontSize:10}}>Entr</p>
                    <p style={{color:"#9cffb5",margin:"2px 0 0",fontSize:16,fontWeight:"bold"}}>{records.filter(r=>r.tipo==="Entrada"&&r.sucursal_id===branches.find(b2=>b2.nombre===b.nombre)?.id&&r.fecha_hora?.startsWith(today)).length}</p>
                  </div>
                  <div style={{flex:1,textAlign:"center",padding:10,borderRadius:8,background:"rgba(0,0,0,0.3)"}}>
                    <p style={{color:"#9bb4ca",margin:0,fontSize:10}}>Sal</p>
                    <p style={{color:"#d08aff",margin:"2px 0 0",fontSize:16,fontWeight:"bold"}}>{records.filter(r=>r.tipo==="Salida"&&r.sucursal_id===branches.find(b2=>b2.nombre===b.nombre)?.id&&r.fecha_hora?.startsWith(today)).length}</p>
                  </div>
                  <div style={{flex:1,textAlign:"center",padding:10,borderRadius:8,background:"rgba(0,0,0,0.3)"}}>
                    <p style={{color:"#9bb4ca",margin:0,fontSize:10}}>Retraso</p>
                    <p style={{color:b.retardo>0?"#ff8c9e":"#9bb4ca",margin:"2px 0 0",fontSize:16,fontWeight:"bold"}}>{b.retardo}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="glass" style={{padding:24}}>
        <h2 style={{marginTop:0,marginBottom:16}}>Acciones</h2>
        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          <Link href="/kiosko" style={{padding:"14px 18px",borderRadius:12,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none"}}>📷 Kiosko</Link>
          <Link href="/reportes" style={{padding:"14px 18px",borderRadius:12,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none"}}>📊 Reportes</Link>
          <Link href="/reportes-auto" style={{padding:"14px 18px",borderRadius:12,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none"}}>📧 Auto-reporte</Link>
          <Link href="/mapa" style={{padding:"14px 18px",borderRadius:12,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none"}}>🗺️ Mapa</Link>
          <Link href="/admin/empleados" style={{padding:"14px 18px",borderRadius:12,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none"}}>Empleados</Link>
          <Link href="/admin/qrs" style={{padding:"14px 18px",borderRadius:12,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none"}}>📱 QR</Link>
          <Link href="/yts" style={{padding:"14px 18px",borderRadius:12,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none"}}>YTS</Link>
          <Link href="/empleado" style={{padding:"14px 18px",borderRadius:12,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none"}}>Mi Credencial</Link>
          <Link href="/incidencias" style={{padding:"14px 18px",borderRadius:12,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none"}}>⚠️ Incidencias</Link>
          <Link href="/permisos" style={{padding:"14px 18px",borderRadius:12,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none"}}>🏖️ Permisos</Link>
        </div>
      </section>
    </main>
  );
}
