import type { HandleUpload } from "@payloadcms/plugin-cloud-storage/types";
import type { CollectionConfig } from "payload";
import type { v2 as cloudinaryType, UploadApiErrorResponse, UploadApiResponse } from "cloudinary"; // Import specific error type
import type { UploadApiOptions } from "cloudinary";
import type { CloudinaryVersioningOptions, PublicIDOptions } from "./types";

import path from "path";
import stream from "stream";
import { getResourceType } from "./utils"; // Assuming getResourceType is in utils

interface Args {
  cloudinary: typeof cloudinaryType;
  collection: CollectionConfig;
  folder: string; // This is the base folder from plugin options
  prefix?: string; // This is args.prefix (collection-level prefix)
  versioning?: CloudinaryVersioningOptions;
  publicID?: PublicIDOptions;
}

const getUploadOptions = (filename: string, versioning?: CloudinaryVersioningOptions): UploadApiOptions => {
  const ext = path.extname(filename).toLowerCase();
  const resourceType = getResourceType(ext); // getResourceType needs file extension
  const baseOptions: UploadApiOptions = {
    resource_type: resourceType,
    use_filename: true,
    unique_filename: true,
    // If versioning is enabled, add invalidate option
    ...(versioning?.autoInvalidate && { invalidate: true }),
  };

  switch (resourceType) {
    case "video":
      return {
        ...baseOptions,
        chunk_size: 6000000,
        eager: [{ format: ext.slice(1), quality: "auto" }],
        eager_async: true,
      };
    case "image":
      return {
        ...baseOptions,
        eager: [{ quality: "auto" }],
        eager_async: true,
      };
    case "raw":
      // For PDFs, add a pages parameter to count the pages and create a thumbnail
      if (ext === '.pdf') {
        return {
          ...baseOptions,
          resource_type: "raw", // Explicitly set for PDF
          use_filename: true,
          pages: true,
          eager: [{ format: 'jpg', page: 1, quality: "auto" }],
          eager_async: true,
        };
      }
      return {
        ...baseOptions,
        resource_type: "raw",
        use_filename: true,
      };
    default:
      return baseOptions;
  }
};

/**
 * Sanitize a string to be used as part of a public ID
 * @param str String to sanitize
 * @returns Sanitized string
 */
export const sanitizeForPublicID = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '-') // Allow letters, numbers, underscore, dot, hyphen. Replace others with hyphen.
    .replace(/-+/g, '-')      // Replace consecutive hyphens with a single hyphen
    .replace(/^-|-$/g, '');   // Remove leading or trailing hyphens
    // Note: Dots are allowed by Cloudinary in public_ids, so we don't strip them here.
};

/**
 * Generate a public ID based on the publicID options
 * @param filename Original filename
 * @param folderPath Folder path
 * @param resourceType Resource type ('image', 'video', 'raw', 'auto')
 * @param publicIDOptions Public ID options
 * @returns Generated public ID
 */
export const generatePublicID = (
  filename: string,
  folderPath: string,
  resourceType: string,
  publicIDOptions?: PublicIDOptions
): string => {
  // If a custom generator function is provided, use it
  if (publicIDOptions?.generatePublicID) {
    return publicIDOptions.generatePublicID(filename, path.dirname(folderPath), path.basename(folderPath));
  }

  const shouldKeepExtension = publicIDOptions?.keepRawExtension === true && resourceType === 'raw';
  let finalNamePart: string;

  if (publicIDOptions?.enabled === false) {
    // Custom public_id generation is disabled by user, but we still need to process the name
    const nameToProcess = path.basename(filename);
    if (shouldKeepExtension) {
      const ext = path.extname(nameToProcess);
      const nameWithoutExt = path.basename(nameToProcess, ext);
      // Sanitize only the name part, then append the original (unsanitized) extension
      finalNamePart = sanitizeForPublicID(nameWithoutExt) + ext;
    } else {
      const nameWithoutExt = path.basename(nameToProcess, path.extname(nameToProcess));
      finalNamePart = sanitizeForPublicID(nameWithoutExt);
    }
    return path.posix.join(folderPath, finalNamePart);
  }

  // Default behavior or publicIDOptions.enabled is true/undefined
  const useFilename = publicIDOptions?.useFilename !== false;
  const uniqueFilename = publicIDOptions?.uniqueFilename !== false;
  const timestamp = uniqueFilename ? `_${Date.now()}` : '';

  if (useFilename) {
    const nameToProcess = path.basename(filename);
    let baseNameSegment: string;

    if (shouldKeepExtension) {
      const ext = path.extname(nameToProcess);
      const nameWithoutExt = path.basename(nameToProcess, ext);
      // Sanitize only the name part, then append the original (unsanitized) extension
      baseNameSegment = sanitizeForPublicID(nameWithoutExt) + ext;
    } else {
      const nameWithoutExt = path.basename(nameToProcess, path.extname(nameToProcess));
      baseNameSegment = sanitizeForPublicID(nameWithoutExt);
    }
    // Correctly apply timestamp to the base name segment
    finalNamePart = `${baseNameSegment}${timestamp}`;
  } else {
    // Not using filename, keepRawExtension is ignored here
    // Also, apply timestamp if uniqueFilename is true
    finalNamePart = `media${timestamp}`;
  }
  return path.posix.join(folderPath, finalNamePart);
};

/**
 * Check if a file is a PDF based on its file extension
 */
const isPDF = (filename: string): boolean => {
  const ext = path.extname(filename).toLowerCase();
  return ext === '.pdf';
};

/**
 * Get PDF page count from Cloudinary
 */
const getPDFPageCount = async (
  cloudinary: typeof cloudinaryType,
  publicId: string,
  defaultCount = 1
): Promise<number> => {
  try {
    const pdfInfo = await cloudinary.api.resource(publicId, {
      resource_type: 'raw',
      pages: true
    });
    if (pdfInfo && pdfInfo.pages) {
      return pdfInfo.pages;
    }
  } catch (error) {
    console.error("Error getting PDF page count:", error);
  }
  return defaultCount;
};

export const getHandleUpload =
  ({ cloudinary, folder, prefix = "", versioning, publicID }: Args): HandleUpload =>
  async ({ data, file }) => {
    let chosenPrefixValue: string | undefined = undefined;
    let prefixSource: 'doc' | 'collection' | 'none' = 'none';

    if (data.prefix && typeof data.prefix === 'string' && data.prefix.trim() !== '') {
      chosenPrefixValue = data.prefix.trim();
      prefixSource = 'doc';
    } else if (prefix && prefix.trim() !== '') {
      chosenPrefixValue = prefix.trim();
      prefixSource = 'collection';
    }

    const folderPath = chosenPrefixValue
      ? path.posix.join(folder, chosenPrefixValue)
      : folder;

    // Determine resourceType early
    const fileExtension = path.extname(file.filename).toLowerCase();
    const resourceType = getResourceType(fileExtension); // getResourceType needs file extension

    // Generate the public ID based on options, now including resourceType
    const publicIdValue = generatePublicID(file.filename, folderPath, resourceType, publicID);

    // --- DIAGNOSTIC LOGGING ---
    console.log(`[CloudinaryUpload] Base folder from plugin options: "${folder}"`);
    if (prefixSource === 'doc') {
      console.log(`[CloudinaryUpload] Using prefix from document field "prefix": "${chosenPrefixValue}"`);
    } else if (prefixSource === 'collection') {
      console.log(`[CloudinaryUpload] Using prefix from collection configuration: "${chosenPrefixValue}"`);
    } else {
      console.log('[CloudinaryUpload] No prefix defined or used (neither in document field nor collection config).');
    }
    console.log(`[CloudinaryUpload] Target Cloudinary folderPath for asset_folder & public_id base: "${folderPath}"`);
    console.log(`[CloudinaryUpload] Determined resourceType for file "${file.filename}": "${resourceType}"`);
    console.log(`[CloudinaryUpload] Generated public_id for Cloudinary: "${publicIdValue}"`);
    // --- END DIAGNOSTIC LOGGING ---

    const uploadOptions: UploadApiOptions = {
      ...getUploadOptions(file.filename, versioning), // getUploadOptions also determines resource_type for the API call
      public_id: publicIdValue,
      use_filename: publicID?.useFilename !== false,
      unique_filename: publicID?.uniqueFilename !== false,
      asset_folder: folderPath,
    };

    return new Promise((resolve, reject) => {
      try {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          async (error?: UploadApiErrorResponse, result?: UploadApiResponse) => { // Add types for error and result
            if (error) {
              // Log the full original error first
              console.error("[CloudinaryUpload] Full Cloudinary upload error:", error);

              // Check for file size limit error indicators
              if (error.http_code && (error.http_code === 400 || error.http_code === 413) && 
                  error.message && /size|limit|large/i.test(error.message)) {
                console.error(`[CloudinaryUpload] Friendly Error: Upload likely failed due to file size limits. 
                Cloudinary message: "${error.message}". 
                Please check:
                1. Your Cloudinary account's file size restrictions (plan limits, per-file limits for specific resource types).
                2. Any request body size limits on your server or proxy if you are not uploading directly from the client (e.g., Nginx 'client_max_body_size', Node.js body parser limits).`);
              }
              reject(error); // Reject with the original error object
              return;
            }

            if (result) {
              const isPDFFile = isPDF(file.filename); // isPDF also uses file.filename
              const baseMetadata = {
                public_id: result.public_id,
                resource_type: result.resource_type, // This is Cloudinary's determined resource_type
                format: result.format,
                secure_url: result.secure_url,
                bytes: result.bytes,
                created_at: result.created_at,
                version: result.version ? String(result.version) : result.version,
                version_id: result.version_id,
              };

              let typeSpecificMetadata = {};
              if (result.resource_type === "video") {
                typeSpecificMetadata = {
                  duration: result.duration,
                  width: result.width,
                  height: result.height,
                  eager: result.eager,
                };
              } else if (result.resource_type === "image") {
                typeSpecificMetadata = {
                  width: result.width,
                  height: result.height,
                };
              } else if (isPDFFile) { // Check if original file was PDF
                let pageCount = 1;
                if (result.pages) {
                  pageCount = result.pages;
                } else {
                  pageCount = await getPDFPageCount(cloudinary, result.public_id);
                }
                typeSpecificMetadata = {
                  pages: pageCount,
                  selected_page: 1,
                  thumbnail_url: `https://res.cloudinary.com/${cloudinary.config().cloud_name}/image/upload/pg_1/q_auto,f_jpg/${result.public_id}.jpg`
                };
              }

              data.cloudinary = {
                ...baseMetadata,
                ...typeSpecificMetadata,
              };

              if (versioning?.enabled && versioning?.storeHistory) {
                data.versions = data.versions || [];
                data.versions.push({
                  version: result.version ? String(result.version) : "",
                  version_id: result.version_id || "",
                  created_at: result.created_at || new Date().toISOString(),
                  secure_url: result.secure_url || "",
                });
              }
            }
            resolve(data);
          }
        );

        const readableStream = new stream.Readable();
        readableStream.push(file.buffer);
        readableStream.push(null);
        readableStream.pipe(uploadStream);
      } catch (error) { // This catch block is for errors during stream creation or piping
        console.error("[CloudinaryUpload] Error in upload process (before Cloudinary stream):", error);
        reject(error);
      }
    });
  };
