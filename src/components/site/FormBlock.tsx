"use client";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { PublicForm } from "@/lib/forms";

export function FormBlock({ form, preview }: { form: PublicForm; preview?: boolean }) {
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (preview) return;
    setState("sending");
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};
    fd.forEach((v, k) => (payload[k] = v));
    try {
      const res = await fetch(`/api/public/forms/${form.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        setState("ok");
        setMessage(json.message || form.successMessage);
      } else {
        setErrors(json.errors ?? {});
        setMessage(json.error || "Revisa los campos marcados.");
        setState("error");
      }
    } catch {
      setMessage("No se pudo enviar. Inténtalo de nuevo.");
      setState("error");
    }
  }

  if (state === "ok") {
    return (
      <div className="nx-form">
        <div className="nx-form-ok">
          <CheckCircle2 size={44} />
          <p style={{ fontSize: "1.15rem", fontWeight: 600, margin: 0 }}>{message}</p>
        </div>
      </div>
    );
  }

  return (
    <form className="nx-form" onSubmit={onSubmit} noValidate>
      {state === "error" && <div className="nx-form-alert">{message}</div>}
      <div className="nx-hp" aria-hidden="true">
        <label>
          No rellenar <input type="text" name="_hp" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {form.fields.map((f) => {
        const id = `f-${form.id}-${f.id}`;
        const err = errors[f.id];
        return (
          <div key={f.id} className={`nx-field ${f.width === "half" ? "half" : ""}`}>
            {f.type === "checkbox" ? (
              <label className="nx-check">
                <input type="checkbox" name={f.id} required={f.required} />
                <span>
                  {f.label} {f.required && <span className="req">*</span>}
                </span>
              </label>
            ) : (
              <>
                <label htmlFor={id}>
                  {f.label} {f.required && <span className="req">*</span>}
                </label>
                {f.type === "textarea" ? (
                  <textarea id={id} name={f.id} className="nx-input" placeholder={f.placeholder} required={f.required} />
                ) : f.type === "select" ? (
                  <select id={id} name={f.id} className="nx-input" required={f.required} defaultValue="">
                    <option value="" disabled>
                      {f.placeholder || "Selecciona una opción"}
                    </option>
                    {(f.options ?? "").split("\n").map((o) => o.trim()).filter(Boolean).map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input id={id} name={f.id} type={f.type} className="nx-input" placeholder={f.placeholder} required={f.required} />
                )}
              </>
            )}
            {err && <span className="nx-field-error">{err}</span>}
          </div>
        );
      })}
      <div className="nx-field">
        <button className="nx-btn" type="submit" disabled={state === "sending"} style={{ justifySelf: "start", alignSelf: "flex-start" }}>
          {state === "sending" ? "Enviando…" : form.submitLabel}
        </button>
      </div>
    </form>
  );
}
