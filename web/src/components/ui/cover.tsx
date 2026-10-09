import Image from "next/image";
import { useState } from "react";
import { entryTypeLabels, type EntryType } from "@/lib/types";

/**
 * Tapa 2:3 con carga diferida. Sin URL, o si la imagen falla, muestra un
 * recuadro con la inicial del tipo para que la grilla no salte.
 */
export function Cover({
  src,
  type,
  title,
  className = "w-16",
  sizes = "64px",
}: {
  src?: string;
  type: EntryType;
  title: string;
  className?: string;
  sizes?: string;
}) {
  // Guardamos QUE url fallo: si despues cambia la tapa, se vuelve a intentar.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = !!src && failedSrc !== src;

  return (
    <div
      className={`relative aspect-[2/3] shrink-0 overflow-hidden rounded-md border border-border bg-surface-strong ${className}`}
    >
      {showImage ? (
        <Image
          src={src}
          alt={`Tapa de ${title}`}
          fill
          sizes={sizes}
          loading="lazy"
          className="object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center text-lg font-medium text-muted"
          title={entryTypeLabels[type]}
        >
          {entryTypeLabels[type].charAt(0)}
        </span>
      )}
    </div>
  );
}
