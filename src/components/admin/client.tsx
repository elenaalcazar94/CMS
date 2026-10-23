"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { toast } from "./toast";
import { cn } from "@/lib/utils";

export type ActionResult = { ok?: boolean; error?: string; message?: string; redirect?: string } | void;

/** Formulario que ejecuta una server action, muestra un aviso y refresca la vista. */
export function ActionForm({
  action, children, success = "Cambios guardados", className, onDone, resetOnSuccess,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  success?: string | null;
  className?: string;
  onDone?: () => void;
  resetOnSuccess?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await action(fd);
          if (res?.error) return toast.error(res.error);
          if (res?.message || success) toast(res?.message || success!);
          if (resetOnSuccess) ref.current?.reset();
          onDone?.();
          if (res?.redirect) router.push(res.redirect);
          else router.refresh();
        });
      }}
    >
      <fieldset disabled={pending} className={cn("min-w-0", className)}>{children}</fieldset>
    </form>
  );
}

export function Submit({ children, className = "btn-primary", pendingText }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  return (
    <button type="submit" className={cn(className, "group")}>
      <Loader2 className="hidden h-4 w-4 animate-spin group-disabled:block" />
      <span className="group-disabled:hidden">{children}</span>
      <span className="hidden group-disabled:inline">{pendingText ?? children}</span>
    </button>
  );
}

/** Botón que pide confirmación antes de ejecutar una acción. */
export function ConfirmButton({
  action, children, title = "¿Seguro?", description, confirmText = "Eliminar", className = "btn-danger-ghost btn-sm", success = "Eliminado",
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  title?: string;
  description?: string;
  confirmText?: string;
  className?: string;
  success?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{children}</button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} size="sm">
        {description && <p className="text-sm text-zinc-600">{description}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
          <button
            className="btn-danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await action();
                if (res?.error) return toast.error(res.error);
                toast(res?.message || success);
                setOpen(false);
                if (res?.redirect) router.push(res.redirect);
                else router.refresh();
              })
            }
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} {confirmText}
          </button>
        </div>
      </Modal>
    </>
  );
}

export function Modal({ open, onClose, title, children, size = "md", footer }: { open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; size?: "sm" | "md" | "lg" | "xl"; footer?: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open || !mounted) return null;
  const w = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="animate-fade absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn("animate-pop relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-pop sm:rounded-2xl", w)}>
        {title && (
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
            <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
            <button onClick={onClose} className="btn-icon btn-ghost -mr-2"><X className="h-4 w-4" /></button>
          </div>
        )}
        <div className="scrollbar-thin overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-zinc-100 bg-zinc-50/60 px-6 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Switch({ checked, onChange, name, label, description }: { checked?: boolean; onChange?: (v: boolean) => void; name?: string; label?: React.ReactNode; description?: React.ReactNode }) {
  const [internal, setInternal] = useState(!!checked);
  const value = onChange ? !!checked : internal;
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      {(label || description) && (
        <span>
          {label && <span className="block text-sm font-medium text-zinc-800">{label}</span>}
          {description && <span className="mt-0.5 block text-xs text-zinc-500">{description}</span>}
        </span>
      )}
      {name && <input type="hidden" name={name} value={value ? "on" : ""} />}
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => (onChange ? onChange(!value) : setInternal(!value))}
        className={cn("relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition-colors", value ? "bg-brand-600" : "bg-zinc-300")}
      >
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", value ? "translate-x-[18px]" : "translate-x-0.5")} />
      </button>
    </label>
  );
}

export function CopyButton({ value, className = "btn-secondary btn-sm", children = "Copiar" }: { value: string; className?: string; children?: React.ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => navigator.clipboard.writeText(value).then(() => toast("Copiado al portapapeles"))}>
      {children}
    </button>
  );
}
