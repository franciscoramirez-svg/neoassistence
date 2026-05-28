"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

const PER_PAGE = 20;

function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("neoassistence_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default function AdminLoginLogsPage() {
  const router = useRouter();
  const [user, setUser] = useState(getStoredUser);
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [success, setSuccess] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && user?.role !== "admin") router.push("/dashboard"); }, [mounted, user, router]);

  const loadLogs = useCallback(async () => {
    if (!user || user.role !== "admin") return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", String(PER_PAGE));
      if (search) params.set("search", search);
      if (success !== "all") params.set("success", success === "success" ? "true" : "false");
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      const res = await apiRequest<any>(`/auth/login/logs?${params.toString()}`);
      setLogs(res.data || []);
      setTotal(res.total || 0);
    } catch {} finally { setLoading(false); }
  }, [user, page, search, success, startDate, endDate]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  function handleLogout() {
    localStorage.removeItem("neoassistence_user");
    router.push("/login");
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  if (!mounted || !user) return <main className="page-shell"><div className="skeleton" style={{width:"100%",height:300,borderRadius:24}} /></main>;
  if (user.role !== "admin") return null;

  return (
    <main className="page-shell">
      <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",marginBottom:8}}>
        <Link href="/dashboard" style={{color:"#5ef2ff",fontSize:13,textDecoration:"none"}}>← Volver</Link>
        <button onClick={handleLogout} style={{background:"none",border:"none",color:"#ff8c9e",cursor:"pointer"}}>Cerrar sesión</button>
      </nav>

      <div className="glass" style={{padding:24,marginBottom:20}}>
        <p style={{color:"#5ef2ff",textTransform:"uppercase",letterSpacing:"0.18em"}}>Admin</p>
        <h1 style={{margin:"8px 0"}}>Registro de accesos</h1>
        <p style={{color:"#9bb4ca"}}>Monitoreo de inicios de sesión — quién, cuándo y si fue exitoso.</p>
      </div>

      <div className="glass" style={{padding:20,marginBottom:20}}>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"end"}}>
          <div style={{flex:1,minWidth:140}}>
            <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Empleado</label>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar por nombre..." style={{width:"100%",padding:8,borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13}} />
          </div>
          <div>
            <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Resultado</label>
            <select value={success} onChange={e => { setSuccess(e.target.value); setPage(1); }} style={{padding:"8px 12px",borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13}}>
              <option value="all">Todos</option>
              <option value="success">Exitosos</option>
              <option value="failed">Fallidos</option>
            </select>
          </div>
          <div>
            <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Desde</label>
            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }} style={{padding:"6px 8px",borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13}} />
          </div>
          <div>
            <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Hasta</label>
            <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }} style={{padding:"6px 8px",borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13}} />
          </div>
          <button onClick={() => { setSearch(""); setSuccess("all"); setStartDate(""); setEndDate(""); setPage(1); }} style={{padding:"8px 14px",borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"transparent",color:"#9bb4ca",cursor:"pointer"}}>Limpiar</button>
        </div>
      </div>

      <div className="glass" style={{padding:24,borderRadius:16}}>
        {loading ? (
          <div className="skeleton" style={{width:"100%",height:300,borderRadius:16}} />
        ) : logs.length === 0 ? (
          <p style={{color:"#9bb4ca",textAlign:"center"}}>Sin registros</p>
        ) : (
          <>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead>
                  <tr style={{borderBottom:"1px solid rgba(94,242,255,0.15)"}}>
                    <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Fecha</th>
                    <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Empleado</th>
                    <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Resultado</th>
                    <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                      <td style={{padding:"8px",color:"white",whiteSpace:"nowrap"}}>{new Date(l.created_at).toLocaleString("es-MX")}</td>
                      <td style={{padding:"8px",color:"white"}}>{l.employee_name || <span style={{color:"#9bb4ca"}}>—</span>}</td>
                      <td style={{padding:"8px"}}>
                        <span style={{color: l.success ? "#9cffb5" : "#ff8c9e"}}>
                          {l.success ? "✓ Exitoso" : "✗ Fallido"}
                        </span>
                      </td>
                      <td style={{padding:"8px",color:"#9bb4ca",fontSize:12}}>{l.detail || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:16,paddingTop:12,borderTop:"1px solid rgba(94,242,255,0.1)"}}>
              <span style={{color:"#9bb4ca",fontSize:12}}>{total} registro{total !== 1 ? "s" : ""}</span>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{padding:"6px 12px",borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"transparent",color: page <= 1 ? "#3a5568" : "#5ef2ff",cursor: page <= 1 ? "default" : "pointer",fontSize:12}}>Anterior</button>
                <span style={{color:"white",fontSize:13}}>{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{padding:"6px 12px",borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"transparent",color: page >= totalPages ? "#3a5568" : "#5ef2ff",cursor: page >= totalPages ? "default" : "pointer",fontSize:12}}>Siguiente</button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
