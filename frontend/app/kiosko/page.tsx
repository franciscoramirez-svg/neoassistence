"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { useToast } from "../ToastProvider";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("neoassistence_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function NeonClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fecha = time.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
  const hora = time.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div style={{textAlign:"center",marginBottom:12}}>
      <p style={{color:"#d08aff",fontSize:13,textTransform:"uppercase",letterSpacing:"0.1em",margin:0}}>{fecha}</p>
      <p style={{color:"#d08aff",fontSize:28,fontWeight:"bold",textShadow:"0 0 10px #d08aff",margin:0}}>{hora}</p>
    </div>
  );
}

function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  return Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));
}

function playBeep(freq: number = 660, duration: number = 150) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
  } catch {}
}

export default function KioskPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState(getStoredUser());
  const [mounted, setMounted] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualPin, setManualPin] = useState("");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [descriptors, setDescriptors] = useState<{id: string; name: string; pin: string; descriptor: number[]}[]>([]);
  const [faceVerifying, setFaceVerifying] = useState(false);
  const [faceStatus, setFaceStatus] = useState("");
  const [showFaceReg, setShowFaceReg] = useState(false);
  const [faceRegDetected, setFaceRegDetected] = useState(false);
  const [faceRegSaving, setFaceRegSaving] = useState(false);
  const [identifiedUser, setIdentifiedUser] = useState<any>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceapiRef = useRef<any>(null);
  const flowInProgress = useRef(false);
  const regDetectRef = useRef<any>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && !user) router.push("/login"); }, [mounted, user, router]);
  useEffect(() => {
    setSuccess(false);
    setMessage("");
    setIdentifiedUser(null);
    setShowFaceReg(false);
    setManualMode(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!locationReady) {
      navigator.geolocation.getCurrentPosition(
        (p) => { setLat(p.coords.latitude); setLon(p.coords.longitude); setLocationReady(true); },
        () => { setLat(19.432608); setLon(-99.133209); setLocationReady(true); },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [user, locationReady]);

  // Load face-api models and descriptors on mount
  useEffect(() => {
    if (!mounted || success) return;
    loadModels();
    loadFaceDescriptors();
  }, [mounted, success]);

  async function loadModels() {
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
      const faces = await apiRequest<{id: string; nombre: string; pin: string; face_descriptor: number[]}[]>("/employees/faces");
      setDescriptors(faces.map(f => ({
        id: f.id, name: f.nombre, pin: f.pin, descriptor: f.face_descriptor,
      })));
    } catch {}
  }

  function verifyFaceThenCheckIn(type: "Entrada" | "Salida") {
    if (flowInProgress.current) return;
    flowInProgress.current = true;
    setFaceVerifying(true);
    setFaceStatus("Iniciando cámara...");

    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        if (videoRef.current) videoRef.current.srcObject = stream;
        await new Promise(r => setTimeout(r, 500));

        if (!faceapiRef.current || !canvasRef.current || !videoRef.current) throw new Error("refs");
        const faceapi = faceapiRef.current;
        const canvas = canvasRef.current;
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no ctx");
        ctx.drawImage(videoRef.current, 0, 0);

        setFaceStatus("Detectando rostro...");
        const result = await Promise.race([
          faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.3 }))
            .withFaceLandmarks()
            .withFaceDescriptor(),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000)),
        ]);

        if (!result) {
          setFaceStatus("No se detectó rostro. Reintenta.");
          return;
        }

        const desc = Array.from(result.descriptor as Float32Array);
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
          playBeep(880, 200);
          setFaceStatus("✓ " + bestMatch.name);
          await doCheckIn(bestMatch.name, type);
          return;
        }

        setFaceStatus("Rostro no reconocido. Reintenta.");
      } catch {
        setFaceStatus("Error al verificar. Reintenta.");
      } finally {
        if (stream) stream.getTracks().forEach(t => t.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
        setFaceVerifying(false);
        flowInProgress.current = false;
      }
    })();
  }

  async function doCheckIn(name: string, type: "Entrada" | "Salida") {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      osc.connect(audioCtx.destination);
      osc.frequency.value = type === "Entrada" ? 880 : 440;
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {}

    try {
      await apiRequest<{message: string}>("/records", {
        method: "POST",
        body: JSON.stringify({
          employee_name: name,
          movement_type: type,
          lat, lon,
          justification: null,
          source: "kiosko",
        }),
      });
      setMessage(type === "Entrada" ? "Entrada registrada" : "Salida registrada");
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setMessage("");
        setFaceStatus("");
        flowInProgress.current = false;
      }, 3500);
    } catch (e: any) {
      toast("Error: " + (e?.message || "Error al registrar"), "error");
    }
  }

  async function handleManualSubmit() {
    if (!manualName.trim() || !manualPin.trim()) return;
    setManualMode(false);
    setManualName("");
    setManualPin("");

    // Check if employee has registered face
    const hasFace = descriptors.some(e => e.name === manualName.trim());
    if (hasFace) {
      toast("Ya tienes rostro registrado. Usa reconocimiento facial.", "error");
      return;
    }

    // Authenticate and proceed to face registration
    let stream: MediaStream | null = null;
    try {
      const res = await apiRequest<{user: any}>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ name: manualName.trim(), pin: manualPin.trim() }),
      });
      setIdentifiedUser(res.user);
      setShowFaceReg(true);

      // Start camera for face registration
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      if (videoRef.current) videoRef.current.srcObject = stream;
      startFaceRegDetection();
    } catch (e: any) {
      toast("Error: " + (e?.message || "Error al autenticar"), "error");
    }
  }

  function startFaceRegDetection() {
    if (!videoRef.current || !faceapiRef.current) return;
    const faceapi = faceapiRef.current;
    regDetectRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;
      try {
        const result = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 160 }))
          .withFaceLandmarks()
          .withFaceDescriptor();
        setFaceRegDetected(!!result);
      } catch {}
    }, 1000);
  }

  async function registerOwnFace() {
    if (!videoRef.current || !identifiedUser || !faceapiRef.current) return;
    const faceapi = faceapiRef.current;
    setFaceRegSaving(true);
    try {
      const result = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 160 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (!result) { toast("No se detectó rostro. Acércate más a la cámara.", "error"); setFaceRegSaving(false); return; }
      await apiRequest(`/employees/${identifiedUser.id}/face`, {
        method: "PUT",
        body: JSON.stringify({ face_descriptor: Array.from(result.descriptor as Float32Array) }),
      });
      playBeep(1047, 300);
      setShowFaceReg(false);
      setIdentifiedUser(null);
      clearInterval(regDetectRef.current);
      regDetectRef.current = null;
      if (videoRef.current?.srcObject) {
        const s = videoRef.current.srcObject as MediaStream;
        s.getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
      await loadFaceDescriptors();
      toast("Rostro registrado. Ya puedes usar reconocimiento facial.", "success");
    } catch {
      toast("Error al registrar rostro", "error");
    }
    setFaceRegSaving(false);
  }

  function handleLogout() {
    if (videoRef.current?.srcObject) {
      const s = videoRef.current.srcObject as MediaStream;
      s.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    localStorage.removeItem("neoassistence_user");
    router.push("/login");
  }

  if (!mounted || !user) {
    return (
      <main className="page-shell" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
        <div style={{textAlign:"center"}}><h1 style={{color:"#d08aff"}}>KIOSKO</h1><div className="skeleton" style={{width:200,height:60,borderRadius:16}} /></div>
      </main>
    );
  }

  if (success && message) {
    return (
    <main className="page-shell" style={{display:"flex",flexDirection:"column",alignItems:"center",minHeight:"100vh",padding:"12px 12px 24px"}}>
        <NeonClock />
        <div style={{textAlign:"center",padding:32}}>
          <div style={{fontSize:80,marginBottom:16}}>&#10003;</div>
          <h1 style={{color:"#9cffb5",fontSize:28,marginBottom:8}}>REGISTRADO</h1>
          <p style={{color:"white",fontSize:22}}>{message}</p>
        </div>
      </main>
    );
  }

  if (showFaceReg && identifiedUser) {
    return (
      <main className="page-shell" style={{display:"flex",flexDirection:"column",alignItems:"center",minHeight:"100dvh",padding:16}}>
        <NeonClock />
        <div style={{width:"100%",maxWidth:380}}>
          <h2 style={{color:"#5ef2ff",fontSize:16,marginBottom:6,textAlign:"center"}}>REGISTRAR TU ROSTRO</h2>
          <p style={{color:"#9cffb5",fontSize:14,textAlign:"center",marginBottom:10}}>{identifiedUser.name}</p>
          <div style={{borderRadius:12,overflow:"hidden",background:"#000",marginBottom:8,height:260,position:"relative"}}>
            <video ref={videoRef} autoPlay playsInline muted style={{width:"100%",height:"100%",objectFit:"cover"}} />
            <canvas ref={canvasRef} style={{position:"absolute",top:0,left:0,width:"100%",height:"100%"}} />
          </div>
          <p style={{color:faceRegDetected?"#9cffb5":"#9bb4ca",fontSize:13,textAlign:"center",marginBottom:10}}>
            {faceRegDetected ? "Rostro detectado" : "Colócate frente a la cámara..."}
          </p>
          <button onClick={registerOwnFace} disabled={!faceRegDetected || faceRegSaving} style={{width:"100%",padding:12,borderRadius:10,border:"1px solid rgba(156,255,181,0.4)",background:faceRegDetected?"rgba(156,255,181,0.2)":"#1a2a3a",color:"white",fontSize:14,fontWeight:"bold",opacity:faceRegDetected?1:0.5}}>
            {faceRegSaving ? "Guardando..." : "REGISTRAR ROSTRO"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell" style={{display:"flex",flexDirection:"column",alignItems:"center",minHeight:"100dvh",padding:"8px 8px 16px"}}>
      <NeonClock />
      <h1 style={{color:"#d08aff",fontSize:24,marginBottom:8,textShadow:"0 0 20px #d08aff",textAlign:"center"}}>NEOMOTIC</h1>
      <button onClick={handleLogout} style={{position:"fixed",top:8,right:8,padding:"6px 10px",borderRadius:8,border:"1px solid rgba(255,140,158,0.3)",background:"transparent",color:"#ff8c9e",fontSize:11,zIndex:50}}>Salir</button>
      {user?.role === "admin" && <button onClick={()=>router.push("/dashboard")} style={{position:"fixed",top:8,left:8,padding:"6px 10px",borderRadius:8,border:"1px solid rgba(94,242,255,0.3)",background:"transparent",color:"#5ef2ff",fontSize:11,zIndex:50}}>Dashboard</button>}
      {user?.role?.toLowerCase().includes("supervisor") && <button onClick={()=>router.push("/empleado")} style={{position:"fixed",top:8,left:8,padding:"6px 10px",borderRadius:8,border:"1px solid rgba(94,242,255,0.3)",background:"transparent",color:"#5ef2ff",fontSize:11,zIndex:50}}>Mi Perfil</button>}

      <div style={{width:"100%",maxWidth:380}}>
        {faceVerifying && (
          <>
            <div style={{borderRadius:"50%",overflow:"hidden",background:"#000",marginBottom:8,width:200,height:200,marginLeft:"auto",marginRight:"auto"}}>
              <video ref={videoRef} autoPlay playsInline muted style={{width:"100%",height:"100%",objectFit:"cover"}} />
            </div>
            <p style={{color:faceStatus?"#ffcc5e":"#5ef2ff",fontSize:13,textAlign:"center",marginBottom:8}}>
              {faceStatus || "Verificando..."}
            </p>
          </>
        )}

        <canvas ref={canvasRef} style={{display:"none"}} />

        {!modelsLoaded && <p style={{color:"#9bb4ca",fontSize:12,textAlign:"center",marginBottom:8}}>Cargando modelos de reconocimiento facial...</p>}

        <div style={{display:"flex",gap:10,marginBottom:12}}>
          <button onClick={()=>verifyFaceThenCheckIn("Entrada")} disabled={!locationReady||faceVerifying||!modelsLoaded} style={{flex:1,padding:"24px 12px",borderRadius:16,border:"2px solid rgba(94,242,255,0.4)",background:(locationReady&&!faceVerifying)?"linear-gradient(135deg, rgba(94,242,255,0.2), rgba(156,255,181,0.1))":"#1a2a3a",color:"white",fontSize:18,fontWeight:"bold",opacity:(locationReady&&!faceVerifying)?1:0.5}}>ENTRADA</button>
          <button onClick={()=>verifyFaceThenCheckIn("Salida")} disabled={!locationReady||faceVerifying||!modelsLoaded} style={{flex:1,padding:"24px 12px",borderRadius:16,border:"2px solid rgba(94,242,255,0.2)",background:(locationReady&&!faceVerifying)?"#0a1526":"#1a2a3a",color:"white",fontSize:18,fontWeight:"bold",opacity:(locationReady&&!faceVerifying)?1:0.5}}>SALIDA</button>
        </div>

        {(user?.role === "admin" || user?.role?.toLowerCase().includes("supervisor")) && (
          <button onClick={() => setManualMode(true)} style={{width:"100%",padding:"10px",borderRadius:10,border:"1px solid rgba(208,138,255,0.3)",background:"rgba(208,138,255,0.1)",color:"#d08aff",fontSize:13}}>
            Ingresar nombre manualmente
          </button>
        )}
      </div>

      {manualMode && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div style={{maxWidth:340,padding:20,borderRadius:16,background:"#0d1526",border:"1px solid rgba(94,242,255,0.2)"}}>
            <h2 style={{color:"#5ef2ff",marginTop:0,fontSize:15}}>Ingresa tus datos</h2>
            <input
              value={manualName}
              onChange={(e)=>setManualName(e.target.value)}
              placeholder="Nombre completo"
              autoFocus
              style={{width:"100%",padding:12,borderRadius:10,border:"1px solid rgba(94,242,255,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:14,marginBottom:10}}
            />
            <input
              value={manualPin}
              onChange={(e)=>setManualPin(e.target.value)}
              placeholder="PIN"
              type="password"
              style={{width:"100%",padding:12,borderRadius:10,border:"1px solid rgba(94,242,255,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:14,marginBottom:14}}
            />
            <div style={{display:"flex",gap:10}}>
              <button onClick={handleManualSubmit} style={{flex:1,padding:12,borderRadius:10,border:"1px solid rgba(94,242,255,0.3)",background:"rgba(94,242,255,0.2)",color:"white",fontSize:14}}>Aceptar</button>
              <button onClick={()=>{setManualMode(false);setManualPin("");}} style={{flex:1,padding:12,borderRadius:10,border:"1px solid rgba(255,140,158,0.3)",background:"transparent",color:"#ff8c9e",fontSize:14}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
