"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import ThemeToggle from "../ThemeToggle";
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ResponsiveContainer } from "recharts";

type RecordItem = { id: string; empleado: string; tipo: string; estatus: string; fecha_hora: string; sucursal_id: string; };
type Branch = { id: string; nombre: string; lat?: number; lon?: number; };
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
  "NO DIO SALIDA": "#d08aff",
  "SALIDA ANTICIPADA": "#ff9f43",
  "SALIDA TEMPRANA": "#ff9f43",
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
    }}>
      {medals[pos] || pos}
    </span>
  );
}

function SectionSkeleton({ height = 200 }: { height?: number }) {
  return <div className="skeleton" style={{ width: "100%", height, borderRadius: 16 }} />;
}

function refreshCss() {
  return `
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
  `;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(getStoredUser());
  const [mounted, setMounted] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filterBranch, setFilterBranch] = useState("");
  const todayStr = typeof window === "undefined" ? "" : new Date().toISOString().split("T")[0];
  const [filterDesde, setFilterDesde] = useState(todayStr);
  const [filterHasta, setFilterHasta] = useState(todayStr);

  const [records, setRecords] = useState<RecordItem[]>([]);
  const [ranking, setRanking] = useState<RankItem[]>([]);
  const [retardosMensuales, setRetardosMensuales] = useState<any[]>([]);
  const [tendencias, setTendencias] = useState<any[]>([]);
  const [sucursalesAnalytics, setSucursalesAnalytics] = useState<any[]>([]);

  const [loading, setLoading] = useState({ cards: true, ranking: true, charts: true, sucursales: true });

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && !user) router.push("/login"); }, [mounted, user, router]);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://192.168.1.85:8000";

  async function loadDashboardData() {
    const params = `?desde=${filterDesde}&hasta=${filterHasta}${filterBranch ? `&sucursal_id=${filterBranch}` : ""}`;
    const rankingParams = `?periodo_inicio=${filterDesde}&periodo_fin=${filterHasta}${filterBranch ? `&sucursal_id=${filterBranch}` : ""}`;
    const branchParam = filterBranch ? `&sucursal_id=${filterBranch}` : "";

    setLoading(prev => ({ ...prev, cards: true }));
    apiRequest<{ data: { items: RecordItem[] } }>(`/records${params}`)
      .then(r => { setRecords(r.data?.items || []); setLoading(prev => ({ ...prev, cards: false })); })
      .catch(() => setLoading(prev => ({ ...prev, cards: false })));

    setLoading(prev => ({ ...prev, ranking: true }));
    apiRequest<{ data: RankItem[] }>(`/analytics/ranking${rankingParams}`)
      .then(r => { setRanking(r.data || []); setLoading(prev => ({ ...prev, ranking: false })); })
      .catch(() => setLoading(prev => ({ ...prev, ranking: false })));

    setLoading(prev => ({ ...prev, charts: true }));
    Promise.all([
      apiRequest<{ data: any[] }>(`/analytics/retardos-mensuales${branchParam}`).then(r => r.data || []).catch(() => []),
      apiRequest<{ data: any[] }>(`/analytics/tendencias${branchParam}`).then(r => r.data || []).catch(() => []),
    ]).then(([ret, tend]) => {
      setRetardosMensuales(ret);
      setTendencias(tend);
      setLoading(prev => ({ ...prev, charts: false }));
    });

    setLoading(prev => ({ ...prev, sucursales: true }));
    apiRequest<{ data: any[] }>("/analytics/sucursales")
      .then(r => { setSucursalesAnalytics(r.data || []); setLoading(prev => ({ ...prev, sucursales: false })); })
      .catch(() => setLoading(prev => ({ ...prev, sucursales: false })));
  }

  useEffect(() => {
    apiRequest<any>("/branches").then(r => {
      const b = r.data || [];
      setBranches(Array.isArray(b) ? b : []);
    }).catch(() => []);
    if (user) loadDashboardData();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(loadDashboardData, 60000);
    return () => clearInterval(interval);
  }, [user, filterDesde, filterHasta, filterBranch]);

  const handleFilterApply = () => {
    loadDashboardData();
  };

  function getDaysInRange(from: string, to: string) {
    const days: string[] = [];
    const start = new Date(from);
    const end = new Date(to);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().split("T")[0]);
    }
    return days;
  }

  const daysInRange = getDaysInRange(filterDesde, filterHasta);

  const filteredRecords = records.filter(r => {
    if (!r.fecha_hora) return false;
    const d = r.fecha_hora.slice(0, 10);
    if (d < filterDesde || d > filterHasta) return false;
    if (!filterBranch) return true;
    return r.sucursal_id === filterBranch;
  });

  const totalHoy = filteredRecords.length;
  const entradas = filteredRecords.filter(r => r.tipo === "Entrada").length;
  const salidas = filteredRecords.filter(r => r.tipo === "Salida").length;
  const aTiempo = filteredRecords.filter(r => r.estatus === "A Tiempo").length;
  const retardosCount = filteredRecords.filter(r => r.estatus?.toLowerCase().includes("retardo")).length;

  const statusPie = Object.entries(
    filteredRecords.reduce((acc, r) => {
      const key = r.estatus?.toLowerCase().includes("retardo") ? "Retardo" : r.estatus === "A Tiempo" ? "A Tiempo" : r.estatus === "Permiso" ? "Permiso" : r.estatus?.includes("OLVIDO") ? "OLVIDO REGISTRO" : r.estatus === "NO DIO SALIDA" ? "NO DIO SALIDA" : r.estatus?.includes("SALIDA") ? r.estatus : "Otros";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const barData = daysInRange.map(d => {
    const dayRecords = filteredRecords.filter(r => r.fecha_hora?.startsWith(d));
    return { date: d.slice(5), Entradas: dayRecords.filter(r => r.tipo === "Entrada").length, Salidas: dayRecords.filter(r => r.tipo === "Salida").length };
  });

  const topRank = ranking.slice(0, 5);

  const exportUrl = `${apiBase}/analytics/ranking/export/excel?periodo_inicio=${filterDesde}&periodo_fin=${filterHasta}${filterBranch ? `&sucursal_id=${filterBranch}` : ""}`;

  return (
    <main className="page-shell">
      <style>{refreshCss()}</style>

      <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",marginBottom:8}}>
        <img src="/images/logo_modo_oscuro.fw.png" alt="NEOMOTIC" style={{height:32}} />
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <ThemeToggle />
          <span style={{color:"#9bb4ca",fontSize:13}}>{user?.name}</span>
          <button onClick={()=>{localStorage.removeItem("neoassistence_user");router.push("/login");}} style={{background:"none",border:"none",color:"#ff8c9e",cursor:"pointer",fontSize:13}}>Cerrar sesión</button>
        </div>
      </nav>

      <div className="glass" style={{padding:"16px 20px",marginBottom:16}}>
        <h1 style={{margin:0,fontSize:22}}>Dashboard</h1>
        <p style={{color:"#9bb4ca",marginTop:4,fontSize:13}}>Resumen de asistencia</p>
      </div>

      <section className="glass" style={{padding:"12px 16px",marginBottom:16}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <label style={{color:"#9bb4ca",fontSize:12}}>Desde</label>
            <input type="date" value={filterDesde} onChange={e => setFilterDesde(e.target.value)}
              style={{padding:"6px 10px",borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"#0a1526",color:"white",fontSize:12}} />
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <label style={{color:"#9bb4ca",fontSize:12}}>Hasta</label>
            <input type="date" value={filterHasta} onChange={e => setFilterHasta(e.target.value)}
              style={{padding:"6px 10px",borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"#0a1526",color:"white",fontSize:12}} />
          </div>
          <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)}
            style={{padding:"6px 10px",borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"#0a1526",color:"white",fontSize:12}}>
            <option value="">Todas las sucursales</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
          <button onClick={handleFilterApply}
            style={{padding:"6px 14px",borderRadius:8,border:"1px solid rgba(94,242,255,0.3)",background:"rgba(94,242,255,0.15)",color:"#5ef2ff",fontSize:12,cursor:"pointer"}}>
            Filtrar
          </button>
          <a href={exportUrl} target="_blank" rel="noreferrer"
            style={{padding:"6px 14px",borderRadius:8,border:"1px solid rgba(156,255,181,0.3)",background:"rgba(156,255,181,0.1)",color:"#9cffb5",fontSize:12,textDecoration:"none",marginLeft:"auto"}}>
            📥 Exportar Excel
          </a>
        </div>
      </section>

      <section className="glass" style={{padding:"6px 12px",marginBottom:16,overflowX:"auto"}}>
        <div style={{display:"flex",gap:6,flexWrap:"nowrap",whiteSpace:"nowrap",padding:"6px 0"}}>
          <Link href="/kiosko" style={{padding:"8px 12px",borderRadius:8,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:11}}>📷 Kiosko</Link>
          <Link href="/reportes" style={{padding:"8px 12px",borderRadius:8,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:11}}>📊 Reportes</Link>
          <Link href="/reportes-auto" style={{padding:"8px 12px",borderRadius:8,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:11}}>📧 Auto-reporte</Link>
          <Link href="/admin/empleados" style={{padding:"8px 12px",borderRadius:8,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:11}}>👥 Empleados</Link>
          <Link href="/admin/qrs" style={{padding:"8px 12px",borderRadius:8,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:11}}>📱 QR</Link>
          <Link href="/yts" style={{padding:"8px 12px",borderRadius:8,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:11}}>YTS</Link>
          <Link href="/empleado" style={{padding:"8px 12px",borderRadius:8,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:11}}>Credencial</Link>
          <Link href="/incidencias" style={{padding:"8px 12px",borderRadius:8,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:11}}>⚠️ Incidencias</Link>
          <Link href="/permisos" style={{padding:"8px 12px",borderRadius:8,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:11}}>🏖️ Permisos</Link>
          <Link href="/calendario" style={{padding:"8px 12px",borderRadius:8,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:11}}>📅 Calendario</Link>
          <Link href="/historial" style={{padding:"8px 12px",borderRadius:8,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:11}}>📋 Historial</Link>
          <Link href="/admin/registros" style={{padding:"8px 12px",borderRadius:8,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:11}}>✏️ Registros</Link>
          <Link href="/admin/login-logs" style={{padding:"8px 12px",borderRadius:8,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:11}}>🔐 Accesos</Link>
          <Link href="/admin/nomina" style={{padding:"8px 12px",borderRadius:8,background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",color:"white",textDecoration:"none",fontSize:11}}>💰 Nómina</Link>
        </div>
      </section>

      {loading.cards ? (
        <SectionSkeleton height={100} />
      ) : (
        <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(120px, 1fr))",gap:12,marginBottom:20}}>
          {[
            { label: "Total", value: totalHoy, color: "#5ef2ff" },
            { label: "Entradas", value: entradas, color: "#9cffb5" },
            { label: "A Tiempo", value: aTiempo, color: "#9cffb5" },
            { label: "Retardos", value: retardosCount, color: "#ff8c9e" },
            { label: "Salidas", value: salidas, color: "#d08aff" },
          ].map(s => (
            <div key={s.label} className="glass" style={{padding:"14px 10px",textAlign:"center",borderRadius:14}}>
              <p style={{color:"#9bb4ca",margin:0,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em"}}>{s.label}</p>
              <p style={{color:s.color,fontSize:28,margin:"4px 0 0",fontWeight:"bold"}}>{s.value}</p>
            </div>
          ))}
        </section>
      )}

      {loading.ranking ? (
        <SectionSkeleton height={260} />
      ) : topRank.length > 0 ? (
        <section className="glass" style={{padding:20,marginBottom:20,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:-50,right:-30,width:150,height:150,background:"radial-gradient(circle, rgba(255,215,0,0.08), transparent)",borderRadius:"50%",pointerEvents:"none"}} />
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div>
              <h2 style={{margin:0,fontSize:16}}>🏆 Ranking de Puntualidad</h2>
              <p style={{color:"#9bb4ca",margin:"4px 0 0",fontSize:11}}>Top 5 - {filterBranch ? branches.find(b=>b.id===filterBranch)?.nombre : "Todas las sucursales"}</p>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {topRank.map((item, i) => {
              const colors = ["#ffd700", "#c0c0c0", "#cd7f32", "#5ef2ff", "#9cffb5"];
              const color = colors[i] || "#5ef2ff";
              return (
                <div key={item.empleado} className="rank-bar-bg" style={{padding:"10px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                    <RankBadge pos={item.posicion} />
                    <span style={{flex:1,color:"white",fontSize:13,fontWeight:500}}>{item.empleado}</span>
                    <span style={{color,fontSize:18,fontWeight:"bold"}}>{item.puntualidad_pct}%</span>
                    <span style={{color:"#9bb4ca",fontSize:11}}>{item.retardos > 0 ? `⚠ ${item.retardos} ret` : "✅ 0 ret"}</span>
                  </div>
                  <div style={{width:"100%",height:5,background:"rgba(255,255,255,0.05)",borderRadius:3}}>
                    <div className="rank-bar-fill" style={{
                      width: `${Math.max(item.puntualidad_pct, 2)}%`,
                      background: `linear-gradient(90deg, ${color}, ${color}66)`,
                      boxShadow: `0 0 10px ${color}44`,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {loading.charts ? (
        <SectionSkeleton height={300} />
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:16,marginBottom:20}}>
          <div className="glass" style={{padding:20}}>
            <h3 style={{margin:"0 0 12px",color:"#9bb4ca",fontSize:13}}>Asistencia diaria (7 días)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barData}>
                <XAxis dataKey="date" tick={{fill:"#9bb4ca",fontSize:10}} axisLine={false} tickLine={false} />
                <YAxis tick={{fill:"#9bb4ca",fontSize:10}} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",borderRadius:8,color:"white"}} />
                <Bar dataKey="Entradas" fill="#5ef2ff" radius={[4,4,0,0]} />
                <Bar dataKey="Salidas" fill="#d08aff" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass" style={{padding:20}}>
            <h3 style={{margin:"0 0 12px",color:"#9bb4ca",fontSize:13}}>Estatus - {filterDesde || "hoy"}</h3>
            {statusPie.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={statusPie} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value">
                      {statusPie.map((e, i) => <Cell key={i} fill={STATUS_COLORS[e.name] || "#9bb4ca"} />)}
                    </Pie>
                    <Tooltip contentStyle={{background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",borderRadius:8,color:"white"}} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:10,flexWrap:"wrap"}}>
                  {statusPie.map(e => (
                    <span key={e.name} style={{fontSize:10,color:"#9bb4ca"}}>
                      <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:STATUS_COLORS[e.name]||"#9bb4ca",marginRight:3}} />
                      {e.name}: {e.value}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p style={{color:"#9bb4ca",textAlign:"center",paddingTop:50,fontSize:13}}>Sin datos en este período</p>
            )}
          </div>

          {tendencias.length > 0 && (
            <div className="glass" style={{padding:20}}>
              <h3 style={{margin:"0 0 12px",color:"#9bb4ca",fontSize:13}}>Tendencia mensual</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={tendencias}>
                  <XAxis dataKey="mes" tick={{fill:"#9bb4ca",fontSize:9}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:"#9bb4ca",fontSize:10}} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",borderRadius:8,color:"white"}} />
                  <Line type="monotone" dataKey="a_tiempo" stroke="#9cffb5" strokeWidth={2} dot={{fill:"#9cffb5",r:3}} name="A Tiempo" />
                  <Line type="monotone" dataKey="retardos" stroke="#ff8c9e" strokeWidth={2} dot={{fill:"#ff8c9e",r:3}} name="Retardos" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {!loading.charts && retardosMensuales.some((m: any) => m.total > 0) && (
        <div className="glass" style={{padding:20,marginBottom:20}}>
          <h3 style={{margin:"0 0 12px",color:"#9bb4ca",fontSize:13}}>% Retardos por Mes</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={retardosMensuales}>
              <XAxis dataKey="mes_label" tick={{fill:"#9bb4ca",fontSize:10}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill:"#9bb4ca",fontSize:10}} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
              <Tooltip contentStyle={{background:"#0a1526",border:"1px solid rgba(94,242,255,0.2)",borderRadius:8,color:"white"}} />
              <Bar dataKey="porcentaje_retardo" fill="#ff8c9e" radius={[4,4,0,0]}
                style={{filter:"drop-shadow(0 0 6px rgba(255,140,158,0.4))"}} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {loading.sucursales ? (
        <SectionSkeleton height={200} />
      ) : !filterBranch && sucursalesAnalytics.length > 0 ? (
        <section className="glass" style={{padding:20,marginBottom:20}}>
          <h2 style={{marginTop:0,marginBottom:14,fontSize:16}}>Sucursales</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))",gap:14}}>
            {sucursalesAnalytics.map((b: any) => {
              const trendData = (b.trend || []).map((t: any) => ({ dia: t.fecha?.slice(5) || "", registros: t.total }));
              return (
                <div key={b.sucursal_id} className="sparkline-card" style={{
                  padding:16,borderRadius:14,
                  background:"linear-gradient(135deg, rgba(94,242,255,0.08), rgba(156,255,181,0.04))",
                  border:"1px solid rgba(94,242,255,0.2)",position:"relative",overflow:"hidden"
                }}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <p style={{margin:0,color:"#5ef2ff",fontWeight:"bold",fontSize:14}}>{b.nombre}</p>
                      <p style={{color:"#9bb4ca",marginTop:2,fontSize:11}}>{b.total_registros} registros (7d)</p>
                    </div>
                    <div style={{width:40,height:40,borderRadius:"50%",background:b.total_registros>0?"linear-gradient(135deg, #5ef2ff, #9cffb5)":"rgba(94,242,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:b.total_registros>0?"0 0 12px rgba(94,242,255,0.5)":"none"}}>
                      <span style={{color:b.total_registros>0?"#0a1526":"#5ef2ff",fontSize:14,fontWeight:"bold"}}>{b.total_registros}</span>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:10,marginTop:12,marginBottom:10}}>
                    <div style={{flex:1,textAlign:"center",padding:8,borderRadius:8,background:"rgba(0,0,0,0.3)"}}>
                      <p style={{color:"#9bb4ca",margin:0,fontSize:9}}>Entr</p>
                      <p style={{color:"#9cffb5",margin:"2px 0 0",fontSize:14,fontWeight:"bold"}}>{b.entradas}</p>
                    </div>
                    <div style={{flex:1,textAlign:"center",padding:8,borderRadius:8,background:"rgba(0,0,0,0.3)"}}>
                      <p style={{color:"#9bb4ca",margin:0,fontSize:9}}>Sal</p>
                      <p style={{color:"#d08aff",margin:"2px 0 0",fontSize:14,fontWeight:"bold"}}>{b.salidas}</p>
                    </div>
                    <div style={{flex:1,textAlign:"center",padding:8,borderRadius:8,background:"rgba(0,0,0,0.3)"}}>
                      <p style={{color:"#9bb4ca",margin:0,fontSize:9}}>Retraso</p>
                      <p style={{color:b.retardos>0?"#ff8c9e":"#9bb4ca",margin:"2px 0 0",fontSize:14,fontWeight:"bold"}}>{b.retardos}</p>
                    </div>
                  </div>
                  {trendData.length > 0 && (
                    <div style={{height:36}}>
                      <ResponsiveContainer width="100%" height={36}>
                        <AreaChart data={trendData}>
                          <Area type="monotone" dataKey="registros" stroke="#5ef2ff" fill="rgba(94,242,255,0.12)" strokeWidth={1.5} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {!filterBranch && <MapSection branches={branches} records={records} />}

    </main>
  );
}

function MapSection({ branches, records }: { branches: Branch[]; records: RecordItem[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInitRef = useRef(false);
  const [mapLoading, setMapLoading] = useState(true);

  useEffect(() => {
    if (!branches.length || mapInitRef.current || !mapRef.current) return;
    mapInitRef.current = true;
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
      const check = () => {
        if (!mapRef.current || (window as any).L === undefined) return setTimeout(check, 100);
        const L = (window as any).L;
        const avgLat = branches.reduce((a, b) => a + (b.lat || 0), 0) / branches.length;
        const avgLon = branches.reduce((a, b) => a + (b.lon || 0), 0) / branches.length;
        const map = L.map(mapRef.current).setView([avgLat || 19.4326, avgLon || -99.1332], 10);
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
          subdomains: "abcd", maxZoom: 19,
        }).addTo(map);
        const today = new Date().toISOString().split("T")[0];
        branches.forEach(branch => {
          if (!branch.lat || !branch.lon) return;
          const br = records.filter(r => r.sucursal_id === branch.id && r.fecha_hora?.startsWith(today));
          const hasRetardo = br.some(r => r.estatus?.toLowerCase().includes("retardo"));
          const icon = L.divIcon({
            className: "custom-marker",
            html: `<div style="width:36px;height:36px;background:${hasRetardo?"linear-gradient(135deg,#ff8c9e,#d04aff)":"linear-gradient(135deg,#5ef2ff,#9cffb5)"};border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 16px ${hasRetardo?"rgba(255,140,158,0.6)":"rgba(94,242,255,0.6)"};font-size:13px;font-weight:bold;color:#0a1526;border:2px solid ${hasRetardo?"#ff8c9e":"#5ef2ff"}">${br.length}</div>`,
            iconSize: [36, 36], iconAnchor: [18, 18],
          });
          L.marker([branch.lat, branch.lon], { icon }).addTo(map)
            .bindPopup(`<div style="color:#0a1526;min-width:140px"><strong style="font-size:13px">${branch.nombre}</strong><br/><span style="font-size:11px">Entradas: ${br.filter(r=>r.tipo==="Entrada").length} | Salidas: ${br.filter(r=>r.tipo==="Salida").length}</span></div>`);
        });
        setMapLoading(false);
      };
      setTimeout(check, 300);
    };
    document.body.appendChild(script);
    return () => {
      const existing = document.querySelector('[src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"]');
      if (existing) existing.remove();
    };
  }, [branches, records]);

  return (
    <section className="glass" style={{padding:20,marginBottom:24}}>
      <h2 style={{marginTop:0,marginBottom:14,fontSize:16}}>🗺️ Mapa de Sucursales</h2>
      <div style={{display:"flex",gap:12,marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <div style={{width:14,height:14,borderRadius:"50%",background:"linear-gradient(135deg, #5ef2ff, #9cffb5)"}} />
          <span style={{color:"#9bb4ca",fontSize:11}}>Sin retardos</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <div style={{width:14,height:14,borderRadius:"50%",background:"linear-gradient(135deg, #ff8c9e, #d04aff)"}} />
          <span style={{color:"#9bb4ca",fontSize:11}}>Con retardos</span>
        </div>
      </div>
      <div style={{position:"relative"}}>
        <div ref={mapRef} style={{height:400,borderRadius:14,overflow:"hidden",border:"1px solid rgba(94,242,255,0.2)"}} />
        {mapLoading && <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(10,21,38,0.8)",borderRadius:14}}><div className="skeleton" style={{width:"80%",height:300,borderRadius:12}} /></div>}
      </div>
    </section>
  );
}
