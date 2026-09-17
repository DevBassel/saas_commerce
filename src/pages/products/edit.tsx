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

  const record = form.refineCore.query?.data?.data;

  return (
    <EditView>
      <EditViewHeader />
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
    </EditView>
  );
};

ProductsEdit.displayName = "ProductsEdit";
