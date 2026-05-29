"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { apiRequest } from "@/lib/api";

type Branch = {
  id: string;
  nombre: string;
  lat: number;
  lon: number;
};

type RecordItem = {
  id: string;
  empleado: string;
  tipo: string;
  estatus: string;
  fecha_hora: string;
  sucursal_id: string;
};

function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("neoassistence_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default function MapaPage() {
  const router = useRouter();
  const [user, setUser] = useState(getStoredUser());
  const [mounted, setMounted] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && !user) router.push("/login"); }, [mounted, user, router]);

  useEffect(() => {
    if (!user) return;
    apiRequest<any>("/branches").then(r => setBranches(r.data || [])).catch(() => []);
    apiRequest<any>("/records").then(r => setRecords(r.data?.items || [])).catch(() => []);
    const t = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(t);
  }, [user]);

  useEffect(() => {
    if (!mounted || !user || loading || branches.length === 0 || !mapContainerRef.current) return;
    
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
      
      setTimeout(() => {
        if (!mapContainerRef.current || (window as any).L === undefined) return;
        
        const L = (window as any).L;
        
        const avgLat = branches.reduce((a, b) => a + b.lat, 0) / branches.length;
        const avgLon = branches.reduce((a, b) => a + b.lon, 0) / branches.length;
        
        const map = L.map("map-container").setView([avgLat, avgLon], 10);
        
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 19,
        }).addTo(map);
        
        const today = new Date().toISOString().split("T")[0];
        
        branches.forEach(branch => {
          const branchRecords = records.filter(r => r.sucursal_id === branch.id && r.fecha_hora?.startsWith(today));
          const hasRetardo = branchRecords.some(r => r.estatus?.toLowerCase().includes("retardo"));
          const total = branchRecords.length;
          
          const icon = L.divIcon({
            className: "custom-marker",
            html: `<div style="
              width: 40px; height: 40px;
              background: ${hasRetardo ? "linear-gradient(135deg, #ff8c9e, #d04aff)" : "linear-gradient(135deg, #00f2fe, #b388ff)"};
              border-radius: 50%;
              display: flex; align-items: center; justify-content: center;
              box-shadow: 0 0 20px ${hasRetardo ? "rgba(255,140,158,0.6)" : "rgba(0,242,254,0.6)"};
              font-size: 14px; font-weight: bold; color: #0a1526;
              border: 3px solid ${hasRetardo ? "#ff8c9e" : "#00f2fe"};
            ">${total}</div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          });
          
          const marker = L.marker([branch.lat, branch.lon], { icon }).addTo(map);
          marker.bindPopup(`
            <div style="color: #0a1526; min-width: 150px;">
              <strong style="font-size: 14px;">${branch.nombre}</strong><br/>
              <span style="font-size: 12px;">📍 ${branch.lat.toFixed(4)}, ${branch.lon.toFixed(4)}</span><br/>
              <hr style="margin: 8px 0; border-color: #ddd;"/>
              <div style="display: flex; justify-content: space-around; font-size: 12px;">
                <span>📥 ${branchRecords.filter(r => r.tipo === "Entrada").length}</span>
                <span>📤 ${branchRecords.filter(r => r.tipo === "Salida").length}</span>
                <span style="color: ${hasRetardo ? "#d04aff" : "#00f2fe"}">⏱ ${branchRecords.filter(r => r.estatus?.toLowerCase().includes("retardo")).length}</span>
              </div>
            </div>
          `);
          
          marker.on("click", () => setSelectedBranch(branch));
        });
      }, 500);
    };
    document.body.appendChild(script);
  }, [mounted, user, loading, branches, records]);

  if (!mounted || !user) return (
    <main className="page-shell">
      <div style={{textAlign:"center",padding:40}}><div className="skeleton" style={{width:"100%",height:400,borderRadius:24}} /></div>
    </main>
  );

  const today = new Date().toISOString().split("T")[0];
  const todayRecords = records.filter(r => r.fecha_hora?.startsWith(today));

  const getBranchStats = (branchId: string) => {
    const branchRecords = records.filter(r => r.sucursal_id === branchId && r.fecha_hora?.startsWith(today));
    return {
      total: branchRecords.length,
      entradas: branchRecords.filter(r => r.tipo === "Entrada").length,
      salidas: branchRecords.filter(r => r.tipo === "Salida").length,
      retardos: branchRecords.filter(r => r.estatus?.toLowerCase().includes("retardo")).length,
    };
  };

  return (
    <main className="page-shell">
      <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",marginBottom:8}}>
        <img src="/images/logo_modo_oscuro.fw.png" alt="NEOMOTIC" style={{height:32}} />
        <button onClick={() => { localStorage.removeItem("neoassistence_user"); router.push("/login"); }} style={{background:"none",border:"none",color:"#ff8c9e",cursor:"pointer"}}>Cerrar sesión</button>
      </nav>

      <Link href="/dashboard" style={{color:"#00f2fe",textDecoration:"none",display:"block",marginBottom:16}}>← Volver al dashboard</Link>

      <div className="glass" style={{padding:24,marginBottom:24}}>
        <h1 style={{margin:0,fontSize:28}}>🗺️ Mapa de Ubicaciones</h1>
        <p style={{color:"#9bb4ca",marginTop:8}}>{branches.length} ubicaciones • {todayRecords.length} registros hoy</p>
      </div>

      {loading ? (
        <div className="glass" style={{padding:40,textAlign:"center"}}>
          <p style={{color:"#00f2fe",fontSize:24}}>🗺️</p>
          <p style={{color:"#9bb4ca"}}>Cargando mapa...</p>
        </div>
      ) : branches.length > 0 ? (
        <>
          <div id="map-container" ref={mapContainerRef} style={{
            height: 450,
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 24,
            border: "1px solid rgba(0,242,254,0.2)",
          }} />
          
          <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:24}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:16,height:16,borderRadius:"50%",background:"linear-gradient(135deg, #00f2fe, #b388ff)"}} />
              <span style={{color:"#9bb4ca",fontSize:13}}>Sin retardos</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:16,height:16,borderRadius:"50%",background:"linear-gradient(135deg, #ff8c9e, #d04aff)"}} />
              <span style={{color:"#9bb4ca",fontSize:13}}>Con retardos</span>
            </div>
          </div>

          {selectedBranch && (
            <div className="glass" style={{padding:20,marginBottom:24}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <h3 style={{margin:0,color:"#00f2fe"}}>{selectedBranch.nombre}</h3>
                <button onClick={() => setSelectedBranch(null)} style={{background:"none",border:"none",color:"#9bb4ca",cursor:"pointer",fontSize:18}}>✕</button>
              </div>
              <p style={{color:"#9bb4ca",fontSize:12,marginTop:4}}>📍 {selectedBranch.lat.toFixed(4)}, {selectedBranch.lon.toFixed(4)}</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4, 1fr)",gap:8,marginTop:16}}>
                <div style={{textAlign:"center",padding:12,borderRadius:8,background:"rgba(0,0,0,0.3)"}}>
                  <p style={{color:"#9bb4ca",margin:0,fontSize:10}}>Total</p>
                  <p style={{color:"#00f2fe",fontSize:22,fontWeight:"bold"}}>{getBranchStats(selectedBranch.id).total}</p>
                </div>
                <div style={{textAlign:"center",padding:12,borderRadius:8,background:"rgba(0,0,0,0.3)"}}>
                  <p style={{color:"#9bb4ca",margin:0,fontSize:10}}>Entrada</p>
                  <p style={{color:"#b388ff",fontSize:22,fontWeight:"bold"}}>{getBranchStats(selectedBranch.id).entradas}</p>
                </div>
                <div style={{textAlign:"center",padding:12,borderRadius:8,background:"rgba(0,0,0,0.3)"}}>
                  <p style={{color:"#9bb4ca",margin:0,fontSize:10}}>Salida</p>
                  <p style={{color:"#d08aff",fontSize:22,fontWeight:"bold"}}>{getBranchStats(selectedBranch.id).salidas}</p>
                </div>
                <div style={{textAlign:"center",padding:12,borderRadius:8,background:"rgba(0,0,0,0.3)"}}>
                  <p style={{color:"#9bb4ca",margin:0,fontSize:10}}>Retraso</p>
                  <p style={{color:getBranchStats(selectedBranch.id).retardos > 0 ? "#ff8c9e" : "#9bb4ca",fontSize:22,fontWeight:"bold"}}>{getBranchStats(selectedBranch.id).retardos}</p>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="glass" style={{padding:40,textAlign:"center"}}>
          <p style={{color:"#9bb4ca",fontSize:48}}>🗺️</p>
          <p style={{color:"#9bb4ca"}}>No hay sucursales registradas</p>
        </div>
      )}
    </main>
  );
}