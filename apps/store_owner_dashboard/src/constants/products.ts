export const SKU_REGEX = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
export const SKU_MESSAGE =
  "must be alphanumeric, may contain hyphens/underscores, must start alphanumeric";

export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const MAX_FILES_PER_REQUEST = 5;
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
