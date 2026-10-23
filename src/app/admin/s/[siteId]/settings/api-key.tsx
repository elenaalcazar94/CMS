"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, AlertTriangle } from "lucide-react";
import { CopyButton, Modal } from "@/components/admin/client";
import { toast } from "@/components/admin/toast";

export function ApiKeyCreator({ action }: { action: (fd: FormData) => Promise<{ error?: string; message?: string }> }) {
  const [name, setName] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <div className="flex gap-2">
        <input className="input" placeholder="Nombre de la clave (p. ej. Web Next.js)" value={name} onChange={(e) => setName(e.target.value)} />
        <button
          className="btn-primary"
          disabled={pending}
          onClick={() => start(async () => {
            const fd = new FormData();
            fd.set("name", name);
            const r = await action(fd);
            if (r.error) return toast.error(r.error);
            setKey(r.message!);
            setName("");
            router.refresh();
          })}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Crear clave
        </button>
      </div>
      <Modal open={!!key} onClose={() => setKey(null)} title="Tu nueva clave API" size="md">
        <p className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Cópiala ahora: por seguridad no volverá a mostrarse.</p>
        <div className="flex gap-2">
          <code className="flex-1 break-all rounded-lg bg-zinc-100 px-3 py-2 font-mono text-xs">{key}</code>
          <CopyButton value={key ?? ""} />
        </div>
        <div className="mt-5 flex justify-end"><button className="btn-primary" onClick={() => setKey(null)}>Hecho</button></div>
      </Modal>
    </>
  );
}
