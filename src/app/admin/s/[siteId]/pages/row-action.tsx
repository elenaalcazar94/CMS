"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "@/components/admin/toast";

type Item = { label: string; action: () => Promise<{ error?: string; message?: string; redirect?: string }> };

export function RowAction({ items, danger }: { items: Item[]; danger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", on);
    return () => document.removeEventListener("mousedown", on);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button className="btn-icon btn-ghost" onClick={() => setOpen(!open)} aria-label="Más acciones"><MoreHorizontal className="h-4 w-4" /></button>
      {open && (
        <div className="animate-pop absolute right-0 top-full z-30 mt-1 w-48 rounded-xl border border-zinc-200 bg-white p-1 shadow-pop">
          {items.map((it) => (
            <button
              key={it.label}
              className="w-full rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-zinc-100"
              onClick={() => start(async () => {
                setOpen(false);
                const r = await it.action();
                if (r.error) return toast.error(r.error);
                if (r.message) toast(r.message);
                if (r.redirect) router.push(r.redirect);
                else router.refresh();
              })}
            >
              {it.label}
            </button>
          ))}
          {danger && <><div className="my-1 border-t border-zinc-100" />{danger}</>}
        </div>
      )}
    </div>
  );
}
