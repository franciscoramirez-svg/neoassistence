import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:"-30%",left:"-20%",width:"70%",height:"70%",borderRadius:"50%",background:"radial-gradient(circle,rgba(0,242,254,0.12),transparent 70%)",pointerEvents:"none"}} />
      <div style={{position:"absolute",bottom:"-30%",right:"-20%",width:"70%",height:"70%",borderRadius:"50%",background:"radial-gradient(circle,rgba(179,136,255,0.1),transparent 70%)",pointerEvents:"none"}} />

      <div className="glass" style={{maxWidth:480,width:"100%",padding:"40px 32px",textAlign:"center",position:"relative",zIndex:1}}>
        <img src="/images/logo_modo_oscuro.fw.png" alt="NEOMOTIC" style={{height:48,marginBottom:16}} />
        <h1 style={{margin:0,fontSize:24,fontWeight:700,background:"linear-gradient(135deg,#00f2fe,#b388ff)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
          NeoAssistence
        </h1>
        <p style={{color:"#9bb4ca",margin:"12px 0 32px",fontSize:14,lineHeight:1.5}}>
          Control de asistencia con reconocimiento facial, geocerca y reportes automáticos.
        </p>

        <Link href="/login" style={{display:"block",width:"100%",padding:"16px 20px",borderRadius:16,border:"none",background:"linear-gradient(135deg,#00f2fe,#b388ff)",color:"#fff",fontSize:16,fontWeight:600,cursor:"pointer",textAlign:"center",textDecoration:"none"}}>
          Iniciar sesión
        </Link>

        <div style={{display:"flex",gap:10,marginTop:16,justifyContent:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:12,color:"rgba(155,180,202,0.6)"}}>Reconocimiento facial</span>
          <span style={{fontSize:12,color:"rgba(155,180,202,0.3)"}}>•</span>
          <span style={{fontSize:12,color:"rgba(155,180,202,0.6)"}}>Geocerca</span>
          <span style={{fontSize:12,color:"rgba(155,180,202,0.3)"}}>•</span>
          <span style={{fontSize:12,color:"rgba(155,180,202,0.6)"}}>Reportes</span>
        </div>
      </div>
    </main>
  );
}
