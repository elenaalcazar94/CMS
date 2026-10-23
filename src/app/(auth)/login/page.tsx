import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { login } from "@/app/actions/auth";
import { ActionForm, Submit } from "@/components/admin/client";
import { Toaster } from "@/components/admin/toast";

export const dynamic = "force-dynamic";
export const metadata = { title: "Iniciar sesión · Nido CMS" };

export default async function LoginPage() {
  if ((await db.user.count()) === 0) redirect("/setup");
  if (await getCurrentUser()) redirect("/admin");
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Bienvenido de nuevo</h1>
      <p className="mt-1.5 text-sm text-zinc-500">Accede a tu panel para gestionar tus webs.</p>
      <ActionForm action={login} success={null} className="mt-8 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input py-2.5" placeholder="tu@email.com" autoFocus />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="password">Contraseña</label>
            <Link href="/forgot" className="mb-1.5 text-xs font-medium text-brand-600 hover:text-brand-700">¿La has olvidado?</Link>
          </div>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="input py-2.5" placeholder="••••••••" />
        </div>
        <Submit className="btn-primary w-full py-2.5" pendingText="Entrando…">Entrar</Submit>
      </ActionForm>
      <Toaster />
    </>
  );
}
