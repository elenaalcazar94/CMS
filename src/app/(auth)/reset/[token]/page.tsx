import { resetPassword } from "@/app/actions/auth";
import { ActionForm, Submit } from "@/components/admin/client";
import { Toaster } from "@/components/admin/toast";

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Nueva contraseña</h1>
      <p className="mt-1.5 text-sm text-zinc-500">Elige una contraseña segura de al menos 8 caracteres.</p>
      <ActionForm action={resetPassword} success={null} className="mt-8 space-y-4">
        <input type="hidden" name="token" value={token} />
        <div>
          <label className="label">Nueva contraseña</label>
          <input name="password" type="password" minLength={8} required className="input py-2.5" autoFocus />
        </div>
        <Submit className="btn-primary w-full py-2.5">Guardar y entrar</Submit>
      </ActionForm>
      <Toaster />
    </>
  );
}
