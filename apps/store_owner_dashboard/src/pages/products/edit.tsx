"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "@refinedev/react-hook-form";
import type { HttpError } from "@refinedev/core";

import { EditView, EditViewHeader } from "@/components/refine-ui/views/edit-view";
import { ProductForm } from "@/components/products/product-form";
import {
  productSchema,
  type ProductFormValues,
} from "@/components/products/product-schema";
import { ProductImagesManager } from "@/components/products/product-images-manager";
import { QueryErrorState } from "@/components/refine-ui/views/query-state";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/product";

export const ProductsEdit = () => {
  const form = useForm<Product, HttpError, ProductFormValues>({
    resolver: zodResolver(productSchema),
    refineCoreProps: {
      resource: "products",
      action: "edit",
      redirect: "list",
    },
  });

  const query = form.refineCore.query;
  const record = query?.data?.data;

  return (
    <EditView>
      <EditViewHeader />
      {query?.isLoading ? (
        <div className={cn("grid", "gap-6", "lg:grid-cols-[2fr_1fr]")}>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className={cn("flex", "flex-col", "gap-4")}>
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton
                  key={`skeleton-field-${index}`}
                  className="h-10 w-full"
                />
              ))}
            </CardContent>
          </Card>
        </div>
      ) : query?.isError ? (
        <QueryErrorState onRetry={() => void query.refetch()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <ProductForm
            form={form}
            onSubmit={form.refineCore.onFinish}
            isSubmitting={form.refineCore.formLoading}
            submitLabel="Save changes"
          />
          {record?.id ? (
            <ProductImagesManager
              productId={record.id}
              images={record.images ?? []}
            />
          ) : null}
        </div>
      )}
    </EditView>
  );
};

ProductsEdit.displayName = "ProductsEdit";
