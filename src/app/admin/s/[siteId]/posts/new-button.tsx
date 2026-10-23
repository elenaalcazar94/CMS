"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/admin/toast";

export function NewPostButton({ action, children, className = "btn-primary" }: { action: () => Promise<{ error?: string; redirect?: string }>; children: React.ReactNode; className?: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      className={className}
      disabled={pending}
      onClick={() => start(async () => {
        const r = await action();
        if (r.error) toast.error(r.error);
        else if (r.redirect) router.push(r.redirect);
      })}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}
