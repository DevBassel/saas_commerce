import { apiClient } from "./client";
import type { Product } from "@/types/product";

export const productsApi = {
  uploadImages: async (
    productId: number,
    files: File[]
  ): Promise<Product> => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    const response = await apiClient.post<Product>(
      `products/${productId}/images`,
      formData
    );
    return response.data;
  },

  deleteImage: async (productId: number, imageId: number): Promise<Product> => {
    const response = await apiClient.delete<Product>(
      `products/${productId}/images/${imageId}`
    );
    return response.data;
  },

  reorderImages: async (
    productId: number,
    imageIds: number[]
  ): Promise<Product> => {
    const response = await apiClient.patch<Product>(
      `products/${productId}/images/order`,
      { imageIds }
    );
    return response.data;
  },
};
