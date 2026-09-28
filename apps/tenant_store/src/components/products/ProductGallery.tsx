"use client";
import { useMemo, useState } from "react";
import Image from "next/image";
import { IProductImage } from "@/api/productsApi";
import { cn } from "@/lib/utils";

export default function ProductGallery({
  images,
  name,
}: {
  images: IProductImage[];
  name: string;
}) {
  const [index, setIndex] = useState(0);
  const sorted = useMemo(
    () => [...(images ?? [])].sort((a, b) => a.position - b.position),
    [images],
  );
  const active = sorted[index];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-border bg-muted">
        {active ? (
          <Image
            src={active.url}
            alt={name}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            No image
          </div>
        )}
      </div>
      {sorted.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {sorted.map((image, i) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`View image ${i + 1}`}
              className={cn(
                "relative size-20 shrink-0 overflow-hidden rounded-xl border transition",
                i === index
                  ? "border-primary"
                  : "border-border opacity-70 hover:opacity-100",
              )}
            >
              <Image
                src={image.url}
                alt={`${name} ${i + 1}`}
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
