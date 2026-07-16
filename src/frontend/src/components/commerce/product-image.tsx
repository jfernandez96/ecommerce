"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import { resolveMediaUrl } from "@/lib/media-url";
import { cn } from "@/lib/utils";

type ProductImageProps = {
  src?: string;
  alt: string;
  fill?: boolean;
  priority?: boolean;
  sizes?: string;
  className?: string;
  fallbackClassName?: string;
};

export function ProductImage({ src, alt, fill, priority, sizes, className, fallbackClassName }: ProductImageProps) {
  const resolvedSrc = resolveMediaUrl(src);
  const [failed, setFailed] = useState(!resolvedSrc);
  const localImage = resolvedSrc?.startsWith("data:") || resolvedSrc?.startsWith("blob:");
  const uploadedMedia = /\/uploads\//i.test(resolvedSrc || "");
  const localApiHost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(resolvedSrc || "");
  const forceNativeImage = localImage || uploadedMedia || localApiHost;

  useEffect(() => {
    setFailed(!resolvedSrc);
  }, [resolvedSrc]);

  if (failed || !resolvedSrc) {
    return (
      <div className={cn("flex h-full w-full flex-col items-center justify-center gap-3 bg-muted text-foreground/55", fallbackClassName)}>
        <ImageOff size={32} />
        <span className="px-4 text-center text-sm font-medium">Imagen no disponible</span>
      </div>
    );
  }

  if (forceNativeImage) {
    return (
      <img
        src={resolvedSrc}
        alt={alt}
        className={cn(fill && "absolute inset-0 h-full w-full product-media-fill", className)}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      fill={fill}
      priority={priority}
      sizes={sizes}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}