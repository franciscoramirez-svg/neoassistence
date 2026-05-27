"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { useToast } from "../../ToastProvider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://192.168.1.85:8000/api";

type Employee = {
  id: string;
  nombre: string;
  pin: string;
  activo: boolean;
  rol: string;
  sucursal_id: string;
  hora_entrada: string;
  hora_salida: string;
  tolerancia_minutos?: number;
  sueldo_diario?: number;
  numero_empleado?: string;
  foto_url?: string;
  face_descriptor?: number[] | null;
};

function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("neoassistence_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default function EmpleadosAdminPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState(getStoredUser());
  const [mounted, setMounted] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ 
    nombre: "", 
    pin: "1234", 
    rol: "employee", 
    activo: true, 
    sucursal_id: "", 
    hora_entrada: "07:00", 
    hora_salida: "17:00",
    tolerancia_minutos: "15",
    sueldo_diario: "200.00",
    horas_extra: false,
    numero_empleado: ""
  });

  const [showQR, setShowQR] = useState<string | null>(null);
  const [faceEmp, setFaceEmp] = useState<string | null>(null);
  const [faceEmpName, setFaceEmpName] = useState("");
  const faceVideoRef = useRef<HTMLVideoElement>(null);
  const faceapiRef = useRef<any>(null);
  const [faceLoaded, setFaceLoaded] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [savingFace, setSavingFace] = useState(false);
  const [faceRegistered, setFaceRegistered] = useState(false);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const faceIntervalRef = useRef<any>(null);

  function generatePin() {
    const pin = String(1000 + Math.floor(Math.random() * 9000));
    setFormData({ ...formData, pin });
  }

  async function regenerateAllPins() {
    if (!confirm("¿Generar nuevo PIN para todos los empleados que tengan '1234'?")) return;
    for (const emp of employees) {
      if (emp.pin === "1234" || !emp.pin) {
        const newPin = String(1000 + Math.floor(Math.random() * 9000));
        try {
          await apiRequest(`/employees/${emp.id}`, {
            method: "PUT",
            body: JSON.stringify({ pin: newPin }),
          });
        } catch {}
      }
    }
    loadEmployees();
    toast("PINs generados para empleados con 1234", "success");
  }
  
  // Fix for checkbox - ensure boolean
  const horasExtraChecked = !!formData.horas_extra;

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && !user) router.push("/login"); }, [mounted, user, router]);

  useEffect(() => {
    if (!user || user.role !== "admin") { router.push("/dashboard"); return; }
    loadEmployees();
  }, [user]);

  async function loadEmployees() {
    setLoading(true);
    try {
      const res = await apiRequest<any[]>("/employees");
      setEmployees(res || []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    if (!faceEmp) return;
    loadFaceModels();
    return () => closeFaceCamera();
  }, [faceEmp]);

  async function loadFaceModels() {
    try {
      const faceapi = await import("face-api.js");
      faceapiRef.current = faceapi;
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ]);
      console.log("Face models loaded");
      setFaceLoaded(true);
      // Wait a bit before starting camera to ensure DOM is ready
      setTimeout(startFaceCamera, 500);
    } catch (e) {
      console.error("Error loading face models:", e);
      toast("Error al cargar modelos faciales", "error");
    }
  }

  async function startFaceCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (faceVideoRef.current) {
        faceVideoRef.current.srcObject = stream;
        faceVideoRef.current.onloadeddata = () => {
          console.log("Video ready, starting detection");
          setTimeout(detectFaceLoop, 500);
        };
      }
    } catch (e) {
      console.error("Error camera:", e);
      toast("Error al acceder a la cámara", "error");
    }
  }

  async function detectFaceLoop() {
    if (!faceVideoRef.current || !faceEmp || !faceapiRef.current) return;
    const faceapi = faceapiRef.current;
    try {
      const detection = await faceapi.detectSingleFace(faceVideoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }));
      setFaceDetected(!!detection);
    } catch {}
    faceIntervalRef.current = setTimeout(detectFaceLoop, 800);
  }

  async function registerFace() {
    if (!faceVideoRef.current || !faceEmp || !faceapiRef.current) return;
    const faceapi = faceapiRef.current;
    setSavingFace(true);
    try {
      const result = await faceapi
        .detectSingleFace(faceVideoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (!result) { toast("No se detectó rostro. Acércate más a la cámara.", "error"); setSavingFace(false); return; }
      const descriptor = Array.from(result.descriptor as Float32Array);
      console.log("Face descriptor length:", descriptor.length);
      await apiRequest(`/employees/${faceEmp}/face`, {
        method: "PUT",
        body: JSON.stringify({ face_descriptor: descriptor }),
      });
      setFaceRegistered(true);
      loadEmployees();
    } catch (e) {
      console.error("Error registering face:", e);
      toast("Error al registrar rostro", "error");
    }
    setSavingFace(false);
  }

  function closeFaceCamera() {
    if (faceIntervalRef.current) { clearTimeout(faceIntervalRef.current); faceIntervalRef.current = null; }
    if (faceVideoRef.current?.srcObject) {
      const stream = faceVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
    }
  }

  async function uploadPhoto() {
    const file = photoInputRef.current?.files?.[0];
    if (!file || !selectedEmp?.id) return;
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_URL}/employees/${selectedEmp.id}/photo`, { method: "POST", body: form });
      const data = await res.json();
      if (data.ok) {
        loadEmployees();
        setUploadingPhoto(false);
        toast("Foto subida correctamente", "success");
      } else {
        toast("Error al subir foto", "error");
        setUploadingPhoto(false);
      }
    } catch (e) {
      toast("Error de conexión al subir foto", "error");
      setUploadingPhoto(false);
    }
  }

  async function saveEmployee() {
    try {
      const payload = { ...formData, tolerancia_minutos: Number(formData.tolerancia_minutos) || 15, sueldo_diario: Number(formData.sueldo_diario) || 0 };
      if (selectedEmp?.id) {
        await apiRequest(`/employees/${selectedEmp.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/employees", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setEditMode(false);
      setSelectedEmp(null);
      loadEmployees();
      toast("Empleado guardado", "success");
    } catch (e) {
      toast("Error al guardar", "error");
    }
  }

  async function toggleActivo(emp: Employee) {
    try {
      await apiRequest(`/employees/${emp.id}`, {
        method: "PUT",
        body: JSON.stringify({ activo: !emp.activo }),
      });
      loadEmployees();
    } catch {}
  }

  function newEmployee() {
    setSelectedEmp(null);
    setFormData({ nombre: "", pin: "1234", rol: "employee", activo: true, sucursal_id: "", hora_entrada: "08:00", hora_salida: "18:00", tolerancia_minutos: "15", sueldo_diario: "200.00", horas_extra: false, numero_empleado: "" });
    setEditMode(true);
  }

  function editEmployee(emp: Employee) {
    setSelectedEmp(emp);
    setFormData({
      nombre: emp.nombre,
      pin: emp.pin || "1234",
      rol: emp.rol || "employee",
      activo: emp.activo,
      sucursal_id: emp.sucursal_id || "",
      hora_entrada: emp.hora_entrada || "08:00",
      hora_salida: emp.hora_salida || "18:00",
      tolerancia_minutos: String(emp.tolerancia_minutos ?? "15"),
      sueldo_diario: String(emp.sueldo_diario ?? "200.00"),
      horas_extra: false,
      numero_empleado: emp.numero_empleado || "",
    });
    setEditMode(true);
  }

  if (!mounted || !user) return <main className="page-shell"><div style={{textAlign:"center",padding:40}}><div className="skeleton" style={{width:"100%",height:300,borderRadius:24}} /></div></main>;

  return (
    <main className="page-shell">
      <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",marginBottom:8}}>
        <img src="/images/logo_modo_oscuro.fw.png" alt="NEOMOTIC" style={{height:32}} />
        <button onClick={() => { localStorage.removeItem("neoassistence_user"); router.push("/login"); }} style={{background:"none",border:"none",color:"#ff8c9e",cursor:"pointer"}}>Cerrar sesión</button>
      </nav>

      <Link href="/dashboard" style={{color:"#5ef2ff",textDecoration:"none",display:"block",marginBottom:16}}>← Volver al dashboard</Link>

        <div className="glass" style={{padding:24,marginBottom:24,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div>
            <h1 style={{margin:0,fontSize:28}}>👥 Gestión de Empleados</h1>
            <p style={{color:"#9bb4ca",marginTop:8}}>{employees.length} empleados registrados</p>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={regenerateAllPins} style={{padding:"8px 14px",borderRadius:10,border:"1px solid rgba(255,204,94,0.3)",background:"rgba(255,204,94,0.1)",color:"#ffcc5e",fontSize:12,cursor:"pointer"}}>🔑 Generar PINs</button>
            <button onClick={newEmployee} style={{padding:"10px 18px",borderRadius:12,border:"1px solid rgba(94,242,255,0.3)",background:"rgba(94,242,255,0.2)",color:"#5ef2ff",fontSize:14,cursor:"pointer"}}>+ Nuevo</button>
          </div>
        </div>

      {loading ? (
        <div className="glass" style={{padding:40,textAlign:"center"}}><div className="skeleton" style={{width:"100%",height:200,borderRadius:24}} /></div>
      ) : employees.length === 0 ? (
        <div className="glass" style={{padding:40,textAlign:"center"}}><p style={{color:"#9bb4ca"}}>No hay empleados</p></div>
      ) : (
        <div className="glass" style={{padding:24}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{borderBottom:"1px solid rgba(94,242,255,0.2)"}}>
                <th style={{textAlign:"left",padding:"12px 8px",color:"#9bb4ca"}}>Nombre</th>
                <th style={{textAlign:"left",padding:"12px 8px",color:"#9bb4ca"}}>No.</th>
                <th style={{textAlign:"left",padding:"12px 8px",color:"#9bb4ca"}}>Rol</th>
                <th style={{textAlign:"center",padding:"12px 8px",color:"#9bb4ca"}}>PIN</th>
                <th style={{textAlign:"center",padding:"12px 8px",color:"#9bb4ca"}}>Horario</th>
                <th style={{textAlign:"center",padding:"12px 8px",color:"#9bb4ca"}}>Tol.</th>
                <th style={{textAlign:"center",padding:"12px 8px",color:"#9bb4ca"}}>Estado</th>
                <th style={{textAlign:"center",padding:"12px 8px",color:"#9bb4ca"}}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id} style={{borderBottom:"1px solid rgba(94,242,255,0.1)"}}>
                  <td style={{padding:"12px 8px",color:"white"}}>{emp.nombre}</td>
                  <td style={{padding:"12px 8px",color:"#9bb4ca",fontFamily:"monospace",fontSize:13}}>{emp.numero_empleado || "—"}</td>
                  <td style={{padding:"12px 8px",color:"#9bb4ca"}}>{emp.rol || "employee"}</td>
                  <td style={{padding:"12px 8px",textAlign:"center",color:"#ffcc5e",fontFamily:"monospace",fontSize:13,fontWeight:"bold"}}>{emp.pin || "—"}</td>
                  <td style={{padding:"12px 8px",textAlign:"center",color:"#5ef2ff",fontSize:12}}>{(emp.hora_entrada||"??").slice(0,5)}-{(emp.hora_salida||"??").slice(0,5)}</td>
                  <td style={{padding:"12px 8px",textAlign:"center",color:"#9bb4ca",fontSize:12}}>{emp.tolerancia_minutos ?? 15}min</td>
                  <td style={{padding:"12px 8px",textAlign:"center"}}>
                    <span style={{color: emp.activo ? "#9cffb5" : "#ff8c9e"}}>{emp.activo ? "Activo" : "Inactivo"}</span>
                  </td>
                  <td style={{padding:"12px 8px",textAlign:"center",display:"flex",gap:8,justifyContent:"center"}}>
                    <button onClick={() => setShowQR(emp.id + "|" + emp.nombre)} style={{padding:"6px 12px",borderRadius:6,border:"1px solid rgba(94,242,255,0.2)",background:"transparent",color:"#5ef2ff",fontSize:12}}>QR</button>
                    <button onClick={() => { setFaceEmp(emp.id); setFaceEmpName(emp.nombre); setFaceRegistered(false); setFaceDetected(false); }} style={{padding:"6px 12px",borderRadius:6,border:"1px solid " + (emp.face_descriptor ? "rgba(156,255,181,0.4)" : "rgba(255,140,158,0.3)"),background: emp.face_descriptor ? "rgba(156,255,181,0.1)" : "transparent",color: emp.face_descriptor ? "#9cffb5" : "#ff8c9e",fontSize:12}}>{emp.face_descriptor ? "✓ Rostro" : "✗ Rostro"}</button>
                    <button onClick={() => editEmployee(emp)} style={{padding:"6px 12px",borderRadius:6,border:"1px solid rgba(94,242,255,0.2)",background:"transparent",color:"#5ef2ff",fontSize:12}}>Editar</button>
                    <button onClick={() => toggleActivo(emp)} style={{padding:"6px 12px",borderRadius:6,border:"1px solid " + (emp.activo ? "rgba(255,140,158,0.3)" : "rgba(156,255,181,0.3)"),background:"transparent",color: emp.activo ? "#ff8c9e" : "#9cffb5",fontSize:12}}>
                      {emp.activo ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

{editMode && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,overflow:"auto"}}>
          <div className="glass" style={{maxWidth:340,width:"85%",padding:16,borderRadius:12,margin:20}}>
            <h2 style={{color:"#5ef2ff",marginTop:0,fontSize:16}}>{selectedEmp ? "Editar" : "Nuevo"} Empleado</h2>
            
            <div style={{marginBottom:10}}>
              <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Nombre</label>
              <input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} style={{width:"100%",padding:10,borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:14}} />
            </div>

            <div style={{marginBottom:10}}>
              <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>No. Empleado</label>
              <input value={formData.numero_empleado} onChange={e => setFormData({...formData, numero_empleado: e.target.value})} style={{width:"100%",padding:10,borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:14}} />
            </div>

            <div style={{marginBottom:10}}>
              <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>PIN</label>
              <div style={{display:"flex",gap:8}}>
                <input value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} style={{flex:1,padding:10,borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:14,fontFamily:"monospace"}} />
                <button type="button" onClick={generatePin} style={{padding:"6px 12px",borderRadius:8,border:"1px solid rgba(255,204,94,0.3)",background:"rgba(255,204,94,0.1)",color:"#ffcc5e",fontSize:12,whiteSpace:"nowrap",cursor:"pointer"}}>Generar</button>
              </div>
            </div>

            <div style={{marginBottom:10}}>
              <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Rol / Puesto</label>
              <input value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value})} placeholder="Ej: Tecnico Electronico, Andamiero, Supervisor..." style={{width:"100%",padding:10,borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:14}} />
            </div>

            <div style={{marginBottom:10}}>
              <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Horario</label>
            {selectedEmp && (
              <div style={{marginBottom:10}}>
                <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>Foto</label>
                <input ref={photoInputRef} type="file" accept="image/jpeg,image/png" style={{color:"white",fontSize:13,marginBottom:6}} />
                <button onClick={uploadPhoto} disabled={uploadingPhoto} style={{padding:"6px 12px",borderRadius:6,border:"1px solid rgba(94,242,255,0.2)",background:"transparent",color:"#5ef2ff",fontSize:12}}>
                  {uploadingPhoto ? "Subiendo..." : "Subir Foto"}
                </button>
                {selectedEmp.foto_url && <span style={{color:"#9cffb5",fontSize:12,marginLeft:8}}>✓ tiene foto</span>}
              </div>
            )}

            <div style={{display:"flex",gap:8}}>
                <div style={{flex:1}}>
                  <span style={{color:"#9bb4ca",fontSize:11}}>Entrada</span>
                  <input type="time" value={formData.hora_entrada} onChange={e => setFormData({...formData, hora_entrada: e.target.value})} style={{width:"100%",padding:8,borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13}} />
                </div>
                <div style={{flex:1}}>
                  <span style={{color:"#9bb4ca",fontSize:11}}>Salida</span>
                  <input type="time" value={formData.hora_salida} onChange={e => setFormData({...formData, hora_salida: e.target.value})} style={{width:"100%",padding:8,borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13}} />
                </div>
                <div style={{flex:1}}>
                  <span style={{color:"#9bb4ca",fontSize:11}}>Tol. (min)</span>
                  <input type="number" value={formData.tolerancia_minutos} onChange={e => setFormData({...formData, tolerancia_minutos: e.target.value})} style={{width:"100%",padding:8,borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13}} min="0" max="120" />
                </div>
                <div style={{flex:1}}>
                  <span style={{color:"#9bb4ca",fontSize:11}}>$ Diario</span>
                  <input type="number" value={formData.sueldo_diario} onChange={e => setFormData({...formData, sueldo_diario: e.target.value})} style={{width:"100%",padding:8,borderRadius:8,border:"1px solid rgba(94,242,255,0.2)",background:"rgba(10,21,38,0.8)",color:"white",fontSize:13}} min="0" step="10" />
                </div>
              </div>
            </div>

            <div style={{marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
              <input type="checkbox" id="horas_extra" checked={horasExtraChecked} onChange={e => setFormData({...formData, horas_extra: e.target.checked})} style={{width:16,height:16}} />
              <label htmlFor="horas_extra" style={{color:"#9bb4ca",cursor:"pointer",fontSize:13}}>Permitir horas extra</label>
            </div>

            <div style={{marginBottom:10}}>
              <label style={{display:"block",marginBottom:4,color:"#9bb4ca",fontSize:12}}>QR del empleado</label>
              <div style={{padding:10,borderRadius:8,background:"white",textAlign:"center"}}>
                <img src={`https://quickchart.io/qr?size=120&text=${encodeURIComponent(formData.nombre || 'NOMBRE')}`} alt="QR" />
                <p style={{color:"#333",marginTop:6,fontSize:11}}>{formData.nombre || 'Sin nombre'}</p>
              </div>
            </div>

            <div style={{display:"flex",gap:8}}>
              <button onClick={saveEmployee} style={{flex:1,padding:10,borderRadius:8,border:"1px solid rgba(94,242,255,0.3)",background:"rgba(94,242,255,0.2)",color:"white",fontWeight:"bold",fontSize:13}}>Guardar</button>
              <button onClick={() => { setEditMode(false); setSelectedEmp(null); }} style={{flex:1,padding:10,borderRadius:8,border:"1px solid rgba(255,140,158,0.3)",background:"transparent",color:"#ff8c9e",fontSize:13}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showQR && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div className="glass" style={{padding:20,borderRadius:12,textAlign:"center"}}>
            <h2 style={{color:"#5ef2ff",marginTop:0,fontSize:16}}>Código QR</h2>
            <div style={{padding:12,borderRadius:8,background:"white",margin:"8px 0"}}>
              <img src={`https://quickchart.io/qr?size=150&text=${encodeURIComponent(showQR.split('|')[1] || 'NOMBRE')}`} alt="QR" />
            </div>
            <p style={{color:"white",fontSize:14,marginBottom:12}}>{showQR.split('|')[1]}</p>
            <button onClick={() => setShowQR(null)} style={{padding:"8px 16px",borderRadius:8,border:"1px solid rgba(94,242,255,0.3)",background:"rgba(94,242,255,0.2)",color:"white",fontSize:13}}>Cerrar</button>
          </div>
        </div>
      )}

      {faceEmp && !faceRegistered && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div className="glass" style={{maxWidth:320,width:"85%",padding:16,borderRadius:12}}>
            <h2 style={{color:"#5ef2ff",marginTop:0,fontSize:16}}>Registrar Rostro</h2>
            <p style={{color:"#9cffb5",fontSize:14,marginBottom:10}}>{faceEmpName}</p>
            <div style={{borderRadius:8,overflow:"hidden",background:"#000",marginBottom:10,height:240,display:"flex",alignItems:"center",justifyContent:"center",border: faceDetected ? "2px solid rgba(156,255,181,0.6)" : "2px solid transparent",boxShadow: faceDetected ? "0 0 12px rgba(156,255,181,0.3)" : "none",transition:"all 0.3s"}}>
              <video ref={faceVideoRef} autoPlay playsInline muted style={{width:"100%",height:"100%",objectFit:"cover"}} />
              {!faceLoaded && <p style={{color:"#9bb4ca",position:"absolute",fontSize:13}}>Cargando modelos...</p>}
            </div>
            <p style={{color:faceDetected?"#9cffb5":"#9bb4ca",fontSize:13,textAlign:"center",marginBottom:12}}>
              {faceDetected ? "✓ Rostro detectado" : "Coloca tu rostro frente a la cámara"}
            </p>
            <div style={{display:"flex",gap:8}}>
              <button onClick={registerFace} disabled={!faceDetected || savingFace} style={{flex:1,padding:10,borderRadius:8,border:"1px solid rgba(156,255,181,0.3)",background:faceDetected?"rgba(156,255,181,0.2)":"#1a2a3a",color:"white",fontWeight:"bold",fontSize:13,opacity:faceDetected?1:0.5}}>
                {savingFace ? "Guardando..." : "Registrar Rostro"}
              </button>
              <button onClick={() => { closeFaceCamera(); setFaceEmp(null); }} style={{flex:1,padding:10,borderRadius:8,border:"1px solid rgba(255,140,158,0.3)",background:"transparent",color:"#ff8c9e",fontSize:13}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {faceEmp && faceRegistered && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div className="glass" style={{padding:24,borderRadius:12,textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:8}}>✓</div>
            <h2 style={{color:"#9cffb5",margin:0,fontSize:16}}>Rostro registrado</h2>
            <p style={{color:"#9bb4ca",marginTop:6,fontSize:13}}>El rostro se ha guardado correctamente</p>
            <button onClick={() => { closeFaceCamera(); setFaceEmp(null); setFaceRegistered(false); }} style={{marginTop:12,padding:"8px 16px",borderRadius:8,border:"1px solid rgba(94,242,255,0.3)",background:"rgba(94,242,255,0.2)",color:"white",fontSize:13}}>Cerrar</button>
          </div>
        </div>
      )}
    </main>
  );
}