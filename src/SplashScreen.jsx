import React, { useEffect, useState } from "react";
import logo from "./assets/INFINIX LOGO.png";

export default function SplashScreen({ onFinish }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      if (onFinish) onFinish();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: "#fff",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      transition: "opacity 1.2s",
      opacity: visible ? 1 : 0,
      pointerEvents: visible ? "auto" : "none"
    }}>
      <img
        src={logo}
        alt="Infinix Dev Logo"
        style={{
          width: "220px",
          height: "220px",
          objectFit: "contain",
          boxShadow: 'none',
          animation: visible ? "fadeScaleIn 1.2s cubic-bezier(.4,2,.3,1)" : "fadeScaleOut 1.2s cubic-bezier(.4,2,.3,1)",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.7)"
        }}
      />
      <div style={{
        marginTop: 32,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          background: '#fff',
          borderRadius: 12,
          padding: '10px 28px',
          fontSize: 22,
          color: '#2196f3',
          fontWeight: 900,
          letterSpacing: 1,
          boxShadow: 'none',
          textAlign: 'center',
          border: 'none',
          marginBottom: 12,
          animation: visible ? "fadeInText 1.6s cubic-bezier(.4,2,.3,1)" : "fadeOutText 1.2s cubic-bezier(.4,2,.3,1)",
          opacity: visible ? 1 : 0
        }}>
          EsyncSadeCloud<br />Licencia: INFINIX-KMS-2025-001
        </div>
        <div style={{ fontSize: 18, color: '#222', fontWeight: 700, textAlign: 'center', marginTop: 4,
          animation: visible ? "fadeInText 1.8s cubic-bezier(.4,2,.3,1)" : "fadeOutText 1.2s cubic-bezier(.4,2,.3,1)",
          opacity: visible ? 1 : 0
        }}>
          Arquitecto de soluciones: Ruben Madrigal
        </div>
      </div>
      <style>{`
        @keyframes fadeScaleIn {
          0% { opacity: 0; transform: scale(0.7); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeScaleOut {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.7); }
        }
        @keyframes fadeInText {
          0% { opacity: 0; transform: translateY(24px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeOutText {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(24px); }
        }
      `}</style>
    </div>
  );
}
