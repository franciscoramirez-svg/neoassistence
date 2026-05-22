"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Branch = {
  id: string;
  nombre: string;
  lat: number;
  lon: number;
  radio: number;
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

async function fetchBranches() {
  try {
    const res = await fetch("http://localhost:8000/api/branches");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function generateQRUrl(branchId: string) {
  return `https://quickchart.io/qr?text=neoassistence://checkin?branch=${branchId}&size=200`;
}

export default function QRsPage() {
  const router = useRouter();
  const [user, setUser] = useState(getStoredUser());
  const [mounted, setMounted] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !user) {
      router.push("/login");
    }
  }, [mounted, user, router]);

  useEffect(() => {
    if (!user) return;
    fetchBranches().then((data) => {
      setBranches(data);
      setLoading(false);
    }).catch(() => {
      setError("No se pudieron cargar las sucursales");
      setLoading(false);
    });
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

  return (
    <main className="page-shell">
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", marginBottom: 16 }}>
        <Link href="/dashboard" style={{ color: "#5ef2ff", textDecoration: "none" }}>
          ← Volver al dashboard
        </Link>
        <button onClick={() => { localStorage.removeItem("neoassistence_user"); router.push("/login"); }} style={{ background: "none", border: "none", color: "#ff8c9e", cursor: "pointer" }}>
          Cerrar sesión
        </button>
      </nav>

      <div className="glass" style={{ padding: 24, marginBottom: 24 }}>
        <p style={{ color: "#5ef2ff", textTransform: "uppercase", letterSpacing: "0.18em" }}>Admin</p>
        <h1 style={{ margin: "8px 0" }}>Códigos QR</h1>
        <p style={{ color: "#9bb4ca" }}>Descarga los códigos QR de cada sucursal para imprimir.</p>
      </div>

      {loading ? (
        <div className="skeleton" style={{width:"100%",height:200,borderRadius:24}} />
      ) : error ? (
        <p style={{ color: "#ff8c9e" }}>{error}</p>
      ) : branches.length === 0 ? (
        <p style={{ color: "#9bb4ca" }}>No hay sucursales registradas.</p>
      ) : (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          {branches.map((branch) => (
            <div key={branch.id} className="glass" style={{ padding: 24, textAlign: "center" }}>
              <h3 style={{ margin: "0 0 16px" }}>{branch.nombre}</h3>
              <div style={{ 
                width: 200, 
                height: 200, 
                background: "white", 
                margin: "0 auto 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12
              }}>
                <img 
                  src={`https://quickchart.io/qr?text=${encodeURIComponent(generateQRUrl(branch.id))}&size=200`}
                  alt={`QR ${branch.nombre}`}
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
              <p style={{ color: "#9bb4ca", fontSize: 14, marginBottom: 16 }}>
                Escanea para registrar en: {branch.nombre}
              </p>
              <a 
                href={`https://quickchart.io/qr?text=neoassistence://checkin?branch=${branch.id}&size=400`}
                download={`qr_${branch.nombre.replace(/\s+/g, "_")}.png`}
                style={{ 
                  display: "inline-block",
                  padding: "10px 16px", 
                  borderRadius: 10, 
                  border: "1px solid rgba(94,242,255,0.28)", 
                  background: "linear-gradient(135deg, rgba(94,242,255,0.14), rgba(156,255,181,0.08))", 
                  color: "white",
                  textDecoration: "none"
                }}
              >
                📥 Descargar PNG
              </a>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}