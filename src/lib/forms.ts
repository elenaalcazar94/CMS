export type FormFieldType = "text" | "email" | "tel" | "textarea" | "select" | "checkbox" | "number" | "date";

export type FormField = {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string; // una opción por línea (select)
  width?: "full" | "half";
};

export const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: "text", label: "Texto corto" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Teléfono" },
  { value: "textarea", label: "Texto largo" },
  { value: "select", label: "Desplegable" },
  { value: "checkbox", label: "Casilla (aceptación)" },
  { value: "number", label: "Número" },
  { value: "date", label: "Fecha" },
];

export type PublicForm = {
  id: string;
  fields: FormField[];
  submitLabel: string;
  successMessage: string;
};

export function parseFields(v: unknown): FormField[] {
  return Array.isArray(v) ? (v as FormField[]).filter((f) => f && f.id && f.type) : [];
}

export const DEFAULT_CONTACT_FIELDS: FormField[] = [
  { id: "nombre", type: "text", label: "Nombre", required: true, width: "half" },
  { id: "email", type: "email", label: "Email", required: true, width: "half" },
  { id: "telefono", type: "tel", label: "Teléfono", width: "full" },
  { id: "mensaje", type: "textarea", label: "Mensaje", required: true, width: "full" },
  { id: "privacidad", type: "checkbox", label: "Acepto la política de privacidad", required: true, width: "full" },
];

/** Valida los datos enviados contra la definición del formulario. */
export function validateSubmission(fields: FormField[], input: Record<string, unknown>) {
  const data: Record<string, string> = {};
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const raw = input[f.id];
    let value = f.type === "checkbox" ? (raw === true || raw === "on" || raw === "true" ? "Sí" : "") : String(raw ?? "").trim();
    value = value.slice(0, f.type === "textarea" ? 10000 : 500);
    if (f.required && !value) {
      errors[f.id] = "Este campo es obligatorio";
      continue;
    }
    if (value && f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[f.id] = "Email no válido";
    if (value && f.type === "select") {
      const opts = (f.options ?? "").split("\n").map((o) => o.trim()).filter(Boolean);
      if (opts.length && !opts.includes(value)) errors[f.id] = "Opción no válida";
    }
    data[f.label || f.id] = value;
  }
  return { data, errors, ok: Object.keys(errors).length === 0 };
}

/** Campos de un mensaje en orden: [etiqueta, valor]. Admite el formato antiguo (objeto). */
export function submissionEntries(data: unknown): [string, string][] {
  if (Array.isArray(data)) return data.filter((e) => Array.isArray(e) && e.length === 2).map(([k, v]) => [String(k), String(v ?? "")]);
  if (data && typeof data === "object") return Object.entries(data as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")]);
  return [];
}
