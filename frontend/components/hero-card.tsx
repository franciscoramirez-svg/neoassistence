export function HeroCard() {
  return (
    <section
      className="glass"
      style={{
        padding: 32,
        textAlign: "center",
        maxWidth: 920,
        margin: "0 auto 24px",
      }}
    >
      <div
        style={{
          width: 100,
          height: 100,
          margin: "0 auto 16px",
          borderRadius: 28,
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(135deg, #5ef2ff, #9cffb5)",
          color: "#04101a",
          fontWeight: 800,
          fontSize: 42,
        }}
      >
        N
      </div>
      <p style={{ color: "#5ef2ff", textTransform: "uppercase", letterSpacing: "0.18em" }}>
        Neomotic
      </p>
      <h1 style={{ margin: "8px 0 10px", fontSize: 56 }}>NeoAssistence</h1>
      <p style={{ color: "#9bb4ca", maxWidth: 720, margin: "0 auto" }}>
        Plataforma profesional para asistencia, geocerca, justificaciones, dashboard y control operativo multi-sucursal.
      </p>
    </section>
  );
}
