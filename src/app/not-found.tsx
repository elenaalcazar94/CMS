import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-zinc-50 p-6 text-center">
      <div>
        <p className="text-6xl font-bold tracking-tight text-brand-600">404</p>
        <h1 className="mt-3 text-xl font-semibold">Página no encontrada</h1>
        <p className="mt-1 text-sm text-zinc-500">La dirección no existe o no tienes acceso.</p>
        <Link href="/admin" className="btn-primary mt-6">Ir al panel</Link>
      </div>
    </div>
  );
}
