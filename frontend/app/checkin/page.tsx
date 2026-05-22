"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("neoassistence_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default function CheckInPage() {
  const router = useRouter();
  const [user, setUser] = useState(getStoredUser());
  const [mounted, setMounted] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [qrMode, setQrMode] = useState(false);
  const [selfieMode, setSelfieMode] = useState(false);
  const [selfieCaptured, setSelfieCaptured] = useState(false);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [justification, setJustification] = useState("");
  const [showJustification, setShowJustification] = useState(false);
  const [pendingType, setPendingType] = useState<"Entrada" | "Salida" | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const selfieVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && !user) router.push("/login"); }, [mounted, user, router]);
  useEffect(() => { if (!user || qrMode || lat) return; requestLocation(); }, [mounted, user, qrMode, lat]);
  useEffect(() => { if (qrMode) startCamera(); else stopCamera(); return () => stopCamera(); }, [qrMode]);
  useEffect(() => { 
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(t);
    } else if (countdown === 0 && selfieMode && selfieVideoRef.current) {
      captureSelfiePhoto();
    }
  }, [countdown, selfieMode]);

  function requestLocation() {
    if (!navigator.geolocation) { setLocationError("Geolocalización no soportada"); return; }
    setLocationLoading(true); setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (p) => { setLat(p.coords.latitude); setLon(p.coords.longitude); setLocationLoading(false); },
      (e) => { setLocationError("Error: " + e.message); setLocationLoading(false); setLat(19.432608); setLon(-99.133209); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch { setError("No se pudo acceder a la cámara"); }
  }

  function stopCamera() {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(t => t.stop());
    }
  }

  async function startSelfieCapture() {
    setSelfieMode(true);
    setSelfieCaptured(false);
    setSelfieImage(null);
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      if (selfieVideoRef.current) selfieVideoRef.current.srcObject = stream;
      setCountdown(3);
    } catch { setError("Error al acceder a la cámara"); }
  }

  async function captureSelfiePhoto() {
    if (!selfieVideoRef.current || !canvasRef.current) return;
    
    const video = selfieVideoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      setSelfieImage(dataUrl);
      
      if (video.srcObject) {
        const tracks = (video.srcObject as MediaStream).getTracks();
        tracks.forEach(t => t.stop());
      }
    }
    setSelfieCaptured(true);
    setSelfieMode(false);
  }

  function retakeSelfie() {
    setSelfieCaptured(false);
    setSelfieImage(null);
    startSelfieCapture();
  }

  async function handleCheckIn(type: "Entrada" | "Salida") {
    setError(""); setMessage("");
    if (!user?.name) { setError("Sesión no válida"); return; }
    if (!lat || !lon) { setError("Necesitas ubicación válida"); return; }

    try {
      const res = await apiRequest<{ message: string }>("/records", {
        method: "POST",
        body: JSON.stringify({
          employee_name: user.name,
          movement_type: type,
          lat, lon,
          justification: justification || null,
          source: qrMode ? "qr" : (selfieCaptured ? "selfie" : "web"),
          selfie_image: selfieImage || null,
        }),
      });
      setMessage(res.message);
      setJustification("");
      setShowJustification(false);
      setSelfieCaptured(false);
      setSelfieImage(null);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Error";
      if (errMsg.includes("justificación")) setShowJustification(true);
      setError(errMsg);
    }
  }

  if (!mounted || !user) return <main className="page-shell"><div style={{textAlign:"center",padding:40}}><div className="skeleton" style={{width:"100%",height:300,borderRadius:24}} /></div></main>;

  return (
    <main className="page-shell">
      <nav style={{display:"flex",justifyContent:"space-between",padding:"12px 0",marginBottom:16}}>
        <Link href={user.role === "admin" ? "/dashboard" : "/login"} style={{color:"#5ef2ff",textDecoration:"none"}}>← Volver</Link>
        <button onClick={()=>{localStorage.removeItem("neoassistence_user");router.push("/login")}} style={{background:"none",border:"none",color:"#9bb4ca",cursor:"pointer"}}>Cerrar sesión</button>
      </nav>

      <div className="glass" style={{padding:24,marginBottom:24}}>
        <p style={{color:"#5ef2ff",textTransform:"uppercase",letterSpacing:"0.18em"}}>Check-in</p>
        <h1 style={{margin:"8px 0"}}>Registro de asistencia</h1>
        <p style={{color:"#9bb4ca"}}>Bienvenido, <strong>{user.name}</strong></p>
      </div>

      <section style={{display:"flex",gap:12,marginBottom:16}}>
        <button onClick={()=>setQrMode(false)} style={{flex:1,padding:12,borderRadius:12,border:qrMode?"1px solid rgba(94,242,255,0.18)":"1px solid rgba(94,242,255,0.28)",background:qrMode?"rgba(10,21,38,0.8)":"linear-gradient(135deg, rgba(94,242,255,0.14), rgba(156,255,181,0.08))",color:"white"}}>📍 GPS</button>
        <button onClick={()=>setQrMode(true)} style={{flex:1,padding:12,borderRadius:12,border:!qrMode?"1px solid rgba(94,242,255,0.18)":"1px solid rgba(94,242,255,0.28)",background:!qrMode?"rgba(10,21,38,0.8)":"linear-gradient(135deg, rgba(94,242,255,0.14), rgba(156,255,181,0.08))",color:"white"}}>📷 QR</button>
        <button onClick={startSelfieCapture} disabled={selfieCaptured} style={{flex:1,padding:12,borderRadius:12,border:"1px solid rgba(94,242,255,0.18)",background:selfieCaptured?"#2a5a3a":"rgba(10,21,38,0.8)",color:"white",cursor:selfieCaptured?"default":"pointer"}}>{selfieCaptured?"✓ selfie":"📸 selfie"}</button>
      </section>

      <section className="glass" style={{maxWidth:720,padding:24}}>
        <div style={{marginBottom:16}}>
          <label style={{display:"block",marginBottom:8}}>Ubicación</label>
          {lat && lon ? <p style={{color:"#9cffb5",margin:0}}>📍 {lat.toFixed(6)}, {lon.toFixed(6)}</p> : locationLoading ? <p style={{color:"#9bb4ca",margin:0}}>Obteniendo ubicación...</p> : locationError ? <p style={{color:"#ff8c9e",margin:0}}>{locationError}</p> : null}
          {!qrMode && <button onClick={requestLocation} style={{marginTop:8,padding:"8px 12px",borderRadius:8,border:"1px solid rgba(94,242,255,0.18)",background:"rgba(10,21,38,0.8)",color:"#9bb4ca",cursor:"pointer"}}>Actualizar ubicación</button>}
        </div>

        {selfieMode && (
          <div style={{marginBottom:16,textAlign:"center",position:"relative",height:280}}>
            <video ref={selfieVideoRef} autoPlay playsInline muted style={{width:280,height:280,borderRadius:"50%",border:"3px solid #5ef2ff",objectFit:"cover"}} />
            {countdown > 0 && (
              <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:64,fontWeight:"bold",color:"#5ef2ff",textShadow:"0 0 20px #5ef2ff"}}>{countdown}</div>
            )}
          </div>
        )}

        {selfieImage && (
          <div style={{marginBottom:16,textAlign:"center"}}>
            <img src={selfieImage} alt="Selfie" style={{width:200,height:200,borderRadius:"50%",border:"3px solid #5ef2ff",objectFit:"cover",marginBottom:8}} />
            <button onClick={retakeSelfie} style={{padding:"8px 16px",borderRadius:8,border:"1px solid rgba(94,242,255,0.3)",background:"rgba(10,21,38,0.8)",color:"#5ef2ff",fontSize:12}}>📷 Repetir</button>
            <canvas ref={canvasRef} style={{display:"none"}} />
          </div>
        )}

        {qrMode && <div style={{marginBottom:16,textAlign:"center"}}><video ref={videoRef} autoPlay playsInline style={{width:"100%",maxWidth:300,borderRadius:12,background:"#000"}} /><p style={{color:"#9bb4ca",marginTop:8}}>Apunta al QR</p></div>}

        {showJustification && <div style={{marginBottom:16,padding:16,borderRadius:12,background:"rgba(255,140,158,0.1)",border:"1px solid rgba(255,140,158,0.3)"}}><label style={{display:"block",marginBottom:8,color:"#ff8c9e",fontWeight:"bold"}}>⚠️ Justificación requerida</label><textarea value={justification} onChange={e=>setJustification(e.target.value)} placeholder="Explica el motivo..." style={{width:"100%",padding:14,borderRadius:12,border:"1px solid rgba(255,140,158,0.3)",background:"rgba(10,21,38,0.8)",color:"white",minHeight:80,marginBottom:12}} /><button onClick={()=>handleCheckIn(pendingType||"Entrada")} disabled={!justification.trim()} style={{width:"100%",padding:14,borderRadius:12,border:"1px solid rgba(255,140,158,0.3)",background:"#ff8c9e",color:"white",cursor:justification.trim()?"pointer":"not-allowed",fontWeight:"bold"}}>✓ Guardar</button></div>}

        <div style={{display:"flex",gap:16}}>
          <button onClick={()=>{setPendingType("Entrada");handleCheckIn("Entrada")}} disabled={!lat||!lon} style={{flex:1,padding:18,borderRadius:18,border:"1px solid rgba(94,242,255,0.28)",background:"linear-gradient(135deg, rgba(94,242,255,0.14), rgba(156,255,181,0.08))",color:"white",cursor:lat&&lon?"pointer":"not-allowed",opacity:lat&&lon?1:0.5}}>📥 Entrada</button>
          <button onClick={()=>{setPendingType("Salida");handleCheckIn("Salida")}} disabled={!lat||!lon} style={{flex:1,padding:18,borderRadius:18,border:"1px solid rgba(94,242,255,0.18)",background:"rgba(10,21,38,0.8)",color:"white",cursor:lat&&lon?"pointer":"not-allowed",opacity:lat&&lon?1:0.5}}>📤 Salida</button>
        </div>
        {message ? <p style={{color:"#9cffb5",marginTop:16}}>{message}</p> : null}
        {error ? <p style={{color:"#ff8c9e",marginTop:16}}>{error}</p> : null}
      </section>
    </main>
  );
}