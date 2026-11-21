"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ShoppingCart } from "lucide-react";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { buttonVariants } from "@/components/ui/button";
import { withTenantParam } from "@/lib/tenant/url";
import { cn } from "@/lib/utils";

interface HeroSectionProps {
  tenantParam: string | null;
}

interface HeroSlideButton {
  label: string;
  href: string;
  variant: "default" | "outline";
}

interface HeroSlide {
  title: string;
  paragraph: string;
  backgroundImage: string;
  buttons:
    | readonly []
    | readonly [HeroSlideButton]
    | readonly [HeroSlideButton, HeroSlideButton];
}

const heroSlides = [
  {
    title: "Everything you need, all in one place.",
    paragraph:
      "Discover products you'll love, explore our latest collections, and enjoy a seamless shopping experience.",
    backgroundImage: "/assets/langing/hero_section_bg.png",
    buttons: [
      { label: "Explore Products", href: "/products", variant: "default" },
      { label: "View Your Cart", href: "/cart", variant: "outline" },
    ],
  },
  {
    title: "Fresh arrivals, ready to discover.",
    paragraph:
      "See what just landed and find standout products selected for the new season.",
    backgroundImage: "/assets/langing/hero_section_bg.png",
    buttons: [
      {
        label: "Shop New Arrivals",
        href: "/products?sortBy=createdAt&sortOrder=desc",
        variant: "default",
      },
      { label: "Browse All", href: "/products", variant: "outline" },
    ],
  },
  {
    title: "Your next favorite is waiting.",
    paragraph:
      "Find everyday essentials and inspired picks designed to fit every moment.",
    backgroundImage: "/assets/langing/hero_section_bg.png",
    buttons: [
      { label: "Explore Collections", href: "/products", variant: "default" },
      { label: "View Your Cart", href: "/cart", variant: "outline" },
    ],
  },
  {
    title: "From discovery to checkout, effortlessly.",
    paragraph:
      "Browse with confidence, save your picks, and keep every order within easy reach.",
    backgroundImage: "/assets/langing/hero_section_bg.png",
    buttons: [
      { label: "Start Shopping", href: "/products", variant: "default" },
      { label: "View Orders", href: "/orders", variant: "outline" },
    ],
  },
] as const satisfies readonly HeroSlide[];

export function HeroSection({ tenantParam }: HeroSectionProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReduceMotion(mediaQuery.matches);

    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);
    return () =>
      mediaQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    if (!api) return;

    const updateCurrentSlide = () => setCurrentSlide(api.selectedScrollSnap());
    updateCurrentSlide();
    api.on("select", updateCurrentSlide);
    api.on("reInit", updateCurrentSlide);

    return () => {
      api.off("select", updateCurrentSlide);
      api.off("reInit", updateCurrentSlide);
    };
  }, [api]);

  return (
    <Carousel
      setApi={setApi}
      opts={{ loop: true, duration: reduceMotion ? 0 : 24 }}
      className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-sm dark:shadow-none"
      aria-label="Featured store promotions"
    >
      <h1 className="sr-only">Featured products and collections</h1>
      <CarouselContent className="ml-0">
        {heroSlides.map((slide, index) => (
          <CarouselItem
            key={slide.title}
            className="pl-0 text-2xl!"
            aria-label={`${index + 1} of ${heroSlides.length}`}
          >
            <section className="relative isolate grid  h-[80dvh] overflow-hidden bg-card  lg:grid-cols-[minmax(0,42%)_minmax(0,58%)]">
              <Image
                src={slide.backgroundImage}
                alt=""
                fill
                priority={index === 0}
                className="h-full w-full object-cover  lg:object-center"
              />
              <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-card via-card/95 to-transparent lg:hidden" />
              <div className="pointer-events-none absolute inset-0 hidden bg-linear-to-r from-card via-card/95 to-transparent lg:block" />
              <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/30 via-transparent to-transparent" />

              <div className="relative z-10 flex flex-col justify-start px-6 py-10 pb-72 sm:px-10 sm:py-12 sm:pb-80 lg:justify-center lg:px-12 lg:py-16">
                <h2 className="mt-5 max-w-xl text-balance text-4xl leading-[1.05] font-bold tracking-tight text-card-foreground ">
                  {slide.title}
                </h2>

                <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
                  {slide.paragraph}
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  {slide.buttons.map((button) => (
                    <Link
                      key={`${slide.title}-${button.label}`}
                      href={withTenantParam(button.href, tenantParam)}
                      className={cn(
                        buttonVariants({
                          variant: button.variant,
                          size: "lg",
                        }),
                        "h-11 w-full gap-2 px-5 motion-reduce:transition-none sm:w-auto",
                        button.variant === "default"
                          ? "shadow-sm shadow-primary/20"
                          : "border-border/80 bg-background/80 backdrop-blur-sm dark:bg-background/55",
                      )}
                    >
                      {button.href.startsWith("/cart") && (
                        <ShoppingCart className="size-4" aria-hidden="true" />
                      )}
                      {button.label}
                      {!button.href.startsWith("/cart") && (
                        <ArrowRight className="size-4" aria-hidden="true" />
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          </CarouselItem>
        ))}
      </CarouselContent>

      <div className="absolute bottom-5 left-3 z-20 flex items-center sm:left-5 lg:left-7">
        {heroSlides.map((slide, index) => (
          <button
            key={slide.title}
            type="button"
            onClick={() => api?.scrollTo(index)}
            className="group flex size-10 touch-manipulation cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label={`Go to slide ${index + 1}: ${slide.title}`}
            aria-current={currentSlide === index ? "true" : undefined}
          >
            <span
              className={cn(
                "h-2.5 rounded-full bg-white/45 shadow-sm transition-[width,background-color] group-hover:bg-white/75 motion-reduce:transition-none",
                currentSlide === index ? "w-8 bg-primary" : "w-2.5",
              )}
            />
          </button>
        ))}
      </div>

      <CarouselPrevious className="top-auto bottom-5 left-auto right-16 z-20 size-10 translate-y-0 border-white/20 bg-black/35 text-white backdrop-blur-sm hover:bg-black/55 hover:text-white disabled:opacity-40" />
      <CarouselNext className="top-auto right-5 bottom-5 z-20 size-10 translate-y-0 border-white/20 bg-black/35 text-white backdrop-blur-sm hover:bg-black/55 hover:text-white disabled:opacity-40" />

      <p className="sr-only" aria-live="polite">
        Slide {currentSlide + 1} of {heroSlides.length}:{" "}
        {heroSlides[currentSlide].title}
      </p>
    </Carousel>
  );
}
