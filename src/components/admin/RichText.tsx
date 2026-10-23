"use client";
import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered, Quote, Link2, AlignLeft, AlignCenter, AlignRight,
  ImageIcon, Minus, Undo2, Redo2, Heading2, Heading3, Pilcrow, Unlink, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "./client";
import { MediaLibrary } from "./MediaLibrary";

function Btn({ on, active, title, children, disabled }: { on: () => void; active?: boolean; title: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={on}
      className={cn("grid h-7 w-7 place-items-center rounded-md text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30", active && "bg-brand-50 text-brand-700 hover:bg-brand-100")}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, siteId, full }: { editor: Editor; siteId?: string; full?: boolean }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [mediaOpen, setMediaOpen] = useState(false);
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    editor.on("transaction", f);
    return () => { editor.off("transaction", f); };
  }, [editor]);

  const i = "h-4 w-4";
  const applyLink = () => {
    if (!url) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else {
      const href = /^(https?:|mailto:|tel:|\/|#)/.test(url) ? url : `https://${url}`;
      editor.chain().focus().extendMarkRange("link").setLink({ href, target: /^https?:/.test(href) ? "_blank" : null }).run();
    }
    setLinkOpen(false);
  };

  return (
    <div className={cn("sticky z-10 flex flex-wrap items-center gap-0.5 border-b border-zinc-100 bg-white/95 px-1.5 py-1 backdrop-blur", full ? "top-0" : "top-0 rounded-t-lg")}>
      <Btn title="Párrafo" on={() => editor.chain().focus().setParagraph().run()} active={editor.isActive("paragraph")}><Pilcrow className={i} /></Btn>
      <Btn title="Título" on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}><Heading2 className={i} /></Btn>
      <Btn title="Subtítulo" on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}><Heading3 className={i} /></Btn>
      <span className="mx-1 h-4 w-px bg-zinc-200" />
      <Btn title="Negrita (Ctrl+B)" on={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}><Bold className={i} /></Btn>
      <Btn title="Cursiva (Ctrl+I)" on={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}><Italic className={i} /></Btn>
      <Btn title="Subrayado (Ctrl+U)" on={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")}><Underline className={i} /></Btn>
      {full && <Btn title="Tachado" on={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")}><Strikethrough className={i} /></Btn>}
      <div className="relative">
        <Btn title="Enlace" on={() => { setUrl(editor.getAttributes("link").href ?? ""); setLinkOpen(!linkOpen); }} active={editor.isActive("link")}><Link2 className={i} /></Btn>
        {linkOpen && (
          <div className="animate-pop absolute left-0 top-full z-20 mt-1 flex w-72 gap-1 rounded-lg border border-zinc-200 bg-white p-1.5 shadow-pop">
            <input autoFocus className="input py-1 text-[13px]" placeholder="https://… o /pagina" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } if (e.key === "Escape") setLinkOpen(false); }} />
            <button type="button" className="btn-primary btn-icon" onClick={applyLink}><Check className="h-4 w-4" /></button>
            {editor.isActive("link") && <button type="button" className="btn-secondary btn-icon" title="Quitar enlace" onClick={() => { editor.chain().focus().unsetLink().run(); setLinkOpen(false); }}><Unlink className="h-4 w-4" /></button>}
          </div>
        )}
      </div>
      <span className="mx-1 h-4 w-px bg-zinc-200" />
      <Btn title="Lista" on={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}><List className={i} /></Btn>
      <Btn title="Lista numerada" on={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}><ListOrdered className={i} /></Btn>
      <Btn title="Cita" on={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}><Quote className={i} /></Btn>
      <span className="mx-1 h-4 w-px bg-zinc-200" />
      <Btn title="Alinear a la izquierda" on={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })}><AlignLeft className={i} /></Btn>
      <Btn title="Centrar" on={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })}><AlignCenter className={i} /></Btn>
      {full && <Btn title="Alinear a la derecha" on={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })}><AlignRight className={i} /></Btn>}
      {full && (
        <>
          <span className="mx-1 h-4 w-px bg-zinc-200" />
          {siteId && <Btn title="Insertar imagen" on={() => setMediaOpen(true)}><ImageIcon className={i} /></Btn>}
          <Btn title="Línea separadora" on={() => editor.chain().focus().setHorizontalRule().run()}><Minus className={i} /></Btn>
          <span className="mx-1 h-4 w-px bg-zinc-200" />
          <Btn title="Deshacer" on={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo2 className={i} /></Btn>
          <Btn title="Rehacer" on={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo2 className={i} /></Btn>
        </>
      )}
      {siteId && (
        <Modal open={mediaOpen} onClose={() => setMediaOpen(false)} title="Insertar imagen" size="xl">
          <MediaLibrary siteId={siteId} mode="pick" accept="image" onPick={(items) => { editor.chain().focus().setImage({ src: items[0].url, alt: items[0].alt }).run(); setMediaOpen(false); }} />
        </Modal>
      )}
    </div>
  );
}

export function RichText({ value, onChange, siteId, full, placeholder = "Escribe aquí…", className }: { value: string; onChange: (html: string) => void; siteId?: string; full?: boolean; placeholder?: string; className?: string }) {
  const lastEmitted = useRef(value);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true } }),
      Image,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? "" : editor.getHTML();
      lastEmitted.current = html;
      onChange(html);
    },
  });

  // Sincroniza si el valor cambia desde fuera (p. ej. restaurar versión)
  useEffect(() => {
    if (editor && value !== lastEmitted.current) {
      lastEmitted.current = value;
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  return (
    <div className={cn("rte", full ? "rte-lg" : "rounded-lg border border-zinc-200 bg-white shadow-sm focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/15", className)}>
      {editor && <Toolbar editor={editor} siteId={siteId} full={full} />}
      <EditorContent editor={editor} />
    </div>
  );
}
