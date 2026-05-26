"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("neoassistence_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

const BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://192.168.1.85:8000";
const API = process.env.NEXT_PUBLIC_API_URL || "http://192.168.1.85:8000/api";

export default function YTSPage() {
  const router = useRouter();
  const [user, setUser] = useState(getStoredUser);
  const [mounted, setMounted] = useState(false);
  const [months, setMonths] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [firmadoHoy, setFirmadoHoy] = useState(false);
  const [firmando, setFirmando] = useState(false);
  const [firmaMsg, setFirmaMsg] = useState("");

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (mounted && !user) router.push("/login");
  }, [mounted, user, router]);

  function loadYTS() {
    fetch(`${API}/yts`).then(r=>r.json()).then(data => {
      setMonths(data || []);
      if (data?.length && !selected) setSelected(data[0].mes);
      setLoading(false);
    }).catch(() => setLoading(false));
  }

  useEffect(() => {
    if (!user) return;
    loadYTS();
    fetch(`${API}/yts/firma/${user.id}`).then(r=>r.json()).then(d => setFirmadoHoy(d.firmado)).catch(()=>{});
  }, [user]);

  async function handleFirmar() {
    setFirmando(true);
    setFirmaMsg("");
    try {
      const res = await fetch(`${API}/yts/firmar`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({employee_id: user.id, employee_name: user.name}),
      });
      const d = await res.json();
      if (d.ok) {
        setFirmadoHoy(true);
        setFirmaMsg(d.message);
      } else {
        setFirmaMsg("Error al firmar");
      }
    } catch {
      setFirmaMsg("Error de conexión");
    }
    setFirmando(false);
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file || !selected) return;
    setUploading(true);
    setUploadMsg("");
    const form = new FormData();
    form.append("file", file);
    form.append("mes", selected);
    try {
      const res = await fetch(`${API}/yts/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (data.ok) {
        setUploadMsg("Imagen subida correctamente");
        loadYTS();
      } else {
        setUploadMsg("Error al subir");
      }
    } catch {
      setUploadMsg("Error de conexión");
    }
    setUploading(false);
  }

  const canUpload = user?.role === "admin" || user?.role?.toLowerCase().includes("supervisor");
  const isSupervisor = user?.role?.toLowerCase().includes("supervisor");
  const goBack = user?.role === "admin" ? "/dashboard" : user?.role === "empleado" ? "/empleado" : "/supervisor";

  if (!mounted || !user) {
    return (
      <main className="page-shell" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
        <div className="skeleton" style={{width:280,height:200,borderRadius:24}} />
      </main>
    );
  }

  const current = months.find(m => m.mes === selected);
  const imgUrl = current ? `${BASE}${current.archivo_url}` : null;

  const today = new Date();
  const mesOptions: string[] = [];
  for (let i = 23; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    mesOptions.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  }

  return (
    <main className="page-shell" style={{padding:16, maxWidth:600, margin:"0 auto",minHeight:"100vh"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <h1 style={{color:"#d08aff",fontSize:20,margin:0}}>Yo Trabajo Seguro</h1>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>router.push(goBack)} style={{padding:"8px 14px",borderRadius:8,border:"1px solid rgba(94,242,255,0.3)",background:"transparent",color:"#5ef2ff",fontSize:12}}>Volver</button>
          <button onClick={()=>{localStorage.removeItem("neoassistence_user"); router.push("/login");}} style={{padding:"8px 14px",borderRadius:8,border:"1px solid rgba(255,140,158,0.3)",background:"transparent",color:"#ff8c9e",fontSize:12}}>Salir</button>
        </div>
      </div>

      <div className="glass" style={{padding:20,borderRadius:16,marginBottom:16}}>
        <label style={{color:"#9bb4ca",fontSize:13,display:"block",marginBottom:8}}>Seleccionar mes</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"1px solid rgba(94,242,255,0.25)",background:"rgba(255,255,255,0.05)",color:"white",fontSize:14}}
        >
          <option value="">-- Selecciona un mes --</option>
          {mesOptions.map(m => {
            const has = months.find(x => x.mes === m);
            return (
              <option key={m} value={m} style={{color:"black"}}>
                {m} {has ? "✓" : ""}
              </option>
            );
          })}
        </select>

        {canUpload && (
          <div style={{marginTop:16,padding:16,borderTop:"1px solid rgba(255,255,255,0.08)",display:"flex",flexDirection:"column",gap:12}}>
            <p style={{color:"#9bb4ca",fontSize:12,margin:0}}>Subir imagen para el mes seleccionado:</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" style={{color:"white",fontSize:13}} />
            <button onClick={handleUpload} disabled={uploading} style={{padding:"8px 16px",borderRadius:8,border:"1px solid rgba(255,204,94,0.3)",background:"rgba(255,204,94,0.1)",color:uploading?"#9bb4ca":"white",fontSize:13,cursor:"pointer",alignSelf:"flex-start"}}>
              {uploading ? "Subiendo..." : "Subir imagen"}
            </button>
            {uploadMsg && <p style={{color:uploadMsg.includes("Error")?"#ff8c9e":"#9cffb5",fontSize:12,margin:0}}>{uploadMsg}</p>}
          </div>
        )}
      </div>

      <div className="glass" style={{padding:20,borderRadius:16,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <h2 style={{color:"#5ef2ff",fontSize:15,margin:0}}>Firma diaria</h2>
            <p style={{color:"#9bb4ca",fontSize:12,marginTop:4}}>
              {firmadoHoy ? "Ya firmaste hoy ✓" : "Confirma que estás en condiciones de trabajar"}
            </p>
          </div>
          {!firmadoHoy ? (
            <button onClick={handleFirmar} disabled={firmando} style={{padding:"10px 18px",borderRadius:10,border:"1px solid rgba(156,255,181,0.3)",background:"rgba(156,255,181,0.15)",color:"white",fontSize:13,fontWeight:"bold",cursor:"pointer"}}>
              {firmando ? "Firmando..." : "Firmar hoy"}
            </button>
          ) : (
            <div style={{width:40,height:40,borderRadius:"50%",background:"rgba(156,255,181,0.2)",display:"flex",alignItems:"center",justifyContent:"center",color:"#9cffb5",fontSize:20}}>✓</div>
          )}
        </div>
        {firmaMsg && <p style={{color:"#9cffb5",fontSize:12,marginTop:8,marginBottom:0}}>{firmaMsg}</p>}
      </div>

      {loading && <div className="skeleton" style={{width:"100%",height:120,borderRadius:16}} />}

      {imgUrl ? (
        <div className="glass" style={{padding:16,borderRadius:16,textAlign:"center"}}>
          <img
            src={imgUrl}
            alt={`Yo Trabajo Seguro ${selected}`}
            style={{maxWidth:"100%",maxHeight:"70vh",borderRadius:12}}
          />
          <p style={{color:"#9bb4ca",fontSize:12,marginTop:12}}>{selected}</p>
        </div>
      ) : selected && !loading ? (
        <div className="glass" style={{padding:32,borderRadius:16,textAlign:"center"}}>
          <p style={{color:"#9bb4ca",fontSize:14}}>No hay imagen disponible para {selected}.</p>
          <p style={{color:"#9bb4ca",fontSize:12}}>Contacta al administrador para subir la imagen del mes.</p>
        </div>
      ) : null}
    </main>
  );
}
