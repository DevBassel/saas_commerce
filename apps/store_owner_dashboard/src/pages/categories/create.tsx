"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "@refinedev/react-hook-form";
import type { HttpError } from "@refinedev/core";

import {
  CreateView,
  CreateViewHeader,
} from "@/components/refine-ui/views/create-view";
import { CategoryForm } from "@/components/categories/category-form";
import {
  categorySchema,
  type CategoryFormValues,
} from "@/components/categories/category-schema";
import type { Category } from "@/types/category";

export const CategoriesCreate = () => {
  const form = useForm<Category, HttpError, CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    refineCoreProps: {
      resource: "categories",
      action: "create",
      redirect: "edit",
    },
    defaultValues: {
      name: "",
      slug: undefined,
      description: "",
      isActive: true,
    },
  });

  return (
    <CreateView>
      <CreateViewHeader />
      <CategoryForm
        form={form}
        onSubmit={form.refineCore.onFinish}
        isSubmitting={form.refineCore.formLoading}
        submitLabel="Create category"
      />
    </CreateView>
  );
};

CategoriesCreate.displayName = "CategoriesCreate";
