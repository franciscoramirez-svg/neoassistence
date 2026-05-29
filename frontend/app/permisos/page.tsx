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

export default function PermisosPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState(getStoredUser);
  const [mounted, setMounted] = useState(false);
  const [permisos, setPermisos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ empleado_nombre: "", tipo: "permiso", fecha_inicio: "", fecha_fin: "", motivo: "" });

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && !user) router.push("/login"); }, [mounted, user, router]);

  useEffect(() => {
    if (!user) return;
    loadPermisos();
  }, [user, filter]);

  async function loadPermisos() {
    try {
      let url = "/permisos";
      const params = new URLSearchParams();
      if (filter) params.set("estatus", filter);
      if (user?.role !== "admin") params.set("empleado", user?.name || "");
      const qs = params.toString();
      if (qs) url += "?" + qs;
      const data = await apiRequest<any[]>(url);
      setPermisos(data || []);
    } catch {} finally { setLoading(false); }
  }

  async function handleSubmit() {
    if (!formData.fecha_inicio || !formData.fecha_fin) {
      toast("Selecciona fecha de inicio y fin", "error");
      return;
    }
    try {
      await apiRequest("/permisos", {
        method: "POST",
        body: JSON.stringify({ ...formData, empleado_nombre: formData.empleado_nombre || user?.name || "" }),
      });
      toast("Permiso solicitado", "success");
      setShowForm(false);
      setFormData({ empleado_nombre: "", tipo: "permiso", fecha_inicio: "", fecha_fin: "", motivo: "" });
      loadPermisos();
    } catch { toast("Error al crear", "error"); }
  }

  async function handleResolve(id: string, estatus: string) {
    try {
      await apiRequest(`/permisos/${id}/resolver`, {
        method: "PUT",
        body: JSON.stringify({ estatus, admin_comentario: "" }),
      });
      toast(`Permiso ${estatus}`, "success");
      loadPermisos();
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
          <Link href={user?.role === "admin" ? "/dashboard" : user?.role?.includes("supervisor") ? "/supervisor" : "/empleado"} style={{color:"#00f2fe",fontSize:13,textDecoration:"none"}}>← Volver</Link>
          <button onClick={() => { localStorage.removeItem("neoassistence_user"); router.push("/login"); }} style={{background:"none",border:"none",color:"#ff8c9e",cursor:"pointer"}}>Cerrar sesión</button>
        </div>
      </nav>

      <section className="glass" style={{padding:24,marginBottom:20}}>
        <p style={{color:"#00f2fe",textTransform:"uppercase",letterSpacing:"0.18em"}}>Permisos y Vacaciones</p>
        <h1 style={{margin:"8px 0"}}>Gestión de ausencias</h1>
        <p style={{color:"#9bb4ca"}}>Solicita y administra permisos o vacaciones.</p>
      </section>

      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <button onClick={() => setShowForm(!showForm)} style={{padding:"10px 18px",borderRadius:10,border:"1px solid rgba(0,242,254,0.3)",background:"rgba(0,242,254,0.1)",color:"#00f2fe",cursor:"pointer",fontSize:13}}>
          {showForm ? "Cancelar" : "Nueva solicitud"}
        </button>
        {["", "pendiente", "aprobado", "rechazado"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${filter===f?"rgba(0,242,254,0.5)":"rgba(255,255,255,0.1)"}`,background:filter===f?"rgba(0,242,254,0.15)":"transparent",color:filter===f?"#00f2fe":"#9bb4ca",cursor:"pointer",fontSize:12}}>
            {f === "aprobado" ? "Aprobado" : f === "rechazado" ? "Rechazado" : f === "pendiente" ? "Pendiente" : "Todas"}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="glass" style={{padding:20,marginBottom:20,borderRadius:16}}>
          <h3 style={{margin:"0 0 12px",color:"#00f2fe",fontSize:14}}>Nueva solicitud</h3>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:10,marginBottom:12}}>
            <div>
              <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Empleado</label>
              <input value={formData.empleado_nombre || user?.name || ""} onChange={e => setFormData({...formData, empleado_nombre: e.target.value})} style={{width:"100%",padding:8,borderRadius:8,border:"1px solid rgba(0,242,254,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13}} />
            </div>
            <div>
              <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Tipo</label>
              <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} style={{width:"100%",padding:8,borderRadius:8,border:"1px solid rgba(0,242,254,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13}}>
                <option value="permiso">Permiso</option>
                <option value="vacacion">Vacación</option>
              </select>
            </div>
            <div>
              <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Inicio</label>
              <input type="date" value={formData.fecha_inicio} onChange={e => setFormData({...formData, fecha_inicio: e.target.value})} style={{width:"100%",padding:8,borderRadius:8,border:"1px solid rgba(0,242,254,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13}} />
            </div>
            <div>
              <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Fin</label>
              <input type="date" value={formData.fecha_fin} onChange={e => setFormData({...formData, fecha_fin: e.target.value})} style={{width:"100%",padding:8,borderRadius:8,border:"1px solid rgba(0,242,254,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13}} />
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Motivo</label>
            <textarea value={formData.motivo} onChange={e => setFormData({...formData, motivo: e.target.value})} style={{width:"100%",padding:8,borderRadius:8,border:"1px solid rgba(0,242,254,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13,minHeight:60}} />
          </div>
          <button onClick={handleSubmit} style={{padding:"10px 20px",borderRadius:8,border:"1px solid rgba(179,136,255,0.3)",background:"rgba(179,136,255,0.15)",color:"#b388ff",fontSize:13,cursor:"pointer"}}>Guardar</button>
        </div>
      )}

      <div className="glass" style={{padding:24,borderRadius:16}}>
        {loading ? (
          <div className="skeleton" style={{width:"100%",height:200,borderRadius:16}} />
        ) : permisos.length === 0 ? (
          <p style={{color:"#9bb4ca",textAlign:"center"}}>Sin solicitudes</p>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{borderBottom:"1px solid rgba(0,242,254,0.15)"}}>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Empleado</th>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Tipo</th>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Inicio</th>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Fin</th>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Motivo</th>
                  <th style={{textAlign:"center",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Estado</th>
                  {user?.role === "admin" && <th style={{textAlign:"center",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Acción</th>}
                </tr>
              </thead>
              <tbody>
                {permisos.map(p => (
                  <tr key={p.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                    <td style={{padding:"8px",color:"white"}}>{p.empleado_nombre}</td>
                    <td style={{padding:"8px",color:"#9bb4ca"}}>{p.tipo === "vacacion" ? "Vacación" : "Permiso"}</td>
                    <td style={{padding:"8px",color:"#9bb4ca"}}>{p.fecha_inicio}</td>
                    <td style={{padding:"8px",color:"#9bb4ca"}}>{p.fecha_fin}</td>
                    <td style={{padding:"8px",color:"#9bb4ca",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.motivo || "—"}</td>
                    <td style={{padding:"8px",textAlign:"center"}}>
                      <span style={{color: p.estatus === "aprobado" ? "#b388ff" : p.estatus === "rechazado" ? "#ff8c9e" : "#ffcc5e"}}>
                        {p.estatus === "aprobado" ? "Aprobado" : p.estatus === "rechazado" ? "Rechazado" : "Pendiente"}
                      </span>
                    </td>
                    {user?.role === "admin" && p.estatus === "pendiente" && (
                      <td style={{padding:"8px",textAlign:"center"}}>
                        <div style={{display:"flex",gap:6,justifyContent:"center"}}>
                          <button onClick={() => handleResolve(p.id, "aprobado")} style={{padding:"4px 10px",borderRadius:6,border:"1px solid rgba(179,136,255,0.3)",background:"rgba(179,136,255,0.1)",color:"#b388ff",fontSize:11,cursor:"pointer"}}>✓</button>
                          <button onClick={() => handleResolve(p.id, "rechazado")} style={{padding:"4px 10px",borderRadius:6,border:"1px solid rgba(255,140,158,0.3)",background:"rgba(255,140,158,0.1)",color:"#ff8c9e",fontSize:11,cursor:"pointer"}}>✕</button>
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
