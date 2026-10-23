import "server-only";
import { db } from "./db";
import { validateSubmission, parseFields } from "./forms";
import { sendMail, emailLayout, escapeHtml } from "./mail";
import { rateLimit } from "./auth";

/** Procesa el envío de un formulario (web pública o API headless). */
export async function handleSubmission(
  where: { id: string } | { siteId: string; slug: string },
  input: Record<string, unknown>,
  meta: { ip: string; userAgent: string | null },
) {
  if (input._hp) return { status: 200, body: { ok: true, message: "Gracias" } }; // bot (honeypot)
  if (!rateLimit(`form:${meta.ip}`, 8, 10 * 60_000)) {
    return { status: 429, body: { error: "Demasiados envíos. Inténtalo dentro de unos minutos." } };
  }
  const form = await db.form.findFirst({ where, include: { site: true } });
  if (!form) return { status: 404, body: { error: "Formulario no encontrado" } };

  const fields = parseFields(form.fields);
  const { ok, data, errors } = validateSubmission(fields, input);
  if (!ok) return { status: 422, body: { error: "Revisa los campos marcados.", errors } };

  await db.formSubmission.create({ data: { formId: form.id, data: Object.entries(data), ip: meta.ip, userAgent: meta.userAgent?.slice(0, 250) } });

  const to = form.notifyEmails.split(/[,;\s]+/).filter(Boolean);
  if (to.length) {
    const emailField = fields.find((f) => f.type === "email");
    const replyTo = emailField ? data[emailField.label || emailField.id] : undefined;
    const rows = Object.entries(data)
      .map(([k, v]) => `<tr><td style="padding:8px 12px 8px 0;color:#6b6880;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:8px 0;white-space:pre-wrap">${escapeHtml(v || "—")}</td></tr>`)
      .join("");
    void sendMail({
      to,
      replyTo: replyTo || undefined,
      subject: `Nuevo mensaje en ${form.site.name}: ${form.name}`,
      html: emailLayout(`Nuevo mensaje · ${form.name}`, `<table style="border-collapse:collapse;font-size:15px">${rows}</table>`),
    });
  }
  return { status: 200, body: { ok: true, message: form.successMessage } };
}
