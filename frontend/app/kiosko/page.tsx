"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { useToast } from "../ToastProvider";

function playBeep(freq: number = 800, duration: number = 100, type: OscillatorType = "sine") {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const master = ctx.createGain();
    master.connect(ctx.destination);
    master.gain.value = 0.12;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(g);
    g.connect(master);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(1, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration / 1000);
    osc.start(now);
    osc.stop(now + duration / 1000 + 0.05);
  } catch {}
}

function playHikDetected() {
  playBeep(1200, 60);
  setTimeout(() => playBeep(1400, 60), 80);
}

function playHikMatched() {
  playBeep(900, 120);
  setTimeout(() => playBeep(1100, 100), 130);
}

function playHikDenied() {
  playBeep(300, 300, "sawtooth");
}

function playHikChime(type: "Entrada" | "Salida") {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const master = ctx.createGain();
    master.connect(ctx.destination);
    master.gain.value = 0.12;
    const now = ctx.currentTime;
    if (type === "Entrada") {
      [660, 880, 1100].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        osc.connect(g);
        g.connect(master);
        const t = now + i * 0.15;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(1, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
      });
    } else {
      [587, 523, 440].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        osc.connect(g);
        g.connect(master);
        const t = now + i * 0.15;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(1, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
      });
    }
  } catch {}
}

function playVoice(text: string) {
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-MX";
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    window.speechSynthesis.speak(utterance);
  } catch {}
}

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

export default function KioskPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState(getStoredUser());
  const [identifiedUser, setIdentifiedUser] = useState<any>(null);
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
  const [cameraReady, setCameraReady] = useState(false);
  const [faceStatus, setFaceStatus] = useState("");
  const [processing, setProcessing] = useState(false);
  const [showFaceReg, setShowFaceReg] = useState(false);
  const [faceRegDetected, setFaceRegDetected] = useState(false);
  const [faceRegSaving, setFaceRegSaving] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const [faceInFrame, setFaceInFrame] = useState(false);
  const [successName, setSuccessName] = useState("");
  const [livenessState, setLivenessState] = useState<"idle" | "watching">("idle");
  const [flashGreen, setFlashGreen] = useState(false);
  const [matchConfidence, setMatchConfidence] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceDescriptorsRef = useRef<{id: string; name: string; pin: string; descriptor: number[]}[]>([]);
  const detectionIntervalRef = useRef<any>(null);
  const faceapiRef = useRef<any>(null);
  const idleTimerRef = useRef<any>(null);
  const faceStillTimerRef = useRef<number>(0);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && !user) router.push("/login"); }, [mounted, user, router]);
  useEffect(() => {
    // Reset state on mount (fix for dev server state persistence)
    setSuccess(false);
    setMessage("");
    setIdentifiedUser(null);
    setProcessing(false);
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

  // Load face-api models on mount
  useEffect(() => {
    if (!mounted || identifiedUser || success) return;
    loadModels();
    return () => stopDetection();
  }, [mounted, identifiedUser, success]);

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
      console.log("Face models loaded");
      startCamera();
    } catch (e) {
      console.error("Error loading models:", e);
      setFaceStatus("Error al cargar modelos");
    }
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraReady(true);
        setFaceStatus("Iniciando detección...");
        setTimeout(loadDescriptors, 500);
      }
    } catch (e) {
      console.error("Error camera:", e);
      setFaceStatus("Cámara no disponible");
    }
  }

  async function loadDescriptors() {
    try {
      const faces = await apiRequest<{id: string; nombre: string; pin: string; face_descriptor: number[]}[]>("/employees/faces");
      faceDescriptorsRef.current = faces.map(f => ({
        id: f.id,
        name: f.nombre,
        pin: f.pin,
        descriptor: f.face_descriptor,
      }));
      console.log("Loaded", faceDescriptorsRef.current.length, "face descriptors");
      setFaceStatus(faceDescriptorsRef.current.length + " rostros registrados");
      startDetection();
    } catch (e) {
      console.error("Error loading descriptors:", e);
      setFaceStatus("Cargando empleados...");
      setTimeout(startDetection, 1000);
    }
  }

  function resetIdleTimer() {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true);
      stopDetection();
    }, 60000);
  }

  async function wakeFromIdle() {
    setIsIdle(false);
    setFaceStatus("Iniciando...");
    startCamera();
  }

  const landmarkHistoryRef = useRef<{x: number; y: number}[]>([]);
  const spoofWarnedRef = useRef(false);

  async function detectOnce() {
    if (!videoRef.current || (identifiedUser && !showFaceReg) || success || processing || !faceapiRef.current) return;
    const faceapi = faceapiRef.current;
    
    try {
      const result = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 160 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
      
      if (result) {
        setFaceInFrame(true);
        resetIdleTimer();
        if (showFaceReg) {
          setFaceRegDetected(true);
          scheduleDetect(300);
          return;
        }
        
        // --- Passive liveness: detect natural movement ---
        const nose = result.landmarks.getNose()[0];
        landmarkHistoryRef.current.push({ x: nose.x, y: nose.y });
        if (landmarkHistoryRef.current.length > 10) landmarkHistoryRef.current.shift();
        
        if (landmarkHistoryRef.current.length >= 10) {
          const xs = landmarkHistoryRef.current.map(p => p.x);
          const ys = landmarkHistoryRef.current.map(p => p.y);
          const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
          const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
          const varX = xs.reduce((a, b) => a + (b - meanX) ** 2, 0) / xs.length;
          const varY = ys.reduce((a, b) => a + (b - meanY) ** 2, 0) / ys.length;
          const movement = Math.sqrt(varX + varY);
          
          if (movement < 0.2 && !spoofWarnedRef.current) {
            spoofWarnedRef.current = true;
            setLivenessState("watching");
            setFaceStatus("Mueve ligeramente tu rostro");
            scheduleDetect(200);
            return;
          }
          spoofWarnedRef.current = false;
        }
        // --- End passive liveness ---
        
        const descriptor = Array.from(result.descriptor as Float32Array);
        let bestMatch: {name: string; distance: number} | null = null;
        let secondBest: {name: string; distance: number} | null = null;
        
        for (const emp of faceDescriptorsRef.current) {
          const dist = euclideanDistance(descriptor, emp.descriptor);
          if (!bestMatch || dist < bestMatch.distance) {
            secondBest = bestMatch;
            bestMatch = { name: emp.name, distance: dist };
          } else if (!secondBest || dist < secondBest.distance) {
            secondBest = { name: emp.name, distance: dist };
          }
        }
        
        if (bestMatch && bestMatch.distance < 0.45 && (!secondBest || bestMatch.distance / secondBest.distance < 0.8)) {
          console.log("Match:", bestMatch.name, bestMatch.distance);
          setMatchConfidence(Math.round((1 - bestMatch.distance) * 100));
          playVoice("Bienvenido " + bestMatch.name);
          setTimeout(() => authenticateUser(bestMatch.name, true), 600);
        } else {
          const conf = bestMatch ? Math.round((1 - bestMatch.distance) * 100) : 0;
          setMatchConfidence(bestMatch ? conf : null);
          setFaceStatus(bestMatch && bestMatch.distance < 0.7 ? `Rostro desconocido (${conf}%)` : "Buscando...");
          scheduleDetect(200);
          return;
        }
      } else {
        setFaceInFrame(false);
        landmarkHistoryRef.current = [];
        spoofWarnedRef.current = false;
        if (showFaceReg) setFaceRegDetected(false);
        setFaceStatus("Coloca tu rostro frente a la cámara");
        scheduleDetect(500);
        return;
      }
    } catch {}
    scheduleDetect(500);
  }
  
  function scheduleDetect(delay: number) {
    if (identifiedUser && !showFaceReg) return;
    detectionIntervalRef.current = setTimeout(detectOnce, delay);
  }
  
  function startDetection() {
    if (!videoRef.current || !canvasRef.current || !faceapiRef.current) return;
    setIsIdle(false);
    resetIdleTimer();
    scheduleDetect(300);
  }

  function stopDetection() {
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
    if (detectionIntervalRef.current) {
      clearTimeout(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
    }
  }

  function resetLiveness() {
    setLivenessState("idle");
    landmarkHistoryRef.current = [];
    spoofWarnedRef.current = false;
  }

  async function authenticateUser(name: string, fromFace: boolean = false, pin?: string) {
    if (identifiedUser || success || processing) return;
    setProcessing(true);
    
    // Don't stop the camera for manual entry registration
    if (fromFace) stopDetection();
    
    // For face match, look up PIN from stored descriptors; for manual, use provided PIN
    if (!pin) {
      const emp = faceDescriptorsRef.current.find(e => e.name === name);
      pin = emp?.pin || "1234";
    }
    
    try {
      const res = await apiRequest<{user: any}>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ name, pin }),
      });
      // If came from manual entry AND has face, block (must use face recognition)
      if (!fromFace) {
        const hasFace = faceDescriptorsRef.current.some(e => e.name === name);
        if (hasFace) {
          setProcessing(false);
          setFaceStatus("Ya tienes rostro registrado. Usa reconocimiento facial.");
          setTimeout(() => { setFaceStatus(""); startDetection(); }, 3000);
          return;
        }
        // Manual entry without face → show registration
        setIdentifiedUser(res.user);
        setShowFaceReg(true);
        return;
      }
      // Came from face match → proceed to check-in
      setIdentifiedUser(res.user);
      setProcessing(false);
    } catch (e: any) {
      console.error("Error registering face:", e);
      toast("Error al registrar: " + (e?.message || e), "error");
      setProcessing(false);
    }
    setFaceRegSaving(false);
  }

  async function registerOwnFace() {
    if (!videoRef.current || !identifiedUser || !faceapiRef.current) return;
    const faceapi = faceapiRef.current;
    setFaceRegSaving(true);
    try {
      const result = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (!result) { toast("No se detectó rostro. Acércate más a la cámara.", "error"); setFaceRegSaving(false); return; }
      await apiRequest(`/employees/${identifiedUser.id}/face`, {
        method: "PUT",
        body: JSON.stringify({ face_descriptor: Array.from(result.descriptor as Float32Array) }),
      });
      playHikMatched();
      setShowFaceReg(false);
      setIdentifiedUser(null);
      setProcessing(false);
      await loadDescriptors();
      setFaceStatus("Rostro registrado. Ya puedes usar reconocimiento facial.");
      setTimeout(() => setFaceStatus(""), 5000);
    } catch (e: any) {
      console.error("Error registering face:", e);
      toast("Error al registrar rostro", "error");
    }
    setFaceRegSaving(false);
  }

  async function handleManualSubmit() {
    if (!manualName.trim() || !manualPin.trim()) return;
    await authenticateUser(manualName.trim(), false, manualPin.trim());
    setManualMode(false);
    setManualName("");
    setManualPin("");
  }

  async function handleCheckIn(type: "Entrada" | "Salida") {
    if (!identifiedUser?.name || !lat || !lon) return;
    setMessage("Procesando...");
    setProcessing(true);

    try {
      await apiRequest<{message: string}>("/records", {
        method: "POST",
        body: JSON.stringify({
          employee_name: identifiedUser.name,
          movement_type: type,
          lat, lon,
          justification: null,
          source: "kiosko",
        }),
      });
      
      playHikChime(type);
      playVoice(type === "Entrada" ? "Entrada registrada" : "Salida registrada");
      
      setMessage(type === "Entrada" ? "Entrada registrada" : "Salida registrada");
      setSuccessName(identifiedUser.name);
      setSuccess(true);
      setFlashGreen(true);
      setTimeout(() => setFlashGreen(false), 600);
      
      setTimeout(() => {
        setIdentifiedUser(null);
        setSuccess(false);
        setProcessing(false);
        setMatchConfidence(null);
        resetLiveness();
        loadDescriptors();
      }, 3500);
    } catch (e: any) {
      console.log("Error registro:", e);
      toast("Error: " + (e?.message || "Error al registrar"), "error");
      setMessage("");
      setProcessing(false);
    }
  }

  function handleLogout() {
    stopDetection();
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
    <main className="page-shell" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100dvh",padding:"12px 12px 24px",position:"relative",overflow:"hidden"}}>
        {flashGreen && <div style={{position:"fixed",inset:0,background:"radial-gradient(circle at center, rgba(156,255,181,0.4), transparent 70%)",zIndex:200,pointerEvents:"none",animation:"flashFade 0.6s ease-out"}} />}
        <NeonClock />
        <div style={{textAlign:"center",padding:32,animation:"fadeInUp 0.6s ease-out"}}>
          <div style={{
            width:120,height:120,borderRadius:"50%",
            background:"radial-gradient(circle at 30% 30%, rgba(156,255,181,0.4), rgba(94,242,255,0.15))",
            display:"flex",alignItems:"center",justifyContent:"center",
            margin:"0 auto 24px",
            animation:"scaleBounce 0.5s ease-out 0.1s both",
            boxShadow:"0 0 60px rgba(156,255,181,0.3)",
          }}>
            <span style={{fontSize:60,color:"#9cffb5",filter:"drop-shadow(0 0 20px rgba(156,255,181,0.8))"}}>&#10003;</span>
          </div>
          <h1 style={{color:"#9cffb5",fontSize:28,marginBottom:4,textShadow:"0 0 30px rgba(156,255,181,0.5)"}}>{message.toUpperCase()}</h1>
          <p style={{color:"white",fontSize:18,marginBottom:4,opacity:0.9}}>{successName}</p>
          <img src="/images/logo_modo_oscuro.fw.png" alt="NEOMOTIC" style={{height:24,opacity:0.6,marginTop:8}} />
        </div>
        <style>{`
          @keyframes fadeInUp { from { opacity:0; transform:translateY(30px) } to { opacity:1; transform:translateY(0) } }
          @keyframes scaleBounce { 0% { transform:scale(0) } 60% { transform:scale(1.15) } 100% { transform:scale(1) } }
          @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
          @keyframes flashFade { 0% { opacity:1 } 100% { opacity:0 } }
        `}</style>
      </main>
    );
  }

  if (isIdle) {
    return (
      <main onClick={wakeFromIdle} style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100dvh",background:"#0a1526",cursor:"pointer",padding:16}}>
        <img src="/images/logo_modo_oscuro.fw.png" alt="NEOMOTIC" style={{height:48,marginBottom:16}} />
        <NeonClock />
        <p style={{color:"#9bb4ca",fontSize:16,marginTop:40,textAlign:"center"}}>Toca la pantalla para activar</p>
      </main>
    );
  }

  if (identifiedUser && !showFaceReg) {
    return (
      <main className="page-shell" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100dvh",padding:16}}>
        <style>{`@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}@keyframes progressShrink{0%{width:100%}100%{width:0%}}`}</style>
        <NeonClock />
        <div style={{width:"100%",maxWidth:360}}>
          <button onClick={()=>{setIdentifiedUser(null);setProcessing(false);setMatchConfidence(null);resetLiveness();loadDescriptors();}} style={{position:"fixed",top:12,right:12,padding:"8px 12px",borderRadius:8,border:"1px solid rgba(208,138,255,0.2)",background:"transparent",color:"#9bb4ca",fontSize:12}}>Cambiar</button>
          <h1 style={{color:"#5ef2ff",fontSize:18,marginBottom:6}}>REGISTRO</h1>
          <p style={{color:"#9cffb5",fontSize:20,marginBottom:8,fontWeight:"bold"}}>{identifiedUser.name}</p>
          <p style={{color:"#5ef2ff",fontSize:11,marginBottom:12}}>GPS: {locationReady ? "OK" : "..."}</p>
          {processing && (
            <div style={{width:"100%",height:4,background:"rgba(255,255,255,0.1)",borderRadius:2,marginBottom:12,overflow:"hidden"}}>
              <div style={{width:"100%",height:"100%",background:"linear-gradient(90deg, #5ef2ff, #9cffb5)",borderRadius:2,animation:"progressShrink 2.5s ease-in-out forwards"}} />
            </div>
          )}
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>handleCheckIn("Entrada")} disabled={!locationReady || processing} style={{flex:1,padding:"24px 12px",borderRadius:16,border:"2px solid rgba(94,242,255,0.4)",background:!locationReady||processing?"#1a2a3a":"linear-gradient(135deg, rgba(94,242,255,0.2), rgba(156,255,181,0.1))",color:"white",fontSize:18,fontWeight:"bold",opacity:locationReady&&!processing?1:0.5,position:"relative",overflow:"hidden"}}>
              {processing && <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg, transparent, rgba(94,242,255,0.2), transparent)",animation:"shimmer 1.5s infinite"}} />}
              {processing?"PROCESANDO...":"ENTRADA"}
            </button>
            <button onClick={()=>handleCheckIn("Salida")} disabled={!locationReady || processing} style={{flex:1,padding:"24px 12px",borderRadius:16,border:"2px solid rgba(94,242,255,0.2)",background:!locationReady||processing?"#1a2a3a":"#0a1526",color:"white",fontSize:18,fontWeight:"bold",opacity:locationReady&&!processing?1:0.5,position:"relative",overflow:"hidden"}}>
              {processing && <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg, transparent, rgba(94,242,255,0.15), transparent)",animation:"shimmer 1.5s infinite"}} />}
              {processing?"PROCESANDO...":"SALIDA"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell" style={{display:"flex",flexDirection:"column",alignItems:"center",minHeight:"100dvh",padding:"8px 8px 16px"}}>
      <img src="/images/logo_modo_oscuro.fw.png" alt="NEOMOTIC" style={{height:48,marginBottom:12}} />
      <NeonClock />
      <button onClick={handleLogout} style={{position:"fixed",top:8,right:8,padding:"6px 10px",borderRadius:8,border:"1px solid rgba(255,140,158,0.3)",background:"transparent",color:"#ff8c9e",fontSize:11,zIndex:50}}>Salir</button>
      {user?.role === "admin" && <button onClick={()=>router.push("/dashboard")} style={{position:"fixed",top:8,left:8,padding:"6px 10px",borderRadius:8,border:"1px solid rgba(94,242,255,0.3)",background:"transparent",color:"#5ef2ff",fontSize:11,zIndex:50}}>Dashboard</button>}
      {user?.role?.toLowerCase().includes("supervisor") && <button onClick={()=>router.push("/empleado")} style={{position:"fixed",top:8,left:8,padding:"6px 10px",borderRadius:8,border:"1px solid rgba(94,242,255,0.3)",background:"transparent",color:"#5ef2ff",fontSize:11,zIndex:50}}>Mi Perfil</button>}
      <div style={{width:"100%",maxWidth:380}}>
        <h2 style={{color:"#5ef2ff",fontSize:16,marginBottom:8,textAlign:"center"}}>RECONOCIMIENTO FACIAL</h2>
        
        <div style={{borderRadius:12,overflow:"hidden",background:"#000",marginBottom:8,height:260,position:"relative",border: faceInFrame ? "2px solid rgba(156,255,181,0.6)" : "2px solid transparent",boxShadow: faceInFrame ? "0 0 16px rgba(156,255,181,0.3)" : "none",transition:"all 0.3s"}}>
          <video ref={videoRef} autoPlay playsInline muted style={{width:"100%",height:"100%",objectFit:"cover"}} />
          <canvas ref={canvasRef} style={{position:"absolute",top:0,left:0,width:"100%",height:"100%"}} />
        </div>
        
        <p style={{color:"#9bb4ca",fontSize:13,textAlign:"center",marginBottom:4}}>
          {faceStatus ? (
            <>
              {faceStatus}
              {matchConfidence !== null && !identifiedUser && (
                <span style={{display:"inline-block",marginLeft:8,padding:"1px 8px",borderRadius:10,fontSize:10,
                  background:matchConfidence > 80 ? "rgba(156,255,181,0.2)" : matchConfidence > 50 ? "rgba(255,204,94,0.2)" : "rgba(255,140,158,0.2)",
                  color:matchConfidence > 80 ? "#9cffb5" : matchConfidence > 50 ? "#ffcc5e" : "#ff8c9e",
                  verticalAlign:"middle"
                }}>{matchConfidence}%</span>
              )}
            </>
          ) : (modelsLoaded ? <div className="skeleton" style={{width:160,height:20,borderRadius:8,display:"inline-block",verticalAlign:"middle"}} /> : "Iniciando modelos...")}
        </p>
        
        {livenessState === "watching" && (
          <p style={{color:"#ffcc5e",fontSize:11,textAlign:"center",marginBottom:8,animation:"pulse 1.5s infinite"}}>
            👁 Parpadea para confirmar que eres real
          </p>
        )}
        
        {(user?.role === "admin" || user?.role?.toLowerCase().includes("supervisor")) && (
          <button onClick={() => setManualMode(true)} style={{width:"100%",padding:"10px",borderRadius:10,border:"1px solid rgba(208,138,255,0.3)",background:"rgba(208,138,255,0.1)",color:"#d08aff",fontSize:13}}>
            Ingresar nombre manualmente
          </button>
        )}
      </div>

      {showFaceReg && identifiedUser && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div style={{width:"90%",maxWidth:380,padding:20,borderRadius:16,background:"rgba(13,21,38,0.85)",border:"1px solid rgba(94,242,255,0.2)",backdropFilter:"blur(4px)"}}>
            <h2 style={{color:"#5ef2ff",fontSize:16,marginTop:0,marginBottom:6}}>REGISTRAR TU ROSTRO</h2>
            <p style={{color:"#9cffb5",fontSize:14,marginBottom:6}}>{identifiedUser.name}</p>
            <p style={{color:faceRegDetected?"#9cffb5":"#9bb4ca",fontSize:13,textAlign:"center",marginBottom:10}}>
              {faceRegDetected ? "Rostro detectado" : "Colócate frente a la cámara..."}
            </p>
            <button onClick={registerOwnFace} disabled={!faceRegDetected || faceRegSaving} style={{width:"100%",padding:12,borderRadius:10,border:"1px solid rgba(156,255,181,0.4)",background:faceRegDetected?"rgba(156,255,181,0.2)":"#1a2a3a",color:"white",fontSize:14,fontWeight:"bold",opacity:faceRegDetected?1:0.5}}>
              {faceRegSaving ? "Guardando..." : "REGISTRAR ROSTRO"}
            </button>
          </div>
        </div>
      )}

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