"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

const Slider = SliderPrimitive.Root;

function SliderControl({ className, ...props }: SliderPrimitive.Control.Props) {
  return (
    <SliderPrimitive.Control
      data-slot="slider-control"
      className={cn(
        "relative flex min-h-11 w-full touch-none items-center select-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function SliderTrack({ className, ...props }: SliderPrimitive.Track.Props) {
  return (
    <SliderPrimitive.Track
      data-slot="slider-track"
      className={cn("relative h-1.5 w-full rounded-full bg-muted", className)}
      {...props}
    />
  );
}

function SliderIndicator({ className, ...props }: SliderPrimitive.Indicator.Props) {
  return (
    <SliderPrimitive.Indicator
      data-slot="slider-indicator"
      className={cn("rounded-full bg-primary", className)}
      {...props}
    />
  );
}

function SliderThumb({ className, ...props }: SliderPrimitive.Thumb.Props) {
  return (
    <SliderPrimitive.Thumb
      data-slot="slider-thumb"
      className={cn(
        "block size-5 shrink-0 cursor-grab rounded-full border border-primary bg-background shadow-sm ring-ring/40 transition-shadow before:absolute before:-inset-3 before:rounded-full hover:ring-4 focus-within:ring-4 active:cursor-grabbing data-disabled:pointer-events-none",
        className,
      )}
      {...props}
    />
  );
}

export { Slider, SliderControl, SliderTrack, SliderIndicator, SliderThumb };
