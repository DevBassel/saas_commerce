"use client";

import { useMemo, useRef, useState } from "react";
import { useInvalidate, useNotification } from "@refinedev/core";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { productsApi } from "@/api/products.api";
import { toApiError } from "@/api/client";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILES_PER_REQUEST,
  MAX_FILE_SIZE,
} from "@/constants/products";
import type { Product, ProductImage } from "@/types/product";

const sortByPosition = (images: ProductImage[]): ProductImage[] =>
  [...images].sort((a, b) => a.position - b.position);

const buildSignature = (images: ProductImage[]): string =>
  images.map((image) => `${image.id}:${image.position}`).join("|");

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const ProductImagesManager = ({
  productId,
  images,
}: {
  productId: number;
  images: ProductImage[];
}) => {
  const incomingSignature = useMemo(() => buildSignature(images), [images]);
  const [sync, setSync] = useState(() => ({
    signature: incomingSignature,
    items: sortByPosition(images),
  }));

  // Re-sync only when the server-provided images actually change (render-phase
  // adjustment), instead of overwriting optimistic state on every render.
  // Optimistic updates keep `signature` unchanged so they are not clobbered.
  if (sync.signature !== incomingSignature) {
    setSync({ signature: incomingSignature, items: sortByPosition(images) });
  }

  const items = sync.items;

  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { open } = useNotification();
  const invalidate = useInvalidate();

  const refreshProduct = () =>
    invalidate({
      resource: "products",
      id: productId,
      invalidates: ["list", "detail"],
    });

  const applyProduct = (product: Product) => {
    const next = sortByPosition(product.images ?? []);
    setSync((previous) => ({ ...previous, items: next }));
  };

  const handleSelectFiles = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    if (files.length > MAX_FILES_PER_REQUEST) {
      open?.({
        type: "error",
        message: "Too many files",
        description: `A maximum of ${MAX_FILES_PER_REQUEST} files can be uploaded per request.`,
      });
      return;
    }

    const tooLarge = files.find((file) => file.size > MAX_FILE_SIZE);
    if (tooLarge) {
      open?.({
        type: "error",
        message: "File too large",
        description: `${tooLarge.name} exceeds the maximum size of ${formatSize(
          MAX_FILE_SIZE,
        )}.`,
      });
      return;
    }

    const invalidType = files.find(
      (file) => !ALLOWED_MIME_TYPES.includes(file.type),
    );
    if (invalidType) {
      open?.({
        type: "error",
        message: "Unsupported image type",
        description: `Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}.`,
      });
      return;
    }

    setUploading(true);
    try {
      const product = await productsApi.uploadImages(productId, files);
      applyProduct(product);
      refreshProduct();
      open?.({
        type: "success",
        message: "Images uploaded",
        description: `${files.length} image(s) added.`,
      });
    } catch (error) {
      open?.({
        type: "error",
        message: "Upload failed",
        description: toApiError(error).message,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imageId: number) => {
    setBusyId(imageId);
    try {
      const product = await productsApi.deleteImage(productId, imageId);
      applyProduct(product);
      refreshProduct();
      open?.({ type: "success", message: "Image deleted" });
    } catch (error) {
      open?.({
        type: "error",
        message: "Delete failed",
        description: toApiError(error).message,
      });
    } finally {
      setBusyId(null);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;

    const previous = items;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setSync((current) => ({ ...current, items: next }));
    setReordering(true);
    try {
      const product = await productsApi.reorderImages(
        productId,
        next.map((image) => image.id),
      );
      applyProduct(product);
      refreshProduct();
    } catch (error) {
      setSync((current) => ({ ...current, items: previous }));
      open?.({
        type: "error",
        message: "Reorder failed",
        description: toApiError(error).message,
      });
    } finally {
      setReordering(false);
    }
  };

  const isBusy = uploading || reordering;

  return (
    <Card>
      <CardHeader
        className={cn("flex", "flex-row", "items-center", "justify-between")}
      >
        <CardTitle>Images</CardTitle>
        <Button
          type="button"
          variant="outline"
          disabled={isBusy}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
          <span>Add images</span>
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_MIME_TYPES.join(",")}
          multiple
          hidden
          onChange={handleSelectFiles}
        />
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p
            className={cn(
              "py-8",
              "text-center",
              "text-sm",
              "text-muted-foreground",
            )}
          >
            No images yet. Add up to {MAX_FILES_PER_REQUEST} images per upload.
          </p>
        ) : (
          <div className={cn("grid", "gap-4", "sm:grid-cols-2")}>
            {items.map((image, index) => (
              <div
                key={image.id}
                className={cn("overflow-hidden", "rounded-md", "border")}
              >
                <div className={cn("relative", "aspect-square", "bg-muted")}>
                  <img
                    src={image.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className={cn("h-full", "w-full", "object-cover")}
                  />
                  <span
                    className={cn(
                      "absolute",
                      "left-2",
                      "top-2",
                      "rounded",
                      "bg-background/80",
                      "px-1.5",
                      "py-0.5",
                      "text-xs",
                      "font-medium",
                    )}
                  >
                    #{index + 1}
                  </span>
                  <span
                    className={cn(
                      "absolute",
                      "bottom-1",
                      "right-1",
                      "rounded",
                      "bg-background/80",
                      "px-1.5",
                      "py-0.5",
                      "text-xs",
                      "font-medium",
                    )}
                  >
                    {formatSize(image.sizeBytes)}
                  </span>
                </div>
                <div
                  className={cn(
                    "flex",
                    "items-center",
                    "justify-between",
                    "gap-1",
                    "p-2",
                  )}
                >
                  <div className={cn("flex", "items-center", "gap-1")}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isBusy || index === 0}
                      onClick={() => move(index, -1)}
                      aria-label="Move image up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isBusy || index === items.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label="Move image down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isBusy || busyId === image.id}
                      onClick={() => handleDelete(image.id)}
                      aria-label="Delete image"
                    >
                      {busyId === image.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className={cn("h-4 w-4", "text-destructive")} />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

ProductImagesManager.displayName = "ProductImagesManager";
