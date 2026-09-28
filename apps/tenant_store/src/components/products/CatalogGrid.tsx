"use client";
import { useMemo, useState } from "react";
import { PackageOpen, Search } from "lucide-react";
import { IProduct } from "@/api/productsApi";
import { ProductItem } from "@/components/products/Product_item";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "border-primary bg-primary/10 text-primary",
      )}
    >
      {children}
    </button>
  );
}

export default function CatalogGrid({ products }: { products: IProduct[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of products) {
      if (product.category) {
        map.set(String(product.category.id), product.category.name);
      }
    }
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory =
        category === "all" || String(product.categoryId) === category;
      const matchesQuery =
        !q ||
        product.name.toLowerCase().includes(q) ||
        product.sku?.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [products, query, category]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products"
            className="pl-9"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={category === "all"}
              onClick={() => setCategory("all")}
            >
              All
            </FilterChip>
            {categories.map((item) => (
              <FilterChip
                key={item.id}
                active={category === item.id}
                onClick={() => setCategory(item.id)}
              >
                {item.name}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      {filtered.length ? (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => (
            <ProductItem key={product.id} {...product} />
          ))}
        </div>
      ) : (
        <div className="flex h-60 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-muted-foreground">
          <PackageOpen className="size-10" />
          <p>No products match your search.</p>
        </div>
      )}
    </div>
  );
}
