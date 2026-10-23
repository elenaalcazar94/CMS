"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SiteRole } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/permissions";
import { updateMemberRole } from "@/app/actions/sites";
import { toast } from "@/components/admin/toast";

export function RoleSelect({ siteId, userId, role, disabled }: { siteId: string; userId: string; role: SiteRole; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <select
      className="input w-auto py-1.5 text-[13px]"
      defaultValue={role}
      disabled={disabled || pending}
      onChange={(e) => start(async () => {
        const r = await updateMemberRole(siteId, userId, e.target.value as SiteRole);
        if (r.error) toast.error(r.error); else toast(r.message!);
        router.refresh();
      })}
    >
      {(["CLIENT", "EDITOR", "ADMIN"] as const).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
    </select>
  );
}
