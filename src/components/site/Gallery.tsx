"use client";
import { useEffect, useState } from "react";

export function Gallery({ images, columns }: { images: { src: string; alt?: string }[]; columns: string }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % images.length));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + images.length) % images.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, images.length]);

  return (
    <>
      <div className={`nx-grid nx-gallery nx-cols-${columns}`}>
        {images.map((img, i) => (
          <button key={i} type="button" onClick={() => setOpen(i)} aria-label={img.alt || `Imagen ${i + 1}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.src} alt={img.alt ?? ""} loading="lazy" />
          </button>
        ))}
      </div>
      {open !== null && images[open] && (
        <div className="nx-lightbox" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[open].src} alt={images[open].alt ?? ""} />
        </div>
      )}
    </>
  );
}
