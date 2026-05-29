"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

type Branch = { id: string; nombre: string; lat: number; lon: number; radio: number };

function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("neoassistence_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

const FRONTEND_URL = "https://neoassistence.vercel.app";

export default function QRsPage() {
  const router = useRouter();
  const [user, setUser] = useState(getStoredUser());
  const [mounted, setMounted] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && !user) router.push("/login"); }, [mounted, user, router]);

  useEffect(() => {
    if (!user) return;
    apiRequest<{data: Branch[]}>("/branches").then(d => { setBranches(d.data || []); setLoading(false); }).catch(() => setLoading(false));
  }, [user]);

  if (!mounted || !user) {
    return <main className="page-shell"><div className="skeleton" style={{width:"100%",height:300,borderRadius:24}} /></main>;
  }

  return (
    <main className="page-shell">
      <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",marginBottom:16}}>
        <Link href="/dashboard" style={{color:"#00f2fe",textDecoration:"none"}}>← Volver</Link>
        <button onClick={()=>{localStorage.removeItem("neoassistence_user");router.push("/login")}} style={{background:"none",border:"none",color:"#ff8c9e",cursor:"pointer"}}>Cerrar sesión</button>
      </nav>

      <div className="glass" style={{padding:24,marginBottom:24}}>
        <p style={{color:"#00f2fe",textTransform:"uppercase",letterSpacing:"0.18em"}}>Admin</p>
        <h1 style={{margin:"8px 0"}}>Códigos QR</h1>
        <p style={{color:"#9bb4ca"}}>Imprime estos QR y colócalos en cada sucursal. Al escanearlos, el empleado abre el check-in con la sucursal pre-seleccionada.</p>
      </div>

      {loading ? (
        <div className="skeleton" style={{width:"100%",height:200,borderRadius:24}} />
      ) : branches.length === 0 ? (
        <p style={{color:"#9bb4ca"}}>No hay sucursales.</p>
      ) : (
        <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:24}}>
          {branches.map(b => {
            const qrData = `${FRONTEND_URL}/checkin?branch=${b.id}`;
            const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(qrData)}&size=300&margin=2`;
            return (
              <div key={b.id} className="glass" style={{padding:24,textAlign:"center"}}>
                <h3 style={{margin:"0 0 16px"}}>{b.nombre}</h3>
                <div style={{width:200,height:200,background:"white",margin:"0 auto 16px",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:12}}>
                  <img src={qrUrl} alt={`QR ${b.nombre}`} style={{width:"100%",height:"100%"}} />
                </div>
                <p style={{color:"#9bb4ca",fontSize:12,marginBottom:16,wordBreak:"break-all"}}>{qrData}</p>
                <a href={`https://quickchart.io/qr?text=${encodeURIComponent(qrData)}&size=500&margin=2`} download={`qr_${b.nombre.replace(/\s+/g,"_")}.png`} style={{display:"inline-block",padding:"10px 16px",borderRadius:10,border:"1px solid rgba(0,242,254,0.28)",background:"linear-gradient(135deg, rgba(0,242,254,0.14), rgba(179,136,255,0.08))",color:"white",textDecoration:"none"}}>📥 Descargar</a>
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
