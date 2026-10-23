"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

type Toast = { id: number; type: "success" | "error"; message: string };

export function toast(message: string, type: Toast["type"] = "success") {
  window.dispatchEvent(new CustomEvent("nido:toast", { detail: { message, type } }));
}
toast.error = (m: string) => toast(m, "error");

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const { message, type } = (e as CustomEvent).detail;
      const id = Date.now() + Math.random();
      setItems((t) => [...t, { id, message, type }]);
      setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), message.length > 70 ? 20000 : type === "error" ? 6000 : 3200);
    };
    window.addEventListener("nido:toast", on);
    return () => window.removeEventListener("nido:toast", on);
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[200] flex flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} className="animate-toast pointer-events-auto flex min-w-[260px] max-w-sm items-start gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-pop">
          {t.type === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
          <span className="flex-1 select-text break-words text-zinc-800">{t.message}</span>
          <button onClick={() => setItems((x) => x.filter((i) => i.id !== t.id))} className="text-zinc-400 hover:text-zinc-700"><X className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );
}
