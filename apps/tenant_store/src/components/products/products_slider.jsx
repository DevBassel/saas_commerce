import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { ProductItem } from "./Product_item";
import { getProducts } from "@/api/productsApi";
import { toApiError } from "@/api/handelError";
import ApiErrorFallback from "@/components/ApiErrorFallback";
import { PackageOpen } from "lucide-react";
import { apiClient } from "@/api/apiClient";

export async function ProductsSlider() {
  let products;
  let loadError = null;

  try {
    products = await getProducts(undefined, apiClient);
  } catch (error) {
    loadError = toApiError(error).message;
  }

  if (loadError) {
    return (
      <ApiErrorFallback
        compact
        title="Couldn't load products"
        message={loadError}
      />
    );
  }

  if (!products?.length) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-muted-foreground">
        <PackageOpen className="size-8" />
        <p className="text-sm">No products yet</p>
      </div>
    );
  }

  return (
    <Carousel
      className="w-[75%] md:w-full mx-auto"
      opts={{
        align: "start",
        loop: true,
      }}
    >
      <CarouselContent className="w-full">
        {products.map((item) => (
          <CarouselItem
            key={`${item.id}-${item.name}`}
            className="basis-1/1 md:basis-1/3 lg:basis-1/4"
          >
            <ProductItem {...item} />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="-left-7" />
      <CarouselNext className="-right-7" />
    </Carousel>
  );
}
