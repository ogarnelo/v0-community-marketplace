"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

interface ListingGalleryProps {
  title: string;
  category: string;
  photoUrls: string[];
}

export function ListingGallery({ title, category, photoUrls }: ListingGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [api, setApi] = useState<CarouselApi | undefined>(undefined);
  const [dialogApi, setDialogApi] = useState<CarouselApi | undefined>(undefined);

  const images = useMemo(() => photoUrls.filter(Boolean), [photoUrls]);
  const hasImages = images.length > 0;

  const selectIndex = (nextIndex: number) => {
    setSelectedIndex(nextIndex);
    api?.scrollTo(nextIndex);
    dialogApi?.scrollTo(nextIndex);
  };

  const openAt = (nextIndex: number) => {
    setSelectedIndex(nextIndex);
    setIsOpen(true);
    setTimeout(() => {
      dialogApi?.scrollTo(nextIndex);
    }, 0);
  };

  return (
    <>
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-2xl border bg-muted">
          {hasImages ? (
            <>
              <Carousel
                setApi={setApi}
                opts={{ startIndex: selectedIndex }}
                className="w-full"
              >
                <CarouselContent className="ml-0">
                  {images.map((url, index) => (
                    <CarouselItem key={`${url}-${index}`} className="pl-0">
                      <button
                        type="button"
                        onClick={() => openAt(index)}
                        className="relative block w-full text-left"
                      >
                        <div className="flex items-center justify-center bg-muted" style={{ aspectRatio: "4 / 3" }}>
                          <img
                            src={url}
                            alt={`${title} ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </button>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>

              {images.length > 1 ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute left-3 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full bg-white/90 shadow-sm hover:bg-white"
                    onClick={() => selectIndex(Math.max(0, selectedIndex - 1))}
                    disabled={selectedIndex === 0}
                  >
                    <ChevronLeft className="h-5 w-5" />
                    <span className="sr-only">Foto anterior</span>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-3 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full bg-white/90 shadow-sm hover:bg-white"
                    onClick={() => selectIndex(Math.min(images.length - 1, selectedIndex + 1))}
                    disabled={selectedIndex === images.length - 1}
                  >
                    <ChevronRight className="h-5 w-5" />
                    <span className="sr-only">Siguiente foto</span>
                  </Button>
                </>
              ) : null}

              <Button
                type="button"
                variant="secondary"
                className="absolute bottom-3 right-3 z-10 gap-2 rounded-full bg-white/90 shadow-sm hover:bg-white"
                onClick={() => openAt(selectedIndex)}
              >
                <Expand className="h-4 w-4" />
                Ver fotos
              </Button>

              <div className="absolute bottom-3 left-3 z-10 rounded-full bg-black/65 px-3 py-1 text-xs font-medium text-white">
                {selectedIndex + 1} / {images.length}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center bg-muted" style={{ aspectRatio: "4 / 3" }}>
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <ImageIcon className="h-12 w-12 opacity-40" />
                <span className="select-none text-sm">Sin fotos disponibles</span>
              </div>
            </div>
          )}
        </div>

        {images.length > 1 ? (
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
            {images.map((url, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={`thumb-${url}-${index}`}
                  type="button"
                  onClick={() => selectIndex(index)}
                  className={`overflow-hidden rounded-xl border transition ${isSelected ? "border-[#7EBA28] ring-2 ring-[#7EBA28]/20" : "border-border hover:border-[#7EBA28]/50"
                    }`}
                >
                  <div style={{ aspectRatio: "1 / 1" }}>
                    <img src={url} alt={`${title} miniatura ${index + 1}`} className="h-full w-full object-cover" />
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-5xl border-0 bg-black p-3 text-white sm:p-4" showCloseButton={false}>
          <DialogTitle className="sr-only">Galería de fotos de {title}</DialogTitle>
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-white/70">{category}</p>
              </div>
              <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
                {selectedIndex + 1} / {images.length}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-black">
              <Carousel setApi={setDialogApi} opts={{ startIndex: selectedIndex }} className="w-full">
                <CarouselContent className="ml-0">
                  {images.map((url, index) => (
                    <CarouselItem key={`dialog-${url}-${index}`} className="pl-0">
                      <div className="flex items-center justify-center" style={{ aspectRatio: "16 / 10" }}>
                        <img src={url} alt={`${title} ampliada ${index + 1}`} className="max-h-[80vh] w-full object-contain" />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>

              {images.length > 1 ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute left-3 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full bg-white/10 text-white hover:bg-white/20"
                    onClick={() => selectIndex(Math.max(0, selectedIndex - 1))}
                    disabled={selectedIndex === 0}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-3 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full bg-white/10 text-white hover:bg-white/20"
                    onClick={() => selectIndex(Math.min(images.length - 1, selectedIndex + 1))}
                    disabled={selectedIndex === images.length - 1}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
