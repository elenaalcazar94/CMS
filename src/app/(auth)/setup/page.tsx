import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { setup } from "@/app/actions/auth";
import { ActionForm, Submit } from "@/components/admin/client";
import { Toaster } from "@/components/admin/toast";

export const dynamic = "force-dynamic";
export const metadata = { title: "Instalación · Nido CMS" };

export default async function SetupPage() {
  if ((await db.user.count()) > 0) redirect("/login");
  return (
    <>
      <span className="badge-brand mb-4 self-start">Paso 1 de 1</span>
      <h1 className="text-2xl font-semibold tracking-tight">Vamos a instalar tu CMS</h1>
      <p className="mt-1.5 text-sm text-zinc-500">Crea la cuenta de superadministrador. Podrás gestionar todos los sitios y usuarios.</p>
      <ActionForm action={setup} success="¡Instalación completada!" className="mt-8 space-y-4">
        <div>
          <label className="label">Tu nombre</label>
          <input name="name" required className="input py-2.5" placeholder="Elena Alcázar" autoFocus />
        </div>
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" required className="input py-2.5" placeholder="tu@agencia.com" />
        </div>
        <div>
          <label className="label">Contraseña</label>
          <input name="password" type="password" minLength={8} required className="input py-2.5" placeholder="Mínimo 8 caracteres" />
        </div>
        <Submit className="btn-primary w-full py-2.5" pendingText="Instalando…">Crear cuenta y empezar</Submit>
      </ActionForm>
      <Toaster />
    </>
  );
}
