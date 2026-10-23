"use client";
import { useParams } from "next/navigation";

export default function NotFound() {
  const params = useParams<{ site?: string }>();
  const home = typeof window !== "undefined" && window.location.pathname.startsWith("/s/") && params.site ? `/s/${params.site}` : "/";
  return (
    <div className="nx-notice">
      <div>
        <div className="nx-notice-code">404</div>
        <h2>Página no encontrada</h2>
        <p className="nx-muted">La página que buscas no existe o se ha movido.</p>
        <a className="nx-btn" href={home}>Ir al inicio</a>
      </div>
    </div>
  );
}
