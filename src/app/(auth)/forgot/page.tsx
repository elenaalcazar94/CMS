import Link from "next/link";
import { requestReset } from "@/app/actions/auth";
import { ActionForm, Submit } from "@/components/admin/client";
import { Toaster } from "@/components/admin/toast";

export const metadata = { title: "Recuperar contraseña · Nido CMS" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Recuperar contraseña</h1>
      <p className="mt-1.5 text-sm text-zinc-500">Te enviaremos un enlace para elegir una nueva.</p>
      <ActionForm action={requestReset} success={null} resetOnSuccess className="mt-8 space-y-4">
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" required className="input py-2.5" placeholder="tu@email.com" autoFocus />
        </div>
        <Submit className="btn-primary w-full py-2.5" pendingText="Enviando…">Enviar enlace</Submit>
      </ActionForm>
      <Link href="/login" className="mt-6 text-center text-sm font-medium text-zinc-500 hover:text-zinc-800">← Volver al inicio de sesión</Link>
      <Toaster />
    </>
  );
}
