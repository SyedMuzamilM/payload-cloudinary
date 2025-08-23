import type { HandleUpload } from "@payloadcms/plugin-cloud-storage/types";
import type { CollectionConfig } from "payload";
import type { v2 as cloudinaryType } from "cloudinary";
import type { UploadApiOptions } from "cloudinary";
import type { CloudinaryVersioningOptions, PublicIDOptions } from "./types";

import path from "path";
import stream from "stream";
import { getResourceType } from "./utils";
import { validateFile, validatePublicId, sanitizeString } from "./validation";
import { CloudinaryUploadError, CloudinaryAPIError, defaultLogger, handleError, type Logger } from "./errors";

interface Args {
  cloudinary: typeof cloudinaryType;
  collection: CollectionConfig;
  folder: string;
  prefix?: string;
  versioning?: CloudinaryVersioningOptions;
  publicID?: PublicIDOptions;
  logger?: Logger;
}

const getUploadOptions = (
  filename: string,
  versioning?: CloudinaryVersioningOptions,
): UploadApiOptions => {
  const ext = path.extname(filename).toLowerCase();
  const resourceType = getResourceType(ext);
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
      if (ext === ".pdf") {
        return {
          ...baseOptions,
          resource_type: "raw",
          use_filename: true,
          // When uploading PDFs, add a parameter to extract page count
          pages: true,
          // Set an eager transformation to create a thumbnail of first page
          eager: [{ format: "jpg", page: 1, quality: "auto" }],
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
 * @deprecated Use sanitizeString from validation.ts instead
 */
const sanitizeForPublicID = (str: string): string => {
  return sanitizeString(str);
};

/**
 * Generate a public ID based on the publicID options
 * @param filename Original filename
 * @param folderPath Folder path
 * @param publicIDOptions Public ID options
 * @returns Generated public ID
 */
const generatePublicID = (
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
const isPDF = (filename: string): boolean => {
  const ext = path.extname(filename).toLowerCase();
  return ext === ".pdf";
};

/**
 * Get PDF page count from Cloudinary
 * This is a separate function to avoid async/await linter issues
 */
const getPDFPageCount = async (
  cloudinary: typeof cloudinaryType,
  publicId: string,
  resultPages?: number,
  logger: Logger = defaultLogger,
  defaultCount = 1,
): Promise<number> => {
  // Use result.pages if available to avoid API call
  if (resultPages && resultPages > 0) {
    logger.debug('Using PDF page count from upload result', { publicId, pages: resultPages });
    return resultPages;
  }

  try {
    logger.debug('Fetching PDF page count from Cloudinary API', { publicId });
    const pdfInfo = await cloudinary.api.resource(publicId, {
      resource_type: "raw",
      pages: true,
    });

    if (pdfInfo && pdfInfo.pages) {
      logger.debug('Successfully retrieved PDF page count', { publicId, pages: pdfInfo.pages });
      return pdfInfo.pages;
    }
  } catch (error) {
    logger.warn("Could not get PDF page count from Cloudinary", {
      publicId,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  logger.debug('Using default PDF page count', { publicId, defaultCount });
  return defaultCount;
};

export const getHandleUpload =
  ({
    cloudinary,
    folder,
    prefix = "",
    versioning,
    publicID,
    logger = defaultLogger,
  }: Args): HandleUpload =>
  async ({ data, file }) => {
    try {
      // Validate file before processing
      validateFile(file, {
        maxSize: 100 * 1024 * 1024, // 100MB - can be made configurable
        allowedExtensions: undefined // Use default extensions
      });

      logger.debug('Starting file upload process', {
        filename: file.filename,
        size: file.buffer.length,
        collection: 'media' // We could get this from context if needed
      });
    // Construct the folder path with proper handling of prefix
    const folderPath = data.prefix
      ? path.posix.join(folder, data.prefix)
      : path.posix.join(folder, prefix);

      // Generate the public ID based on options
      const publicIdValue = generatePublicID(file.filename, folderPath, publicID);
      
      // Validate the generated public ID
      validatePublicId(publicIdValue);

      logger.debug('Generated public ID for upload', {
        filename: file.filename,
        publicId: publicIdValue,
        folderPath
      });

      // Basic upload options
      const uploadOptions: UploadApiOptions = {
        ...getUploadOptions(file.filename, versioning),
        public_id: publicIdValue,
        // folder: path.dirname(publicIdValue), // Extract folder from public_id
        use_filename: publicID?.useFilename !== false,
        unique_filename: publicID?.uniqueFilename !== false,
        asset_folder: folderPath,
      };

      return new Promise((resolve, reject) => {
        try {
          logger.debug('Starting Cloudinary upload', { uploadOptions });
          
          const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            async (error, result) => {
              if (error) {
                const uploadError = new CloudinaryUploadError(
                  `Failed to upload file to Cloudinary: ${error.message}`,
                  error,
                  file.filename
                );
                logger.error("Error uploading to Cloudinary", {
                  filename: file.filename,
                  publicId: publicIdValue,
                  error: uploadError.toLogObject()
                });
                reject(uploadError);
                return;
              }

              if (result) {
                logger.info('File uploaded to Cloudinary successfully', {
                  filename: file.filename,
                  publicId: result.public_id,
                  resourceType: result.resource_type,
                  format: result.format,
                  bytes: result.bytes
                });

                const isPDFFile = isPDF(file.filename);
                const baseMetadata = {
                  public_id: result.public_id,
                  resource_type: result.resource_type,
                  format: result.format,
                  secure_url: result.secure_url,
                  bytes: result.bytes,
                  created_at: result.created_at,
                  // Ensure version is always stored as string to match field type
                  version: result.version
                    ? String(result.version)
                    : result.version,
                  version_id: result.version_id,
                };

              // Add metadata based on resource type
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
                } else if (isPDFFile) {
                  // Handle PDF specific metadata
                  let pageCount = 1;

                  // Use the optimized function that tries result.pages first
                  pageCount = await getPDFPageCount(
                    cloudinary,
                    result.public_id,
                    result.pages,
                    logger
                  );

                typeSpecificMetadata = {
                  pages: pageCount,
                  selected_page: 1, // Default to first page for thumbnails
                  // Generate a thumbnail URL for the PDF
                  thumbnail_url: `https://res.cloudinary.com/${cloudinary.config().cloud_name}/image/upload/pg_1/q_auto,f_jpg/${result.public_id}.jpg`,
                };
              }

              // Combine base and type-specific metadata
              data.cloudinary = {
                ...baseMetadata,
                ...typeSpecificMetadata,
              };

              // If versioning and history storage is enabled, store version info
              if (versioning?.enabled && versioning?.storeHistory) {
                data.versions = data.versions || [];
                data.versions.push({
                  // Store version as a string to match the field type expectation
                  version: result.version ? String(result.version) : "",
                  version_id: result.version_id || "",
                  created_at: result.created_at || new Date().toISOString(),
                  secure_url: result.secure_url || "",
                });
              }
            }

            resolve(data);
          },
        );

          // Use buffer directly instead of creating unnecessary stream
          uploadStream.end(file.buffer);
        } catch (error) {
          const uploadError = new CloudinaryUploadError(
            `Error in upload process: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error : undefined,
            file.filename
          );
          logger.error("Error in upload process", {
            filename: file.filename,
            error: uploadError.toLogObject()
          });
          reject(uploadError);
        }
      });
    } catch (error) {
      // Handle validation and other errors
      throw handleError(error, logger, 'handleUpload');
    }
  };
