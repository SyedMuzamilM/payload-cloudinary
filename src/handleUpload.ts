import type { HandleUpload } from "@payloadcms/plugin-cloud-storage/types";
import type { CollectionConfig } from "payload";
import type { v2 as cloudinaryType } from "cloudinary";
import type { UploadApiOptions } from "cloudinary";
import type { CloudinaryVersioningOptions, PublicIDOptions } from "./types";

import path from "path";
import stream from "stream";
import { getResourceType } from "./utils";

interface Args {
  cloudinary: typeof cloudinaryType;
  collection: CollectionConfig;
  folder: string;
  prefix?: string;
  versioning?: CloudinaryVersioningOptions;
  publicID?: PublicIDOptions;
}

const getUploadOptions = (filename: string, versioning?: CloudinaryVersioningOptions): UploadApiOptions => {
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
const sanitizeForPublicID = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-') // Replace any character that's not a letter or number with a hyphen
    .replace(/-+/g, '-') // Replace consecutive hyphens with a single hyphen
    .replace(/^-|-$/g, ''); // Remove leading or trailing hyphens
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
  publicIDOptions?: PublicIDOptions
): string => {
  // If a custom generator function is provided, use it
  if (publicIDOptions?.generatePublicID) {
    return publicIDOptions.generatePublicID(filename, path.dirname(folderPath), path.basename(folderPath));
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
  
  const timestamp = uniqueFilename ? `_${Date.now()}` : '';
  
  if (useFilename) {
    // Use the filename as part of the public ID (sanitized)
    const filenameWithoutExt = path.basename(filename, path.extname(filename));
    const sanitizedFilename = sanitizeForPublicID(filenameWithoutExt);
    return path.posix.join(folderPath, `${sanitizedFilename}${timestamp}`);
  }
  
  // Generate a timestamp-based ID if not using filename
  return path.posix.join(folderPath, `media${timestamp}`);
};

export const getHandleUpload =
  ({ cloudinary, folder, prefix = "", versioning, publicID }: Args): HandleUpload =>
  async ({ data, file }) => {
    // Construct the folder path with proper handling of prefix
    const folderPath = data.prefix 
      ? path.posix.join(folder, data.prefix) 
      : path.posix.join(folder, prefix);
    
    // Generate the public ID based on options
    const publicIdValue = generatePublicID(file.filename, folderPath, publicID);
    
    const uploadOptions: UploadApiOptions = {
      ...getUploadOptions(file.filename, versioning),
      public_id: publicIdValue,
      folder: path.dirname(publicIdValue), // Extract folder from public_id
      use_filename: publicID?.useFilename !== false,
      unique_filename: publicID?.uniqueFilename !== false,
    };

    return new Promise((resolve, reject) => {
      try {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              console.error("Error uploading to Cloudinary:", error);
              reject(error);
              return;
            }

            if (result) {
              // Add metadata to the response including version information
              data.cloudinary = {
                public_id: result.public_id,
                resource_type: result.resource_type,
                format: result.format,
                secure_url: result.secure_url,
                bytes: result.bytes,
                created_at: result.created_at,
                version: result.version, // Add version information
                version_id: result.version_id, // Add version ID if available
                ...(result.resource_type === "video" && {
                  duration: result.duration,
                  width: result.width,
                  height: result.height,
                  eager: result.eager,
                }),
                ...(result.resource_type === "image" && {
                  width: result.width,
                  height: result.height,
                  format: result.format,
                }),
              };

              // If versioning and history storage is enabled, store version info
              if (versioning?.enabled && versioning?.storeHistory) {
                data.versions = data.versions || [];
                data.versions.push({
                  version: result.version,
                  version_id: result.version_id,
                  created_at: result.created_at,
                  secure_url: result.secure_url,
                });
              }
            }

            resolve(data);
          }
        );

        // Create readable stream from buffer or file
        const readableStream = new stream.Readable();
        readableStream.push(file.buffer);
        readableStream.push(null);

        // Pipe the readable stream to the upload stream
        readableStream.pipe(uploadStream);
      } catch (error) {
        console.error("Error in upload process:", error);
        reject(error);
      }
    });
  };
