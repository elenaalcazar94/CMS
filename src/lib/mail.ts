import "server-only";
import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

export function mailEnabled() {
  return !!process.env.SMTP_HOST;
}

function getTransport() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export async function sendMail(opts: { to: string | string[]; subject: string; html: string; replyTo?: string }) {
  if (!mailEnabled()) {
    console.info(`[mail] SMTP no configurado. Correo no enviado: "${opts.subject}" → ${opts.to}`);
    return false;
  }
  try {
    await getTransport().sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, ...opts });
    return true;
  } catch (e) {
    console.error("[mail] Error enviando correo", e);
    return false;
  }
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function emailLayout(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#15131f">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:14px;padding:32px;border:1px solid #e8e6ef">
  <h1 style="font-size:20px;margin:0 0 20px">${escapeHtml(title)}</h1>${body}
  <p style="margin-top:32px;font-size:12px;color:#8a8697">Enviado por Nido CMS</p></div></body></html>`;
}

/** Envía un correo de prueba y devuelve el error de SMTP legible, si lo hay. */
export async function sendTestMail(to: string): Promise<string | null> {
  if (!mailEnabled()) return "El servidor no tiene SMTP configurado (falta SMTP_HOST).";
  try {
    await getTransport().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: "Prueba de correo de Nido CMS",
      html: emailLayout("¡El correo funciona!", "<p>Si lees esto, los avisos de formularios y la recuperación de contraseña ya se envían correctamente.</p>"),
    });
    return null;
  } catch (e) {
    console.error("[mail] Error en el correo de prueba", e);
    const err = e as { code?: string; responseCode?: number; message?: string };
    if (err.code === "EAUTH" || err.responseCode === 535) return "Gmail ha rechazado el usuario o la contraseña de aplicación. Revisa SMTP_USER y SMTP_PASS.";
    if (err.code === "ETIMEDOUT" || err.code === "ECONNECTION" || err.code === "ESOCKET") return `No se ha podido conectar con ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}.`;
    return `Error al enviar: ${err.message ?? "desconocido"}`;
  }
}
