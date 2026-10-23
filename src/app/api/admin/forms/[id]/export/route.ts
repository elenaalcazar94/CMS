import { db } from "@/lib/db";
import { getSiteAccess } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { submissionEntries } from "@/lib/forms";

function csvCell(v: unknown) {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const form = await db.form.findUnique({ where: { id: (await params).id }, include: { submissions: { orderBy: { createdAt: "desc" } } } });
  if (!form) return new Response("Not found", { status: 404 });
  const a = await getSiteAccess(form.siteId);
  if (!a || !can(a.role, "messages")) return new Response("Forbidden", { status: 403 });

  const cols = Array.from(new Set(form.submissions.flatMap((s) => submissionEntries(s.data).map((e) => e[0]))));
  const rows = [
    ["Fecha", ...cols].map(csvCell).join(","),
    ...form.submissions.map((s) => {
      const d = Object.fromEntries(submissionEntries(s.data));
      return [s.createdAt.toISOString(), ...cols.map((c) => d[c])].map(csvCell).join(",");
    }),
  ];
  return new Response("﻿" + rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${form.slug}-mensajes.csv"`,
    },
  });
}
