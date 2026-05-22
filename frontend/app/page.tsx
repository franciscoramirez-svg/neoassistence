import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <div className="glass" style={{ maxWidth: 920, margin: "0 auto", padding: 24 }}>
        <h2 style={{ marginTop: 0 }}>Control de Asistencia</h2>
        <p style={{ color: "#9bb4ca" }}>
          Sistema de control de asistencia con reconocimiento facial.
        </p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Link
            href="/login"
            style={{
              padding: "14px 18px",
              borderRadius: 16,
              background: "linear-gradient(135deg, rgba(94,242,255,0.14), rgba(156,255,181,0.08))",
              border: "1px solid rgba(94,242,255,0.28)",
            }}
          >
            Iniciar sesion
          </Link>
        </div>
      </div>
    </main>
  );
}
