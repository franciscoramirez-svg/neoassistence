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

function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  return Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));
}

export default function CheckInPage() {
  const router = useRouter();
  const [user, setUser] = useState(getStoredUser());
  const [mounted, setMounted] = useState(false);
  const [qrBranchId, setQrBranchId] = useState<string | null>(null);
  const [qrBranchName, setQrBranchName] = useState<string>("");
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [qrMode, setQrMode] = useState(false);
  const [qrScanning, setQrScanning] = useState(false);
  const [selfieMode, setSelfieMode] = useState(false);
  const [selfieCaptured, setSelfieCaptured] = useState(false);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [justification, setJustification] = useState("");
  const [showJustification, setShowJustification] = useState(false);
  const [pendingType, setPendingType] = useState<"Entrada" | "Salida" | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [descriptors, setDescriptors] = useState<{id: string; name: string; descriptor: number[]}[]>([]);
  const [faceVerifying, setFaceVerifying] = useState(false);
  const [faceVerified, setFaceVerified] = useState(false);
  const [faceStatus, setFaceStatus] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const selfieVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const faceapiRef = useRef<any>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && !user) router.push("/login"); }, [mounted, user, router]);

  useEffect(() => {
    if (!mounted || !user || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const branch = params.get("branch");
    if (branch) {
      setQrBranchId(branch);
      setQrMode(true);
      apiRequest<{data: any[]}>("/branches").then(r => {
        const b = (r.data || []).find((x: any) => x.id === branch);
        if (b) setQrBranchName(b.nombre);
      }).catch(() => {});
    }
  }, [mounted, user]);

  useEffect(() => { if (!user || lat) return; requestLocation(); }, [mounted, user, lat]);
  useEffect(() => { if (qrMode && !qrBranchId) startCamera(); else { stopCamera(); setQrScanning(false); } return () => stopCamera(); }, [qrMode, qrBranchId]);
  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(t);
    } else if (countdown === 0 && selfieMode && selfieVideoRef.current) {
      captureSelfiePhoto();
    }
  }, [countdown, selfieMode]);

  // Load face-api models and descriptors on mount
  useEffect(() => {
    if (!mounted || !user) return;
    loadFaceModels();
    loadFaceDescriptors();
  }, [mounted, user]);

  async function loadFaceModels() {
    try {
      const faceapi = await import("face-api.js");
      faceapiRef.current = faceapi;
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ]);
      setModelsLoaded(true);
    } catch {}
  }

  async function loadFaceDescriptors() {
    try {
      const faces = await apiRequest<{id: string; nombre: string; face_descriptor: number[]}[]>("/employees/faces");
      setDescriptors(faces.map(f => ({ id: f.id, name: f.nombre, descriptor: f.face_descriptor })));
    } catch {}
  }

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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setQrScanning(true);
          scanQR();
        };
      }
    } catch { setError("No se pudo acceder a la cámara"); }
  }

  function stopCamera() {
    cancelAnimationFrame(animFrameRef.current);
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  }

  async function scanQR() {
    const video = videoRef.current;
    const canvas = scanCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) { animFrameRef.current = requestAnimationFrame(scanQR); return; }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) { animFrameRef.current = requestAnimationFrame(scanQR); return; }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    try {
      const jsQR = (await import("jsqr")).default;
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
      if (code) {
        try {
          const url = new URL(code.data);
          const branch = url.searchParams.get("branch");
          if (branch) {
            setQrBranchId(branch);
            apiRequest<{data: any[]}>("/branches").then(r => {
              const b = (r.data || []).find((x: any) => x.id === branch);
              if (b) setQrBranchName(b.nombre);
            }).catch(() => {});
            setQrScanning(false);
            stopCamera();
            return;
          }
        } catch {}
      }
    } catch {}
    animFrameRef.current = requestAnimationFrame(scanQR);
  }

  async function startSelfieCapture(forFaceVerify: boolean = false) {
    setSelfieMode(true); setSelfieCaptured(false); setSelfieImage(null); setError("");
    if (forFaceVerify) setFaceVerifying(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      if (selfieVideoRef.current) selfieVideoRef.current.srcObject = stream;
      setCountdown(3);
    } catch { setError("Error al acceder a la cámara"); setFaceVerifying(false); }
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
      if (video.srcObject) { const tracks = (video.srcObject as MediaStream).getTracks(); tracks.forEach(t => t.stop()); }
    }
    setSelfieCaptured(true);
    setSelfieMode(false);

    // If face verification is active, run it on the captured photo
    if (faceVerifying) {
      await verifyFace();
    }
  }

  async function verifyFace() {
    if (!canvasRef.current || !faceapiRef.current || !user) return;
    const faceapi = faceapiRef.current;
    const canvas = canvasRef.current;
    // Check if the current user has a registered face
    if (!descriptors.some(d => d.name === user.name)) {
      setFaceStatus("No tienes rostro registrado. Pide al administrador que registre tu rostro.");
      setFaceVerifying(false);
      setFaceVerified(false);
      return;
    }
    setFaceStatus("Verificando rostro...");
    try {
      const result = await Promise.race([
        faceapi
          .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.3 }))
          .withFaceLandmarks()
          .withFaceDescriptor(),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000)),
      ]);
      if (!result) {
        setFaceStatus("No se detectó rostro. Repite.");
        setFaceVerifying(false);
        setFaceVerified(false);
        return;
      }
      const desc = Array.from(result.descriptor as Float32Array);
      // Find best match
      let bestMatch: {name: string; distance: number} | null = null;
      let secondBest: {name: string; distance: number} | null = null;
      for (const emp of descriptors) {
        const dist = euclideanDistance(desc, emp.descriptor);
        if (!bestMatch || dist < bestMatch.distance) {
          secondBest = bestMatch;
          bestMatch = { name: emp.name, distance: dist };
        } else if (!secondBest || dist < secondBest.distance) {
          secondBest = { name: emp.name, distance: dist };
        }
      }
      if (bestMatch && bestMatch.distance < 0.45 && (!secondBest || bestMatch.distance / secondBest.distance < 0.8)) {
        // Face matches someone — check it's the logged-in user
        if (bestMatch.name === user.name) {
          setFaceStatus("Rostro verificado ✓");
          setFaceVerified(true);
          setFaceVerifying(false);
          return;
        } else {
          setFaceStatus(`Rostro no coincide (${bestMatch.name}). Repite.`);
        }
      } else {
        setFaceStatus("Rostro no reconocido. Repite.");
      }
    } catch {
      setFaceStatus("Error al verificar (tiempo agotado). Repite o cierra e intenta de nuevo.");
    }
    setFaceVerifying(false);
    setFaceVerified(false);
  }

  function retakeSelfie() { setSelfieCaptured(false); setSelfieImage(null); setFaceVerified(false); setFaceVerifying(false); startSelfieCapture(); }

  function startCheckInFlow(type: "Entrada" | "Salida") {
    setError(""); setMessage("");
    if (!user?.name) { setError("Sesión no válida"); return; }
    if (!lat || !lon) { setError("Necesitas ubicación válida"); return; }
    setPendingType(type);

    // Stop QR camera before starting selfie to avoid camera conflicts
    stopCamera();

    // If the user has no registered face, skip verification entirely
    const userHasFace = descriptors.some(d => d.name === user?.name);
    if (!faceVerified && modelsLoaded && descriptors.length > 0 && userHasFace) {
      startSelfieCapture(true);
      return;
    }
    // If models not loaded, no descriptors, or user has no registered face, skip face check
    handleCheckIn(type);
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
          branch_id: qrBranchId || undefined,
          justification: justification || null,
          source: qrBranchId ? "qr" : (selfieCaptured ? "selfie" : "web"),
          selfie_image: selfieImage || null,
        }),
      });
      setMessage(res.message);
      setJustification("");
      setShowJustification(false);
      setSelfieCaptured(false);
      setSelfieImage(null);
      setFaceVerified(false);
      setFaceStatus("");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Error";
      if (errMsg.includes("justificación")) setShowJustification(true);
      setError(errMsg);
    }
  }

  if (!mounted || !user) return <main className="page-shell"><div className="skeleton" style={{width:"100%",height:300,borderRadius:24}} /></main>;

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
        {qrBranchName && <p style={{color:"#5ef2ff",marginTop:8}}>📍 Sucursal: {qrBranchName}</p>}
        {faceVerified && <p style={{color:"#9cffb5",marginTop:4,fontSize:12}}>✓ Rostro verificado</p>}
        {faceStatus && !faceVerified && <p style={{color:"#ffcc5e",marginTop:4,fontSize:12}}>{faceStatus}</p>}
      </div>

      <section style={{display:"flex",gap:12,marginBottom:16}}>
        <button onClick={()=>{setQrMode(false);setQrBranchId(null);setQrBranchName("")}} style={{flex:1,padding:12,borderRadius:12,border:qrMode?"1px solid rgba(94,242,255,0.18)":"1px solid rgba(94,242,255,0.28)",background:qrMode?"rgba(10,21,38,0.8)":"linear-gradient(135deg, rgba(94,242,255,0.14), rgba(156,255,181,0.08))",color:"white"}}>📍 GPS</button>
        <button onClick={()=>{setQrMode(true)}} style={{flex:1,padding:12,borderRadius:12,border:!qrMode?"1px solid rgba(94,242,255,0.18)":"1px solid rgba(94,242,255,0.28)",background:!qrMode?"rgba(10,21,38,0.8)":"linear-gradient(135deg, rgba(94,242,255,0.14), rgba(156,255,181,0.08))",color:"white"}}>📷 QR</button>
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
            {countdown > 0 && <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:64,fontWeight:"bold",color:"#5ef2ff",textShadow:"0 0 20px #5ef2ff"}}>{countdown}</div>}
            {faceVerifying && countdown === 0 && <p style={{color:"#5ef2ff",textAlign:"center",marginTop:4,fontSize:11}}>Verificando rostro...</p>}
          </div>
        )}

        {selfieCaptured && selfieImage && (
          <div style={{marginBottom:16,textAlign:"center"}}>
            <img src={selfieImage} alt="selfie" style={{width:200,height:200,borderRadius:"50%",border:`3px solid ${faceVerified?"#9cffb5":"#5ef2ff"}`,objectFit:"cover",marginBottom:8}} />
            {faceVerified ? (
              <p style={{color:"#9cffb5",fontSize:13,margin:0}}>✓ Rostro verificado</p>
            ) : (
              <div>
                <p style={{color:faceStatus?"#ffcc5e":"#9bb4ca",fontSize:12,marginBottom:8}}>{faceStatus || "Verificando..."}</p>
                <div style={{display:"flex",gap:8,justifyContent:"center"}}>
                  <button onClick={retakeSelfie} style={{padding:"8px 16px",borderRadius:8,border:"1px solid rgba(94,242,255,0.3)",background:"rgba(10,21,38,0.8)",color:"#5ef2ff",fontSize:12}}>📷 Repetir</button>
                  <button onClick={() => { setFaceVerifying(false); setFaceVerified(false); setSelfieCaptured(false); setSelfieImage(null); handleCheckIn(pendingType || "Entrada"); }} style={{padding:"8px 16px",borderRadius:8,border:"1px solid rgba(255,140,158,0.3)",background:"rgba(255,140,158,0.1)",color:"#ff8c9e",fontSize:12}}>Saltar verificación</button>
                </div>
              </div>
            )}
            <canvas ref={canvasRef} style={{display:"none"}} />
          </div>
        )}

        {qrMode && !qrBranchId && (
          <div style={{marginBottom:16,textAlign:"center"}}>
            <video ref={videoRef} autoPlay playsInline muted style={{width:"100%",maxWidth:300,borderRadius:12,background:"#000"}} />
            <canvas ref={scanCanvasRef} style={{display:"none"}} />
            <p style={{color:"#9bb4ca",marginTop:8}}>{qrScanning ? "Escaneando QR..." : "Iniciando cámara..."}</p>
          </div>
        )}

        {qrMode && qrBranchId && (
          <div style={{marginBottom:16,padding:16,borderRadius:12,background:"rgba(94,242,255,0.08)",border:"1px solid rgba(94,242,255,0.3)",textAlign:"center"}}>
            <p style={{color:"#5ef2ff",fontWeight:"bold",margin:"0 0 4px"}}>✅ QR detectado</p>
            <p style={{color:"#9bb4ca",margin:0}}>{qrBranchName || "Sucursal"}</p>
            <button onClick={()=>{setQrBranchId(null);setQrBranchName("");setQrMode(true)}} style={{marginTop:8,padding:"6px 12px",borderRadius:6,border:"1px solid rgba(94,242,255,0.2)",background:"transparent",color:"#9bb4ca",fontSize:11,cursor:"pointer"}}>Escanear otro</button>
          </div>
        )}

        {!modelsLoaded && <p style={{color:"#9bb4ca",fontSize:12,textAlign:"center",marginBottom:8}}>Cargando modelos de reconocimiento facial...</p>}

        {showJustification && (
          <div style={{marginBottom:16,padding:16,borderRadius:12,background:"rgba(255,140,158,0.1)",border:"1px solid rgba(255,140,158,0.3)"}}>
            <label style={{display:"block",marginBottom:8,color:"#ff8c9e",fontWeight:"bold"}}>⚠️ Justificación requerida</label>
            <textarea value={justification} onChange={e=>setJustification(e.target.value)} placeholder="Explica el motivo..." style={{width:"100%",padding:14,borderRadius:12,border:"1px solid rgba(255,140,158,0.3)",background:"rgba(10,21,38,0.8)",color:"white",minHeight:80,marginBottom:12}} />
            <button onClick={()=>handleCheckIn(pendingType||"Entrada")} disabled={!justification.trim()} style={{width:"100%",padding:14,borderRadius:12,border:"1px solid rgba(255,140,158,0.3)",background:"#ff8c9e",color:"white",cursor:justification.trim()?"pointer":"not-allowed",fontWeight:"bold"}}>✓ Guardar</button>
          </div>
        )}

        <div style={{display:"flex",gap:16}}>
          <button onClick={()=>startCheckInFlow("Entrada")} disabled={!lat||!lon} style={{flex:1,padding:18,borderRadius:18,border:"1px solid rgba(94,242,255,0.28)",background:"linear-gradient(135deg, rgba(94,242,255,0.14), rgba(156,255,181,0.08))",color:"white",cursor:lat&&lon?"pointer":"not-allowed",opacity:lat&&lon?1:0.5}}>📥 Entrada</button>
          <button onClick={()=>startCheckInFlow("Salida")} disabled={!lat||!lon} style={{flex:1,padding:18,borderRadius:18,border:"1px solid rgba(94,242,255,0.18)",background:"rgba(10,21,38,0.8)",color:"white",cursor:lat&&lon?"pointer":"not-allowed",opacity:lat&&lon?1:0.5}}>📤 Salida</button>
        </div>
        {message ? <p style={{color:"#9cffb5",marginTop:16}}>{message}</p> : null}
        {error && !showJustification ? <p style={{color:"#ff8c9e",marginTop:16}}>{error}</p> : null}
      </section>
    </main>
  );
}
