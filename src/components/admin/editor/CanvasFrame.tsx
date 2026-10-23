"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renderiza a sus hijos dentro de un iframe (mismo origen) para que las
 * media queries del tema respondan al ancho del dispositivo simulado.
 */
export function CanvasFrame({ children, onKeyDown, className }: { children: React.ReactNode; onKeyDown?: (e: KeyboardEvent) => void; className?: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const keyRef = useRef(onKeyDown);
  keyRef.current = onKeyDown;

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    let observer: MutationObserver | null = null;
    const copy = (node: Node, doc: Document) => {
      if (node instanceof HTMLStyleElement || (node instanceof HTMLLinkElement && node.rel === "stylesheet")) {
        doc.head.appendChild(node.cloneNode(true));
      }
    };
    const setup = () => {
      const doc = iframe.contentDocument;
      if (!doc || doc.body.dataset.ready) return;
      doc.body.dataset.ready = "1";
      document.head.querySelectorAll("style, link[rel='stylesheet']").forEach((n) => copy(n, doc));
      observer = new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => copy(n, doc))));
      observer.observe(document.head, { childList: true });
      doc.body.style.margin = "0";
      doc.body.style.background = "transparent";
      doc.addEventListener("keydown", (e) => keyRef.current?.(e));
      setBody(doc.body);
    };
    if (iframe.contentDocument?.readyState === "complete") setup();
    iframe.addEventListener("load", setup);
    return () => {
      iframe.removeEventListener("load", setup);
      observer?.disconnect();
    };
  }, []);

  return (
    <>
      <iframe ref={ref} className={className} title="Lienzo del editor" srcDoc="<!DOCTYPE html><html lang='es'><head><meta charset='utf-8'></head><body></body></html>" />
      {body && createPortal(children, body)}
    </>
  );
}
