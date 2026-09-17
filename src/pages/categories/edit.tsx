"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "@refinedev/react-hook-form";
import type { HttpError } from "@refinedev/core";

import { EditView, EditViewHeader } from "@/components/refine-ui/views/edit-view";
import { CategoryForm } from "@/components/categories/category-form";
import {
  categorySchema,
  type CategoryFormValues,
} from "@/components/categories/category-schema";
import type { Category } from "@/types/category";

export const CategoriesEdit = () => {
  const form = useForm<Category, HttpError, CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    refineCoreProps: {
      resource: "categories",
      action: "edit",
      redirect: "list",
    },
  });

  return (
    <EditView>
      <EditViewHeader />
      <CategoryForm
        form={form}
        onSubmit={form.refineCore.onFinish}
        isSubmitting={form.refineCore.formLoading}
        submitLabel="Save changes"
      />
    </EditView>
  );
};

CategoriesEdit.displayName = "CategoriesEdit";
