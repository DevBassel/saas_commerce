import { useEffect, useMemo, useRef, useState } from "react";
import { useInvalidate, useNotification } from "@refinedev/core";

import { productsApi } from "@/api/products.api";
import { toApiError } from "@/api/client";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILES_PER_REQUEST,
  MAX_FILE_SIZE,
} from "@/constants/products";
import { OptimizeImgs } from "@/lib/optimize-image";
import type { Product, ProductImage } from "@/types/product";

type UseProductImagesManagerProps = {
  productId: number;
  images: ProductImage[];
};

export type ProductImagesManagerController = {
  items: ProductImage[];
  uploading: boolean;
  uploadStatus: ProductImageUploadStatus | null;
  selectedImageIds: number[];
  deleting: boolean;
  deleteDialogOpen: boolean;
  isBusy: boolean;
  selectFiles: (files: File[]) => Promise<void>;
  moveImage: (index: number, direction: -1 | 1) => Promise<void>;
  toggleImageSelection: (imageId: number) => void;
  requestDeleteSelected: () => void;
  cancelDelete: () => void;
  handleDeleteDialogOpenChange: (open: boolean) => void;
  confirmDeleteImages: () => Promise<void>;
};

type ProductImageUploadStage = "optimizing" | "uploading";

export type ProductImageUploadStatus = {
  stage: ProductImageUploadStage;
  previews: Array<{
    id: string;
    name: string;
    url: string;
    sizeBytes: number;
  }>;
  loadedBytes: number;
  totalBytes: number;
};

const sortByPosition = (images: ProductImage[]): ProductImage[] =>
  [...images].sort((a, b) => a.position - b.position);

const buildSignature = (images: ProductImage[]): string =>
  images.map((image) => `${image.id}:${image.position}`).join("|");

export const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const useProductImagesManager = ({
  productId,
  images,
}: UseProductImagesManagerProps): ProductImagesManagerController => {
  const incomingSignature = useMemo(() => buildSignature(images), [images]);
  const [items, setItems] = useState(() => sortByPosition(images));
  const [selectedImageIds, setSelectedImageIds] = useState<number[]>([]);
  const lastSignatureRef = useRef(incomingSignature);

  // Re-sync only when the server-provided images actually change. Optimistic
  // updates keep the signature unchanged, so they are not clobbered.
  useEffect(() => {
    if (lastSignatureRef.current === incomingSignature) return;
    lastSignatureRef.current = incomingSignature;
    setItems(sortByPosition(images));
    const imageIds = new Set(images.map((image) => image.id));
    setSelectedImageIds((current) =>
      current.filter((imageId) => imageIds.has(imageId)),
    );
  }, [incomingSignature, images]);

  const [uploadStatus, setUploadStatus] =
    useState<ProductImageUploadStatus | null>(null);
  const previewUrlsRef = useRef<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reordering, setReordering] = useState(false);

  const { open } = useNotification();
  const invalidate = useInvalidate();

  useEffect(
    () => () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  const refreshProduct = () =>
    invalidate({
      resource: "products",
      id: productId,
      invalidates: ["list", "detail"],
    });

  const applyProduct = (product: Product) => {
    setItems(sortByPosition(product.images ?? []));
  };

  const replaceUploadPreviews = (
    files: File[],
    stage: ProductImageUploadStage,
  ) => {
    const previews = files.map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`,
      name: file.name,
      url: URL.createObjectURL(file),
      sizeBytes: file.size,
    }));

    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current = previews.map((preview) => preview.url);
    setUploadStatus({
      stage,
      previews,
      loadedBytes: 0,
      totalBytes: files.reduce((total, file) => total + file.size, 0),
    });
  };

  const clearUploadStatus = () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current = [];
    setUploadStatus(null);
  };

  const selectFiles = async (files: File[]) => {
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

    replaceUploadPreviews(files, "optimizing");
    try {
      const optimizedFiles = await OptimizeImgs(files);
      replaceUploadPreviews(optimizedFiles, "uploading");
      const product = await productsApi.uploadImages(
        productId,
        optimizedFiles,
        ({ loaded, total }) => {
          setUploadStatus((current) => {
            if (!current || current.stage !== "uploading") return current;

            const totalBytes = total ?? current.totalBytes;
            return {
              ...current,
              loadedBytes:
                totalBytes > 0 ? Math.min(loaded, totalBytes) : loaded,
              totalBytes,
            };
          });
        },
      );
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
      clearUploadStatus();
    }
  };

  const confirmDeleteImages = async () => {
    const imageIds = [...selectedImageIds];
    if (imageIds.length === 0) return;

    const deletedIds: number[] = [];
    let latestProduct: Product | null = null;
    setDeleting(true);
    try {
      for (const imageId of imageIds) {
        latestProduct = await productsApi.deleteImage(productId, imageId);
        deletedIds.push(imageId);
      }

      if (latestProduct) applyProduct(latestProduct);
      setSelectedImageIds([]);
      refreshProduct();
      open?.({
        type: "success",
        message: imageIds.length === 1 ? "Image deleted" : "Images deleted",
        description: `${imageIds.length} image(s) removed.`,
      });
    } catch (error) {
      if (latestProduct) applyProduct(latestProduct);
      if (deletedIds.length > 0) {
        const deletedIdSet = new Set(deletedIds);
        setSelectedImageIds((current) =>
          current.filter((imageId) => !deletedIdSet.has(imageId)),
        );
      }
      refreshProduct();
      open?.({
        type: "error",
        message:
          deletedIds.length > 0 ? "Some images deleted" : "Delete failed",
        description:
          deletedIds.length > 0
            ? `${deletedIds.length} image(s) were deleted before the request failed. ${toApiError(error).message}`
            : toApiError(error).message,
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const toggleImageSelection = (imageId: number) => {
    setSelectedImageIds((current) =>
      current.includes(imageId)
        ? current.filter((id) => id !== imageId)
        : [...current, imageId],
    );
  };

  const requestDeleteSelected = () => {
    if (selectedImageIds.length > 0) setDeleteDialogOpen(true);
  };

  const moveImage = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;

    const previous = items;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    setReordering(true);
    try {
      const product = await productsApi.reorderImages(
        productId,
        next.map((image) => image.id),
      );
      applyProduct(product);
      refreshProduct();
    } catch (error) {
      setItems(previous);
      open?.({
        type: "error",
        message: "Reorder failed",
        description: toApiError(error).message,
      });
    } finally {
      setReordering(false);
    }
  };

  const cancelDelete = () => setDeleteDialogOpen(false);
  const handleDeleteDialogOpenChange = (next: boolean) => {
    if (!deleting) setDeleteDialogOpen(next);
  };

  return {
    items,
    uploading: uploadStatus !== null,
    uploadStatus,
    selectedImageIds,
    deleting,
    deleteDialogOpen,
    isBusy: uploadStatus !== null || reordering || deleting,
    selectFiles,
    moveImage,
    toggleImageSelection,
    requestDeleteSelected,
    cancelDelete,
    handleDeleteDialogOpenChange,
    confirmDeleteImages,
  };
};
