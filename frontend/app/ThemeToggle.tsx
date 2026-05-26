"use client";
import { useState, useEffect } from "react";

export default function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    setIsLight(document.documentElement.getAttribute("data-theme") === "light");
  }, []);

  function toggle() {
    const next = !isLight;
    setIsLight(next);
    document.documentElement.setAttribute("data-theme", next ? "light" : "dark");
    localStorage.setItem("neoassistence_theme", next ? "light" : "dark");
  }

  return (
    <button onClick={toggle} title={isLight ? "Modo oscuro" : "Modo claro"} style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:16,lineHeight:1,padding:4}}>
      {isLight ? "🌙" : "☀️"}
    </button>
  );
}
