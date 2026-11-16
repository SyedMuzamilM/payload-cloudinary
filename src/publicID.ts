import path from "path";
import { getResourceType } from "./utils";
import type { PublicIDOptions } from "./types";

/**
 * Sanitize a string to be used as part of a public ID
 * @param str String to sanitize
 * @returns Sanitized string
 */
export const sanitizeForPublicID = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-") // Replace any character that's not a letter or number with a hyphen
    .replace(/-+/g, "-") // Replace consecutive hyphens with a single hyphen
    .replace(/^-|-$/g, ""); // Remove leading or trailing hyphens
};

/**
 * Generate a public ID based on the publicID options
 * @param filename Original filename
 * @param folderPath Folder path
 * @param publicIDOptions Public ID options
 * @returns Generated public ID
 */
export const generatePublicID = (
  filename: string,
  folderPath: string,
  publicIDOptions?: PublicIDOptions,
): string => {
  // If a custom generator function is provided, use it
  if (publicIDOptions?.generatePublicID) {
    return publicIDOptions.generatePublicID(
      filename,
      path.dirname(folderPath),
      path.basename(folderPath),
    );
  }

  // Get file extension and resource type
  const ext = path.extname(filename).toLowerCase();
  const resourceType = getResourceType(ext);
  const isRawFile = resourceType === "raw";

  // If publicID is disabled, just return the path with sanitization
  if (publicIDOptions?.enabled === false) {
    const filenameWithoutExt = path.basename(filename, path.extname(filename));
    const sanitizedFilename = sanitizeForPublicID(filenameWithoutExt);
    // For raw files, preserve the extension
    const finalFilename = isRawFile
      ? `${sanitizedFilename}${ext}`
      : sanitizedFilename;
    return path.posix.join(folderPath, finalFilename);
  }

  // Default behavior - use filename (if enabled) and make it unique (if enabled)
  const useFilename = publicIDOptions?.useFilename !== false;
  const uniqueFilename = publicIDOptions?.uniqueFilename !== false;

  const timestamp = uniqueFilename ? `_${Date.now()}` : "";

  if (useFilename) {
    // Use the filename as part of the public ID (sanitized)
    const filenameWithoutExt = path.basename(filename, path.extname(filename));
    const sanitizedFilename = sanitizeForPublicID(filenameWithoutExt);
    // For raw files, preserve the extension
    const finalFilename = isRawFile
      ? `${sanitizedFilename}${timestamp}${ext}`
      : `${sanitizedFilename}${timestamp}`;
    return path.posix.join(folderPath, finalFilename);
  }

  // Generate a timestamp-based ID if not using filename
  // For raw files, we need to preserve the extension even with generated IDs
  const finalFilename = isRawFile
    ? `media${timestamp}${ext}`
    : `media${timestamp}`;
  return path.posix.join(folderPath, finalFilename);
};
