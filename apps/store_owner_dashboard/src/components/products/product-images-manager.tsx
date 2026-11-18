"use client";

import { useRef, type ChangeEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ImagePlus,
  Loader2,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILES_PER_REQUEST,
} from "@/constants/products";
import type { ProductImage } from "@/types/product";
import {
  formatSize,
  useProductImagesManager,
  type ProductImagesManagerController,
} from "@/hooks/use-product-images-manager";

type ProductImagesManagerProps = {
  productId: number;
  images: ProductImage[];
};

export const ProductImagesManager = ({
  productId,
  images,
}: ProductImagesManagerProps) => {
  const controller = useProductImagesManager({ productId, images });

  return <ProductImagesManagerView {...controller} />;
};

export const ProductImagesManagerView = ({
  items,
  uploading,
  uploadStatus,
  selectedImageIds,
  deleting,
  deleteDialogOpen,
  isBusy,
  selectFiles,
  moveImage,
  toggleImageSelection,
  requestDeleteSelected,
  cancelDelete,
  handleDeleteDialogOpenChange,
  confirmDeleteImages,
}: ProductImagesManagerController) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadPercent =
    uploadStatus?.stage === "uploading" && uploadStatus.totalBytes > 0
      ? Math.round(
          Math.min(
            100,
            (uploadStatus.loadedBytes / uploadStatus.totalBytes) * 100,
          ),
        )
      : 0;

  const handleSelectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void selectFiles(files);
  };

  return (
    <>
      <Card>
        <CardHeader
          className={cn(
            "flex",
            "flex-row",
            "flex-wrap",
            "items-center",
            "justify-between",
            "gap-2",
          )}
        >
          <CardTitle>Images</CardTitle>
          <div
            className={cn(
              "flex",
              "flex-wrap",
              "items-center",
              "justify-end",
              "gap-2",
            )}
          >
            <Button
              type="button"
              variant="destructive"
              disabled={isBusy || selectedImageIds.length === 0}
              onClick={requestDeleteSelected}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              <span>
                {selectedImageIds.length > 0
                  ? `Delete (${selectedImageIds.length})`
                  : "Delete"}
              </span>
            </Button>
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
              <span>{uploading ? "Uploading..." : "Add images"}</span>
            </Button>
          </div>
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
          {uploadStatus ? (
            <div
              className={cn(
                "mb-4",
                "rounded-md",
                "border",
                "bg-muted/30",
                "p-3",
              )}
              aria-live="polite"
            >
              <div
                className={cn(
                  "mb-2",
                  "flex",
                  "items-center",
                  "justify-between",
                  "gap-3",
                )}
              >
                <div>
                  <p className={cn("text-sm", "font-medium")}>
                    {uploadStatus.stage === "optimizing"
                      ? "Optimizing images"
                      : "Uploading images"}
                  </p>
                  <p className={cn("text-xs", "text-muted-foreground")}>
                    {uploadStatus.stage === "optimizing"
                      ? `${uploadStatus.previews.length} image(s), ${formatSize(uploadStatus.totalBytes)}`
                      : `${formatSize(uploadStatus.loadedBytes)} of ${formatSize(uploadStatus.totalBytes)}`}
                  </p>
                </div>
                <span className={cn("text-sm", "font-medium")}>
                  {uploadStatus.stage === "uploading"
                    ? `${uploadPercent}%`
                    : "Preparing"}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={
                  uploadStatus.stage === "optimizing"
                    ? "Optimizing selected images"
                    : "Uploading selected images"
                }
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={
                  uploadStatus.stage === "uploading"
                    ? uploadPercent
                    : undefined
                }
                className={cn(
                  "mb-3",
                  "h-2",
                  "overflow-hidden",
                  "rounded-full",
                  "bg-secondary",
                )}
              >
                <div
                  className={cn(
                    "h-full",
                    "rounded-full",
                    "bg-primary",
                    "transition-[width]",
                    uploadStatus.stage === "optimizing" && "animate-pulse",
                  )}
                  style={{
                    width:
                      uploadStatus.stage === "optimizing"
                        ? "35%"
                        : `${uploadPercent}%`,
                  }}
                />
              </div>
              <div
                className={cn(
                  "grid",
                  "grid-cols-2",
                  "gap-2",
                  "sm:grid-cols-5",
                )}
              >
                {uploadStatus.previews.map((preview) => (
                  <div key={preview.id} className={cn("min-w-0")}>
                    <div
                      className={cn(
                        "relative",
                        "aspect-square",
                        "overflow-hidden",
                        "rounded-md",
                        "bg-muted",
                      )}
                    >
                      <img
                        src={preview.url}
                        alt={`Upload preview for ${preview.name}`}
                        className={cn("h-full", "w-full", "object-cover")}
                      />
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
                        {formatSize(preview.sizeBytes)}
                      </span>
                    </div>
                    <p
                      title={preview.name}
                      className={cn(
                        "mt-1",
                        "truncate",
                        "text-xs",
                        "text-muted-foreground",
                      )}
                    >
                      {preview.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {items.length === 0 && !uploadStatus ? (
            <p
              className={cn(
                "py-8",
                "text-center",
                "text-sm",
                "text-muted-foreground",
              )}
            >
              No images yet. Add up to {MAX_FILES_PER_REQUEST} images per
              upload.
            </p>
          ) : items.length > 0 ? (
            <div className={cn("grid", "gap-4", "sm:grid-cols-2")}>
              {items.map((image, index) => (
                <div
                  key={image.id}
                  className={cn(
                    "overflow-hidden",
                    "rounded-md",
                    "border",
                    selectedImageIds.includes(image.id) &&
                      "border-primary ring-2 ring-primary/20",
                  )}
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
                    <Button
                      type="button"
                      variant={
                        selectedImageIds.includes(image.id)
                          ? "default"
                          : "secondary"
                      }
                      size="icon"
                      disabled={isBusy}
                      onClick={() => toggleImageSelection(image.id)}
                      aria-label={
                        selectedImageIds.includes(image.id)
                          ? "Deselect image"
                          : "Select image for deletion"
                      }
                      aria-pressed={selectedImageIds.includes(image.id)}
                      className={cn(
                        "absolute",
                        "right-2",
                        "top-2",
                        "h-8",
                        "w-8",
                        "rounded-full",
                        "shadow-sm",
                      )}
                    >
                      {selectedImageIds.includes(image.id) ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <span
                          className={cn(
                            "h-4",
                            "w-4",
                            "rounded-full",
                            "border-2",
                            "border-current",
                          )}
                        />
                      )}
                    </Button>
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
                        onClick={() => moveImage(index, -1)}
                        aria-label="Move image up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={isBusy || index === items.length - 1}
                        onClick={() => moveImage(index, 1)}
                        aria-label="Move image down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={handleDeleteDialogOpenChange}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {selectedImageIds.length}{" "}
              {selectedImageIds.length === 1 ? "image" : "images"}?
            </DialogTitle>
            <DialogDescription>
              {selectedImageIds.length === 1
                ? "This image will be permanently removed from the product."
                : `These ${selectedImageIds.length} images will be permanently removed from the product.`}{" "}
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={cancelDelete}
            >
              Keep {selectedImageIds.length === 1 ? "image" : "images"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDeleteImages()}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Delete {selectedImageIds.length === 1 ? "image" : "images"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

ProductImagesManager.displayName = "ProductImagesManager";
ProductImagesManagerView.displayName = "ProductImagesManagerView";
