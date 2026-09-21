"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "@refinedev/react-hook-form";
import type { HttpError } from "@refinedev/core";

import {
  CreateView,
  CreateViewHeader,
} from "@/components/refine-ui/views/create-view";
import { ProductForm } from "@/components/products/product-form";
import {
  productSchema,
  type ProductFormValues,
} from "@/components/products/product-schema";
import type { Product } from "@/types/product";

export const ProductsCreate = () => {
  const form = useForm<Product, HttpError, ProductFormValues>({
    resolver: zodResolver(productSchema),
    refineCoreProps: {
      resource: "products",
      action: "create",
      redirect: "edit",
    },
    defaultValues: {
      name: "",
      sku: "",
      description: "",
      price: 0,
      stock: 0,
      isActive: true,
      categoryId: null,
    },
  });

  return (
    <CreateView>
      <CreateViewHeader />
      <ProductForm
        form={form}
        onSubmit={form.refineCore.onFinish}
        isSubmitting={form.refineCore.formLoading}
        submitLabel="Create product"
      />
    </CreateView>
  );
};

ProductsCreate.displayName = "ProductsCreate";
