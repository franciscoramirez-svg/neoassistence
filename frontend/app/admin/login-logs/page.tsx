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

export default function AdminLoginLogsPage() {
  const router = useRouter();
  const [user, setUser] = useState(getStoredUser);
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterName, setFilterName] = useState("");
  const [filterResult, setFilterResult] = useState("all");

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && user?.role !== "admin") router.push("/dashboard"); }, [mounted, user, router]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    loadLogs();
  }, [user]);

  async function loadLogs() {
    setLoading(true);
    try {
      const res = await apiRequest<any[]>("/auth/login/logs");
      setLogs(res || []);
    } catch {} finally { setLoading(false); }
  }

  function handleLogout() {
    localStorage.removeItem("neoassistence_user");
    router.push("/login");
  }

  const filtered = logs.filter(l => {
    if (filterName && !l.employee_name?.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterResult === "success" && !l.success) return false;
    if (filterResult === "failed" && l.success) return false;
    return true;
  });

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
          <div style={{flex:1,minWidth:150}}>
            <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Empleado</label>
            <input value={filterName} onChange={e => setFilterName(e.target.value)} placeholder="Filtrar por nombre..." style={{width:"100%",padding:8,borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13}} />
          </div>
          <div>
            <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Resultado</label>
            <select value={filterResult} onChange={e => setFilterResult(e.target.value)} style={{padding:"8px 12px",borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13}}>
              <option value="all">Todos</option>
              <option value="success">Exitosos</option>
              <option value="failed">Fallidos</option>
            </select>
          </div>
          <button onClick={() => { setFilterName(""); setFilterResult("all"); }} style={{padding:"8px 14px",borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"transparent",color:"#9bb4ca",cursor:"pointer"}}>Limpiar</button>
        </div>
      </div>

      <div className="glass" style={{padding:24,borderRadius:16}}>
        {loading ? (
          <div className="skeleton" style={{width:"100%",height:300,borderRadius:16}} />
        ) : filtered.length === 0 ? (
          <p style={{color:"#9bb4ca",textAlign:"center"}}>Sin registros</p>
        ) : (
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
                {filtered.map(l => (
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
        )}
      </div>
    </main>
  );
}
