import "./globals.css";
import type { Metadata } from "next";
import PWARegister from "./PWARegister";
import { ToastProvider } from "./ToastProvider";


export const metadata: Metadata = {
  title: "NeoAssistence - Control de Asistencia",
  description: "Sistema de control de asistencia con reconocimiento facial",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "NeoAssistence", statusBarStyle: "black-translucent" },
  icons: [
    { url: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
    { url: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
  ],
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem("neoassistence_theme")||"dark";document.documentElement.setAttribute("data-theme",t);}catch(e){}})()` }} />
        <meta name="theme-color" content="#0a1526" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body>
        <ToastProvider>
          <PWARegister />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
