"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { useToast } from "../../ToastProvider";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("neoassistence_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default function AdminRegistrosPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState(getStoredUser);
  const [mounted, setMounted] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ estatus: "", justificacion: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && user?.role !== "admin") router.push("/dashboard"); }, [mounted, user, router]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    loadRecords();
  }, [user, filterEmployee, filterDate]);

  async function loadRecords() {
    setLoading(true);
    try {
      const res = await apiRequest<any>("/records");
      let items: any[] = res?.data?.items || [];
      if (filterEmployee) items = items.filter((r: any) => r.empleado?.toLowerCase().includes(filterEmployee.toLowerCase()));
      if (filterDate) items = items.filter((r: any) => r.fecha_hora?.startsWith(filterDate));
      setRecords(items);
    } catch {} finally { setLoading(false); }
  }

  function startEdit(r: any) {
    setEditId(r.id);
    setEditData({ estatus: r.estatus || "", justificacion: r.justificacion || "" });
  }

  async function saveEdit() {
    if (!editId) return;
    setSaving(true);
    try {
      await apiRequest(`/admin/records/${editId}`, {
        method: "PUT",
        body: JSON.stringify(editData),
      });
      toast("Registro actualizado", "success");
      setEditId(null);
      loadRecords();
    } catch { toast("Error al actualizar", "error"); }
    setSaving(false);
  }

  function handleLogout() {
    localStorage.removeItem("neoassistence_user");
    router.push("/login");
  }

  if (!mounted || !user) return <main className="page-shell"><div className="skeleton" style={{width:"100%",height:300,borderRadius:24}} /></main>;
  if (user.role !== "admin") return null;

  return (
    <main className="page-shell">
      <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",marginBottom:8}}>
        <Link href="/dashboard" style={{color:"#00f2fe",fontSize:13,textDecoration:"none"}}>← Volver</Link>
        <button onClick={handleLogout} style={{background:"none",border:"none",color:"#ff8c9e",cursor:"pointer"}}>Cerrar sesión</button>
      </nav>

      <div className="glass" style={{padding:24,marginBottom:20}}>
        <p style={{color:"#00f2fe",textTransform:"uppercase",letterSpacing:"0.18em"}}>Admin</p>
        <h1 style={{margin:"8px 0"}}>Editar registros</h1>
        <p style={{color:"#9bb4ca"}}>Corrige estatus o justificación de registros de asistencia.</p>
      </div>

      <div className="glass" style={{padding:20,marginBottom:20}}>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"end"}}>
          <div style={{flex:1,minWidth:150}}>
            <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Empleado</label>
            <input value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} placeholder="Filtrar por nombre..." style={{width:"100%",padding:8,borderRadius:8,border:"1px solid rgba(0,242,254,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13}} />
          </div>
          <div style={{flex:1,minWidth:150}}>
            <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Fecha</label>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{width:"100%",padding:8,borderRadius:8,border:"1px solid rgba(0,242,254,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13}} />
          </div>
          <button onClick={() => { setFilterEmployee(""); setFilterDate(""); }} style={{padding:"8px 14px",borderRadius:8,border:"1px solid rgba(0,242,254,0.2)",background:"transparent",color:"#9bb4ca",cursor:"pointer"}}>Limpiar</button>
        </div>
      </div>

      <div className="glass" style={{padding:24,borderRadius:16}}>
        {loading ? (
          <div className="skeleton" style={{width:"100%",height:300,borderRadius:16}} />
        ) : records.length === 0 ? (
          <p style={{color:"#9bb4ca",textAlign:"center"}}>Sin registros</p>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{borderBottom:"1px solid rgba(0,242,254,0.15)"}}>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Fecha</th>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Empleado</th>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Tipo</th>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Estatus</th>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Justificación</th>
                  <th style={{textAlign:"center",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                    <td style={{padding:"8px",color:"white",whiteSpace:"nowrap"}}>{new Date(r.fecha_hora).toLocaleString("es-MX")}</td>
                    <td style={{padding:"8px",color:"white"}}>{r.empleado}</td>
                    <td style={{padding:"8px",color:"#9bb4ca"}}>{r.tipo}</td>
                    <td style={{padding:"8px"}}>
                      {editId === r.id ? (
                        <select value={editData.estatus} onChange={e => setEditData({...editData, estatus: e.target.value})} style={{padding:"4px 8px",borderRadius:6,border:"1px solid rgba(0,242,254,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:12}}>
                          <option value="A Tiempo">A Tiempo</option>
                          <option value="Retardo">Retardo</option>
                          <option value="Retardo 1-15 min">Retardo 1-15 min</option>
                          <option value="Retardo 16-30 min">Retardo 16-30 min</option>
                          <option value="Retardo 31+ min">Retardo 31+ min</option>
                          <option value="OLVIDO REGISTRO">OLVIDO REGISTRO</option>
                          <option value="Justificado">Justificado</option>
                          <option value="Permiso">Permiso</option>
                        </select>
                      ) : (
                        <span style={{color: r.estatus === "A Tiempo" ? "#b388ff" : r.estatus?.toLowerCase().includes("retardo") ? "#ff8c9e" : r.estatus === "Permiso" ? "#00f2fe" : "#ffcc5e"}}>{r.estatus}</span>
                      )}
                    </td>
                    <td style={{padding:"8px"}}>
                      {editId === r.id ? (
                        <textarea value={editData.justificacion} onChange={e => setEditData({...editData, justificacion: e.target.value})} style={{width:"100%",padding:"4px 8px",borderRadius:6,border:"1px solid rgba(0,242,254,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:12,minHeight:40}} />
                      ) : (
                        <span style={{color:"#9bb4ca",fontSize:12}}>{r.justificacion || "—"}</span>
                      )}
                    </td>
                    <td style={{padding:"8px",textAlign:"center"}}>
                      {editId === r.id ? (
                        <div style={{display:"flex",gap:4,justifyContent:"center"}}>
                          <button onClick={saveEdit} disabled={saving} style={{padding:"4px 10px",borderRadius:6,border:"1px solid rgba(179,136,255,0.3)",background:"rgba(179,136,255,0.1)",color:"#b388ff",fontSize:11,cursor:"pointer"}}>✓</button>
                          <button onClick={() => setEditId(null)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid rgba(255,140,158,0.3)",background:"rgba(255,140,158,0.1)",color:"#ff8c9e",fontSize:11,cursor:"pointer"}}>✕</button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(r)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid rgba(0,242,254,0.2)",background:"transparent",color:"#00f2fe",fontSize:11,cursor:"pointer"}}>Editar</button>
                      )}
                    </td>
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
