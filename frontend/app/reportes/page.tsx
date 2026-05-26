"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { apiRequest } from "@/lib/api";
import { useToast } from "../ToastProvider";

type RecordItem = {
  id: string;
  empleado: string;
  tipo: string;
  estatus: string;
  fecha_hora: string;
  justificacion: string;
  sucursal_id: string;
};

type Branch = {
  id: string;
  nombre: string;
};

function getStoredUser() {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = localStorage.getItem("neoassistence_user");
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function ReportesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState(getStoredUser());
  const [mounted, setMounted] = useState(false);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagina, setPagina] = useState(0);

  const [filtroFechaInicio, setFiltroFechaInicio] = useState("");
  const [filtroFechaFin, setFiltroFechaFin] = useState("");
  const [filtroEmpleado, setFiltroEmpleado] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroSucursal, setFiltroSucursal] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !user) {
      router.push("/login");
    }
  }, [mounted, user, router]);

  useEffect(() => {
    const hace3Dias = new Date();
    hace3Dias.setDate(hace3Dias.getDate() - 3);
    setFiltroFechaInicio(hace3Dias.toISOString().split("T")[0]);
    setFiltroFechaFin(new Date().toISOString().split("T")[0]);
  }, []);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      apiRequest<{ data: { items: RecordItem[] } }>("/records").then(r => r.data?.items || []),
      apiRequest<any>("/branches").then(r => r.data || r.branches || []).catch(() => [])
    ]).then(([rec, bra]) => {
      setRecords(rec);
      setBranches(Array.isArray(bra) ? bra : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  if (!mounted || !user) {
    return (
      <main className="page-shell">
        <div style={{ textAlign: "center", padding: 40 }}>
          <div className="skeleton" style={{width:"100%",height:300,borderRadius:24}} />
        </div>
      </main>
    );
  }

  const registrosFiltrados = records.filter(r => {
    const fecha = new Date(r.fecha_hora);
    if (filtroFechaInicio && fecha < new Date(filtroFechaInicio)) return false;
    if (filtroFechaFin && fecha > new Date(filtroFechaFin + "T23:59:59")) return false;
    if (filtroEmpleado && !r.empleado?.toLowerCase().includes(filtroEmpleado.toLowerCase())) return false;
    if (filtroTipo && r.tipo !== filtroTipo) return false;
    if (filtroSucursal && r.sucursal_id !== filtroSucursal) return false;
    return true;
  });

  const POR_PAGINA = 20;
  const totalPaginas = Math.ceil(registrosFiltrados.length / POR_PAGINA);
  const registrosPagina = registrosFiltrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://192.168.1.85:8000/api";

  const exportarExcel = () => {
    const params = new URLSearchParams();
    if (filtroFechaInicio) params.set("fecha_inicio", filtroFechaInicio);
    if (filtroFechaFin) params.set("fecha_fin", filtroFechaFin);
    if (filtroSucursal) params.set("sucursal_id", filtroSucursal);
    window.open(`${API_URL}/records/export/excel?${params.toString()}`, "_blank");
  };

  const exportarSemanal = () => {
    if (!filtroFechaInicio || !filtroFechaFin) {
      toast("Selecciona fecha inicio y fin", "error");
      return;
    }
    const params = new URLSearchParams();
    params.set("fecha_inicio", filtroFechaInicio);
    params.set("fecha_fin", filtroFechaFin);
    window.open(`${API_URL}/records/export/semanal?${params.toString()}`, "_blank");
  };

  const exportarCSV = () => {
    const headers = ["Fecha/Hora", "Empleado", "Tipo", "Estatus", "Justificación"];
    const rows = registrosFiltrados.map(r => [
      new Date(r.fecha_hora).toLocaleString("es-MX"),
      r.empleado,
      r.tipo,
      r.estatus,
      r.justificacion || ""
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_asistencia_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const limpiarFiltros = () => {
    const hace3Dias = new Date();
    hace3Dias.setDate(hace3Dias.getDate() - 3);
    setFiltroFechaInicio(hace3Dias.toISOString().split("T")[0]);
    setFiltroFechaFin(new Date().toISOString().split("T")[0]);
    setFiltroEmpleado("");
    setFiltroTipo("");
    setFiltroSucursal("");
    setPagina(0);
  };

  const enviarReporte = async () => {
    setSending(true);
    try {
      const data = registrosFiltrados.map(r => ({
        fecha: new Date(r.fecha_hora).toLocaleString("es-MX"),
        empleado: r.empleado,
        tipo: r.tipo,
        estatus: r.estatus,
        justificacion: r.justificacion || ""
      }));
      await apiRequest<{ok: boolean}>("/reports/send", {
        method: "POST",
        body: JSON.stringify({
          records: data,
          filters: { fechaInicio: filtroFechaInicio, fechaFin: filtroFechaFin, sucursal: filtroSucursal }
        })
      });
      toast("Reporte enviado exitosamente", "success");
    } catch { toast("Error al enviar reporte", "error"); }
    setSending(false);
  };

  const empleadosUnicos = [...new Set(records.map(r => r.empleado).filter(Boolean))];

  return (
    <main className="page-shell">
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", marginBottom: 8 }}>
        <img src="/images/logo_modo_oscuro.fw.png" alt="NEOMOTIC" style={{height:32}} />
        <button onClick={() => { localStorage.removeItem("neoassistence_user"); router.push("/login"); }} style={{ background: "none", border: "none", color: "#ff8c9e", cursor: "pointer" }}>
          Cerrar sesión
        </button>
      </nav>

      <Link href="/dashboard" style={{ color: "#5ef2ff", textDecoration: "none", display:"block",marginBottom:16 }}>
        ← Volver al dashboard
      </Link>

      <section className="glass" style={{ padding: 24, marginBottom: 24 }}>
        <p style={{ color: "#5ef2ff", textTransform: "uppercase", letterSpacing: "0.18em" }}>Reportes</p>
        <h1 style={{ margin: "8px 0" }}>Exportación de datos</h1>
        <p style={{ color: "#9bb4ca" }}>Filtra y exporta los registros de asistencia.</p>
      </section>

      <section className="glass" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Filtros</h2>
          <button onClick={limpiarFiltros} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(94,242,255,0.18)", background: "rgba(10,21,38,0.8)", color: "#9bb4ca", cursor: "pointer" }}>
            Limpiar
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <div>
            <label style={{ display: "block", marginBottom: 6, color: "#9bb4ca", fontSize: 14 }}>Desde</label>
            <input type="date" value={filtroFechaInicio} onChange={(e) => { setFiltroFechaInicio(e.target.value); setPagina(0); }} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid rgba(94,242,255,0.18)", background: "rgba(10,21,38,0.8)", color: "white" }} />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 6, color: "#9bb4ca", fontSize: 14 }}>Hasta</label>
            <input type="date" value={filtroFechaFin} onChange={(e) => { setFiltroFechaFin(e.target.value); setPagina(0); }} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid rgba(94,242,255,0.18)", background: "rgba(10,21,38,0.8)", color: "white" }} />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 6, color: "#9bb4ca", fontSize: 14 }}>Empleado</label>
            <select value={filtroEmpleado} onChange={(e) => { setFiltroEmpleado(e.target.value); setPagina(0); }} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid rgba(94,242,255,0.18)", background: "rgba(10,21,38,0.8)", color: "white" }}>
              <option value="">Todos</option>
              {empleadosUnicos.map(emp => (
                <option key={emp} value={emp}>{emp}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 6, color: "#9bb4ca", fontSize: 14 }}>Tipo</label>
            <select value={filtroTipo} onChange={(e) => { setFiltroTipo(e.target.value); setPagina(0); }} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid rgba(94,242,255,0.18)", background: "rgba(10,21,38,0.8)", color: "white" }}>
              <option value="">Todos</option>
              <option value="Entrada">Entrada</option>
              <option value="Salida">Salida</option>
            </select>
          </div>
        </div>
      </section>

      <section className="glass" style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Registros ({registrosFiltrados.length})</h2>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
            <Link href="/reportes-auto" style={{padding:"8px 16px",borderRadius:10,border:"1px solid rgba(156,255,181,0.3)",background:"rgba(156,255,181,0.1)",color:"#9cffb5",textDecoration:"none"}}>📧 Auto-Reporte</Link>
            <button onClick={exportarCSV} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(94,242,255,0.28)", background: "linear-gradient(135deg, rgba(94,242,255,0.14), rgba(156,255,181,0.08))", color: "white", cursor: "pointer" }}>
              📥 CSV
            </button>
            <button onClick={exportarExcel} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(156,255,181,0.28)", background: "linear-gradient(135deg, rgba(156,255,181,0.14), rgba(94,242,255,0.08))", color: "white", cursor: "pointer" }}>
              📊 Excel
            </button>
            <button onClick={exportarSemanal} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(255,140,158,0.28)", background: "linear-gradient(135deg, rgba(255,140,158,0.14), rgba(208,138,255,0.08))", color: "white", cursor: "pointer" }}>
              📋 Semanal
            </button>
          </div>
        </div>

        {loading ? (
          <div className="skeleton" style={{width:"100%",height:200,borderRadius:24}} />
        ) : error ? (
          <p style={{ color: "#ff8c9e" }}>{error}</p>
        ) : registrosFiltrados.length === 0 ? (
          <p style={{ color: "#9bb4ca" }}>No hay registros con los filtros seleccionados.</p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(94,242,255,0.18)" }}>
                    <th style={{ textAlign: "left", padding: "10px 8px", color: "#9bb4ca", fontWeight: 500 }}>Fecha</th>
                    <th style={{ textAlign: "left", padding: "10px 8px", color: "#9bb4ca", fontWeight: 500 }}>Empleado</th>
                    <th style={{ textAlign: "left", padding: "10px 8px", color: "#9bb4ca", fontWeight: 500 }}>Tipo</th>
                    <th style={{ textAlign: "left", padding: "10px 8px", color: "#9bb4ca", fontWeight: 500 }}>Estatus</th>
                  </tr>
                </thead>
                <tbody>
                  {registrosPagina.map((r) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid rgba(94,242,255,0.08)" }}>
                      <td style={{ padding: "10px 8px" }}>{new Date(r.fecha_hora).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                      <td style={{ padding: "10px 8px" }}>{r.empleado}</td>
                      <td style={{ padding: "10px 8px" }}>{r.tipo}</td>
                      <td style={{ padding: "10px 8px", color: r.estatus?.toLowerCase().includes("retardo") ? "#ff8c9e" : "#9cffb5", fontSize: 13 }}>{r.estatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPaginas > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
                <button onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(94,242,255,0.18)", background: pagina === 0 ? "rgba(10,21,38,0.4)" : "rgba(10,21,38,0.8)", color: "#9bb4ca", cursor: pagina === 0 ? "not-allowed" : "pointer" }}>
                  ← Anterior
                </button>
                <span style={{ padding: "8px 12px", color: "#9bb4ca" }}>{pagina + 1} / {totalPaginas}</span>
                <button onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))} disabled={pagina >= totalPaginas - 1} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(94,242,255,0.18)", background: pagina >= totalPaginas - 1 ? "rgba(10,21,38,0.4)" : "rgba(10,21,38,0.8)", color: "#9bb4ca", cursor: pagina >= totalPaginas - 1 ? "not-allowed" : "pointer" }}>
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}