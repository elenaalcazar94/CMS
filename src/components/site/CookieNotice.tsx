"use client";
import { useEffect, useState } from "react";

export function CookieNotice({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(!localStorage.getItem("nx-cookies"));
    } catch {}
  }, []);
  if (!show) return null;
  return (
    <div className="nx-cookies" role="dialog" aria-label="Aviso de cookies">
      <span>{text}</span>
      <button
        className="nx-btn"
        onClick={() => {
          try { localStorage.setItem("nx-cookies", "1"); } catch {}
          setShow(false);
        }}
      >
        Aceptar
      </button>
    </div>
  );
}
