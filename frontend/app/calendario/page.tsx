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

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function CalendarioPage() {
  const router = useRouter();
  const [user, setUser] = useState(getStoredUser);
  const [mounted, setMounted] = useState(false);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [data, setData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && !user) router.push("/login"); }, [mounted, user, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const mes = `${year}-${String(month + 1).padStart(2, "0")}`;
    apiRequest<Record<string, string>>(`/records/calendar?mes=${mes}&empleado=${user.role !== "admin" ? user.name : ""}`)
      .then(d => { setData(d || {}); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user, year, month]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };
  const today = new Date().toISOString().split("T")[0];

  const colorMap: Record<string, string> = {
    presente: "#9cffb5",
    retardo: "#ff8c9e",
    permiso: "#5ef2ff",
    otro: "#ffcc5e",
  };

  if (!mounted || !user) return <main className="page-shell"><div className="skeleton" style={{width:"100%",height:400,borderRadius:24}} /></main>;

  const goBack = user?.role === "admin" ? "/dashboard" : "/supervisor";

  return (
    <main className="page-shell">
      <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",marginBottom:8}}>
        <Link href={goBack} style={{color:"#00f2fe",fontSize:13,textDecoration:"none"}}>← Volver</Link>
        <button onClick={()=>{localStorage.removeItem("neoassistence_user");router.push("/login")}} style={{background:"none",border:"none",color:"#ff8c9e",cursor:"pointer"}}>Cerrar sesión</button>
      </nav>

      <div className="glass" style={{padding:24,marginBottom:20}}>
        <p style={{color:"#00f2fe",textTransform:"uppercase",letterSpacing:"0.18em"}}>Asistencia</p>
        <h1 style={{margin:"8px 0"}}>Calendario mensual</h1>
      </div>

      <div className="glass" style={{padding:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <button onClick={prevMonth} style={{padding:"8px 14px",borderRadius:8,border:"1px solid rgba(0,242,254,0.2)",background:"transparent",color:"#00f2fe",cursor:"pointer"}}>← {MONTHS[month === 0 ? 11 : month - 1].slice(0,3)}</button>
          <h2 style={{margin:0,color:"white",fontSize:18}}>{MONTHS[month]} {year}</h2>
          <button onClick={nextMonth} style={{padding:"8px 14px",borderRadius:8,border:"1px solid rgba(0,242,254,0.2)",background:"transparent",color:"#00f2fe",cursor:"pointer"}}>{MONTHS[month === 11 ? 0 : month + 1].slice(0,3)} →</button>
        </div>

        {loading ? (
          <div className="skeleton" style={{width:"100%",height:300,borderRadius:16}} />
        ) : (
          <>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:8,textAlign:"center"}}>
              {DAYS.map(d => <div key={d} style={{color:"#9bb4ca",fontSize:12,padding:"4px 0"}}>{d}</div>)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,textAlign:"center"}}>
              {Array.from({length: firstDay}).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({length: daysInMonth}, (_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const status = data[dateStr];
                const color = colorMap[status || ""] || (dateStr < today ? "#1a2a3a" : "transparent");
                const isToday = dateStr === today;
                return (
                  <div key={day} style={{
                    aspectRatio:"1", display:"flex", alignItems:"center", justifyContent:"center",
                    borderRadius:8, background: color, color: status ? "#0a1526" : (color === "transparent" ? "#9bb4ca" : "#9bb4ca"),
                    fontWeight: isToday ? "bold" : "normal", border: isToday ? "2px solid #00f2fe" : "none",
                    fontSize: 13, position: "relative"
                  }}>
                    {day}
                    {status && <span style={{position:"absolute",bottom:2,fontSize:8}}>{status === "presente" ? "✓" : status === "retardo" ? "!" : status === "permiso" ? "P" : "?"}</span>}
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:16,justifyContent:"center",marginTop:16,flexWrap:"wrap"}}>
              <span style={{fontSize:12,color:"#9bb4ca"}}><span style={{display:"inline-block",width:12,height:12,borderRadius:3,background:"#b388ff",marginRight:4,verticalAlign:"middle"}} /> Presente</span>
              <span style={{fontSize:12,color:"#9bb4ca"}}><span style={{display:"inline-block",width:12,height:12,borderRadius:3,background:"#ff8c9e",marginRight:4,verticalAlign:"middle"}} /> Retardo</span>
              <span style={{fontSize:12,color:"#9bb4ca"}}><span style={{display:"inline-block",width:12,height:12,borderRadius:3,background:"#00f2fe",marginRight:4,verticalAlign:"middle"}} /> Permiso</span>
              <span style={{fontSize:12,color:"#9bb4ca"}}><span style={{display:"inline-block",width:12,height:12,borderRadius:3,background:"#1a2a3a",marginRight:4,verticalAlign:"middle"}} /> Sin registro</span>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
