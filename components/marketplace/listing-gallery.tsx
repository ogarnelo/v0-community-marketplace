"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  photos?: string[] | null;
  title: string;
};

export default function ListingGallery({ photos, title }: Props) {
  const imageList = useMemo(
    () => (Array.isArray(photos) ? photos.filter(Boolean) : []),
    [photos]
  );

  const safeImages = imageList.length > 0 ? imageList : ["/placeholder.svg"];
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const currentImage = safeImages[Math.min(index, safeImages.length - 1)] || "/placeholder.svg";

  const prev = () => setIndex((current) => (current === 0 ? safeImages.length - 1 : current - 1));
  const next = () => setIndex((current) => (current === safeImages.length - 1 ? 0 : current + 1));

  return (
    <>
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-2xl border bg-muted">
          <div className="relative aspect-square w-full">
            <Image
              src={currentImage}
              alt={title}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              priority
              unoptimized
            />
          </div>

          {safeImages.length > 1 ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute left-3 top-1/2 -translate-y-1/2"
                onClick={prev}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute right-3 top-1/2 -translate-y-1/2"
                onClick={next}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          ) : null}

          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-3 top-3"
            onClick={() => setFullscreen(true)}
          >
            <Expand className="h-4 w-4" />
          </Button>
        </div>

        {safeImages.length > 1 ? (
          <div className="grid grid-cols-5 gap-2">
            {safeImages.map((photo, photoIndex) => (
              <button
                key={`${photo}-${photoIndex}`}
                type="button"
                onClick={() => setIndex(photoIndex)}
                className={`overflow-hidden rounded-xl border ${photoIndex === index ? "ring-2 ring-primary" : ""
                  }`}
              >
                <span className="relative block aspect-square w-full">
                  <Image
                    src={photo}
                    alt={`${title} ${photoIndex + 1}`}
                    fill
                    sizes="20vw"
                    className="object-cover"
                    unoptimized
                  />
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {fullscreen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setFullscreen(false)}
        >
          <div className="relative h-[90vh] w-[90vw]">
            <Image
              src={currentImage}
              alt={title}
              fill
              sizes="90vw"
              className="rounded-xl object-contain"
              unoptimized
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
