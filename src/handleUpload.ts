import type { HandleUpload } from "@payloadcms/plugin-cloud-storage/types";
import type { CollectionConfig } from "payload";
import type { v2 as cloudinaryType } from "cloudinary";
import type { UploadApiOptions } from "cloudinary";
import type { CloudinaryVersioningOptions } from "./types";

import path from "path";
import stream from "stream";
import { getResourceType } from "./utils";

interface Args {
  cloudinary: typeof cloudinaryType;
  collection: CollectionConfig;
  folder: string;
  prefix?: string;
  versioning?: CloudinaryVersioningOptions;
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

export const getHandleUpload =
  ({ cloudinary, folder, prefix = "", versioning }: Args): HandleUpload =>
  async ({ data, file }) => {
    // Construct the folder path with proper handling of prefix
    const folderPath = data.prefix 
      ? path.posix.join(folder, data.prefix) 
      : path.posix.join(folder, prefix);
    
    const filePath = path.posix.join(folderPath, file.filename);
    const uploadOptions: UploadApiOptions = {
      ...getUploadOptions(file.filename, versioning),
      public_id: filePath.replace(/\.[^/.]+$/, ""), // Remove file extension
      folder: folderPath, // Explicitly set the folder
      use_filename: true,
      unique_filename: true,
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
