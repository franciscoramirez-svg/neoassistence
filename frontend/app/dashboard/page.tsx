"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import ThemeToggle from "../ThemeToggle";
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ResponsiveContainer } from "recharts";

type RecordItem = { id: string; empleado: string; tipo: string; estatus: string; fecha_hora: string; sucursal_id: string; };
type Branch = { id: string; nombre: string; };
type RankItem = { posicion: number; empleado: string; puntualidad_pct: number; retardos: number; total_registros: number; a_tiempo: number; retardo_minutos: number; };

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

function RankBadge({ pos }: { pos: number }) {
  const medals: Record<number, string> = { 1: "\uD83E\uDD47", 2: "\uD83E\uDD48", 3: "\uD83E\uDD49" };
  const isTop3 = pos <= 3;
  const colors = ["#ffd700", "#c0c0c0", "#cd7f32"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 32, height: 32, borderRadius: "50%",
      background: isTop3 ? `linear-gradient(135deg, ${colors[pos-1]}, ${colors[pos-1]}88)` : "rgba(255,255,255,0.05)",
      border: isTop3 ? `2px solid ${colors[pos-1]}` : "1px solid rgba(255,255,255,0.1)",
      boxShadow: isTop3 ? `0 0 20px ${colors[pos-1]}44` : "none",
      fontSize: isTop3 ? 16 : 13, fontWeight: "bold",
      color: isTop3 ? "#fff" : "#9bb4ca",
      animation: isTop3 ? "pulseGlow 2s infinite" : "none",
      position: "relative",
    }}>
      {medals[pos] || pos}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(getStoredUser());
  const [mounted, setMounted] = useState(false);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBranch, setFilterBranch] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const [ranking, setRanking] = useState<RankItem[]>([]);
  const [retardosMensuales, setRetardosMensuales] = useState<any[]>([]);
  const [tendencias, setTendencias] = useState<any[]>([]);
  const [sucursalesAnalytics, setSucursalesAnalytics] = useState<any[]>([]);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && !user) router.push("/login"); }, [mounted, user, router]);

  async function loadDashboardData() {
    if (!user) return;
    try {
      const [rec, bra, rnk, ret, tend, suc] = await Promise.all([
        apiRequest<{ data: { items: RecordItem[] } }>("/records").then(r => r.data?.items || []),
        apiRequest<any>("/branches").then(r => r.data || []).catch(() => []),
        apiRequest<{ data: RankItem[] }>("/analytics/ranking").then(r => r.data || []).catch(() => []),
        apiRequest<{ data: any[] }>("/analytics/retardos-mensuales").then(r => r.data || []).catch(() => []),
        apiRequest<{ data: any[] }>("/analytics/tendencias").then(r => r.data || []).catch(() => []),
        apiRequest<{ data: any[] }>("/analytics/sucursales").then(r => r.data || []).catch(() => []),
      ]);
      setRecords(rec);
      setBranches(Array.isArray(bra) ? bra : []);
      setRanking(rnk);
      setRetardosMensuales(ret);
      setTendencias(tend);
      setSucursalesAnalytics(suc);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { setLoading(true); loadDashboardData(); }, [user]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
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
  const retardos = filteredRecords.filter(r => r.estatus?.toLowerCase().includes("retardo")).length;

  const statusPie = Object.entries(
    filteredRecords.reduce((acc, r) => {
      const key = r.estatus?.toLowerCase().includes("retardo") ? "Retardo" : r.estatus === "A Tiempo" ? "A Tiempo" : r.estatus === "Permiso" ? "Permiso" : r.estatus?.includes("OLVIDO") ? "OLVIDO REGISTRO" : "Otros";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const barData = last7.map(d => {
    const dayRecords = records.filter(r => r.fecha_hora?.startsWith(d));
    return { date: d.slice(5), Entradas: dayRecords.filter(r => r.tipo === "Entrada").length, Salidas: dayRecords.filter(r => r.tipo === "Salida").length };
  });

  const topRank = ranking.slice(0, 5);

  return (
    <main className="page-shell">
      <style>{`
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 10px currentColor; }
          50% { box-shadow: 0 0 25px currentColor, 0 0 50px currentColor; }
        }
        @keyframes barGlow {
          0% { opacity: 0.7; }
          50% { opacity: 1; }
          100% { opacity: 0.7; }
        }
        .rank-bar-bg {
          background: linear-gradient(90deg, rgba(94,242,255,0.05), rgba(155,180,202,0.02));
          border-radius: 8px;
          overflow: hidden;
          transition: all 0.3s ease;
        }
        .rank-bar-bg:hover {
          background: linear-gradient(90deg, rgba(94,242,255,0.12), rgba(155,180,202,0.05));
          transform: scale(1.01);
        }
        .rank-bar-fill {
          height: 100%;
          border-radius: 8px;
          transition: width 1.2s cubic-bezier(0.22, 1, 0.36, 1);
          position: relative;
        }
        .rank-bar-fill::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          animation: barGlow 3s infinite;
        }
        .sparkline-card {
          transition: all 0.3s ease;
          cursor: default;
        }
        .sparkline-card:hover {
          transform: translateY(-2px);
          border-color: rgba(94,242,255,0.4) !important;
        }
      `}</style>

      <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",marginBottom:8}}>
        <img src="/images/logo_modo_oscuro.fw.png" alt="NEOMOTIC" style={{height:32}} />
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <ThemeToggle />
          <span style={{color:"#9bb4ca"}}>{user.name}</span>
          <button onClick={()=>{localStorage.removeItem("neoassistence_user");router.push("/login");}} style={{background:"none",border:"none",color:"#ff8c9e",cursor:"pointer"}}>Cerrar sesión</button>
        </div>
      </nav>

      <div className="glass" style={{padding:24,marginBottom:20}}>
        <h1 style={{margin:0,fontSize:28}}>Dashboard</h1>
        <p style={{color:"#9bb4ca",marginTop:8}}>Resumen de asistencia en tiempo real</p>
      </div>

      <section className="glass" style={{padding:16,marginBottom:20}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Link href="/kiosko" style={{padding:"10px 14px",borderRadius:10,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:12}}>📷 Kiosko</Link>
          <Link href="/reportes" style={{padding:"10px 14px",borderRadius:10,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:12}}>📊 Reportes</Link>
          <Link href="/reportes-auto" style={{padding:"10px 14px",borderRadius:10,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:12}}>📧 Auto-reporte</Link>
          <Link href="/mapa" style={{padding:"10px 14px",borderRadius:10,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:12}}>🗺️ Mapa</Link>
          <Link href="/admin/empleados" style={{padding:"10px 14px",borderRadius:10,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:12}}>👥 Empleados</Link>
          <Link href="/admin/qrs" style={{padding:"10px 14px",borderRadius:10,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:12}}>📱 QR</Link>
          <Link href="/yts" style={{padding:"10px 14px",borderRadius:10,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:12}}>YTS</Link>
          <Link href="/empleado" style={{padding:"10px 14px",borderRadius:10,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:12}}>Mi Credencial</Link>
          <Link href="/incidencias" style={{padding:"10px 14px",borderRadius:10,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:12}}>⚠️ Incidencias</Link>
          <Link href="/permisos" style={{padding:"10px 14px",borderRadius:10,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:12}}>🏖️ Permisos</Link>
          <Link href="/calendario" style={{padding:"10px 14px",borderRadius:10,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:12}}>📅 Calendario</Link>
          <Link href="/historial" style={{padding:"10px 14px",borderRadius:10,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:12}}>📋 Mi historial</Link>
          <Link href="/admin/registros" style={{padding:"10px 14px",borderRadius:10,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:12}}>✏️ Editar registros</Link>
          <Link href="/admin/login-logs" style={{padding:"10px 14px",borderRadius:10,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:12}}>🔐 Accesos</Link>
          <Link href="/admin/nomina" style={{padding:"10px 14px",borderRadius:10,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:12}}>💰 Nómina</Link>
        </div>
      </section>

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

      {topRank.length > 0 && (
        <section className="glass" style={{padding:24,marginBottom:24,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:-50,right:-30,width:150,height:150,background:"radial-gradient(circle, rgba(255,215,0,0.08), transparent)",borderRadius:"50%",pointerEvents:"none"}} />
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div>
              <h2 style={{margin:0,fontSize:18}}>🏆 Ranking de Puntualidad</h2>
              <p style={{color:"#9bb4ca",margin:"4px 0 0",fontSize:12}}>Top 5 - Basado en % de asistencias a tiempo</p>
            </div>
            <a href={`${process.env.NEXT_PUBLIC_API_URL || "http://192.168.1.85:8000/api"}/analytics/ranking/export/excel`}
              target="_blank" rel="noreferrer"
              style={{padding:"8px 14px",borderRadius:8,background:"rgba(94,242,255,0.1)",border:"1px solid rgba(94,242,255,0.2)",color:"#5ef2ff",textDecoration:"none",fontSize:12,cursor:"pointer"}}>
              📥 Excel
            </a>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {topRank.map((item, i) => {
              const colors = ["#ffd700", "#c0c0c0", "#cd7f32", "#5ef2ff", "#9cffb5"];
              const color = colors[i] || "#5ef2ff";
              return (
                <div key={item.empleado} className="rank-bar-bg" style={{padding:"12px 16px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
                    <RankBadge pos={item.posicion} />
                    <span style={{flex:1,color:"white",fontSize:14,fontWeight:500}}>{item.empleado}</span>
                    <span style={{color,fontSize:20,fontWeight:"bold"}}>{item.puntualidad_pct}%</span>
                    <span style={{color:"#9bb4ca",fontSize:11}}>{item.retardos > 0 ? `⚠ ${item.retardos} ret` : "✅ 0 ret"}</span>
                  </div>
                  <div style={{width:"100%",height:6,background:"rgba(255,255,255,0.05)",borderRadius:3,position:"relative"}}>
                    <div className="rank-bar-fill" style={{
                      width: `${Math.max(item.puntualidad_pct, 2)}%`,
                      background: `linear-gradient(90deg, ${color}, ${color}66)`,
                      boxShadow: `0 0 12px ${color}44`,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

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

        {tendencias.length > 0 && (
          <div className="glass" style={{padding:24}}>
            <h3 style={{margin:"0 0 16px",color:"#9bb4ca",fontSize:14}}>Tendencia mensual</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={tendencias}>
                <XAxis dataKey="mes" tick={{fill:"#9bb4ca",fontSize:10}} axisLine={false} tickLine={false} />
                <YAxis tick={{fill:"#9bb4ca",fontSize:11}} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",borderRadius:8,color:"white"}} />
                <Line type="monotone" dataKey="a_tiempo" stroke="#9cffb5" strokeWidth={2} dot={{fill:"#9cffb5",r:3}} name="A Tiempo" />
                <Line type="monotone" dataKey="retardos" stroke="#ff8c9e" strokeWidth={2} dot={{fill:"#ff8c9e",r:3}} name="Retardos" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {retardosMensuales.some((m: any) => m.total > 0) && (
        <div className="glass" style={{padding:24,marginBottom:24}}>
          <h3 style={{margin:"0 0 16px",color:"#9bb4ca",fontSize:14}}>% Retardos por Mes</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={retardosMensuales}>
              <XAxis dataKey="mes_label" tick={{fill:"#9bb4ca",fontSize:11}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill:"#9bb4ca",fontSize:11}} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
              <Tooltip contentStyle={{background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",borderRadius:8,color:"white"}}
              />
              <Bar dataKey="porcentaje_retardo" fill="#ff8c9e" radius={[4,4,0,0]}
                style={{filter:"drop-shadow(0 0 6px rgba(255,140,158,0.4))"}} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {sucursalesAnalytics.length > 0 && (
        <section className="glass" style={{padding:24,marginBottom:24}}>
          <h2 style={{marginTop:0,marginBottom:16}}>Sucursales</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))",gap:16}}>
            {sucursalesAnalytics.map((b: any) => {
              const trendData = (b.trend || []).map((t: any) => ({
                dia: t.fecha?.slice(5) || "",
                registros: t.total,
              }));
              return (
                <div key={b.sucursal_id} className="sparkline-card" style={{
                  padding:20,borderRadius:16,
                  background:"linear-gradient(135deg, rgba(94,242,255,0.08), rgba(156,255,181,0.04))",
                  border:"1px solid rgba(94,242,255,0.2)",position:"relative",overflow:"hidden"
                }}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <p style={{margin:0,color:"#5ef2ff",fontWeight:"bold",fontSize:16}}>{b.nombre}</p>
                      <p style={{color:"#9bb4ca",marginTop:4,fontSize:12}}>{b.total_registros} registros (7d)</p>
                    </div>
                    <div style={{width:44,height:44,borderRadius:"50%",background:b.total_registros>0?"linear-gradient(135deg, #5ef2ff, #9cffb5)":"rgba(94,242,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:b.total_registros>0?"0 0 15px rgba(94,242,255,0.5)":"none"}}>
                      <span style={{color:b.total_registros>0?"#0a1526":"#5ef2ff",fontSize:16,fontWeight:"bold"}}>{b.total_registros}</span>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:12,marginTop:16,marginBottom:12}}>
                    <div style={{flex:1,textAlign:"center",padding:10,borderRadius:8,background:"rgba(0,0,0,0.3)"}}>
                      <p style={{color:"#9bb4ca",margin:0,fontSize:10}}>Entr</p>
                      <p style={{color:"#9cffb5",margin:"2px 0 0",fontSize:16,fontWeight:"bold"}}>{b.entradas}</p>
                    </div>
                    <div style={{flex:1,textAlign:"center",padding:10,borderRadius:8,background:"rgba(0,0,0,0.3)"}}>
                      <p style={{color:"#9bb4ca",margin:0,fontSize:10}}>Sal</p>
                      <p style={{color:"#d08aff",margin:"2px 0 0",fontSize:16,fontWeight:"bold"}}>{b.salidas}</p>
                    </div>
                    <div style={{flex:1,textAlign:"center",padding:10,borderRadius:8,background:"rgba(0,0,0,0.3)"}}>
                      <p style={{color:"#9bb4ca",margin:0,fontSize:10}}>Retraso</p>
                      <p style={{color:b.retardos>0?"#ff8c9e":"#9bb4ca",margin:"2px 0 0",fontSize:16,fontWeight:"bold"}}>{b.retardos}</p>
                    </div>
                  </div>
                  {trendData.length > 0 && (
                    <div style={{height:40}}>
                      <ResponsiveContainer width="100%" height={40}>
                        <AreaChart data={trendData}>
                          <Area type="monotone" dataKey="registros" stroke="#5ef2ff" fill="rgba(94,242,255,0.15)" strokeWidth={1.5} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}


    </main>
  );
}
