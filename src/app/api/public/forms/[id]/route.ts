import { handleSubmission } from "@/lib/submit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let input: Record<string, unknown> = {};
  try {
    input = req.headers.get("content-type")?.includes("json")
      ? await req.json()
      : Object.fromEntries((await req.formData()).entries());
  } catch {
    return Response.json({ error: "Datos no válidos" }, { status: 400 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const res = await handleSubmission({ id }, input, { ip, userAgent: req.headers.get("user-agent") });
  return Response.json(res.body, { status: res.status });
}
