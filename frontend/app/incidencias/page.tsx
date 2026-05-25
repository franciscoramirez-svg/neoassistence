"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { useToast } from "../ToastProvider";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("neoassistence_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default function IncidenciasPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState(getStoredUser);
  const [mounted, setMounted] = useState(false);
  const [incidencias, setIncidencias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ empleado_nombre: "", tipo: "retardo", fecha: "", hora: "", motivo: "" });

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && !user) router.push("/login"); }, [mounted, user, router]);

  useEffect(() => {
    if (!user) return;
    loadIncidencias();
  }, [user, filter]);

  async function loadIncidencias() {
    try {
      let url = "/incidencias";
      const params = new URLSearchParams();
      if (filter) params.set("estatus", filter);
      if (user?.role !== "admin") params.set("empleado", user?.name || "");
      const qs = params.toString();
      if (qs) url += "?" + qs;
      const data = await apiRequest<any[]>(url);
      setIncidencias(data || []);
    } catch {} finally { setLoading(false); }
  }

  async function handleSubmit() {
    try {
      await apiRequest("/incidencias", {
        method: "POST",
        body: JSON.stringify({ ...formData, empleado_nombre: formData.empleado_nombre || user?.name || "" }),
      });
      toast("Incidencia creada", "success");
      setShowForm(false);
      setFormData({ empleado_nombre: "", tipo: "retardo", fecha: "", hora: "", motivo: "" });
      loadIncidencias();
    } catch { toast("Error al crear", "error"); }
  }

  async function handleResolve(id: string, estatus: string) {
    try {
      await apiRequest(`/incidencias/${id}/resolver`, {
        method: "PUT",
        body: JSON.stringify({ estatus, admin_comentario: "" }),
      });
      toast(`Incidencia ${estatus}`, "success");
      loadIncidencias();
    } catch { toast("Error", "error"); }
  }

  if (!mounted || !user) {
    return <main className="page-shell"><div className="skeleton" style={{width:"100%",height:300,borderRadius:24}} /></main>;
  }

  return (
    <main className="page-shell">
      <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",marginBottom:8}}>
        <img src="/images/logo_modo_oscuro.fw.png" alt="NEOMOTIC" style={{height:32}} />
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <Link href={user?.role === "admin" ? "/dashboard" : "/supervisor"} style={{color:"#5ef2ff",fontSize:13,textDecoration:"none"}}>← Volver</Link>
          <button onClick={() => { localStorage.removeItem("neoassistence_user"); router.push("/login"); }} style={{background:"none",border:"none",color:"#ff8c9e",cursor:"pointer"}}>Cerrar sesión</button>
        </div>
      </nav>

      <section className="glass" style={{padding:24,marginBottom:20}}>
        <p style={{color:"#5ef2ff",textTransform:"uppercase",letterSpacing:"0.18em"}}>Incidencias</p>
        <h1 style={{margin:"8px 0"}}>Gestión de incidencias</h1>
        <p style={{color:"#9bb4ca"}}>Justifica retardos, faltas o salidas anticipadas.</p>
      </section>

      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <button onClick={() => setShowForm(!showForm)} style={{padding:"10px 18px",borderRadius:10,border:"1px solid rgba(94,242,255,0.3)",background:"rgba(94,242,255,0.1)",color:"#5ef2ff",cursor:"pointer",fontSize:13}}>
          {showForm ? "Cancelar" : "Nueva incidencia"}
        </button>
        {["", "pendiente", "aprobada", "rechazada"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${filter===f?"rgba(94,242,255,0.5)":"rgba(255,255,255,0.1)"}`,background:filter===f?"rgba(94,242,255,0.15)":"transparent",color:filter===f?"#5ef2ff":"#9bb4ca",cursor:"pointer",fontSize:12}}>
            {f || "Todas"}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="glass" style={{padding:20,marginBottom:20,borderRadius:16}}>
          <h3 style={{margin:"0 0 12px",color:"#5ef2ff",fontSize:14}}>Nueva incidencia</h3>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:10,marginBottom:12}}>
            <div>
              <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Empleado</label>
              <input value={formData.empleado_nombre || user?.name || ""} onChange={e => setFormData({...formData, empleado_nombre: e.target.value})} style={{width:"100%",padding:8,borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13}} />
            </div>
            <div>
              <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Tipo</label>
              <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} style={{width:"100%",padding:8,borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13}}>
                <option value="retardo">Retardo</option>
                <option value="falta">Falta</option>
                <option value="salida_anticipada">Salida anticipada</option>
              </select>
            </div>
            <div>
              <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Fecha</label>
              <input type="date" value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} style={{width:"100%",padding:8,borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13}} />
            </div>
            <div>
              <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Hora</label>
              <input type="time" value={formData.hora} onChange={e => setFormData({...formData, hora: e.target.value})} style={{width:"100%",padding:8,borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13}} />
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Motivo</label>
            <textarea value={formData.motivo} onChange={e => setFormData({...formData, motivo: e.target.value})} style={{width:"100%",padding:8,borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13,minHeight:60}} />
          </div>
          <button onClick={handleSubmit} style={{padding:"10px 20px",borderRadius:8,border:"1px solid rgba(156,255,181,0.3)",background:"rgba(156,255,181,0.15)",color:"#9cffb5",fontSize:13,cursor:"pointer"}}>Guardar</button>
        </div>
      )}

      <div className="glass" style={{padding:24,borderRadius:16}}>
        {loading ? (
          <div className="skeleton" style={{width:"100%",height:200,borderRadius:16}} />
        ) : incidencias.length === 0 ? (
          <p style={{color:"#9bb4ca",textAlign:"center"}}>Sin incidencias</p>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{borderBottom:"1px solid rgba(94,242,255,0.15)"}}>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Empleado</th>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Tipo</th>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Fecha</th>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Motivo</th>
                  <th style={{textAlign:"center",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Estado</th>
                  {user?.role === "admin" && <th style={{textAlign:"center",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Acción</th>}
                </tr>
              </thead>
              <tbody>
                {incidencias.map(inc => (
                  <tr key={inc.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                    <td style={{padding:"8px",color:"white"}}>{inc.empleado_nombre}</td>
                    <td style={{padding:"8px",color:"#9bb4ca"}}>{inc.tipo}</td>
                    <td style={{padding:"8px",color:"#9bb4ca"}}>{inc.fecha}</td>
                    <td style={{padding:"8px",color:"#9bb4ca",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{inc.motivo || "—"}</td>
                    <td style={{padding:"8px",textAlign:"center"}}>
                      <span style={{color: inc.estatus === "aprobada" ? "#9cffb5" : inc.estatus === "rechazada" ? "#ff8c9e" : "#ffcc5e"}}>
                        {inc.estatus}
                      </span>
                    </td>
                    {user?.role === "admin" && inc.estatus === "pendiente" && (
                      <td style={{padding:"8px",textAlign:"center"}}>
                        <div style={{display:"flex",gap:6,justifyContent:"center"}}>
                          <button onClick={() => handleResolve(inc.id, "aprobada")} style={{padding:"4px 10px",borderRadius:6,border:"1px solid rgba(156,255,181,0.3)",background:"rgba(156,255,181,0.1)",color:"#9cffb5",fontSize:11,cursor:"pointer"}}>✓</button>
                          <button onClick={() => handleResolve(inc.id, "rechazada")} style={{padding:"4px 10px",borderRadius:6,border:"1px solid rgba(255,140,158,0.3)",background:"rgba(255,140,158,0.1)",color:"#ff8c9e",fontSize:11,cursor:"pointer"}}>✕</button>
                        </div>
                      </td>
                    )}
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
