import "server-only";
import { db } from "./db";
import { validateSubmission, parseFields } from "./forms";
import { sendMail, emailLayout, escapeHtml } from "./mail";
import { rateLimit } from "./auth";
import { parseSettings } from "./settings";

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

  const to = await recipients(form.notifyEmails, form.site);
  if (!to.length) console.warn(`[mail] El formulario «${form.name}» no tiene a quién avisar`);
  else {
    const emailField = fields.find((f) => f.type === "email");
    const replyTo = emailField ? data[emailField.label || emailField.id] : undefined;
    const rows = Object.entries(data)
      .map(([k, v]) => `<tr><td style="padding:8px 12px 8px 0;color:#6b6880;vertical-align:top">${escapeHtml(k)}</td><td style="padding:8px 0;white-space:pre-wrap">${escapeHtml(v || "—")}</td></tr>`)
      .join("");
    // Se espera al envío: en plataformas serverless (Netlify) la función se congela al responder
    const sent = await sendMail({
      to,
      replyTo: replyTo || undefined,
      subject: `Nuevo mensaje en ${form.site.name}: ${form.name}`,
      html: emailLayout(`Nuevo mensaje · ${form.name}`, `<table style="border-collapse:collapse;font-size:15px">${rows}</table>`),
    });
    console.info(`[mail] Aviso de «${form.name}» ${sent ? "enviado" : "NO enviado"} a ${to.join(", ")}`);
  }
  return { status: 200, body: { ok: true, message: form.successMessage } };
}

/** A quién avisar: los emails del formulario, si no el de contacto del sitio y, si tampoco, los administradores. */
async function recipients(notifyEmails: string, site: { id: string; settings: unknown }) {
  const list = notifyEmails.split(/[,;\s]+/).filter(Boolean);
  if (list.length) return list;
  const contact = parseSettings(site.settings).contactEmail;
  if (contact) return [contact];
  const admins = await db.user.findMany({
    where: { active: true, OR: [{ memberships: { some: { siteId: site.id, role: "ADMIN" } } }, { role: "SUPERADMIN" }] },
    select: { email: true },
  });
  return admins.map((a) => a.email);
}
