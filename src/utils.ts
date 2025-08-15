import path from "path";

import {
  IMAGE_EXTENSIONS,
  RAW_EXTENSIONS,
  VIDEO_EXTENSIONS,
} from "./constants";
import { PublicIDOptions } from "./types";

export const getResourceType = (ext: string) => {
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (RAW_EXTENSIONS.includes(ext)) return "raw";
  return "auto"; // Default to auto for unknown types
};

/**
 * Sanitize a string to be used as part of a public ID
 * @param str String to sanitize
 * @returns Sanitized string
 */
const sanitizeForPublicID = (str: string): string => {
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

  // If publicID is disabled, just return the path without extension but with sanitization
  if (publicIDOptions?.enabled === false) {
    const filenameWithoutExt = path.basename(filename, path.extname(filename));
    const sanitizedFilename = sanitizeForPublicID(filenameWithoutExt);
    return path.posix.join(folderPath, sanitizedFilename);
  }

  // Default behavior - use filename (if enabled) and make it unique (if enabled)
  const useFilename = publicIDOptions?.useFilename !== false;
  const uniqueFilename = publicIDOptions?.uniqueFilename !== false;

  const timestamp = uniqueFilename ? `_${Date.now()}` : "";

  if (useFilename) {
    // Use the filename as part of the public ID (sanitized)
    const filenameWithoutExt = path.basename(filename, path.extname(filename));
    const sanitizedFilename = sanitizeForPublicID(filenameWithoutExt);
    return path.posix.join(folderPath, `${sanitizedFilename}${timestamp}`);
  }

  // Generate a timestamp-based ID if not using filename
  return path.posix.join(folderPath, `media${timestamp}`);
};

/**
 * Check if a file is a PDF based on its file extension
 */
export const isPDF = (filename: string): boolean => {
  const ext = path.extname(filename).toLowerCase();
  return ext === ".pdf";
};
