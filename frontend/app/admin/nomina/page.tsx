"use client";
import { useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("neoassistence_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default function NominaPage() {
  const user = getStoredUser();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [periodo, setPeriodo] = useState({ inicio: "", fin: "" });
  const [data, setData] = useState<any[]>([]);
  const [periodoLabel, setPeriodoLabel] = useState("");

  useState(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setPeriodo({
      inicio: first.toISOString().split("T")[0],
      fin: last.toISOString().split("T")[0],
    });
  });

  async function calcular() {
    if (!periodo.inicio || !periodo.fin) return;
    setLoading(true);
    try {
      const res = await apiRequest<any>(`/nomina/calcular?periodo_inicio=${periodo.inicio}&periodo_fin=${periodo.fin}`);
      setData(res?.data || []);
      setPeriodoLabel(res?.periodo || "");
    } catch {} finally { setLoading(false); }
  }

  const totalBruto = data.reduce((s, r) => s + r.sueldo_bruto, 0);
  const totalDesc = data.reduce((s, r) => s + r.descuentos, 0);
  const totalNeto = data.reduce((s, r) => s + r.sueldo_neto, 0);

  return (
    <main className="page-shell">
      <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",marginBottom:8}}>
        <Link href="/dashboard" style={{color:"#00f2fe",fontSize:13,textDecoration:"none"}}>← Volver</Link>
        <span style={{color:"#9bb4ca"}}>{user?.name}</span>
      </nav>

      <div className="glass" style={{padding:24,marginBottom:20}}>
        <p style={{color:"#00f2fe",textTransform:"uppercase",letterSpacing:"0.18em"}}>Admin</p>
        <h1 style={{margin:"8px 0"}}>Nómina</h1>
        <p style={{color:"#9bb4ca"}}>Cálculo automático de sueldos basado en asistencia.</p>
      </div>

      <div className="glass" style={{padding:20,marginBottom:20}}>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"end"}}>
          <div>
            <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Periodo inicio</label>
            <input type="date" value={periodo.inicio} onChange={e => setPeriodo({...periodo, inicio: e.target.value})}
              style={{padding:"8px 12px",borderRadius:8,border:"1px solid rgba(0,242,254,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13}} />
          </div>
          <div>
            <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Periodo fin</label>
            <input type="date" value={periodo.fin} onChange={e => setPeriodo({...periodo, fin: e.target.value})}
              style={{padding:"8px 12px",borderRadius:8,border:"1px solid rgba(0,242,254,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13}} />
          </div>
          <button onClick={calcular} disabled={loading}
            style={{padding:"10px 24px",borderRadius:8,border:"none",background:"linear-gradient(135deg, #00f2fe, #b388ff)",color:"#0a1526",fontWeight:"bold",fontSize:14,cursor:"pointer"}}>
            {loading ? "Calculando..." : "Calcular nómina"}
          </button>
        </div>
      </div>

      {data.length > 0 && (
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))",gap:12,marginBottom:20}}>
            <div className="glass" style={{padding:"16px",textAlign:"center",borderRadius:16}}>
              <p style={{color:"#9bb4ca",margin:0,fontSize:12,textTransform:"uppercase",letterSpacing:"0.08em"}}>Empleados</p>
                  <p style={{color:"#00f2fe",fontSize:32,margin:"6px 0 0",fontWeight:"bold"}}>{data.length}</p>
            </div>
            <div className="glass" style={{padding:"16px",textAlign:"center",borderRadius:16}}>
              <p style={{color:"#9bb4ca",margin:0,fontSize:12,textTransform:"uppercase",letterSpacing:"0.08em"}}>Total bruto</p>
              <p style={{color:"white",fontSize:28,margin:"6px 0 0",fontWeight:"bold"}}>{"$" + totalBruto.toFixed(2)}</p>
            </div>
            <div className="glass" style={{padding:"16px",textAlign:"center",borderRadius:16}}>
              <p style={{color:"#9bb4ca",margin:0,fontSize:12,textTransform:"uppercase",letterSpacing:"0.08em"}}>Descuentos</p>
              <p style={{color:"#ff8c9e",fontSize:28,margin:"6px 0 0",fontWeight:"bold"}}>{"-$" + totalDesc.toFixed(2)}</p>
            </div>
            <div className="glass" style={{padding:"16px",textAlign:"center",borderRadius:16}}>
              <p style={{color:"#9bb4ca",margin:0,fontSize:12,textTransform:"uppercase",letterSpacing:"0.08em"}}>Total nómina</p>
              <p style={{color:"#b388ff",fontSize:28,margin:"6px 0 0",fontWeight:"bold"}}>{"$" + totalNeto.toFixed(2)}</p>
            </div>
          </div>

          <div className="glass" style={{padding:24,borderRadius:16,overflowX:"auto"}}>
            <p style={{color:"#9bb4ca",fontSize:12,marginBottom:16}}>{periodoLabel}</p>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:600}}>
              <thead>
                <tr style={{borderBottom:"1px solid rgba(0,242,254,0.15)"}}>
                  <th style={{textAlign:"left",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Empleado</th>
                  <th style={{textAlign:"center",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Días</th>
                  <th style={{textAlign:"center",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Horas</th>
                  <th style={{textAlign:"center",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Retardos</th>
                  <th style={{textAlign:"center",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Inc.</th>
                  <th style={{textAlign:"right",padding:"8px",color:"#9bb4ca",fontWeight:500}}>S. Diario</th>
                  <th style={{textAlign:"right",padding:"8px",color:"#9bb4ca",fontWeight:500}}>Bruto</th>
                  <th style={{textAlign:"right",padding:"8px",color:"#ff8c9e",fontWeight:500}}>Desc.</th>
                  <th style={{textAlign:"right",padding:"8px",color:"#b388ff",fontWeight:500}}>Neto</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r, i) => (
                  <tr key={i} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                    <td style={{padding:"8px",color:"white"}}>{r.empleado}</td>
                    <td style={{padding:"8px",textAlign:"center",color:"#9bb4ca"}}>{r.dias_trabajados}</td>
                    <td style={{padding:"8px",textAlign:"center",color:"#9bb4ca"}}>{r.horas_totales}</td>
                    <td style={{padding:"8px",textAlign:"center",color:r.retardos_min > 0 ? "#ff8c9e" : "#9bb4ca"}}>{r.retardos_min}m</td>
                    <td style={{padding:"8px",textAlign:"center",color:r.incidencias > 0 ? "#ff8c9e" : "#9bb4ca"}}>{r.incidencias}</td>
                    <td style={{padding:"8px",textAlign:"right",color:"#9bb4ca"}}>{"$" + r.sueldo_diario.toFixed(2)}</td>
                    <td style={{padding:"8px",textAlign:"right",color:"white"}}>{"$" + r.sueldo_bruto.toFixed(2)}</td>
                    <td style={{padding:"8px",textAlign:"right",color:"#ff8c9e"}}>{"-$" + r.descuentos.toFixed(2)}</td>
                    <td style={{padding:"8px",textAlign:"right",color:"#b388ff",fontWeight:"bold"}}>{"$" + r.sueldo_neto.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{borderTop:"2px solid rgba(0,242,254,0.2)"}}>
                  <td style={{padding:"8px",color:"#00f2fe",fontWeight:"bold"}}>Total</td>
                  <td colSpan={5} />
                    <td style={{padding:"8px",textAlign:"right",color:"white",fontWeight:"bold"}}>{"$" + totalBruto.toFixed(2)}</td>
                  <td style={{padding:"8px",textAlign:"right",color:"#ff8c9e",fontWeight:"bold"}}>{"-$" + totalDesc.toFixed(2)}</td>
                  <td style={{padding:"8px",textAlign:"right",color:"#b388ff",fontWeight:"bold"}}>{"$" + totalNeto.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
